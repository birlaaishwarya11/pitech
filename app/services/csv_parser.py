import pandas as pd
from io import BytesIO

from app.config import settings
from app.models.schemas import OrderRecord, VehicleRecord
from app.utils.time_utils import parse_time_to_minutes


def parse_orders_csv(file_bytes: bytes) -> list[OrderRecord]:
    """Parse the orders CSV and return a list of OrderRecord objects."""
    df = pd.read_csv(BytesIO(file_bytes), encoding="utf-8-sig")

    required_cols = [
        "Work Order Number", "Customer Number", "Name", "Address",
        "City", "State", "Zip", "Latitude", "Longitude",
        "Open1", "Close1", "FixedTime", "Food Pallets",
        " Pet Food Pallets", "Chemical Pallets",
    ]
    missing = [c for c in required_cols if c not in df.columns]
    if missing:
        raise ValueError(f"Orders CSV missing required columns: {missing}")

    orders = []
    for idx, row in df.iterrows():
        # NOTE: The CSV has columns swapped — "Longitude" contains latitude
        # values and "Latitude" contains longitude values
        lat = row["Longitude"]
        lng = row["Latitude"]

        # Skip rows with missing coordinates
        if pd.isna(lat) or pd.isna(lng):
            continue
        lat = float(lat)
        lng = float(lng)

        # Validate NYC bounding box
        if not (40.4 <= lat <= 41.0 and -74.3 <= lng <= -73.5):
            continue

        # Parse time windows
        open_str = str(row["Open1"]).strip()
        close_str = str(row["Close1"]).strip()
        try:
            open_minutes = parse_time_to_minutes(open_str)
            close_minutes = parse_time_to_minutes(close_str)
        except ValueError:
            open_minutes = settings.DEPOT_OPEN_MINUTES
            close_minutes = settings.DEPOT_CLOSE_MINUTES

        # Service time
        service_time = int(row["FixedTime"]) if pd.notna(row["FixedTime"]) else settings.DEFAULT_SERVICE_TIME

        # Pallets (fractional -> scaled integer)
        food = float(row["Food Pallets"]) if pd.notna(row["Food Pallets"]) else 0.0
        pet = float(row[" Pet Food Pallets"]) if pd.notna(row[" Pet Food Pallets"]) else 0.0
        chem = float(row["Chemical Pallets"]) if pd.notna(row["Chemical Pallets"]) else 0.0
        total_pallets_raw = food + pet + chem
        total_pallets_scaled = int(round(total_pallets_raw * settings.PALLET_SCALE))

        # Weight
        weight = float(row["Weight"]) if pd.notna(row["Weight"]) else 0.0

        # Order type
        order_type = str(row.get("OrderType", "")).strip() if pd.notna(row.get("OrderType")) else ""

        # County
        county = str(row.get("County", "")).strip() if pd.notna(row.get("County")) else ""

        # Delivery instructions
        instructions = str(row.get("Delivery Instructions", "")).strip()
        if instructions == "- None -":
            instructions = ""

        # Standing appointment
        standing = str(row.get("Standing Appointment", "No")).strip().lower() == "yes"

        orders.append(OrderRecord(
            work_order_number=str(row["Work Order Number"]),
            customer_number=str(row["Customer Number"]),
            name=str(row["Name"]),
            address=str(row["Address"]),
            city=str(row["City"]),
            state=str(row["State"]),
            zip_code=str(row["Zip"]),
            latitude=lat,
            longitude=lng,
            open_time=open_minutes,
            close_time=close_minutes,
            service_time=service_time,
            total_pallets=total_pallets_scaled,
            weight=weight,
            order_type=order_type,
            county=county,
            delivery_instructions=instructions,
            standing_appointment=standing,
            original_index=int(idx),
        ))

    if not orders:
        raise ValueError("No valid orders found in CSV after parsing and validation.")

    return orders


def parse_assets_csv(file_bytes: bytes) -> list[VehicleRecord]:
    """Parse the asset CSV and return a list of VehicleRecord objects."""
    df = pd.read_csv(BytesIO(file_bytes), encoding="utf-8-sig")

    required_cols = ["Name", "Capacity in Pallets"]
    missing = [c for c in required_cols if c not in df.columns]
    if missing:
        raise ValueError(f"Asset CSV missing required columns: {missing}")

    vehicles = []
    for _, row in df.iterrows():
        name = str(row["Name"]).strip()
        capacity_raw = float(row["Capacity in Pallets"])
        capacity_scaled = int(round(capacity_raw * settings.PALLET_SCALE))

        vehicles.append(VehicleRecord(
            name=name,
            capacity=capacity_scaled,
        ))

    if not vehicles:
        raise ValueError("No vehicles found in asset CSV.")

    return vehicles
