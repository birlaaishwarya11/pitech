from pydantic import BaseModel
from typing import Optional


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
    open_time: int
    close_time: int
    service_time: int
    total_pallets: int
    weight: float
    order_type: str
    county: str
    delivery_instructions: str
    standing_appointment: bool
    original_index: int


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
    open_time: int
    close_time: int
    service_time: int
    total_pallets: int
    total_weight: float
    county: str
    order_indices: list[int]
    order_types: list[str]
    is_large_order: bool = False
    special_note: str = ""


class VehicleRecord(BaseModel):
    name: str
    capacity: int


class DepotInfo(BaseModel):
    name: str
    latitude: float
    longitude: float


class RouteGeometry(BaseModel):
    type: str
    coordinates: list[list[float]]  # GeoJSON: [lng, lat]


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
    latitude: float
    longitude: float


class RouteResult(BaseModel):
    route_number: int
    vehicle: str
    vehicle_capacity_pallets: float
    total_pallets: float
    num_stops: int
    stops: list[StopResult]
    geometry: Optional[RouteGeometry] = None


class OptimizationResponse(BaseModel):
    status: str
    solver_status: str
    total_orders: int
    total_stops: int
    assigned_orders: int
    unassigned_orders: int
    routes_used: int
    vehicles_available: int
    depot: DepotInfo
    routes: list[RouteResult]
    unassigned: list[dict]