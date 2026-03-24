"""
Router for managing optimizer parameters
"""
from fastapi import APIRouter, HTTPException
from backend.models.optimizer_params import OptimizerParams, OptimizerParamsResponse
from backend.config import settings

router = APIRouter(prefix="/api/v1/parameters", tags=["parameters"])

# In-memory session parameters (in production, use Redis or a database)
session_params: dict[str, OptimizerParams] = {}


def get_session_params(session_id: str = "default") -> OptimizerParams:
    """Get parameters for a session, or create with defaults"""
    if session_id not in session_params:
        session_params[session_id] = OptimizerParams(
            solver_time_limit_seconds=settings.SOLVER_TIME_LIMIT_SECONDS,
            solver_max_vehicle_time_minutes=settings.SOLVER_MAX_VEHICLE_TIME_MINUTES,
            solver_max_waiting_minutes=settings.SOLVER_MAX_WAITING_MINUTES,
            drop_penalty=settings.DROP_PENALTY,
            wave2_reload_buffer_minutes=settings.WAVE2_RELOAD_BUFFER_MINUTES,
            wave2_cutoff_minutes=settings.WAVE2_CUTOFF_MINUTES,
            wave2_solver_time_limit_seconds=settings.WAVE2_SOLVER_TIME_LIMIT_SECONDS,
            depot_open_minutes=settings.DEPOT_OPEN_MINUTES,
            depot_close_minutes=settings.DEPOT_CLOSE_MINUTES,
            default_service_time=settings.DEFAULT_SERVICE_TIME,
            use_ors=True,  # Default to ORS
            ors_matrix_batch_size=settings.ORS_MATRIX_BATCH_SIZE,
        )
    return session_params[session_id]


@router.get("/", response_model=OptimizerParamsResponse)
async def get_parameters(session_id: str = "default"):
    """
    Get current optimizer parameters for a session
    
    If the session doesn't exist, returns defaults from config.
    """
    params = get_session_params(session_id)
    return OptimizerParamsResponse(parameters=params)


@router.post("/", response_model=OptimizerParamsResponse)
async def update_parameters(
    params: OptimizerParams,
    session_id: str = "default"
):
    """
    Update optimizer parameters for a session
    
    Parameters persist for the duration of the session.
    Validations are enforced via Pydantic field constraints.
    """
    try:
        # Validate times consistency
        if params.depot_open_minutes >= params.depot_close_minutes:
            raise HTTPException(
                status_code=400,
                detail="depot_open_minutes must be less than depot_close_minutes"
            )
        
        if params.wave2_cutoff_minutes <= params.depot_open_minutes:
            raise HTTPException(
                status_code=400,
                detail="wave2_cutoff_minutes must be after depot_open_minutes"
            )
        
        # Store the parameters
        session_params[session_id] = params
        
        return OptimizerParamsResponse(
            parameters=params,
            message=f"Parameters updated for session '{session_id}'"
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/reset", response_model=OptimizerParamsResponse)
async def reset_parameters(session_id: str = "default"):
    """
    Reset parameters to defaults for a session
    """
    # Remove the session entry so it will use defaults next time
    if session_id in session_params:
        del session_params[session_id]
    
    params = get_session_params(session_id)
    return OptimizerParamsResponse(
        parameters=params,
        message=f"Parameters reset to defaults for session '{session_id}'"
    )


@router.get("/defaults", response_model=OptimizerParamsResponse)
async def get_default_parameters():
    """
    Get the default optimizer parameters from config
    """
    defaults = OptimizerParams(
        solver_time_limit_seconds=settings.SOLVER_TIME_LIMIT_SECONDS,
        solver_max_vehicle_time_minutes=settings.SOLVER_MAX_VEHICLE_TIME_MINUTES,
        solver_max_waiting_minutes=settings.SOLVER_MAX_WAITING_MINUTES,
        drop_penalty=settings.DROP_PENALTY,
        wave2_reload_buffer_minutes=settings.WAVE2_RELOAD_BUFFER_MINUTES,
        wave2_cutoff_minutes=settings.WAVE2_CUTOFF_MINUTES,
        wave2_solver_time_limit_seconds=settings.WAVE2_SOLVER_TIME_LIMIT_SECONDS,
        depot_open_minutes=settings.DEPOT_OPEN_MINUTES,
        depot_close_minutes=settings.DEPOT_CLOSE_MINUTES,
        default_service_time=settings.DEFAULT_SERVICE_TIME,
        use_ors=True,
        ors_matrix_batch_size=settings.ORS_MATRIX_BATCH_SIZE,
    )
    return OptimizerParamsResponse(
        parameters=defaults,
        message="Default optimizer parameters from config"
    )
