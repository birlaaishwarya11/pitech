import io

import pandas as pd

from app.config import settings
from app.models.schemas import (
    OrderRecord, GroupedStop, VehicleRecord,
    OptimizationResponse, RouteResult, StopResult,
)


def _minutes_to_time_str(minutes: int) -> str:
    """Convert minutes from midnight to HH:MM format."""
    h = minutes // 60
    m = minutes % 60
    return f"{h:02d}:{m:02d}"


def build_response(
    orders: list[OrderRecord],
    stops: list[GroupedStop],
    vehicles: list[VehicleRecord],
    solver_result: dict,
) -> OptimizationResponse:
    """Build the API response from solver results."""
    routes_data = solver_result["routes"]
    dropped_stop_indices = solver_result["dropped"]

    route_results = []
    route_number = 1
    total_assigned_orders = 0

    for vehicle_id, route_stops in routes_data.items():
        vehicle = vehicles[vehicle_id]
        total_pallets_scaled = sum(
            stops[s["stop_idx"]].total_pallets for s in route_stops
        )

        stop_results = []
        for s in route_stops:
            stop = stops[s["stop_idx"]]
            wo_numbers = [orders[i].work_order_number for i in stop.order_indices]
            cust = orders[stop.order_indices[0]].customer_number
            total_assigned_orders += len(stop.order_indices)

            stop_results.append(StopResult(
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
            ))

        route_results.append(RouteResult(
            route_number=route_number,
            vehicle=vehicle.name,
            vehicle_capacity_pallets=round(vehicle.capacity / settings.PALLET_SCALE, 2),
            total_pallets=round(total_pallets_scaled / settings.PALLET_SCALE, 2),
            num_stops=len(route_stops),
            stops=stop_results,
        ))
        route_number += 1

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
    Re-read the original CSV and overwrite Seq and Rt columns
    with the solver's optimized values. Returns CSV as a string.
    """
    df = pd.read_csv(io.BytesIO(original_csv_bytes), encoding="utf-8-sig")

    # Build lookup: work_order_number -> (route_number, seq, vehicle, arrival)
    assignment = {}
    routes_data = solver_result["routes"]
    route_number = 1
    for vehicle_id, route_stops in routes_data.items():
        vehicle = vehicles[vehicle_id]
        for s in route_stops:
            stop = stops[s["stop_idx"]]
            for order_idx in stop.order_indices:
                order = orders[order_idx]
                assignment[order.work_order_number] = {
                    "Rt": route_number,
                    "Seq": s["seq"],  # same seq for all orders at same stop
                    "Vehicle": vehicle.name,
                    "Arrival": _minutes_to_time_str(s["arrival"]),
                }
        route_number += 1

    # Overwrite columns
    new_seq = []
    new_rt = []
    new_vehicle = []
    new_arrival = []

    for _, row in df.iterrows():
        wo = str(row["Work Order Number"])
        if wo in assignment:
            a = assignment[wo]
            new_rt.append(a["Rt"])
            new_seq.append(a["Seq"])
            new_vehicle.append(a["Vehicle"])
            new_arrival.append(a["Arrival"])
        else:
            new_rt.append("UNASSIGNED")
            new_seq.append(0)
            new_vehicle.append("")
            new_arrival.append("")

    df["Rt"] = new_rt
    df["Seq"] = new_seq
    df["Assigned Vehicle"] = new_vehicle
    df["Est. Arrival"] = new_arrival

    return df.to_csv(index=False)
