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
    return {"status": "healthy", "service": "piTech Route Optimizer"}
