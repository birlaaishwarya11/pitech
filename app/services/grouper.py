import math
from collections import defaultdict

from app.config import settings
from app.models.schemas import OrderRecord, GroupedStop, VehicleRecord


def group_orders_into_stops(
    orders: list[OrderRecord],
    vehicles: list[VehicleRecord],
) -> list[GroupedStop]:
    """
    Group orders at the same physical address into single stops.
    This matches the manual routing approach where Dry+Cold orders
    for the same customer/address are delivered as one physical stop.

    Oversized stops (pallets > max vehicle capacity) are automatically
    split into multiple truck-sized loads so nothing is left unassigned.

    Grouping key: (latitude, longitude) rounded to 6 decimals.
    """
    # Use the most common (smallest) vehicle capacity as the split target.
    # With 35 HINOs (9p) and 4 VOLVOs (21p), splitting to 9p ensures
    # every load can be served by ANY truck in the fleet.
    min_vehicle_capacity = min(v.capacity for v in vehicles)

    # Group by rounded coordinates
    coord_groups: dict[tuple, list[int]] = defaultdict(list)
    for i, order in enumerate(orders):
        key = (round(order.latitude, 6), round(order.longitude, 6))
        coord_groups[key].append(i)

    stops = []
    stop_id = 0

    for coord, indices in coord_groups.items():
        group_orders = [orders[i] for i in indices]

        # Sum pallets and weight
        total_pallets = sum(o.total_pallets for o in group_orders)
        total_weight = sum(o.weight for o in group_orders)

        # Tightest time window (intersection)
        open_time = max(o.open_time for o in group_orders)
        close_time = min(o.close_time for o in group_orders)

        # If intersection is empty, fall back to the widest window
        if open_time >= close_time:
            open_time = min(o.open_time for o in group_orders)
            close_time = max(o.close_time for o in group_orders)

        # Collect order types
        order_types = sorted(set(o.order_type for o in group_orders if o.order_type))

        # Address info from first order
        first = group_orders[0]
        county = first.county
        counties = [o.county for o in group_orders if o.county]
        if counties:
            county = max(set(counties), key=counties.count)

        # If total pallets fit in one truck, create a single stop
        if total_pallets <= min_vehicle_capacity:
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
            ))
            stop_id += 1
        else:
            # Split oversized stop into multiple truck-sized loads.
            # Each load is capped at min_vehicle_capacity. A single large
            # order that itself exceeds capacity is spread across multiple
            # loads (the same order_index appears in each sub-load, with
            # pallets divided evenly).
            num_loads = math.ceil(total_pallets / min_vehicle_capacity)
            pallets_per_load = total_pallets // num_loads
            remainder = total_pallets - pallets_per_load * num_loads

            # Weight follows the same proportional split
            weight_per_load = total_weight / num_loads

            for load_num in range(num_loads):
                load_pallets = pallets_per_load + (1 if load_num < remainder else 0)
                suffix = f" (Load {load_num + 1})"
                stops.append(GroupedStop(
                    stop_id=stop_id,
                    address=first.address,
                    city=first.city,
                    state=first.state,
                    zip_code=first.zip_code,
                    name=first.name + suffix,
                    latitude=first.latitude,
                    longitude=first.longitude,
                    open_time=open_time,
                    close_time=close_time,
                    service_time=settings.DEFAULT_SERVICE_TIME,
                    total_pallets=load_pallets,
                    total_weight=round(weight_per_load, 2),
                    county=county,
                    order_indices=indices,  # all orders linked to each sub-load
                    order_types=order_types,
                ))
                stop_id += 1

    return stops
