def parse_time_to_minutes(time_str: str) -> int:
    """Convert a time value like '0830', '830', or '830.0' to minutes from midnight (510)."""
    time_str = str(time_str).strip()

    # Handle float format from pandas (e.g., "830.0" or "1230.0")
    if "." in time_str:
        time_str = time_str.split(".")[0]

    # Zero-pad to 4 digits: "830" -> "0830"
    time_str = time_str.zfill(4)

    if len(time_str) == 4 and time_str.isdigit():
        hours = int(time_str[:2])
        minutes = int(time_str[2:])
        return hours * 60 + minutes

    raise ValueError(f"Invalid time format: '{time_str}'. Expected HHMM like '0830'.")
