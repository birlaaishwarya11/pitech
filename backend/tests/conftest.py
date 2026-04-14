import pytest
import os

# Ensure tests run from the backend directory so 'app.*' imports resolve
os.chdir(os.path.join(os.path.dirname(__file__), ".."))

# Speed up solver for tests (default 180s is too slow)
from app.config import settings
settings.SOLVER_TIME_LIMIT_SECONDS = 5
settings.WAVE2_SOLVER_TIME_LIMIT_SECONDS = 3


@pytest.fixture
def sample_orders_csv() -> bytes:
    """Minimal valid orders CSV with 3 orders (2 Dry, 1 Cold) at 2 locations."""
    return (
        "Work Order Number,Customer Number,Name,Address,City,State,Zip,"
        "Longitude,Latitude,Open1,Close1,FixedTime,"
        "Food Pallets, Pet Food Pallets,Chemical Pallets,OrderType,County,Weight\n"
        # Note: CSV columns are swapped — "Longitude" = lat, "Latitude" = lon
        "WO001,C100,Stop A,10 Main St,Bronx,NY,10451,"
        "40.82,-73.92,0830,1230,30,2.0,0,0,Dry,Bronx,500\n"
        "WO002,C100,Stop A,10 Main St,Bronx,NY,10451,"
        "40.82,-73.92,0830,1230,30,1.5,0,0,Cold,Bronx,300\n"
        "WO003,C200,Stop B,20 Oak Ave,Queens,NY,11101,"
        "40.75,-73.85,1230,1630,30,3.0,0,0,Dry,Queens,700\n"
    ).encode()


@pytest.fixture
def sample_assets_csv() -> bytes:
    """Minimal valid assets CSV with 3 vehicles."""
    return (
        "Name,Capacity in Pallets\n"
        "FB-1,9\n"
        "FB-2,9\n"
        "FB-101,21\n"
    ).encode()


@pytest.fixture
def real_orders_path() -> str:
    path = os.path.join(
        os.path.dirname(__file__), "..", "..", "Orders Jan 14 2026.csv"
    )
    return os.path.abspath(path)


@pytest.fixture
def real_assets_path() -> str:
    path = os.path.join(
        os.path.dirname(__file__),
        "..",
        "..",
        "Asset List with Capacity (as of 1.28.26).csv",
    )
    return os.path.abspath(path)
