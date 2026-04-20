from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.config import settings
from app.routers.optimize import router as optimize_router

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="piTech Route Optimizer",
    description="Automated route optimization for food bank deliveries using Google OR-Tools CVRPTW solver.",
    version="1.0.0",
)
app.state.limiter = limiter


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={"detail": "Rate limit exceeded. Please wait before submitting another optimization."},
    )


cors_origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(optimize_router)


@app.get("/api/v1/health")
async def health_check():
    import httpx

    ors_reachable = False
    try:
        async with httpx.AsyncClient(timeout=3) as hc:
            if "localhost" in settings.ORS_BASE_URL:
                r = await hc.get(f"{settings.ORS_BASE_URL}/v2/health")
                ors_reachable = r.status_code == 200
            else:
                ors_reachable = bool(settings.ORS_API_KEY)
    except Exception:
        pass

    return {
        "status": "healthy",
        "service": "piTech Route Optimizer",
        "ors_reachable": ors_reachable,
    }
