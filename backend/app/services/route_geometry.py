import logging
from typing import Optional

import openrouteservice

from app.config import settings
from app.models.schemas import GroupedStop

logger = logging.getLogger(__name__)


def build_route_geometry(
    route_stops: list[GroupedStop],
) -> tuple[Optional[dict], Optional[float]]:
    """
    Build a road-following GeoJSON LineString for one solved route
    using the self-hosted ORS Directions API.

    Returns:
        (geometry, distance_km)
        - geometry: GeoJSON {"type": "LineString", "coordinates": [[lng, lat], ...]}
        - distance_km: total route distance in kilometres (rounded to 1 dp)
    """
    if not route_stops:
        return None, None

    coordinates = [(settings.DEPOT_LNG, settings.DEPOT_LAT)]
    coordinates.extend((stop.longitude, stop.latitude) for stop in route_stops)
    coordinates.append((settings.DEPOT_LNG, settings.DEPOT_LAT))

    try:
        client = openrouteservice.Client(
            key=settings.ORS_API_KEY or None,
            base_url=settings.ORS_BASE_URL,
        )

        response = openrouteservice.directions.directions(
            client,
            coordinates=coordinates,
            profile="driving-hgv",
            format="geojson",
            geometry=True,
            instructions=False,
            optimize_waypoints=False,
            validate=False,
        )

        features = response.get("features", [])
        if not features:
            return None, None

        feature = features[0]
        geometry = feature.get("geometry")
        if not geometry:
            return None, None

        # ORS returns distance in metres inside properties.summary
        distance_km = None
        props = feature.get("properties", {})
        summary = props.get("summary", {})
        distance_m = summary.get("distance")
        if distance_m is not None:
            distance_km = round(distance_m / 1000, 1)

        return geometry, distance_km

    except Exception as e:
        logger.warning("Failed to build route geometry from ORS: %s", e)
        return None, None
