from fastapi import FastAPI

from app.routers.optimize import router as optimize_router

app = FastAPI(
    title="piTech Route Optimizer",
    description="Automated route optimization for food bank deliveries using Google OR-Tools CVRPTW solver.",
    version="1.0.0",
)

app.include_router(optimize_router)


@app.get("/api/v1/health")
async def health_check():
    return {"status": "healthy", "service": "piTech Route Optimizer"}
