import io

import pandas as pd

from app.config import settings
from app.models.schemas import (
    OrderRecord, GroupedStop, VehicleRecord,
    OptimizationResponse, RouteResult, StopResult, DepotInfo,
)
from app.services.route_geometry import build_route_geometry


def _minutes_to_time_str(minutes: int) -> str:
    """Convert minutes from midnight to HH:MM format."""
    h = minutes // 60
    m = minutes % 60
    return f"{h:02d}:{m:02d}"


# def build_response(
#     orders: list[OrderRecord],
#     stops: list[GroupedStop],
#     vehicles: list[VehicleRecord],
#     solver_result: dict,
# ) -> OptimizationResponse:
#     """Build the API response from solver results."""
#     routes_data = solver_result["routes"]
#     dropped_stop_indices = solver_result["dropped"]
#     wave2_vehicle_ids = solver_result.get("wave2_vehicle_ids", set())
#
#     route_results = []
#     route_number = 1
#     total_assigned_orders = 0
#
#     for vehicle_id, route_stops in routes_data.items():
#         vehicle = vehicles[vehicle_id]
#         # For vehicles that ran both waves, split stops by wave
#         w1_stops = [s for s in route_stops if s.get("wave", 1) == 1]
#         w2_stops = [s for s in route_stops if s.get("wave", 1) == 2]
#
#         def _make_route(wave_stops, wave_num):
#             nonlocal route_number, total_assigned_orders
#             total_pallets_scaled = sum(stops[s["stop_idx"]].total_pallets for s in wave_stops)
#             stop_results = []
#             for s in wave_stops:
#                 stop = stops[s["stop_idx"]]
#                 wo_numbers = [orders[i].work_order_number for i in stop.order_indices]
#                 cust = orders[stop.order_indices[0]].customer_number
#                 total_assigned_orders += len(stop.order_indices)
#                 stop_results.append(StopResult(
#                     seq=s["seq"],
#                     work_order_numbers=wo_numbers,
#                     customer_number=cust,
#                     name=stop.name,
#                     address=stop.address,
#                     city=stop.city,
#                     state=stop.state,
#                     zip_code=stop.zip_code,
#                     arrival_time_minutes=s["arrival"],
#                     pallets=round(stop.total_pallets / settings.PALLET_SCALE, 2),
#                     order_types=stop.order_types,
#                 ))
#             label = f"W{wave_num}-{route_number}" if wave_num == 2 else str(route_number)
#             route_results.append(RouteResult(
#                 route_number=route_number,
#                 vehicle=f"{vehicle.name} (Wave {wave_num})" if wave_num == 2 else vehicle.name,
#                 vehicle_capacity_pallets=round(vehicle.capacity / settings.PALLET_SCALE, 2),
#                 total_pallets=round(total_pallets_scaled / settings.PALLET_SCALE, 2),
#                 num_stops=len(wave_stops),
#                 stops=stop_results,
#             ))
#             route_number += 1
#
#         if w1_stops:
#             _make_route(w1_stops, 1)
#         if w2_stops:
#             _make_route(w2_stops, 2)
#         # Vehicle only in wave2 (was idle in wave1)
#         if not w1_stops and not w2_stops and route_stops:
#             wave_num = 2 if vehicle_id in wave2_vehicle_ids else 1
#             _make_route(route_stops, wave_num)
#
#     # Unassigned
#     unassigned_orders = 0
#     unassigned_list = []
#     for stop_idx in dropped_stop_indices:
#         stop = stops[stop_idx]
#         unassigned_orders += len(stop.order_indices)
#         wo_numbers = [orders[i].work_order_number for i in stop.order_indices]
#         unassigned_list.append({
#             "work_order_numbers": wo_numbers,
#             "name": stop.name,
#             "address": f"{stop.address}, {stop.city}, {stop.state} {stop.zip_code}",
#             "pallets": round(stop.total_pallets / settings.PALLET_SCALE, 2),
#             "order_types": stop.order_types,
#             "reason": "Could not fit within time/capacity constraints",
#         })
#
#     return OptimizationResponse(
#         status=solver_result["status"],
#         solver_status=solver_result["solver_status"],
#         total_orders=len(orders),
#         total_stops=len(stops),
#         assigned_orders=total_assigned_orders,
#         unassigned_orders=unassigned_orders,
#         routes_used=len(route_results),
#         vehicles_available=len(vehicles),
#         routes=route_results,
#         unassigned=unassigned_list,
#     )

