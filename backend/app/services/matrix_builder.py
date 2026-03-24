import hashlib
import json
import math
import os
from pathlib import Path

import openrouteservice

from app.config import settings
from app.models.schemas import GroupedStop, OrderRecord

CACHE_DIR = Path(__file__).resolve().parent.parent.parent / ".matrix_cache"


def _haversine_distance_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate the great-circle distance between two points in km."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlng / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def _haversine_duration_seconds(dist_km: float, avg_speed_kmh: float = 25.0) -> float:
    """Estimate driving time in seconds for NYC urban driving."""
    return (dist_km / avg_speed_kmh) * 3600


def build_unique_locations_from_stops(
    stops: list[GroupedStop],
) -> tuple[list[tuple[float, float]], list[int]]:
    """
    Build a deduplicated list of (lng, lat) coordinates from grouped stops.
    Returns:
        unique_locations: list of (lng, lat) — index 0 is the depot
        stop_to_location: mapping from stop index to unique location index
    """
    # Index 0 = depot
    unique_locations = [(settings.DEPOT_LNG, settings.DEPOT_LAT)]
    coord_to_index: dict[tuple[float, float], int] = {
        (settings.DEPOT_LNG, settings.DEPOT_LAT): 0
    }
    stop_to_location = []

    for stop in stops:
        coord_key = (round(stop.longitude, 6), round(stop.latitude, 6))
        if coord_key not in coord_to_index:
            coord_to_index[coord_key] = len(unique_locations)
            unique_locations.append(coord_key)
        stop_to_location.append(coord_to_index[coord_key])

    return unique_locations, stop_to_location


def _cache_key(locations: list[tuple[float, float]]) -> str:
    """Generate a cache key from sorted coordinates."""
    data = json.dumps(sorted(locations), sort_keys=True)
    return hashlib.md5(data.encode()).hexdigest()


def _load_cache(key: str) -> tuple[list[list[float]], list[list[float]]] | None:
    CACHE_DIR.mkdir(exist_ok=True)
    path = CACHE_DIR / f"{key}.json"
    if path.exists():
        with open(path, "r") as f:
            data = json.load(f)
        return data["distances"], data["durations"]
    return None


def _save_cache(key: str, distances: list[list[float]], durations: list[list[float]]):
    CACHE_DIR.mkdir(exist_ok=True)
    path = CACHE_DIR / f"{key}.json"
    with open(path, "w") as f:
        json.dump({"distances": distances, "durations": durations}, f)


def build_matrix_haversine(
    unique_locations: list[tuple[float, float]],
) -> tuple[list[list[int]], list[list[int]]]:
    """
    Build distance (meters) and duration (seconds) matrices using Haversine.
    Used as a fallback when ORS is unavailable.
    """
    n = len(unique_locations)
    distances = [[0] * n for _ in range(n)]
    durations = [[0] * n for _ in range(n)]

    for i in range(n):
        for j in range(n):
            if i == j:
                continue
            lng1, lat1 = unique_locations[i]
            lng2, lat2 = unique_locations[j]
            dist_km = _haversine_distance_km(lat1, lng1, lat2, lng2)
            # Apply 1.4x urban road factor for NYC
            dist_km *= 1.4
            distances[i][j] = int(dist_km * 1000)  # meters
            durations[i][j] = int(_haversine_duration_seconds(dist_km))

    return distances, durations


def build_matrix_ors(
    unique_locations: list[tuple[float, float]],
) -> tuple[list[list[int]], list[list[int]]]:
    """
    Build distance and duration matrices using OpenRouteService Matrix API.
    Batches requests to stay within API limits.
    Results are cached to disk.
    """
    cache_key = _cache_key(unique_locations)
    cached = _load_cache(cache_key)
    if cached is not None:
        # Convert to int lists
        distances = [[int(v) if v is not None else 999999 for v in row] for row in cached[0]]
        durations = [[int(v) if v is not None else 999999 for v in row] for row in cached[1]]
        return distances, durations

    if not settings.ORS_API_KEY or settings.ORS_API_KEY == "your_openrouteservice_api_key_here":
        raise ValueError(
            "ORS_API_KEY not configured. Set it in .env or use Haversine fallback."
        )

    client = openrouteservice.Client(key=settings.ORS_API_KEY)
    n = len(unique_locations)
    batch_size = settings.ORS_MATRIX_BATCH_SIZE

    # ORS expects [[lng, lat], ...] format
    coords = [list(loc) for loc in unique_locations]

    all_distances = [[0] * n for _ in range(n)]
    all_durations = [[0] * n for _ in range(n)]

    for src_start in range(0, n, batch_size):
        src_end = min(src_start + batch_size, n)
        sources = list(range(src_start, src_end))
        destinations = list(range(n))

        result = client.distance_matrix(
            locations=coords,
            sources=sources,
            destinations=destinations,
            metrics=["distance", "duration"],
            profile="driving-hgv",
        )

        for i, src_idx in enumerate(sources):
            for j, dst_idx in enumerate(destinations):
                dist_val = result["distances"][i][j]
                dur_val = result["durations"][i][j]
                # ORS returns None for unroutable pairs
                all_distances[src_idx][dst_idx] = int(dist_val) if dist_val is not None else 999999
                all_durations[src_idx][dst_idx] = int(dur_val) if dur_val is not None else 999999

    _save_cache(cache_key, all_distances, all_durations)
    return all_distances, all_durations


def build_matrix(
    unique_locations: list[tuple[float, float]],
    use_ors: bool = True,
) -> tuple[list[list[int]], list[list[int]]]:
    """
    Build the distance/duration matrix.
    Tries ORS first, falls back to Haversine if ORS fails.
    """
    if use_ors:
        try:
            return build_matrix_ors(unique_locations)
        except Exception as e:
            print(f"ORS matrix failed ({e}), falling back to Haversine.")
            return build_matrix_haversine(unique_locations)
    return build_matrix_haversine(unique_locations)
