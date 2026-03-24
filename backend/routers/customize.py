from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter(prefix="/api/v1", tags=["customizer"])

class DeleteStopRequest(BaseModel):
    """Request model for deleting a stop from an optimized route"""
    vehicle_id: str
    stop_index: int
    reason: Optional[str] = None

class DeleteStopResponse(BaseModel):
    """Response model after deleting a stop"""
    vehicle_id: str
    deleted_stop_index: int
    updated_route: List
    total_distance: Optional[float] = None
    total_time: Optional[float] = None
    message: str

@router.post("/delete-stop", response_model=DeleteStopResponse)
async def delete_stop(request: DeleteStopRequest):
    """
    Delete a stop from an optimized vehicle route.
    
    Takes the output from the optimize endpoint and removes a specific stop
    from a vehicle's route, then recalculates the route metrics.
    
    Args:
        request: DeleteStopRequest containing vehicle_id and stop_index
        
    Returns:
        DeleteStopResponse with updated route information
    """
    try:
        # Validate that vehicle_id exists in current routes
        if not vehicle_id:
            raise HTTPException(status_code=400, detail="Vehicle ID is required")
        
        # Validate stop_index is valid
        if request.stop_index < 0:
            raise HTTPException(status_code=400, detail="Stop index must be non-negative")
        
        # TODO: Implement logic to:
        # 1. Fetch the current optimized route for the vehicle
        # 2. Validate that stop_index exists in the route
        # 3. Remove the stop at the specified index
        # 4. Recalculate distance and time metrics
        # 5. Update the route
        
        # Placeholder response
        return DeleteStopResponse(
            vehicle_id=request.vehicle_id,
            deleted_stop_index=request.stop_index,
            updated_route=[],  # Updated route after deletion
            total_distance=0.0,
            total_time=0.0,
            message=f"Stop at index {request.stop_index} deleted successfully"
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))