def build_response(
    orders: list[OrderRecord],
    stops: list[GroupedStop],
    vehicles: list[VehicleRecord],
    solver_result: dict,
) -> OptimizationResponse:
    """Build the API response from solver results."""
    routes_data = solver_result["routes"]
    dropped_stop_indices = solver_result["dropped"]
    wave2_vehicle_ids = solver_result.get("wave2_vehicle_ids", set())

    route_results = []
    route_number = 1
    total_assigned_orders = 0

    for vehicle_id, route_stops in routes_data.items():
        vehicle = vehicles[vehicle_id]

        # For vehicles that ran both waves, split stops by wave
        w1_stops = [s for s in route_stops if s.get("wave", 1) == 1]
        w2_stops = [s for s in route_stops if s.get("wave", 1) == 2]

        def _make_route(wave_stops, wave_num):
            nonlocal route_number, total_assigned_orders

            ordered_wave_stops = sorted(wave_stops, key=lambda s: s["seq"])
            ordered_grouped_stops = [stops[s["stop_idx"]] for s in ordered_wave_stops]

            total_pallets_scaled = sum(
                stop.total_pallets for stop in ordered_grouped_stops
            )

            route_geometry = build_route_geometry(ordered_grouped_stops)

            stop_results = []
            for s, stop in zip(ordered_wave_stops, ordered_grouped_stops):
                wo_numbers = [orders[i].work_order_number for i in stop.order_indices]
                cust = orders[stop.order_indices[0]].customer_number
                total_assigned_orders += len(stop.order_indices)

                stop_results.append(
                    StopResult(
                        seq=s["seq"],
                        work_order_numbers=wo_numbers,
                        customer_number=cust,
                        name=stop.name,
                        address=stop.address,
                        city=stop.city,
                        state=stop.state,
                        zip_code=stop.zip_code,
                        arrival_time_minutes=s["arrival"],
                        pallets=round(stop.total_pallets / settings.PALLET_SCALE, 2),
                        order_types=stop.order_types,
                        latitude=stop.latitude,
                        longitude=stop.longitude,
                    )
                )

            route_results.append(
                RouteResult(
                    route_number=route_number,
                    vehicle=f"{vehicle.name} (Wave {wave_num})" if wave_num == 2 else vehicle.name,
                    vehicle_capacity_pallets=round(vehicle.capacity / settings.PALLET_SCALE, 2),
                    total_pallets=round(total_pallets_scaled / settings.PALLET_SCALE, 2),
                    num_stops=len(ordered_wave_stops),
                    stops=stop_results,
                    geometry=route_geometry,
                )
            )

            route_number += 1

        if w1_stops:
            _make_route(w1_stops, 1)
        if w2_stops:
            _make_route(w2_stops, 2)

        # Vehicle only in wave2 (was idle in wave1)
        if not w1_stops and not w2_stops and route_stops:
            wave_num = 2 if vehicle_id in wave2_vehicle_ids else 1
            _make_route(route_stops, wave_num)

    # Unassigned
    unassigned_orders = 0
    unassigned_list = []
    for stop_idx in dropped_stop_indices:
        stop = stops[stop_idx]
        unassigned_orders += len(stop.order_indices)
        wo_numbers = [orders[i].work_order_number for i in stop.order_indices]
        unassigned_list.append({
            "work_order_numbers": wo_numbers,
            "name": stop.name,
            "address": f"{stop.address}, {stop.city}, {stop.state} {stop.zip_code}",
            "pallets": round(stop.total_pallets / settings.PALLET_SCALE, 2),
            "order_types": stop.order_types,
            "reason": "Could not fit within time/capacity constraints",
        })

    return OptimizationResponse(
        status=solver_result["status"],
        solver_status=solver_result["solver_status"],
        total_orders=len(orders),
        total_stops=len(stops),
        assigned_orders=total_assigned_orders,
        unassigned_orders=unassigned_orders,
        routes_used=len(route_results),
        vehicles_available=len(vehicles),
        depot=DepotInfo(
            name="Food Bank Depot",
            latitude=settings.DEPOT_LAT,
            longitude=settings.DEPOT_LNG,
        ),
        routes=route_results,
        unassigned=unassigned_list,
    )

