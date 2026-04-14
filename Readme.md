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

## Quick Start (all three services)

You need **three terminals** (or use `docker compose` for ORS and run the rest):

### Terminal 1 — ORS

```bash
docker compose up -d ors
# Wait until healthy:
docker compose logs -f ors        # look for "ready"
```

### Terminal 2 — Backend

```bash
cd backend
source .venv/bin/activate
python -m uvicorn app.main:app --reload --port 8000
```

### Terminal 3 — Frontend

```bash
cd frontend
npm run dev
```

### Then open in browser

```text
http://localhost:5173
```

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
