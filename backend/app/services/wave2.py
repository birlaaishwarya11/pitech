"""
Two-wave dispatch planner.

Wave 1 is the main optimization pass.  When it leaves stops unassigned,
wave 2 sends eligible trucks back out for a second run:

  - Trucks that completed a wave-1 route compute their depot return time
    (last arrival + service time + travel back to depot) + reload buffer.
  - Idle trucks (not used in wave 1) are available from depot_open.
  - Any truck whose wave-2 start time is ≤ WAVE2_CUTOFF_MINUTES is eligible.
  - A second OR-Tools solve runs on only the dropped stops with those trucks
    using per-vehicle start times.
  - Results are remapped back to original vehicle / stop indices and merged
    with the wave-1 result.
"""

from app.config import settings
from app.models.schemas import GroupedStop, VehicleRecord
from app.services.solver import solve_vrp


def plan_second_wave(
    dropped_stop_indices: list[int],
    stops: list[GroupedStop],
    vehicles: list[VehicleRecord],
    wave1_routes: dict,             # {original_vehicle_id: [{stop_idx, seq, arrival}]}
    duration_matrix: list[list[int]],
    stop_to_location: list[int],
) -> dict:
    """
    Plan wave-2 routes for stops that wave 1 could not assign.

    Returns a result dict in the same shape as solve_vrp() but with an extra
    key ``wave2_vehicle_ids`` — a set of original vehicle IDs used in wave 2.
    The ``routes`` dict uses original vehicle IDs as keys and original stop
    indices in the stop_idx field.
    """
    if not dropped_stop_indices:
        return {
            "routes": {},
            "dropped": [],
            "status": "none_dropped",
            "solver_status": "N/A",
            "wave2_vehicle_ids": set(),
        }

    depot_loc = 0  # index 0 in the duration matrix is always the depot

    # ── 1. Compute per-vehicle wave-2 earliest start ──────────────────────
    vehicle_wave2_start: dict[int, int] = {}

    for v_id in range(len(vehicles)):
        route_stops = wave1_routes.get(v_id)
        if route_stops:
            # Find the last stop served in wave 1
            last = max(route_stops, key=lambda s: s["arrival"])
            last_arrival = last["arrival"]
            service_min = stops[last["stop_idx"]].service_time
            last_loc = stop_to_location[last["stop_idx"]]
            travel_back_min = duration_matrix[last_loc][depot_loc] // 60
            wave2_start = (
                last_arrival + service_min + travel_back_min
                + settings.WAVE2_RELOAD_BUFFER_MINUTES
            )
        else:
            # Idle in wave 1 — available immediately
            wave2_start = settings.DEPOT_OPEN_MINUTES

        vehicle_wave2_start[v_id] = wave2_start

    # ── 2. Filter eligible vehicles ────────────────────────────────────────
    eligible: list[tuple[int, int]] = sorted(
        (
            (v_id, start_t)
            for v_id, start_t in vehicle_wave2_start.items()
            if start_t <= settings.WAVE2_CUTOFF_MINUTES
        ),
        key=lambda x: x[0],
    )

    if not eligible:
        return {
            "routes": {},
            "dropped": dropped_stop_indices,
            "status": "no_eligible_vehicles",
            "solver_status": "N/A",
            "wave2_vehicle_ids": set(),
        }

    # ── 3. Build wave-2 sub-problem ────────────────────────────────────────
    # Map local wave-2 vehicle index → original vehicle ID
    w2_to_orig: dict[int, int] = {
        w2_idx: orig_id for w2_idx, (orig_id, _) in enumerate(eligible)
    }
    w2_vehicles = [vehicles[orig_id] for orig_id, _ in eligible]
    w2_start_times = [start_t for _, start_t in eligible]

    # Subset of stops and their location mappings
    w2_stops = [stops[i] for i in dropped_stop_indices]
    w2_stop_to_loc = [stop_to_location[i] for i in dropped_stop_indices]

    # ── 4. Solve ───────────────────────────────────────────────────────────
    w2_result = solve_vrp(
        stops=w2_stops,
        vehicles=w2_vehicles,
        duration_matrix=duration_matrix,
        stop_to_location=w2_stop_to_loc,
        vehicle_start_times=w2_start_times,
        time_limit_seconds=settings.WAVE2_SOLVER_TIME_LIMIT_SECONDS,
    )

    # ── 5. Remap back to original indices ──────────────────────────────────
    remapped_routes: dict[int, list[dict]] = {}
    w2_assigned_local: set[int] = set()

    for w2_v_idx, route_stops in w2_result["routes"].items():
        orig_v_id = w2_to_orig[w2_v_idx]
        remapped: list[dict] = []
        for s in route_stops:
            orig_stop_idx = dropped_stop_indices[s["stop_idx"]]
            remapped.append({
                "stop_idx": orig_stop_idx,
                "seq": s["seq"],
                "arrival": s["arrival"],
            })
            w2_assigned_local.add(s["stop_idx"])
        remapped_routes[orig_v_id] = remapped

    still_dropped = [
        dropped_stop_indices[local_idx]
        for local_idx in w2_result["dropped"]
    ]

    return {
        "routes": remapped_routes,
        "dropped": still_dropped,
        "status": w2_result["status"],
        "solver_status": w2_result["solver_status"],
        "wave2_vehicle_ids": set(remapped_routes.keys()),
    }


def merge_waves(wave1_result: dict, wave2_result: dict) -> dict:
    """
    Merge wave-1 and wave-2 solver results into a single result dict.

    Wave-2 vehicles that also ran in wave-1 keep both sets of stops — the
    caller (result_builder) uses ``wave2_vehicle_ids`` to label them.
    If a vehicle appears in BOTH waves, wave-2 stops are stored separately
    under the same vehicle ID with a list of wave markers.
    """
    merged_routes: dict[int, list[dict]] = dict(wave1_result["routes"])

    for v_id, route_stops in wave2_result["routes"].items():
        # Tag each stop with wave=2 so result_builder can label them
        tagged = [{**s, "wave": 2} for s in route_stops]
        if v_id in merged_routes:
            # Vehicle did both waves — append wave-2 stops (already tagged)
            # Wave-1 stops get wave=1 tag retro-actively
            w1_tagged = [{**s, "wave": 1} for s in merged_routes[v_id]]
            merged_routes[v_id] = w1_tagged + tagged
        else:
            merged_routes[v_id] = tagged

    # Tag wave-1-only stops with wave=1 where not already tagged
    for v_id, route_stops in merged_routes.items():
        merged_routes[v_id] = [
            s if "wave" in s else {**s, "wave": 1}
            for s in route_stops
        ]

    return {
        "status": wave1_result["status"],
        "solver_status": wave1_result["solver_status"],
        "routes": merged_routes,
        "dropped": wave2_result["dropped"],
        "wave2_vehicle_ids": wave2_result.get("wave2_vehicle_ids", set()),
    }
