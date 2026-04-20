from fastapi import APIRouter, File, Form, Request, UploadFile, HTTPException, Query
from fastapi.responses import StreamingResponse
from typing import Optional
import io

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

from app.config import settings
from app.models.schemas import OptimizationResponse
from app.services.csv_parser import parse_orders_csv, parse_assets_csv
from app.services.grouper import group_orders_into_stops
from app.services.matrix_builder import build_unique_locations_from_stops, build_matrix
from app.services.solver import solve_vrp
from app.services.result_builder import build_response, build_csv_output, build_xlsx_output
from app.services.instructions_parser import parse_instructions
from app.services.route_geometry import calculate_route_distance
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
    avoid_vehicles: list[str] | None = None,
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
    all_vehicles = parse_assets_csv(assets_bytes)

    # Filter out avoided vehicles (case-insensitive match on name)
    if avoid_vehicles:
        avoided_set = {name.strip().lower() for name in avoid_vehicles if name.strip()}
        vehicles = [v for v in all_vehicles if v.name.strip().lower() not in avoided_set]
        if not vehicles:
            raise ValueError(
                f"All {len(all_vehicles)} vehicles were marked as avoided — "
                "at least one vehicle must remain available."
            )
    else:
        vehicles = all_vehicles

    combined_instructions = "\n".join(
        filter(None, [inline_instructions.strip(), api_instructions.strip()])
    )
    constraints = parse_instructions(combined_instructions)

    stops = group_orders_into_stops(orders, vehicles, constraints)

    unique_locations, stop_to_location = build_unique_locations_from_stops(stops)
    _distance_matrix, duration_matrix, matrix_warnings = build_matrix(
        unique_locations, use_ors=use_ors,
    )

    # Scale solver time with problem size — small sets don't need 180s
    num_stops = len(stops)
    solver_time = min(30 + num_stops, settings.SOLVER_TIME_LIMIT_SECONDS)

    solver_result = solve_vrp(
        stops=stops,
        vehicles=vehicles,
        duration_matrix=duration_matrix,
        stop_to_location=stop_to_location,
        time_limit_seconds=solver_time,
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
@limiter.limit("10/minute")
async def optimize_routes(
    request: Request,
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
    avoid_vehicles: Optional[str] = Form(
        None,
        description="Comma-separated list of vehicle names to exclude from routing.",
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

        avoided_list = [v.strip() for v in avoid_vehicles.split(",") if v.strip()] if avoid_vehicles else None

        orders, stops, vehicles, solver_result, constraints, matrix_warnings = await _run_optimization(
            orders_bytes, assets_bytes, use_ors, special_instructions or "",
            depot_open=depot_open, depot_close=depot_close,
            num_waves=num_waves, wave2_cutoff=wave2_cutoff,
            avoid_vehicles=avoided_list,
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
@limiter.limit("10/minute")
async def optimize_routes_csv(
    request: Request,
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
    avoid_vehicles: Optional[str] = Form(
        None,
        description="Comma-separated list of vehicle names to exclude from routing.",
    ),
):
    """
    Upload orders (CSV or XLS) and asset CSV, run route optimization,
    return a downloadable CSV with new Rt, Seq, Vehicle, and Arrival columns.
    """
    try:
        orders_bytes = await orders_file.read()
        assets_bytes = await assets_file.read()

        avoided_list = [v.strip() for v in avoid_vehicles.split(",") if v.strip()] if avoid_vehicles else None

        orders, stops, vehicles, solver_result, _, _ = await _run_optimization(
            orders_bytes, assets_bytes, use_ors, special_instructions or "",
            depot_open=depot_open, depot_close=depot_close,
            num_waves=num_waves, wave2_cutoff=wave2_cutoff,
            avoid_vehicles=avoided_list,
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
@limiter.limit("10/minute")
async def optimize_routes_xlsx(
    request: Request,
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
    avoid_vehicles: Optional[str] = Form(
        None,
        description="Comma-separated list of vehicle names to exclude from routing.",
    ),
):
    """
    Upload orders (CSV or XLS) and asset CSV, run route optimization,
    return a downloadable Excel (.xlsx) with new Rt, Seq, Vehicle, and Arrival columns.
    """
    try:
        orders_bytes = await orders_file.read()
        assets_bytes = await assets_file.read()

        avoided_list = [v.strip() for v in avoid_vehicles.split(",") if v.strip()] if avoid_vehicles else None

        orders, stops, vehicles, solver_result, _, _ = await _run_optimization(
            orders_bytes, assets_bytes, use_ors, special_instructions or "",
            depot_open=depot_open, depot_close=depot_close,
            num_waves=num_waves, wave2_cutoff=wave2_cutoff,
            avoid_vehicles=avoided_list,
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


@router.post("/compare/distance")
@limiter.limit("20/minute")
async def compare_file_distance(
    request: Request,
    file: UploadFile = File(..., description="CSV with Rt, Seq, Latitude, Longitude columns"),
):
    """
    Calculate total road distance (km) for routes in an uploaded CSV
    using ORS Directions. No solver run — just distance calculation.

    The CSV must have: Rt (route number), Latitude, Longitude.
    Seq (stop sequence) is optional but recommended for correct ordering.
    Stops are grouped by Rt and ordered by Seq.
    Each route is measured as: depot -> stops in order -> depot.
    """
    import pandas as pd
    from io import BytesIO

    try:
        file_bytes = await file.read()
        if not file_bytes or not file_bytes.strip():
            raise ValueError("Uploaded file is empty.")

        df = pd.read_csv(BytesIO(file_bytes), encoding="utf-8-sig")

        required = ["Rt", "Latitude", "Longitude"]
        missing = [c for c in required if c not in df.columns]
        if missing:
            raise ValueError(
                f"File missing required columns: {missing}. "
                "Need at least: Rt, Latitude, Longitude."
            )

        has_seq = "Seq" in df.columns

        route_distances: dict[str, float | None] = {}
        total_km = 0.0
        routes_measured = 0

        for rt, group in df.groupby("Rt"):
            rt_str = str(rt)
            if rt_str in ("UNASSIGNED", "REMOVED", ""):
                continue

            if has_seq:
                group = group.sort_values("Seq")

            coords = [(settings.DEPOT_LNG, settings.DEPOT_LAT)]
            for _, row in group.iterrows():
                try:
                    lat_f = float(row["Latitude"])
                    lng_f = float(row["Longitude"])
                    coords.append((lng_f, lat_f))
                except (TypeError, ValueError):
                    continue
            coords.append((settings.DEPOT_LNG, settings.DEPOT_LAT))

            if len(coords) < 3:
                route_distances[rt_str] = None
                continue

            dist = calculate_route_distance(coords)
            route_distances[rt_str] = dist
            if dist is not None:
                total_km += dist
                routes_measured += 1

        return {
            "file_name": file.filename,
            "total_routes": len(route_distances),
            "routes_measured": routes_measured,
            "total_distance_km": round(total_km, 1),
            "route_distances_km": route_distances,
        }

    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Distance calculation failed: {str(e)}")
