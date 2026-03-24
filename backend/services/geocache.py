"""
Persistent geocode cache backed by SQLite.

Schema is intentionally simple so it can be migrated to Azure SQL or
PostgreSQL with only a connection-string change. The table and column
names are ANSI SQL — no SQLite-specific syntax is used.

Azure migration path:
    Replace _get_conn() with a pyodbc / sqlalchemy connection:

    import pyodbc
    CONN_STR = (
        "Driver={ODBC Driver 18 for SQL Server};"
        "Server=tcp:<server>.database.windows.net,1433;"
        "Database=<db>;Uid=<user>;Pwd=<pwd>;Encrypt=yes;"
    )
    def _get_conn(): return pyodbc.connect(CONN_STR)

    The rest of this file stays identical.
"""

import sqlite3
import time
import os
from pathlib import Path

from geopy.geocoders import Nominatim
from geopy.exc import GeocoderTimedOut, GeocoderServiceError

# ── Database location ──────────────────────────────────────────────────────
# Stored next to the project root so it survives server restarts and is easy
# to back up or transfer.  Override with GEOCACHE_DB env var if needed.
_DB_PATH = Path(os.getenv("GEOCACHE_DB", Path(__file__).parent.parent.parent / "geocache.db"))

_geolocator = Nominatim(user_agent="pitech-route-optimizer", timeout=10)


# ── Database setup ─────────────────────────────────────────────────────────

def _get_conn() -> sqlite3.Connection:
    """Return a SQLite connection.  swap this function for Azure/Postgres migration."""
    conn = sqlite3.connect(_DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    """Create the geocode_cache table if it doesn't exist.  Safe to call on every startup."""
    with _get_conn() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS geocode_cache (
                address_key  TEXT PRIMARY KEY,
                latitude     REAL NOT NULL,
                longitude    REAL NOT NULL,
                geocoded_at  TEXT NOT NULL
            )
        """)
        conn.commit()


# ── Public API ─────────────────────────────────────────────────────────────

def get_cached(address_key: str) -> tuple[float, float] | None:
    """Return (lat, lng) from DB cache, or None if not found."""
    with _get_conn() as conn:
        row = conn.execute(
            "SELECT latitude, longitude FROM geocode_cache WHERE address_key = ?",
            (address_key,)
        ).fetchone()
    return (row["latitude"], row["longitude"]) if row else None


def save_to_cache(address_key: str, lat: float, lng: float) -> None:
    """Persist a geocoded result.  Uses INSERT OR REPLACE so re-geocoding is safe."""
    with _get_conn() as conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO geocode_cache (address_key, latitude, longitude, geocoded_at)
            VALUES (?, ?, ?, datetime('now'))
            """,
            (address_key, lat, lng)
        )
        conn.commit()


def geocode_address(address: str, city: str, state: str, zip_code: str) -> tuple[float, float] | None:
    """
    Return (lat, lng) for the given address.

    Resolution order:
      1. SQLite cache  → instant, no API call
      2. Nominatim API → ~1 sec (rate-limited), result saved to cache

    Failed lookups are NOT cached so they are retried on next upload
    (e.g. a typo gets fixed upstream).
    """
    key = f"{address.strip()},{city.strip()},{state.strip()},{zip_code.strip()}"

    # 1. Cache hit
    cached = get_cached(key)
    if cached:
        return cached

    # 2. Live geocode
    try:
        query = f"{address}, {city}, {state} {zip_code}, USA"
        time.sleep(1.1)  # Nominatim hard rate limit: 1 req/sec
        location = _geolocator.geocode(query)
        if location:
            lat, lng = location.latitude, location.longitude
            save_to_cache(key, lat, lng)
            return (lat, lng)
    except (GeocoderTimedOut, GeocoderServiceError):
        pass

    return None


def cache_stats() -> dict:
    """Return row count and DB file size — useful for health/admin endpoints."""
    with _get_conn() as conn:
        count = conn.execute("SELECT COUNT(*) FROM geocode_cache").fetchone()[0]
    size_kb = round(_DB_PATH.stat().st_size / 1024, 1) if _DB_PATH.exists() else 0
    return {"cached_addresses": count, "db_size_kb": size_kb, "db_path": str(_DB_PATH)}


# Initialise on import so the table always exists when the module is loaded
init_db()
