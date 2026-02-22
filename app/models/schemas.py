from pydantic import BaseModel


class OrderRecord(BaseModel):
    work_order_number: str
    customer_number: str
    name: str
    address: str
    city: str
    state: str
    zip_code: str
    latitude: float
    longitude: float
    open_time: int       # minutes from midnight
    close_time: int      # minutes from midnight
    service_time: int    # minutes
    total_pallets: int   # scaled by PALLET_SCALE
    weight: float
    order_type: str
    county: str
    delivery_instructions: str
    standing_appointment: bool
    original_index: int  # row index in the CSV


class GroupedStop(BaseModel):
    """Multiple orders at the same address grouped into one physical stop."""
    stop_id: int
    address: str
    city: str
    state: str
    zip_code: str
    name: str
    latitude: float
    longitude: float
    open_time: int           # tightest window start (max of all opens)
    close_time: int          # tightest window end (min of all closes)
    service_time: int        # single service time (one physical stop)
    total_pallets: int       # sum of all orders' pallets (scaled)
    total_weight: float
    county: str
    order_indices: list[int]  # indices into the orders list
    order_types: list[str]    # e.g. ["Dry", "Cold"]


class VehicleRecord(BaseModel):
    name: str
    capacity: int  # scaled by PALLET_SCALE


class StopResult(BaseModel):
    seq: int
    work_order_numbers: list[str]
    customer_number: str
    name: str
    address: str
    city: str
    state: str
    zip_code: str
    arrival_time_minutes: int
    pallets: float
    order_types: list[str]


class RouteResult(BaseModel):
    route_number: int
    vehicle: str
    vehicle_capacity_pallets: float
    total_pallets: float
    num_stops: int
    stops: list[StopResult]


class OptimizationResponse(BaseModel):
    status: str
    solver_status: str
    total_orders: int
    total_stops: int
    assigned_orders: int
    unassigned_orders: int
    routes_used: int
    vehicles_available: int
    routes: list[RouteResult]
    unassigned: list[dict]
