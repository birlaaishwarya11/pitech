from fastapi import APIRouter, File, Form, UploadFile, HTTPException, Query
from fastapi.responses import StreamingResponse
from typing import Optional
import io

from backend.models.schemas import OptimizationResponse
from backend.models.optimizer_params import OptimizerParams
from backend.services.csv_parser import parse_orders_csv, parse_assets_csv
from backend.services.grouper import group_orders_into_stops
from backend.services.matrix_builder import build_unique_locations_from_stops, build_matrix
from backend.services.solver import solve_vrp
from backend.services.result_builder import build_response, build_csv_output
from backend.services.instructions_parser import parse_instructions
from backend.services.geocache import cache_stats
from backend.services.wave2 import plan_second_wave, merge_waves
from backend.routers.parameters import get_session_params

router = APIRouter(prefix="/api/v1", tags=["optimization"])


async def _run_optimization(
    orders_bytes: bytes,
    assets_bytes: bytes,
    use_ors: bool,
    time_limit_seconds: int = 60,
    api_instructions: str = "",
    params: OptimizerParams | None = None,
) -> tuple:
    """
    Shared optimization pipeline.

    Special instructions are resolved from two sources (merged in order):
      1. An 'Instructions' column in the orders file (per-row directives)
      2. The free-text `special_instructions` field in the API request

    Both are parsed before the solver runs, so skips/overrides/locks are
    applied during stop creation — the solver never sees excluded orders.
    """
    # 1. Parse file — returns (orders, inline_instructions_from_file)
    orders, inline_instructions = parse_orders_csv(orders_bytes)
    vehicles = parse_assets_csv(assets_bytes)

    # 2. Merge file-level + API-level instructions and parse into constraints
    combined_instructions = "\n".join(
        filter(None, [inline_instructions.strip(), api_instructions.strip()])
    )
    constraints = parse_instructions(combined_instructions)

    # 3. Group orders by (address, order_type), apply skip/window constraints,
    #    auto-split oversized loads, flag large orders
    stops = group_orders_into_stops(orders, vehicles, constraints)

    # 4. Build distance/duration matrix
    unique_locations, stop_to_location = build_unique_locations_from_stops(stops)
    _distance_matrix, duration_matrix = build_matrix(unique_locations, use_ors=use_ors)

    # 5. Solve CVRPTW — Wave 1
    solver_result = solve_vrp(
        stops=stops,
        vehicles=vehicles,
        duration_matrix=duration_matrix,
        stop_to_location=stop_to_location,
        time_limit_seconds=time_limit_seconds,
        params=params,
    )

    # 6. Wave 2: send eligible trucks back for unassigned stops
    if solver_result["dropped"]:
        wave2_result = plan_second_wave(
            dropped_stop_indices=solver_result["dropped"],
            stops=stops,
            vehicles=vehicles,
            wave1_routes=solver_result["routes"],
            duration_matrix=duration_matrix,
            stop_to_location=stop_to_location,
            params=params,
        )
        solver_result = merge_waves(solver_result, wave2_result)

    return orders, stops, vehicles, solver_result, constraints


@router.post("/optimize", response_model=OptimizationResponse)
async def optimize_routes(
    orders_file: UploadFile = File(..., description="Orders CSV or XLS file"),
    assets_file: UploadFile = File(..., description="Asset/vehicle CSV file"),
    use_ors: bool = Query(True, description="Use OpenRouteService (True) or Haversine fallback (False)"),
    time_limit_seconds: int = Query(60, description="Solver time limit in seconds (default: 60)"),
    session_id: str = Query("default", description="Session ID for parameter lookup"),
    special_instructions: Optional[str] = Form(
        None,
        description=(
            "Optional free-text routing directives (one per line).\n"
            "Examples:\n"
            "  skip: WO#977187\n"
            "  lock: Salt & Sea Mission → truck=FB-1\n"
            "  priority: MUNA Social Service\n"
            "  window: WO#976054 → 08:30-10:00\n"
            "  note: WO#976055 → call 30min ahead\n"
            "These are merged with any 'Instructions' column in the uploaded file."
        ),
    ),
):
    """
    Upload orders (CSV or XLS) and asset CSV, run route optimization,
    return JSON with new Rt and Seq assignments.

    Dry and Cold orders at the same address are routed as separate stops.
    Oversized stops are automatically split into truck-sized loads.
    Missing coordinates are resolved from the persistent geocode cache.
    """
    try:
        orders_bytes = await orders_file.read()
        assets_bytes = await assets_file.read()
        
        # Get parameters for this session
        params = get_session_params(session_id)
        
        # Override use_ors and time_limit_seconds from parameters if provided
        use_ors = use_ors if use_ors is not None else params.use_ors
        time_limit_seconds = time_limit_seconds if time_limit_seconds > 0 else params.solver_time_limit_seconds

        orders, stops, vehicles, solver_result, constraints = await _run_optimization(
            orders_bytes, assets_bytes, use_ors, time_limit_seconds, special_instructions or "", params=params
        )

        response = build_response(orders, stops, vehicles, solver_result)

        # Attach any instruction parse errors as a warning in the response
        if constraints.get("errors"):
            response.status = f"success (instruction warnings: {'; '.join(constraints['errors'])})"

        return response

    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Optimization failed: {str(e)}")


@router.post("/optimize/csv")
async def optimize_routes_csv(
    orders_file: UploadFile = File(..., description="Orders CSV or XLS file"),
    assets_file: UploadFile = File(..., description="Asset/vehicle CSV file"),
    use_ors: bool = Query(True, description="Use OpenRouteService (True) or Haversine fallback (False)"),
    time_limit_seconds: int = Query(60, description="Solver time limit in seconds (default: 60)"),
    special_instructions: Optional[str] = Form(
        None,
        description="Optional free-text routing directives — same format as /optimize.",
    ),
):
    """
    Upload orders (CSV or XLS) and asset CSV, run route optimization,
    return a downloadable CSV with new Rt, Seq, Vehicle, and Arrival columns.
    """
    try:
        orders_bytes = await orders_file.read()
        assets_bytes = await assets_file.read()

        orders, stops, vehicles, solver_result, _ = await _run_optimization(
            orders_bytes, assets_bytes, use_ors, time_limit_seconds, special_instructions or ""
        )

        csv_output = build_csv_output(orders, stops, vehicles, solver_result, orders_bytes)

        return StreamingResponse(
            io.BytesIO(csv_output.encode("utf-8")),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=optimized_routes.csv"},
        )

    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Optimization failed: {str(e)}")


@router.get("/geocache/stats")
async def geocache_statistics():
    """Return the number of cached addresses and database file size."""
    return cache_stats()
