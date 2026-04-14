# TECH5930 Route Optimizer

This project is a **FastAPI backend + Vite/React frontend** integration for delivery route optimization and route visualization.

The current version supports:

- running the FastAPI backend locally
- running the Vite/React frontend locally
- uploading both **orders** and **assets** files
- calling the real backend optimize endpoint
- displaying optimized routes on an interactive map
- filtering by route
- clicking routes and stops to focus on them
- viewing stop details in map popups
- opening stops directly in Google Maps
- downloading a generated route plan as a `.txt` file

---

## Project Structure

```text
TECH5900
├─ backend
└─ frontend
```

---

## Current Status

### Implemented

- FastAPI backend runs successfully
- Vite/React frontend runs successfully
- backend health check is connected
- frontend can upload:
  - `orders_file`
  - `assets_file`
- frontend can call the real backend endpoint:
  - `POST /api/v1/optimize`
- frontend displays optimized routes on a map
- frontend supports:
  - all-routes view
  - single-route filtering
  - clicking a route line to focus on it
  - clicking a stop to focus on it
  - stop list navigation for a selected route
  - stop detail popups
  - Google Maps links for each stop
- frontend can download the optimization result as a readable text route plan

### Not Yet Implemented

- fully structured routing rules UI
- backend-driven vehicle cards in the sidebar
- polished final export formats beyond `.txt`
- remove / add / change stop workflow from the UI
- production-grade live traffic routing
- fully reliable large-scale road-network matrix optimization on the free ORS tier

---

## Backend Setup

Open a terminal and go to the backend folder:

```bash
cd backend
```

Create and activate a virtual environment if needed.

### macOS / Linux

```bash
python3 -m venv .venv
source .venv/bin/activate
```

### Windows

```bash
python -m venv .venv
.venv\Scripts\activate
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

Health check:

```text
http://127.0.0.1:8000/api/v1/health
```

Swagger docs:

```text
http://127.0.0.1:8000/docs
```

---

## Frontend Setup

Open another terminal and go to the frontend folder:

```bash
cd frontend
```

Install dependencies if needed:

```bash
npm install
```

Create a local frontend environment file:

```bash
cp .env.example .env
```

Run the frontend:

```bash
npm run dev
```

### Frontend URL

```text
http://localhost:5173
```

---

## Environment Variables

### Backend

Create `backend/.env` from `backend/.env.example`.

Example:

```env
ORS_API_KEY=your_openrouteservice_api_key_here
ORS_BASE_URL=https://api.openrouteservice.org
ORS_MATRIX_BATCH_SIZE=50
DEPOT_LAT=40.8094
DEPOT_LNG=-73.8796
```

### Frontend

Create `frontend/.env` from `frontend/.env.example`.

Example:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
```

---

## Quick Start Checklist

### Terminal 1 — Backend

#### macOS / Linux

```bash
cd backend
source .venv/bin/activate
python -m uvicorn app.main:app --reload --port 8000
```

#### Windows

```bash
cd backend
.venv\Scripts\activate
python -m uvicorn app.main:app --reload --port 8000
```

### Terminal 2 — Frontend

```bash
cd frontend
npm install
npm run dev
```

### Then open in browser

```text
http://localhost:5173
```

---

## How to Use

1. Start the backend
2. Start the frontend
3. Open the frontend in the browser
4. Upload:
   - an **orders** file
   - an **assets** file
5. Optionally add **special instructions**
6. Click **Generate Routes**
7. Review routes on the map
8. Optionally filter to a single route
9. Click stops or use the stop list to inspect route details
10. Download the route plan if needed

---

## Main Features

### Interactive Route Map

The map supports:

- displaying all routes together
- filtering to a single route
- clicking a route line to isolate that route
- clicking a stop to focus on it
- showing a stop list for the selected route
- jumping from the stop list to the selected stop on the map
- viewing stop details in a popup
- opening a stop in Google Maps

### Route Plan Download

The current downloadable output is:

```text
route_plan.txt
```

The route plan includes:

- route number
- vehicle assignment
- stop sequence
- stop address
- estimated arrival time
- pallets
- order types
- work order numbers

---

## Backend Endpoint Used

The frontend currently calls:

```text
POST /api/v1/optimize
```

Expected inputs:

- `orders_file` required
- `assets_file` required
- `special_instructions` optional
- `use_ors` query parameter

---

## ORS Notes and Fallback Behavior

This project uses **OpenRouteService (ORS)** in two different ways:

### 1. Matrix / optimization support

The backend attempts to use ORS for routing-related distance or time calculations.

However, the **free ORS tier is not sufficient for the current full matrix size** of this project. When the ORS matrix request exceeds the provider limit, the backend falls back to **Haversine-based distance estimation**.

This means:

- optimization can still run successfully
- routes can still be generated
- but the optimization is not always using a full road-network matrix

### 2. Route geometry for map rendering

After route order is solved, the backend attempts to call ORS directions for each route to get road-following map geometry.

This means:

- some routes can render as true road routes
- some routes may fail geometry generation for specific stops
- if geometry is unavailable, the frontend may fall back to straight-line rendering

So, in the current version:

- **the solver can still work even when ORS matrix fails**
- **map geometry may be partly road-based and partly fallback-based depending on the route**

---

## Current UI Notes

### Upload Files

The upload panel is connected to the real backend optimize flow.

### Fleet Display

The sidebar vehicle cards are not yet connected to backend route data.

Actual vehicle assignments are currently shown through:

- the map route labels
- the stop popups
- the downloaded route plan

### Routing Rules

The current version does not yet support a full structured rules-management UI.

Only optional **special instructions** entered during upload are supported.

### Route Result Display

The current frontend focuses on:

- route map visualization
- route filtering
- stop navigation
- route summary
- downloadable route plan

---

## Known Limitations

- ORS free-tier matrix limits are too small for the full optimization problem size
- some stops may fail ORS routability checks
- some routes may display road-following geometry while others may fall back
- live traffic is not supported in the current implementation
- sidebar vehicle cards are still informational only
- routing rules are not fully structured
- stop add / remove / change workflow is not implemented in the UI
- the project is currently intended for **local execution / demo use**, not production deployment

---

## Local Development Reminder

When reopening this project later, do **not** start from the frontend first.

Always follow this order:

1. Start backend
2. Confirm backend health check works
3. Start frontend
4. Open frontend in browser
5. Upload files
6. Generate routes
7. Review map and route plan
