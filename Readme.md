# TECH5930 Route Optimizer

This project is a **FastAPI backend + Vite/React frontend** integration for delivery route optimization.

At the current stage, the system supports:

- running the FastAPI backend locally
- running the Vite/React frontend locally
- uploading both **orders** and **assets** files
- calling the real backend optimize endpoint
- downloading a generated route plan as a `.txt` file

---

## Project Structure

```text
TECH5900
├─ backend
└─ frontend
```

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
- frontend can download the optimization result as a readable text route plan

### Not Yet Implemented

- live route map rendering
- backend-driven vehicle cards in the sidebar
- fully structured routing rules UI
- CSV/PDF export as polished final artifacts
- remove/change stop

------

## Backend Setup

Open a terminal and go to the backend folder:

```
cd backend
```

Create and activate a virtual environment if needed:

```
python -m venv .venv
.venv\Scripts\activate
```

Install dependencies:

```
pip install -r requirements.txt
```

Run the backend:

```
python -m uvicorn app.main:app --reload --port 8000
```

### Backend URLs

Health check:

```
http://127.0.0.1:8000/api/v1/health
```

Swagger docs:

```
http://127.0.0.1:8000/docs
```

------

## Frontend Setup

Open another terminal and go to the frontend folder:

```
cd frontend
```

Install dependencies if needed:

```
npm install
```

Create or update the `.env` file inside `frontend/`:

```
VITE_API_BASE_URL=http://127.0.0.1:8000
```

Run the frontend:

```
npm run dev
```

### Frontend URL

```
http://localhost:5173
```

------

## Quick Start Checklist

### Terminal 1 — Backend

```
cd backend
.venv\Scripts\activate
python -m uvicorn app.main:app --reload --port 8000
```

### Terminal 2 — Frontend

```
cd frontend
npm install
npm run dev
```

### Then open in browser

```
http://localhost:5173
```

------

## How to Use

1. Start the backend
2. Start the frontend
3. Open the frontend in the browser
4. Upload:
   - an **orders** file
   - an **assets** file
5. Optionally add **special instructions**
6. Click **Generate Routes**
7. After optimization succeeds, click **Download Route Plan**

------

## Main Output

The main output of the current version is a downloadable text file:

```
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

------

## Current UI Notes

### Upload Files

The upload panel is connected to the real backend optimize flow.

### Fleet Display

The vehicle cards shown earlier in the old dashboard are **not** currently connected to backend route data.
 In the current version, actual vehicle assignments are shown in the downloaded route plan.

### Routing Rules

The current version does **not** yet support a full rules management UI.
 Only optional **special instructions** entered during upload are supported.

### Route Result Display

The current frontend version focuses on:

- optimization summary
- route plan download

Raw JSON output and unfinished map placeholders were removed to make the UI cleaner.

------

## Backend Endpoint Used

The frontend currently calls:

```
POST /api/v1/optimize
```

Expected inputs:

- `orders_file` (required)
- `assets_file` (required)
- `special_instructions` (optional)
- `use_ors` (query parameter)

------

## Notes

- The backend currently falls back to **Haversine distance** if ORS is not configured.
- The route output is currently provided as a downloadable text file.
- The frontend dashboard is only partially connected to real backend output.
- The current version is intended as a working integration demo, not yet a fully polished final product.

------

## Known Limitations

- Map visualization is not connected yet
- Sidebar vehicle cards are placeholders / informational only
- Routing rules are not fully structured
- Downloaded text output is currently the primary result artifact
- Removing/changing stops is not implemented yet
- This project is currently intended for **local execution**

------

## Personal Reminder

When reopening this project later, do **not** start from the frontend first.

Always follow this order:

1. Start backend
2. Confirm backend health check works
3. Start frontend
4. Open frontend in browser
5. Upload files
6. Generate routes
7. Download route plan