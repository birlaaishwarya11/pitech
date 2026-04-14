from typing import Optional

import openrouteservice

from app.config import settings
from app.models.schemas import GroupedStop


def build_route_geometry(route_stops: list[GroupedStop]) -> Optional[dict]:
    """
    Build a road-following GeoJSON LineString for one solved route.

    Input stop order must already be optimized.
    Output geometry is GeoJSON:
    {
        "type": "LineString",
        "coordinates": [[lng, lat], ...]
    }
    """
    if not route_stops:
        return None

    if not settings.ORS_API_KEY or settings.ORS_API_KEY == "your_openrouteservice_api_key_here":
        return None

    coordinates = [(settings.DEPOT_LNG, settings.DEPOT_LAT)]
    coordinates.extend((stop.longitude, stop.latitude) for stop in route_stops)
    coordinates.append((settings.DEPOT_LNG, settings.DEPOT_LAT))

    try:
        client = openrouteservice.Client(
            key=settings.ORS_API_KEY,
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
            return None

        geometry = features[0].get("geometry")
        if not geometry:
            return None

        return geometry

    except Exception as e:
        print(f"Failed to build route geometry from ORS directions: {e}")
        return None