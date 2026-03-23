import math
from collections import defaultdict

from app.config import settings
from app.models.schemas import OrderRecord, GroupedStop, VehicleRecord


def group_orders_into_stops(
    orders: list[OrderRecord],
    vehicles: list[VehicleRecord],
    constraints: dict | None = None,
) -> list[GroupedStop]:
    """
    Group orders into physical stops with two key rules:

    1. Dry and Cold orders are NEVER grouped into the same stop,
       even if they share an address. Each type gets its own stop.

    2. Stops that exceed the smallest vehicle capacity are auto-split
       into truck-sized loads so every load can be served by any truck.
       These are flagged as is_large_order=True.

    Grouping key: (latitude, longitude, order_type)

    constraints dict (from instructions_parser) may contain:
      - skip_wos: set of WO numbers to exclude
      - window_overrides: {wo: (open_min, close_min)}
      - notes: {wo: note_text}
    """
    constraints = constraints or {}
    skip_wos = constraints.get("skip_wos", set())
    window_overrides = constraints.get("window_overrides", {})
    notes = constraints.get("notes", {})

    min_cap = min(v.capacity for v in vehicles)  # split target = smallest truck (HINO 9p)

    # Group by (lat, lng, order_type) — Dry and Cold stay separate
    coord_groups: dict[tuple, list[int]] = defaultdict(list)
    for i, order in enumerate(orders):
        if order.work_order_number in skip_wos:
            continue
        # Apply window override before grouping
        if order.work_order_number in window_overrides:
            open_m, close_m = window_overrides[order.work_order_number]
            order = order.model_copy(update={"open_time": open_m, "close_time": close_m})
            orders[i] = order
        key = (round(order.latitude, 6), round(order.longitude, 6), order.order_type)
        coord_groups[key].append(i)

    stops = []
    stop_id = 0

    for key, indices in coord_groups.items():
        order_type = key[2]
        group_orders = [orders[i] for i in indices]

        total_pallets = sum(o.total_pallets for o in group_orders)
        total_weight = sum(o.weight for o in group_orders)

        # Tightest time window (intersection), fall back to widest if empty
        open_time = max(o.open_time for o in group_orders)
        close_time = min(o.close_time for o in group_orders)
        if open_time >= close_time:
            open_time = min(o.open_time for o in group_orders)
            close_time = max(o.close_time for o in group_orders)

        order_types = [order_type] if order_type else []

        first = group_orders[0]
        county = first.county
        counties = [o.county for o in group_orders if o.county]
        if counties:
            county = max(set(counties), key=counties.count)

        # Collect any pass-through notes for orders in this group
        stop_note = "; ".join(
            f"WO#{orders[i].work_order_number}: {notes[orders[i].work_order_number]}"
            for i in indices
            if orders[i].work_order_number in notes
        )

        if total_pallets <= min_cap:
            # Normal stop — fits on any truck as-is
            stops.append(GroupedStop(
                stop_id=stop_id,
                address=first.address,
                city=first.city,
                state=first.state,
                zip_code=first.zip_code,
                name=first.name,
                latitude=first.latitude,
                longitude=first.longitude,
                open_time=open_time,
                close_time=close_time,
                service_time=settings.DEFAULT_SERVICE_TIME,
                total_pallets=total_pallets,
                total_weight=total_weight,
                county=county,
                order_indices=indices,
                order_types=order_types,
                is_large_order=False,
                special_note=stop_note,
            ))
            stop_id += 1
        else:
            # Large order — split into min_cap-sized loads, flag each as large
            num_loads = math.ceil(total_pallets / min_cap)
            pallets_per_load = total_pallets // num_loads
            remainder = total_pallets - pallets_per_load * num_loads
            weight_per_load = total_weight / num_loads

            for load_num in range(num_loads):
                load_pallets = pallets_per_load + (1 if load_num < remainder else 0)
                stops.append(GroupedStop(
                    stop_id=stop_id,
                    address=first.address,
                    city=first.city,
                    state=first.state,
                    zip_code=first.zip_code,
                    name=f"{first.name} (Load {load_num + 1})",
                    latitude=first.latitude,
                    longitude=first.longitude,
                    open_time=open_time,
                    close_time=close_time,
                    service_time=settings.DEFAULT_SERVICE_TIME,
                    total_pallets=load_pallets,
                    total_weight=round(weight_per_load, 2),
                    county=county,
                    order_indices=indices,
                    order_types=order_types,
                    is_large_order=True,
                    special_note=stop_note,
                ))
                stop_id += 1

    return stops
