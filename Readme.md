# TECH5930 Route Optimizer

A **FastAPI backend + Vite/React frontend + OpenRouteService** stack for delivery route optimization.

The system supports:

- uploading **orders** and **assets** CSV files
- optimizing delivery routes using OR-Tools with real road-distance matrices from ORS
- interactive route map with Leaflet (route filtering, stop popups, Google Maps links)
- downloading a generated route plan

---

## Project Structure

```text
piTech/
├─ backend/            # FastAPI + OR-Tools solver
├─ frontend/           # Vite / React + Leaflet map
├─ docker-compose.yml  # OpenRouteService container
└─ ors-data/           # ORS graph data (created on first run)
```

---

## Prerequisites

- **Python 3.10+**
- **Node.js 18+** and npm
- **Docker** (for OpenRouteService)

---

## 1. OpenRouteService (ORS) Setup

ORS provides real road-distance and travel-time matrices used by the solver. It runs as a Docker container.

### Start ORS

```bash
./scripts/setup-ors.sh
# docker compose up -d ors
```

On the first launch ORS will download the OpenStreetMap graph and build it. This can take **several minutes** (watch logs with `docker compose logs -f ors`). The service is ready when the health check passes:

```bash
curl http://localhost:8080/ors/v2/health
```

You should see `{"status":"ready"}`.

### ORS URL

```
http://localhost:8080/ors
```

The backend is pre-configured to use this URL (`ORS_BASE_URL` in `backend/app/config.py`).

> **Note:** If ORS is not running, the backend falls back to Haversine (straight-line) distances automatically.

---

## 2. Backend Setup

Open a terminal in the project root:

```bash
cd backend
```

Create and activate a virtual environment:

```bash
python -m venv .venv
source .venv/bin/activate        # macOS / Linux
# .venv\Scripts\activate         # Windows
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Create a local backend environment file:

```bash
cp .env.example .env
```

Then update `backend/.env` with your own values if needed.

Run the backend:

```bash
python -m uvicorn app.main:app --reload --port 8000
```

### Backend URLs

| Endpoint     | URL                                        |
| ------------ | ------------------------------------------ |
| Health check | http://127.0.0.1:8000/api/v1/health        |
| Swagger docs | http://127.0.0.1:8000/docs                 |

---

## 3. Frontend Setup

Open another terminal in the project root:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Create a local frontend environment file:

```bash
cp .env.example .env
```

Run the dev server:

```bash
npm run dev
```

### Frontend URL

```text
http://localhost:5173
```

---

## Quick Start (copy-paste)

Run these from the project root after cloning:

```bash
# 1. Backend
cd backend
python3 -m venv ../venv
source ../venv/bin/activate
pip install -r requirements.txt
echo 'ORS_BASE_URL=http://localhost:8080/ors' > .env
echo 'ORS_API_KEY=' >> .env
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
cd ..

# 2. Frontend
cd frontend
echo 'VITE_API_BASE_URL=http://localhost:8000' > .env.local
npm install
npm run dev &
cd ..

# 3. ORS (Docker) — road-accurate routing
./scripts/setup-ors.sh
# First run downloads NY OSM data (~300 MB) and builds graph (~3-5 min)
# Subsequent starts are instant
```

Open http://localhost:5173 in your browser.

### Without Docker (public ORS API fallback)

If Docker is unavailable, use the public ORS API (free tier — has quota limits):

```bash
# In backend/.env:
ORS_BASE_URL=https://api.openrouteservice.org
ORS_API_KEY=your_key_here
```

Get a free key at [openrouteservice.org/dev/#/signup](https://openrouteservice.org/dev/#/signup).

### Multi-terminal setup (alternative)

You need **three terminals** (or use `docker compose` for ORS and run the rest):

#### Terminal 1 — ORS

```bash
docker compose up -d ors
# Wait until healthy:
docker compose logs -f ors        # look for "ready"
```

#### Terminal 2 — Backend

```bash
cd backend
source ../venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

#### Terminal 3 — Frontend

```bash
cd frontend
npm run dev
```

Then open http://localhost:5173

---

## How to Use

1. Start ORS, backend, and frontend (see Quick Start above)
2. Open the frontend in the browser
3. Upload an **orders** CSV and an **assets** CSV
4. Optionally add **special instructions**
5. Click **Generate Routes**
6. View optimized routes on the interactive map
7. Download the route plan

---

## Architecture

```
                         ┌─────────────────────────────────────┐
                         │           Frontend (React)          │
                         │        http://localhost:5173         │
                         │  Upload CSV → View Map → Download   │
                         └──────────────┬──────────────────────┘
                                        │ POST /api/v1/optimize
                                        ▼
┌───────────────────────────────────────────────────────────────────┐
│                      Backend (FastAPI)                             │
│                    http://localhost:8000                           │
│                                                                   │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌───────────────┐  │
│  │  CSV     │──▶│ Grouper  │──▶│ ORS      │──▶│  OR-Tools     │  │
│  │  Parser  │   │ (stops)  │   │ Matrix   │   │  CVRPTW       │  │
│  └──────────┘   └──────────┘   └──────────┘   │  Solver       │  │
│       │                             │          └───────┬───────┘  │
│       │                             │                  │          │
│       ▼                             ▼                  ▼          │
│  Validate cols,            Distance/duration     Optimized routes │
│  coords, loads             matrix (real roads)   with assignments │
│                                                        │          │
│                         ┌──────────────┐               │          │
│                         │ ORS Geometry │◀──────────────┘          │
│                         │ (per route)  │                          │
│                         └──────┬───────┘                          │
│                                │                                  │
│                                ▼                                  │
│                     Road-following polylines                      │
│                     + distance per route                          │
└───────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
                         ┌──────────────────────────┐
                         │  OpenRouteService (ORS)   │
                         │  http://localhost:8080     │
                         │  Docker · driving-hgv     │
                         │  NY state OSM data        │
                         └──────────────────────────┘
```

