/**
 * Type definitions matching the FastAPI backend schemas
 */

export interface OrderRecord {
  work_order_number: string;
  customer_number: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  latitude: number;
  longitude: number;
  open_time: number;
  close_time: number;
  service_time: number;
  total_pallets: number;
  weight: number;
  order_type: string;
  county: string;
  delivery_instructions: string;
  standing_appointment: boolean;
  original_index: number;
}

export interface GroupedStop {
  stop_id: number;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  name: string;
  latitude: number;
  longitude: number;
  open_time: number;
  close_time: number;
  service_time: number;
  total_pallets: number;
  total_weight: number;
  county: string;
  order_indices: number[];
  order_types: string[];
  is_large_order?: boolean;
  special_note?: string;
}

export interface VehicleRecord {
  name: string;
  capacity: number;
}

export interface StopResult {
  seq: number;
  work_order_numbers: string[];
  customer_number: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  arrival_time_minutes: number;
  pallets: number;
  order_types: string[];
}

export interface RouteResult {
  route_number: number;
  vehicle: string;
  vehicle_capacity_pallets: number;
  total_pallets: number;
  num_stops: number;
  stops: StopResult[];
}

export interface OptimizationResponse {
  status: string;
  solver_status: string;
  total_orders: number;
  total_stops: number;
  assigned_orders: number;
  unassigned_orders: number;
  routes_used: number;
  vehicles_available: number;
  routes: RouteResult[];
  unassigned: Array<Record<string, unknown>>;
}

export interface DeleteStopRequest {
  vehicle_id: string;
  stop_index: number;
  reason?: string;
}

export interface DeleteStopResponse {
  vehicle_id: string;
  deleted_stop_index: number;
  updated_route: unknown[];
  total_distance?: number;
  total_time?: number;
  message: string;
}

export interface OptimizationParams {
  use_ors?: boolean;
  special_instructions?: string;
  time_limit_seconds?: number;
}
