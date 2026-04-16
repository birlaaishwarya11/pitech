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
docker compose up -d ors
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

## Backend API

The frontend calls:

```
POST /api/v1/optimize
```

| Parameter              | Type   | Required |
| ---------------------- | ------ | -------- |
| `orders_file`          | file   | yes      |
| `assets_file`          | file   | yes      |
| `special_instructions` | string | no       |
| `use_ors`              | query  | no       |
| `depot_open`           | query  | no       |
| `depot_close`          | query  | no       |
| `num_waves`            | query  | no       |
| `wave2_cutoff`         | query  | no       |

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
