from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.routers.optimize import router as optimize_router
from backend.routers.customize import router as customize_router
from backend.routers.parameters import router as parameters_router

app = FastAPI(
    title="piTech Route Optimizer",
    description="Automated route optimization for food bank deliveries using Google OR-Tools CVRPTW solver.",
    version="1.0.0",
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],  # Next.js dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(optimize_router)
app.include_router(customize_router)
app.include_router(parameters_router)


@app.get("/api/v1/health")
async def health_check():
    return {"status": "healthy", "service": "piTech Route Optimizer"}
