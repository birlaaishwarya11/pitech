from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers.optimize import router as optimize_router

app = FastAPI(
    title="piTech Route Optimizer",
    description="Automated route optimization for food bank deliveries using Google OR-Tools CVRPTW solver.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(optimize_router)


@app.get("/api/v1/health")
async def health_check():
    from app.config import settings
    import httpx

    ors_reachable = False
    try:
        async with httpx.AsyncClient(timeout=3) as hc:
            if "localhost" in settings.ORS_BASE_URL:
                r = await hc.get(f"{settings.ORS_BASE_URL}/v2/health")
                ors_reachable = r.status_code == 200
            else:
                # Public API — reachable if key is set
                ors_reachable = bool(settings.ORS_API_KEY)
    except Exception:
        pass

    return {
        "status": "healthy",
        "service": "piTech Route Optimizer",
        "ors_reachable": ors_reachable,
    }
