from ortools.constraint_solver import routing_enums_pb2, pywrapcp

from app.config import settings
from app.models.schemas import GroupedStop, VehicleRecord


def solve_vrp(
    stops: list[GroupedStop],
    vehicles: list[VehicleRecord],
    duration_matrix: list[list[int]],       # seconds, indexed by unique location
    stop_to_location: list[int],            # stop index -> unique location index
    vehicle_start_times: list[int] | None = None,  # per-vehicle earliest depot departure (minutes)
    time_limit_seconds: int | None = None,
    depot_open_minutes: int | None = None,
    depot_close_minutes: int | None = None,
) -> dict:
    """
    Solve the CVRPTW using Google OR-Tools.
    Works with grouped stops (multiple orders per physical stop).

    Returns:
        {
            "status": str,
            "routes": {vehicle_id: [{"stop_idx": int, "seq": int, "arrival": int}]},
            "dropped": [stop_idx, ...]
        }
    """
    num_stops = len(stops)
    num_vehicles = len(vehicles)
    # Node 0 = depot, nodes 1..N = stops
    num_nodes = 1 + num_stops
    depot_index = 0

    # --- Index Manager ---
    manager = pywrapcp.RoutingIndexManager(num_nodes, num_vehicles, depot_index)
    routing = pywrapcp.RoutingModel(manager)

    # --- Helper: map solver node to location matrix index ---
    def node_to_loc(node: int) -> int:
        if node == 0:
            return 0  # depot
        return stop_to_location[node - 1]

    # --- Time/Transit callback ---
    def time_callback(from_index, to_index):
        from_node = manager.IndexToNode(from_index)
        to_node = manager.IndexToNode(to_index)
        from_loc = node_to_loc(from_node)
        to_loc = node_to_loc(to_node)
        travel_seconds = duration_matrix[from_loc][to_loc]
        travel_minutes = travel_seconds // 60
        # Add service time at the from_node (0 for depot)
        svc = 0 if from_node == 0 else stops[from_node - 1].service_time
        return travel_minutes + svc

    transit_callback_index = routing.RegisterTransitCallback(time_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)

    # --- Time Dimension (with time windows) ---
    routing.AddDimension(
        transit_callback_index,
        settings.SOLVER_MAX_WAITING_MINUTES,       # max waiting time (slack)
        1440,   # max cumul value (minutes in a day, since cumul = absolute time)
        False,                                       # don't force start cumul to 0
        "Time",
    )
    time_dimension = routing.GetDimensionOrDie("Time")

    # Set time windows for each stop node
    for stop_idx in range(num_stops):
        node = stop_idx + 1  # node 0 is depot
        index = manager.NodeToIndex(node)
        stop = stops[stop_idx]
        time_dimension.CumulVar(index).SetRange(stop.open_time, stop.close_time)

    # Set depot time windows for each vehicle
    # vehicle_start_times allows wave-2 trucks to depart after returning to depot
    for v in range(num_vehicles):
        start_index = routing.Start(v)
        end_index = routing.End(v)
        d_open = depot_open_minutes if depot_open_minutes is not None else settings.DEPOT_OPEN_MINUTES
        d_close = depot_close_minutes if depot_close_minutes is not None else settings.DEPOT_CLOSE_MINUTES
        v_start = vehicle_start_times[v] if vehicle_start_times else d_open
        time_dimension.CumulVar(start_index).SetRange(v_start, d_close)
        time_dimension.CumulVar(end_index).SetRange(v_start, d_close)

    # Minimize total route time
    for v in range(num_vehicles):
        time_dimension.SetSpanCostCoefficientForVehicle(1, v)

    # --- Capacity Dimension ---
    def demand_callback(from_index):
        from_node = manager.IndexToNode(from_index)
        if from_node == 0:
            return 0
        return stops[from_node - 1].total_pallets

    demand_callback_index = routing.RegisterUnaryTransitCallback(demand_callback)
    vehicle_capacities = [v.capacity for v in vehicles]
    routing.AddDimensionWithVehicleCapacity(
        demand_callback_index,
        0,                   # no slack
        vehicle_capacities,  # per-vehicle capacity
        True,                # start cumul to zero
        "Capacity",
    )

    # --- Disjunctions: allow dropping stops with penalty ---
    for stop_idx in range(num_stops):
        node = stop_idx + 1
        routing.AddDisjunction(
            [manager.NodeToIndex(node)], settings.DROP_PENALTY
        )

    # --- Search Parameters ---
    search_params = pywrapcp.DefaultRoutingSearchParameters()
    search_params.first_solution_strategy = (
        routing_enums_pb2.FirstSolutionStrategy.PARALLEL_CHEAPEST_INSERTION
    )
    search_params.local_search_metaheuristic = (
        routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    )
    limit = time_limit_seconds if time_limit_seconds is not None else settings.SOLVER_TIME_LIMIT_SECONDS
    search_params.time_limit.FromSeconds(limit)
    search_params.log_search = False

    # --- Solve ---
    solution = routing.SolveWithParameters(search_params)

    if not solution:
        status_map = {
            0: "ROUTING_NOT_SOLVED",
            1: "ROUTING_SUCCESS",
            2: "ROUTING_PARTIAL_SUCCESS_LOCAL_OPTIMUM_NOT_REACHED",
            3: "ROUTING_FAIL",
            4: "ROUTING_FAIL_TIMEOUT",
            5: "ROUTING_INVALID",
            6: "ROUTING_INFEASIBLE",
        }
        solver_status = status_map.get(routing.status(), f"UNKNOWN_{routing.status()}")
        return {
            "status": "no_solution",
            "solver_status": solver_status,
            "routes": {},
            "dropped": list(range(num_stops)),
        }

    # --- Extract Solution ---
    routes = {}
    assigned_stops = set()

    for vehicle_id in range(num_vehicles):
        route_stops = []
        index = routing.Start(vehicle_id)
        seq = 0

        while not routing.IsEnd(index):
            node = manager.IndexToNode(index)
            if node != depot_index:
                seq += 1
                stop_idx = node - 1
                arrival = solution.Value(time_dimension.CumulVar(index))
                route_stops.append({
                    "stop_idx": stop_idx,
                    "seq": seq,
                    "arrival": arrival,
                })
                assigned_stops.add(stop_idx)
            index = solution.Value(routing.NextVar(index))

        if route_stops:
            # Calculate finish time: last stop arrival + service there + drive back to depot
            last = route_stops[-1]
            last_service = stops[last["stop_idx"]].service_time
            last_loc = stop_to_location[last["stop_idx"]]
            depot_loc = 0
            return_drive_minutes = duration_matrix[last_loc][depot_loc] // 60
            finish_time = last["arrival"] + last_service + return_drive_minutes

            for s in route_stops:
                s["finish_time"] = finish_time

            routes[vehicle_id] = route_stops

    # Find dropped stops
    dropped = [i for i in range(num_stops) if i not in assigned_stops]

    return {
        "status": "success",
        "solver_status": "ROUTING_SUCCESS",
        "routes": routes,
        "dropped": dropped,
    }
