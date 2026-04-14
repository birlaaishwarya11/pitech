from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Depot — Hunts Point, Bronx
    DEPOT_LAT: float = 40.8094
    DEPOT_LNG: float = -73.8796

    # OpenRouteService (self-hosted via docker-compose)
    # The Python openrouteservice client appends /v2 automatically.
    # Self-hosted ORS v8 exposes the API at /ors/v2 on container port 8082,
    # mapped to host port 8080 via docker-compose.
    ORS_BASE_URL: str = "http://localhost:8080/ors"

    # Solver — Wave 1
    SOLVER_TIME_LIMIT_SECONDS: int = 180
    SOLVER_MAX_VEHICLE_TIME_MINUTES: int = 600  # 10 hours
    SOLVER_MAX_WAITING_MINUTES: int = 300  # 5 hours max wait (allows more flexibility)
    DROP_PENALTY: int = 1000000  # very high penalty to minimize unassigned

    # Solver — Wave 2 (second dispatch for unassigned stops)
    WAVE2_RELOAD_BUFFER_MINUTES: int = 30   # depot turnaround time between waves
    WAVE2_CUTOFF_MINUTES: int = 960         # trucks must begin wave2 by 16:00
    WAVE2_SOLVER_TIME_LIMIT_SECONDS: int = 90

    # Time windows
    DEPOT_OPEN_MINUTES: int = 480   # 8:00 AM
    DEPOT_CLOSE_MINUTES: int = 1020  # 5:00 PM
    DEFAULT_SERVICE_TIME: int = 30   # minutes per stop

    # Pallet scaling (OR-Tools needs integers)
    PALLET_SCALE: int = 100

    model_config = {"env_file": ".env"}


settings = Settings()