def build_csv_output(
    orders: list[OrderRecord],
    stops: list[GroupedStop],
    vehicles: list[VehicleRecord],
    solver_result: dict,
    original_csv_bytes: bytes,
) -> str:
    """
    Re-read the original CSV and overwrite Rt/Seq/Vehicle/Arrival columns
    with the solver's optimized values. Returns CSV as a string.

    Split large orders (is_large_order=True) share order_indices across
    multiple loads routed to different trucks.  We collect every load
    assignment per WO and write:
      - Rt / Seq / Assigned Vehicle / Est. Arrival  → the FIRST load
      - Split Loads                                  → all loads (blank for normal stops)

    This gives dispatchers full visibility: "this address needs 3 trucks;
    here are the routes, vehicles, and arrival windows for each load."
    """
    from collections import defaultdict

    df = pd.read_csv(io.BytesIO(original_csv_bytes), encoding="utf-8-sig")

    # Collect ALL load assignments per WO (split orders hit this >1 time)
    # Route number = one physical dispatch run (vehicle + wave).
    # Vehicles that ran both waves get two separate route numbers.
    all_loads: dict[str, list[dict]] = defaultdict(list)
    routes_data = solver_result["routes"]
    route_number = 1
    for vehicle_id, route_stops in routes_data.items():
        vehicle = vehicles[vehicle_id]
        # Group stops by wave so each wave gets its own route number
        from itertools import groupby as _groupby
        wave_grouped: dict[int, list[dict]] = {}
        for s in route_stops:
            wn = s.get("wave", 1)
            wave_grouped.setdefault(wn, []).append(s)
        for wave_num in sorted(wave_grouped):
            for s in wave_grouped[wave_num]:
                stop = stops[s["stop_idx"]]
                load_entry = {
                    "Rt": route_number,
                    "Seq": s["seq"],
                    "Vehicle": vehicle.name,
                    "Arrival": _minutes_to_time_str(s["arrival"]),
                    "pallets": round(stop.total_pallets / settings.PALLET_SCALE, 2),
                    "is_large": stop.is_large_order,
                    "wave": wave_num,
                }
                for order_idx in stop.order_indices:
                    order = orders[order_idx]
                    all_loads[order.work_order_number].append(load_entry)
            route_number += 1

    # Build final per-WO assignment
    assignment: dict[str, dict] = {}
    for wo, loads in all_loads.items():
        # Deduplicate (same stop may appear multiple times if WO is in several groups)
        seen = set()
        unique_loads = []
        for l in loads:
            key = (l["Rt"], l["Seq"])
            if key not in seen:
                seen.add(key)
                unique_loads.append(l)
        unique_loads.sort(key=lambda l: (l["Rt"], l["Seq"]))

        first = unique_loads[0]
        if len(unique_loads) == 1 or not first["is_large"]:
            split_info = ""
        else:
            parts = [
                f"Load {i+1}: Rt{l['Rt']} {l['Vehicle']} {l['Arrival']} ({l['pallets']}p)"
                for i, l in enumerate(unique_loads)
            ]
            split_info = f"{len(unique_loads)} trucks needed — " + " | ".join(parts)

        assignment[wo] = {
            "Rt": first["Rt"],
            "Seq": first["Seq"],
            "Vehicle": first["Vehicle"],
            "Arrival": first["Arrival"],
            "Split_Loads": split_info,
            "Wave": first["wave"],
        }

    # Overwrite columns
    new_rt, new_seq, new_vehicle, new_arrival, new_split, new_wave = [], [], [], [], [], []

    for _, row in df.iterrows():
        wo = str(row["Work Order Number"])
        if wo in assignment:
            a = assignment[wo]
            new_rt.append(a["Rt"])
            new_seq.append(a["Seq"])
            new_vehicle.append(a["Vehicle"])
            new_arrival.append(a["Arrival"])
            new_split.append(a["Split_Loads"])
            new_wave.append(a["Wave"])
        else:
            new_rt.append("UNASSIGNED")
            new_seq.append(0)
            new_vehicle.append("")
            new_arrival.append("")
            new_split.append("")
            new_wave.append("")

    df["Rt"] = new_rt
    df["Seq"] = new_seq
    df["Assigned Vehicle"] = new_vehicle
    df["Est. Arrival"] = new_arrival
    df["Wave"] = new_wave
    df["Split Loads"] = new_split

    return df.to_csv(index=False)
