"""
Optimizer parameters schema for dynamic configuration
"""
from pydantic import BaseModel, Field
from typing import Optional


class OptimizerParams(BaseModel):
    """Dynamic optimizer parameters that can be modified per session/request"""
    
    # Solver — Wave 1
    solver_time_limit_seconds: int = Field(
        default=180, 
        ge=10, 
        le=600,
        description="Time limit for the initial solver run (10-600 seconds)"
    )
    solver_max_vehicle_time_minutes: int = Field(
        default=600,
        ge=60,
        le=1440,
        description="Maximum time a vehicle can be on the road (60-1440 minutes)"
    )
    solver_max_waiting_minutes: int = Field(
        default=300,
        ge=0,
        le=600,
        description="Maximum time a vehicle can wait at a stop (0-600 minutes)"
    )
    drop_penalty: int = Field(
        default=1000000,
        ge=100,
        description="Penalty for dropping an order (unassigned)"
    )
    
    # Solver — Wave 2
    wave2_reload_buffer_minutes: int = Field(
        default=30,
        ge=0,
        le=120,
        description="Depot turnaround time between waves (0-120 minutes)"
    )
    wave2_cutoff_minutes: int = Field(
        default=960,
        ge=300,
        le=1440,
        description="Cutoff time for wave 2 start (300-1440 minutes from midnight)"
    )
    wave2_solver_time_limit_seconds: int = Field(
        default=90,
        ge=10,
        le=300,
        description="Time limit for wave 2 solver (10-300 seconds)"
    )
    
    # Time windows
    depot_open_minutes: int = Field(
        default=480,
        ge=0,
        le=1440,
        description="Depot opening time in minutes from midnight (0-1440)"
    )
    depot_close_minutes: int = Field(
        default=1020,
        ge=0,
        le=1440,
        description="Depot closing time in minutes from midnight (0-1440)"
    )
    default_service_time: int = Field(
        default=30,
        ge=5,
        le=120,
        description="Default service time per stop in minutes (5-120)"
    )
    
    # Matrix/Distance options
    use_ors: bool = Field(
        default=True,
        description="Use OpenRouteService for real routing (True) or Haversine (False)"
    )
    ors_matrix_batch_size: int = Field(
        default=50,
        ge=10,
        le=100,
        description="Batch size for ORS matrix API calls (10-100)"
    )
    
    class Config:
        """Pydantic config"""
        json_schema_extra = {
            "example": {
                "solver_time_limit_seconds": 180,
                "solver_max_vehicle_time_minutes": 600,
                "solver_max_waiting_minutes": 300,
                "drop_penalty": 1000000,
                "wave2_reload_buffer_minutes": 30,
                "wave2_cutoff_minutes": 960,
                "wave2_solver_time_limit_seconds": 90,
                "depot_open_minutes": 480,
                "depot_close_minutes": 1020,
                "default_service_time": 30,
                "use_ors": True,
                "ors_matrix_batch_size": 50
            }
        }


class OptimizerParamsResponse(BaseModel):
    """Response with current optimizer parameters"""
    parameters: OptimizerParams
    message: str = "Current optimizer parameters"
