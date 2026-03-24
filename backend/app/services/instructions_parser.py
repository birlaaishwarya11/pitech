"""
Parse free-text special instructions into structured routing constraints.

Supported directives (one per line, case-insensitive):
  skip: WO#977187                       → exclude this work order entirely
  lock: <name fragment> → truck=FB-1    → pin stop to a specific vehicle
  priority: <name fragment>             → serve this stop first (Seq 1)
  window: WO#976054 → 08:30-10:00       → override time window for a WO
  note: WO#976055 → call 30min ahead   → attach a label in the output CSV

Lines starting with # are treated as comments.
"""

import re


def parse_instructions(text: str | None) -> dict:
    """
    Returns:
    {
      "skip_wos":    set of WO# strings to remove,
      "lock_stops":  {name_fragment: vehicle_name},
      "priority_stops": [name_fragment, ...],
      "window_overrides": {wo_number: (open_min, close_min)},
      "notes":       {wo_number: note_text},
      "errors":      [str, ...]           # lines we couldn't parse
    }
    """
    result = {
        "skip_wos": set(),
        "lock_stops": {},
        "priority_stops": [],
        "window_overrides": {},
        "notes": {},
        "errors": [],
    }

    if not text:
        return result

    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue

        lower = line.lower()

        # --- skip: WO#977187 ---
        if lower.startswith("skip:"):
            body = line[5:].strip()
            # extract all WO numbers mentioned
            wos = re.findall(r"WO#?(\w+)", body, re.IGNORECASE)
            if wos:
                for wo in wos:
                    result["skip_wos"].add(wo.strip())
            else:
                result["errors"].append(f"Could not parse skip directive: '{line}'")

        # --- lock: <name> → truck=FB-1 ---
        elif lower.startswith("lock:"):
            body = line[5:].strip()
            # split on → or -> or "truck="
            parts = re.split(r"→|->", body)
            if len(parts) == 2:
                name_frag = parts[0].strip()
                truck_part = parts[1].strip()
                truck_match = re.search(r"truck\s*=\s*(\S+)", truck_part, re.IGNORECASE)
                if truck_match:
                    result["lock_stops"][name_frag.lower()] = truck_match.group(1)
                else:
                    result["errors"].append(f"Expected 'truck=<name>' in lock directive: '{line}'")
            else:
                result["errors"].append(f"Could not parse lock directive: '{line}'")

        # --- priority: <name fragment> ---
        elif lower.startswith("priority:"):
            body = line[9:].strip()
            if body:
                result["priority_stops"].append(body.lower())
            else:
                result["errors"].append(f"Empty priority directive: '{line}'")

        # --- window: WO#976054 → 08:30-10:00 ---
        elif lower.startswith("window:"):
            body = line[7:].strip()
            parts = re.split(r"→|->", body)
            if len(parts) == 2:
                wo_match = re.search(r"WO#?(\w+)", parts[0], re.IGNORECASE)
                time_match = re.search(
                    r"(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})", parts[1]
                )
                if wo_match and time_match:
                    wo = wo_match.group(1)
                    open_min = int(time_match.group(1)) * 60 + int(time_match.group(2))
                    close_min = int(time_match.group(3)) * 60 + int(time_match.group(4))
                    result["window_overrides"][wo] = (open_min, close_min)
                else:
                    result["errors"].append(f"Could not parse window directive: '{line}'")
            else:
                result["errors"].append(f"Could not parse window directive: '{line}'")

        # --- note: WO#976055 → call 30min ahead ---
        elif lower.startswith("note:"):
            body = line[5:].strip()
            parts = re.split(r"→|->", body)
            if len(parts) == 2:
                wo_match = re.search(r"WO#?(\w+)", parts[0], re.IGNORECASE)
                if wo_match:
                    result["notes"][wo_match.group(1)] = parts[1].strip()
                else:
                    result["errors"].append(f"Could not find WO# in note directive: '{line}'")
            else:
                result["errors"].append(f"Could not parse note directive: '{line}'")

        else:
            result["errors"].append(f"Unknown directive (ignored): '{line}'")

    return result
