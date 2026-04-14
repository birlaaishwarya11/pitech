import logging
import pandas as pd
from io import BytesIO
from lxml import etree

from app.config import settings
from app.models.schemas import OrderRecord, VehicleRecord
from app.utils.time_utils import parse_time_to_minutes
# Geocoding is no longer needed — the user provides Latitude/Longitude
# directly in the input file.
# from app.services.geocache import geocode_address

logger = logging.getLogger(__name__)


def _read_spreadsheetml(file_bytes: bytes) -> pd.DataFrame:
    """Parse a SpreadsheetML XML file (*.xls exported from Route4Me) into a DataFrame."""
    ns = {'ss': 'urn:schemas-microsoft-com:office:spreadsheet'}
    root = etree.fromstring(file_bytes)
    ws = root.find('.//ss:Worksheet', ns)
    table = ws.find('ss:Table', ns)
    rows = table.findall('ss:Row', ns)
    data = []
    for row in rows:
        cells = row.findall('ss:Cell', ns)
        row_data = [
            cell.find('ss:Data', ns).text if cell.find('ss:Data', ns) is not None else None
            for cell in cells
        ]
        data.append(row_data)
    if not data:
        raise ValueError("No data found in XLS file.")
    return pd.DataFrame(data[1:], columns=data[0])


def _load_orders_dataframe(file_bytes: bytes) -> pd.DataFrame:
    """Load orders from CSV or SpreadsheetML XLS bytes into a DataFrame."""
    sniff = file_bytes[:200].lstrip()
    if sniff.startswith(b'<?xml') or sniff.startswith(b'<Workbook'):
        return _read_spreadsheetml(file_bytes)
    return pd.read_csv(BytesIO(file_bytes), encoding="utf-8-sig")


def extract_inline_instructions(df: pd.DataFrame) -> str:
    """
    Collect any routing directives written directly in the file's
    'Instructions' column (if present) and return them as a single
    newline-separated string in the same format as the API text field.

    Supported column names: 'Instructions', 'Special Instructions',
    'Routing Instructions', 'Dispatcher Notes'  (case-insensitive).

    Example cell value:
        skip: WO#977187
        lock: Salt & Sea Mission → truck=FB-1
        note: WO#976055 → call 30min ahead
    """
    candidates = ["Instructions", "Special Instructions",
                  "Routing Instructions", "Dispatcher Notes"]
    col = next(
        (c for c in df.columns if c.strip().lower() in
         [x.lower() for x in candidates]),
        None
    )
    if col is None:
        return ""

    lines = []
    for val in df[col].dropna():
        text = str(val).strip()
        if text and text.lower() not in ("- none -", "none", "n/a", ""):
            lines.append(text)
    return "\n".join(lines)