**Data flow:** CSV upload → parse & validate → group orders into stops → build distance/duration matrix via ORS → solve CVRPTW with OR-Tools → build road geometry per route → return JSON to frontend → render on Leaflet map

---

## Backend API

Interactive Swagger docs are available at **http://localhost:8000/docs** when the backend is running.

### `GET /api/v1/health`

Health check. Returns ORS reachability status.

```json
{ "status": "healthy", "service": "piTech Route Optimizer", "ors_reachable": true }
```

### `POST /api/v1/optimize`

Main optimization endpoint. Returns JSON with optimized routes.

| Parameter              | Type   | In    | Required | Description |
| ---------------------- | ------ | ----- | -------- | ----------- |
| `orders_file`          | file   | body  | yes      | Orders CSV or XLS |
| `assets_file`          | file   | body  | yes      | Vehicle/asset CSV |
| `special_instructions` | string | body  | no       | Routing directives (skip, lock, priority, window, note) |
| `use_ors`              | bool   | query | no       | Use ORS for real road distances (default: true) |
| `depot_open`           | int    | query | no       | Depot open time in minutes from midnight (default: 480 = 8 AM) |
| `depot_close`          | int    | query | no       | Depot close time (default: 1020 = 5 PM) |
| `num_waves`            | int    | query | no       | Max dispatch waves: 1 or 2 (default: 2) |
| `wave2_cutoff`         | int    | query | no       | Wave 2 latest dispatch in minutes (default: 960 = 4 PM) |

**Response:** `OptimizationResponse` with routes, stops, geometry, distances, finish times, unassigned orders, and warnings.

### `POST /api/v1/optimize/csv`

Same as `/optimize` but returns a downloadable CSV file.

### `POST /api/v1/optimize/xlsx`

Same as `/optimize` but returns a downloadable Excel (.xlsx) file.

### Special instructions format

```
skip: WO#977187
lock: Salt & Sea Mission → truck=FB-1
priority: MUNA Social Service
window: WO#976054 → 08:30-10:00
note: WO#976055 → call 30min ahead
```

### Error responses

| Status | When |
| ------ | ---- |
| 422    | Empty file, missing columns, no valid coordinates, no vehicles |
| 500    | Solver failure, ORS unreachable (with Haversine fallback warning) |

---

## Deployment Guide

### Local development

See [Quick Start](#quick-start-copy-paste) above.

### Production deployment

#### Backend (any Linux server or cloud VM)

```bash
# Install Python 3.10+, clone repo
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Create .env with production settings
cat > .env << EOF
ORS_BASE_URL=http://localhost:8080/ors
ORS_API_KEY=
CORS_ORIGINS=https://your-frontend-domain.com
EOF

# Run with gunicorn for production
pip install gunicorn
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000
```

#### Frontend (static hosting — Vercel, Netlify, S3, etc.)

```bash
cd frontend

# Set the production API URL
echo 'VITE_API_BASE_URL=https://your-backend-domain.com' > .env.production

# Build static files
npm install && npm run build

# Deploy the dist/ folder to your hosting provider
```

#### ORS (Docker on the server)

```bash
# On the production server
./scripts/setup-ors.sh
# First run: ~5 min to build graph. After that, starts in seconds.
```

#### Environment variables reference

| Variable | Where | Default | Description |
| -------- | ----- | ------- | ----------- |
| `ORS_BASE_URL` | backend `.env` | `http://localhost:8080/ors` | ORS server URL |
| `ORS_API_KEY` | backend `.env` | (empty) | Only needed for public ORS API |
| `CORS_ORIGINS` | backend `.env` | `http://localhost:5173,...` | Comma-separated allowed origins |
| `DEPOT_LAT` | backend `.env` | `40.8094` | Depot latitude (Hunts Point) |
| `DEPOT_LNG` | backend `.env` | `-73.8796` | Depot longitude |
| `VITE_API_BASE_URL` | frontend `.env.local` | — | Backend API URL |

---

## Stopping Services

```bash
# Stop ORS
docker compose down

# Backend / Frontend — Ctrl+C in their respective terminals
```

---

## Troubleshooting

| Issue | Fix |
| ----- | --- |
| ORS health check fails | Wait a few more minutes on first run; check `docker compose logs ors` |
| Backend can't reach ORS | Ensure ORS container is running and healthy on port 8080 |
| Frontend shows network error | Confirm backend is running on port 8000 and `.env` has the correct URL |
| Routes use straight-line distances | ORS is not running or not healthy — start it with `docker compose up -d ors` |
| CORS error in browser | Add your frontend URL to `CORS_ORIGINS` in `backend/.env` |
| Empty file error | Ensure the CSV is not empty and has the required columns |
| All orders skipped | Verify Latitude/Longitude columns have valid NYC-area coordinates |
