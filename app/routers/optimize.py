from fastapi import APIRouter, File, UploadFile, HTTPException, Query
from fastapi.responses import StreamingResponse
import io

from app.models.schemas import OptimizationResponse
from app.services.csv_parser import parse_orders_csv, parse_assets_csv
from app.services.grouper import group_orders_into_stops
from app.services.matrix_builder import build_unique_locations_from_stops, build_matrix
from app.services.solver import solve_vrp
from app.services.result_builder import build_response, build_csv_output

router = APIRouter(prefix="/api/v1", tags=["optimization"])


async def _run_optimization(
    orders_bytes: bytes,
    assets_bytes: bytes,
    use_ors: bool,
) -> tuple:
    """Shared optimization pipeline for both endpoints."""
    # 1. Parse CSVs (Seq and Rt from input are completely ignored)
    orders = parse_orders_csv(orders_bytes)
    vehicles = parse_assets_csv(assets_bytes)

    # 2. Group orders at same address into single physical stops
    #    Oversized stops are auto-split into truck-sized loads
    stops = group_orders_into_stops(orders, vehicles)

    # 3. Build deduplicated locations and distance/duration matrix
    unique_locations, stop_to_location = build_unique_locations_from_stops(stops)
    _distance_matrix, duration_matrix = build_matrix(
        unique_locations, use_ors=use_ors
    )

    # 4. Solve CVRPTW
    solver_result = solve_vrp(
        stops=stops,
        vehicles=vehicles,
        duration_matrix=duration_matrix,
        stop_to_location=stop_to_location,
    )

    return orders, stops, vehicles, solver_result


@router.post("/optimize", response_model=OptimizationResponse)
async def optimize_routes(
    orders_file: UploadFile = File(..., description="Orders CSV file"),
    assets_file: UploadFile = File(..., description="Asset/vehicle CSV file"),
    use_ors: bool = Query(True, description="Use OpenRouteService (True) or Haversine fallback (False)"),
):
    """
    Upload orders and asset CSVs, run route optimization,
    and return JSON results with new Rt and Seq assignments.
    Orders at the same address are grouped into single physical stops.
    Any existing Seq/Rt values in the input are completely ignored.
    """
    try:
        orders_bytes = await orders_file.read()
        assets_bytes = await assets_file.read()

        orders, stops, vehicles, solver_result = await _run_optimization(
            orders_bytes, assets_bytes, use_ors
        )

        return build_response(orders, stops, vehicles, solver_result)

    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Optimization failed: {str(e)}")


@router.post("/optimize/csv")
async def optimize_routes_csv(
    orders_file: UploadFile = File(..., description="Orders CSV file"),
    assets_file: UploadFile = File(..., description="Asset/vehicle CSV file"),
    use_ors: bool = Query(True, description="Use OpenRouteService (True) or Haversine fallback (False)"),
):
    """
    Upload orders and asset CSVs, run route optimization,
    and return a downloadable CSV with new Rt, Seq, Vehicle, and Arrival columns.
    Any existing Seq/Rt values in the input are completely overwritten.
    """
    try:
        orders_bytes = await orders_file.read()
        assets_bytes = await assets_file.read()

        orders, stops, vehicles, solver_result = await _run_optimization(
            orders_bytes, assets_bytes, use_ors
        )

        csv_output = build_csv_output(
            orders, stops, vehicles, solver_result, orders_bytes
        )

        return StreamingResponse(
            io.BytesIO(csv_output.encode("utf-8")),
            media_type="text/csv",
            headers={
                "Content-Disposition": "attachment; filename=optimized_routes.csv"
            },
        )

    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Optimization failed: {str(e)}")
