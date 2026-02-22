from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Depot — Hunts Point, Bronx
    DEPOT_LAT: float = 40.8094
    DEPOT_LNG: float = -73.8796

    # OpenRouteService
    ORS_API_KEY: str = ""
    ORS_BASE_URL: str = "https://api.openrouteservice.org"
    ORS_MATRIX_BATCH_SIZE: int = 50

    # Solver
    SOLVER_TIME_LIMIT_SECONDS: int = 120
    SOLVER_MAX_VEHICLE_TIME_MINUTES: int = 600  # 10 hours
    SOLVER_MAX_WAITING_MINUTES: int = 300  # 5 hours max wait (allows more flexibility)
    DROP_PENALTY: int = 1000000  # very high penalty to minimize unassigned

    # Time windows
    DEPOT_OPEN_MINUTES: int = 480   # 8:00 AM
    DEPOT_CLOSE_MINUTES: int = 1020  # 5:00 PM
    DEFAULT_SERVICE_TIME: int = 30   # minutes per stop

    # Pallet scaling (OR-Tools needs integers)
    PALLET_SCALE: int = 100

    model_config = {"env_file": ".env"}


settings = Settings()
