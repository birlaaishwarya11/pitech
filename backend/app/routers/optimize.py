from fastapi import APIRouter, File, Form, UploadFile, HTTPException, Query
from fastapi.responses import StreamingResponse
from typing import Optional
import io

from app.models.schemas import OptimizationResponse
from app.services.csv_parser import parse_orders_csv, parse_assets_csv
from app.services.grouper import group_orders_into_stops
from app.services.matrix_builder import build_unique_locations_from_stops, build_matrix
from app.services.solver import solve_vrp
from app.services.result_builder import build_response, build_csv_output, build_xlsx_output
from app.services.instructions_parser import parse_instructions
from app.services.wave2 import plan_second_wave, merge_waves

router = APIRouter(prefix="/api/v1", tags=["optimization"])


async def _run_optimization(
    orders_bytes: bytes,
    assets_bytes: bytes,
    use_ors: bool,
    api_instructions: str = "",
    depot_open: int | None = None,
    depot_close: int | None = None,
    num_waves: int | None = None,
    wave2_cutoff: int | None = None,
) -> tuple:
    """
    Shared optimization pipeline.

    Special instructions are resolved from two sources (merged in order):
      1. An 'Instructions' column in the orders file (per-row directives)
      2. The free-text `special_instructions` field in the API request

    Both are parsed before the solver runs, so skips/overrides/locks are
    applied during stop creation — the solver never sees excluded orders.
    """
    orders, inline_instructions = parse_orders_csv(orders_bytes)
    vehicles = parse_assets_csv(assets_bytes)

    combined_instructions = "\n".join(
        filter(None, [inline_instructions.strip(), api_instructions.strip()])
    )
    constraints = parse_instructions(combined_instructions)

    stops = group_orders_into_stops(orders, vehicles, constraints)

    unique_locations, stop_to_location = build_unique_locations_from_stops(stops)
    _distance_matrix, duration_matrix, matrix_warnings = build_matrix(
        unique_locations, use_ors=use_ors,
    )

    solver_result = solve_vrp(
        stops=stops,
        vehicles=vehicles,
        duration_matrix=duration_matrix,
        stop_to_location=stop_to_location,
        depot_open_minutes=depot_open,
        depot_close_minutes=depot_close,
    )

    if solver_result["dropped"] and (num_waves is None or num_waves >= 2):
        wave2_result = plan_second_wave(
            dropped_stop_indices=solver_result["dropped"],
            stops=stops,
            vehicles=vehicles,
            wave1_routes=solver_result["routes"],
            duration_matrix=duration_matrix,
            stop_to_location=stop_to_location,
            depot_open_minutes=depot_open,
            wave2_cutoff_minutes=wave2_cutoff,
        )
        solver_result = merge_waves(solver_result, wave2_result)

    return orders, stops, vehicles, solver_result, constraints, matrix_warnings


@router.post("/optimize", response_model=OptimizationResponse)
async def optimize_routes(
    orders_file: UploadFile = File(..., description="Orders CSV or XLS file"),
    assets_file: UploadFile = File(..., description="Asset/vehicle CSV file"),
    use_ors: bool = Query(True, description="Use OpenRouteService (True) or Haversine fallback (False)"),
    depot_open: Optional[int] = Query(None, description="Depot open time in minutes from midnight (default 480 = 8:00 AM)"),
    depot_close: Optional[int] = Query(None, description="Depot close time in minutes from midnight (default 1020 = 5:00 PM)"),
    num_waves: Optional[int] = Query(None, description="Max number of dispatch waves: 1 or 2 (default 2)"),
    wave2_cutoff: Optional[int] = Query(None, description="Wave 2 latest dispatch in minutes from midnight (default 960 = 4:00 PM)"),
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
    Latitude and Longitude must be provided in the input file.
    """
    try:
        orders_bytes = await orders_file.read()
        assets_bytes = await assets_file.read()

        orders, stops, vehicles, solver_result, constraints, matrix_warnings = await _run_optimization(
            orders_bytes, assets_bytes, use_ors, special_instructions or "",
            depot_open=depot_open, depot_close=depot_close,
            num_waves=num_waves, wave2_cutoff=wave2_cutoff,
        )

        response = build_response(orders, stops, vehicles, solver_result)

        all_warnings = []
        if constraints.get("errors"):
            all_warnings.extend(constraints["errors"])
        if matrix_warnings:
            all_warnings.extend(matrix_warnings)
        if all_warnings:
            response.warnings = all_warnings

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
    depot_open: Optional[int] = Query(None, description="Depot open time in minutes from midnight (default 480 = 8:00 AM)"),
    depot_close: Optional[int] = Query(None, description="Depot close time in minutes from midnight (default 1020 = 5:00 PM)"),
    num_waves: Optional[int] = Query(None, description="Max number of dispatch waves: 1 or 2 (default 2)"),
    wave2_cutoff: Optional[int] = Query(None, description="Wave 2 latest dispatch in minutes from midnight (default 960 = 4:00 PM)"),
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

        orders, stops, vehicles, solver_result, _, _ = await _run_optimization(
            orders_bytes, assets_bytes, use_ors, special_instructions or "",
            depot_open=depot_open, depot_close=depot_close,
            num_waves=num_waves, wave2_cutoff=wave2_cutoff,
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


@router.post("/optimize/xlsx")
async def optimize_routes_xlsx(
    orders_file: UploadFile = File(..., description="Orders CSV or XLS file"),
    assets_file: UploadFile = File(..., description="Asset/vehicle CSV file"),
    use_ors: bool = Query(True, description="Use OpenRouteService (True) or Haversine fallback (False)"),
    depot_open: Optional[int] = Query(None, description="Depot open time in minutes from midnight (default 480 = 8:00 AM)"),
    depot_close: Optional[int] = Query(None, description="Depot close time in minutes from midnight (default 1020 = 5:00 PM)"),
    num_waves: Optional[int] = Query(None, description="Max number of dispatch waves: 1 or 2 (default 2)"),
    wave2_cutoff: Optional[int] = Query(None, description="Wave 2 latest dispatch in minutes from midnight (default 960 = 4:00 PM)"),
    special_instructions: Optional[str] = Form(
        None,
        description="Optional free-text routing directives — same format as /optimize.",
    ),
):
    """
    Upload orders (CSV or XLS) and asset CSV, run route optimization,
    return a downloadable Excel (.xlsx) with new Rt, Seq, Vehicle, and Arrival columns.
    """
    try:
        orders_bytes = await orders_file.read()
        assets_bytes = await assets_file.read()

        orders, stops, vehicles, solver_result, _, _ = await _run_optimization(
            orders_bytes, assets_bytes, use_ors, special_instructions or "",
            depot_open=depot_open, depot_close=depot_close,
            num_waves=num_waves, wave2_cutoff=wave2_cutoff,
        )

        xlsx_bytes = build_xlsx_output(orders, stops, vehicles, solver_result, orders_bytes)

        return StreamingResponse(
            io.BytesIO(xlsx_bytes),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=optimized_routes.xlsx"},
        )

    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Optimization failed: {str(e)}")