def parse_orders_csv(file_bytes: bytes) -> tuple[list[OrderRecord], str]:
    """
    Parse orders from CSV or SpreadsheetML XLS.

    Returns:
        (orders, inline_instructions)
        - orders: list of OrderRecord
        - inline_instructions: any routing directives found in an
          'Instructions' column in the file (empty string if none)

    Latitude and Longitude must be provided in the input file.
    Rows with missing or invalid coordinates are skipped and logged.
    """
    df = _load_orders_dataframe(file_bytes)

    required_cols = [
        "Work Order Number", "Customer Number", "Name", "Address",
        "City", "State", "Zip", "Latitude", "Longitude",
        "Open1", "Close1", "FixedTime", "Food Pallets",
        " Pet Food Pallets", "Chemical Pallets",
    ]
    missing = [c for c in required_cols if c not in df.columns]
    if missing:
        raise ValueError(f"Orders file missing required columns: {missing}")

    # Extract any inline routing instructions before we iterate rows
    inline_instructions = extract_inline_instructions(df)

    orders = []
    skipped_rows = []
    for idx, row in df.iterrows():
        # NOTE: The original CSV has swapped column names —
        # "Longitude" contains lat values, "Latitude" contains lng values.
        # XLS exports may have these columns empty.
        raw_lat = row.get("Longitude")
        raw_lng = row.get("Latitude")

        wo = str(row.get("Work Order Number", f"row {idx}"))
        name = str(row.get("Name", "unknown"))

        lat, lng = None, None
        try:
            lat = float(raw_lat)
            lng = float(raw_lng)
            if not (40.4 <= lat <= 41.0 and -74.3 <= lng <= -73.5):
                logger.warning(
                    "Row %s (WO %s, %s): coordinates out of bounds "
                    "(lat=%.6f, lng=%.6f) — skipping",
                    idx, wo, name, lat, lng,
                )
                skipped_rows.append(f"WO {wo} ({name}): coordinates out of bounds")
                lat, lng = None, None
        except (TypeError, ValueError):
            logger.warning(
                "Row %s (WO %s, %s): missing or non-numeric Latitude/Longitude "
                "(raw_lat=%r, raw_lng=%r) — skipping",
                idx, wo, name, raw_lat, raw_lng,
            )
            skipped_rows.append(f"WO {wo} ({name}): missing or invalid coordinates")

        # Geocoding removed — coordinates must be provided in the input file.
        # from app.services.geocache import geocode_address
        # if lat is None or lng is None:
        #     addr = str(row.get("Address", "")).strip()
        #     city = str(row.get("City", "")).strip()
        #     state = str(row.get("State", "NY")).strip()
        #     zip_code = str(row.get("Zip", "")).strip()
        #     coords = geocode_address(addr, city, state, zip_code)
        #     if coords is None:
        #         continue
        #     lat, lng = coords
        #     if not (40.4 <= lat <= 41.0 and -74.3 <= lng <= -73.5):
        #         continue

        if lat is None or lng is None:
            continue

        # Time windows
        open_str = str(row["Open1"]).strip()
        close_str = str(row["Close1"]).strip()
        try:
            open_minutes = parse_time_to_minutes(open_str)
            close_minutes = parse_time_to_minutes(close_str)
        except ValueError:
            open_minutes = settings.DEPOT_OPEN_MINUTES
            close_minutes = settings.DEPOT_CLOSE_MINUTES

        # Service time
        service_time = (
            int(row["FixedTime"])
            if pd.notna(row["FixedTime"]) and str(row["FixedTime"]).strip() not in ("", " ")
            else settings.DEFAULT_SERVICE_TIME
        )

        # Pallets (fractional → scaled integer)
        food = float(row["Food Pallets"]) if pd.notna(row["Food Pallets"]) else 0.0
        pet  = float(row[" Pet Food Pallets"]) if pd.notna(row[" Pet Food Pallets"]) else 0.0
        chem = float(row["Chemical Pallets"]) if pd.notna(row["Chemical Pallets"]) else 0.0
        total_pallets_scaled = int(round((food + pet + chem) * settings.PALLET_SCALE))

        weight = float(row["Weight"]) if pd.notna(row.get("Weight")) else 0.0

        order_type = str(row.get("OrderType", "")).strip() if pd.notna(row.get("OrderType")) else ""
        county     = str(row.get("County", "")).strip()     if pd.notna(row.get("County"))    else ""

        delivery_instructions = str(row.get("Delivery Instructions", "")).strip()
        if delivery_instructions in ("- None -", "None"):
            delivery_instructions = ""

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
            delivery_instructions=delivery_instructions,
            standing_appointment=standing,
            original_index=int(idx),
        ))

    if skipped_rows:
        logger.info(
            "Skipped %d order(s) due to missing/invalid coordinates:\n  %s",
            len(skipped_rows), "\n  ".join(skipped_rows),
        )

    if not orders:
        detail = "No valid orders found after parsing."
        if skipped_rows:
            detail += (
                f" All {len(skipped_rows)} order(s) were skipped because "
                "Latitude/Longitude values are missing or invalid in the input file. "
                "Please ensure every row has valid coordinates."
            )
        raise ValueError(detail)

    return orders, inline_instructions


def parse_assets_csv(file_bytes: bytes) -> list[VehicleRecord]:
    """Parse the asset CSV/XLS and return a list of VehicleRecord objects."""
    df = _load_orders_dataframe(file_bytes)

    required_cols = ["Name", "Capacity in Pallets"]
    missing = [c for c in required_cols if c not in df.columns]
    if missing:
        raise ValueError(f"Asset file missing required columns: {missing}")

    vehicles = []
    for _, row in df.iterrows():
        name = str(row["Name"]).strip()
        if not name:
            continue
        capacity_scaled = int(round(float(row["Capacity in Pallets"]) * settings.PALLET_SCALE))
        vehicles.append(VehicleRecord(name=name, capacity=capacity_scaled))

    if not vehicles:
        raise ValueError("No vehicles found in asset file.")

    return vehicles
