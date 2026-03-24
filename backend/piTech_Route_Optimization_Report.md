# piTech Route Optimization System
## Technical & Business Overview

---

## 1. Executive Summary

piTech is an automated route optimization system for food bank delivery operations across New York City. It replaces manual dispatch planning with a mathematical solver that assigns trucks, sequences stops, and enforces capacity and time constraints — in under 4 minutes per day.

**Results across 8 production datasets:**

| Metric | Manual | piTech |
|---|---|---|
| Planning time | 2–4 hours/day | 2–4 minutes/day |
| Capacity violations | 6–13/day | **0** |
| Orders successfully assigned | 100% (via overloading) | **98.7%** (constraint-safe) |
| Trucks deployed (avg) | 35 | 21 |
| Fleet utilization | Untracked | 38–95% (visible) |

---

## 2. Problem Statement

Manual routing produces plans that are fast to create but unsafe and inefficient to execute:

- Trucks are regularly loaded beyond physical capacity — sometimes 6× the limit — with no visibility or flag
- Morning and afternoon deliveries are mixed on the same route, risking customer time window violations
- More trucks are dispatched than necessary on most days
- Dry and Cold orders are combined at the same stop, which is incorrect operationally
- Planning consumes 2–4 hours of dispatcher time daily with no repeatable process

---

## 3. How It Works

### 3.1 System Flow

```
Orders File (CSV or XLS)
    │
    ├─ Missing coordinates? → Geocode via OpenStreetMap (cached to SQLite DB)
    ├─ Special instructions? → Parse skip / lock / window / priority / note directives
    │
    └─ Group by (Address + Order Type)  ← Dry and Cold always separate stops
           │
           ├─ Stop > truck capacity? → Auto-split into truck-sized loads
           │
           └─ Build Distance Matrix (OpenRouteService API or Haversine fallback)
                  │
                  └─ OR-Tools CVRPTW Solver (120s time limit)
                         │
                         └─ Output: Route #, Sequence, Vehicle, Est. Arrival
```

### 3.2 Key Constraints Enforced

| Constraint | Detail |
|---|---|
| Vehicle capacity | 9p (HINO) or 21p (VOLVO) — hard limit, never exceeded |
| Time windows | Every stop served within customer-specified open/close window |
| Dry / Cold separation | Each order type gets its own stop — never combined |
| Service time | 30 minutes per physical stop |
| Depot hours | Departure ≥ 08:00, return ≤ 17:00 |
| Oversized loads | Automatically split across multiple truck-sized loads, flagged in output |

### 3.3 Tech Stack

| Component | Technology | Cost |
|---|---|---|
| API Framework | Python + FastAPI | Free |
| Solver | Google OR-Tools (CVRPTW) | Free |
| Road distances | OpenRouteService API | Free tier |
| Geocoding | Nominatim / OpenStreetMap | Free |
| Geocode storage | SQLite (→ Azure SQL on migration) | Free |
| File parsing | Pandas + lxml | Free |

**Total licensing cost: $0**

---

## 4. Results Summary

### 4.1 Capacity Compliance
- **0 capacity violations** across all 8 test runs
- Manual routing produced 6–13 violations per day (trucks loaded up to 6× limit)
- Oversized deliveries are split into multiple truck-sized loads automatically

### 4.2 Fleet Efficiency

| Volume | Trucks Used (Manual) | Trucks Used (piTech) | Saved |
|---|---|---|---|
| Light day (~50 orders) | ~15 | 6 | ~9 |
| Normal day (~90–140 orders) | ~30 | 11–13 | ~17–19 |
| Heavy day (~160–190 orders) | 33–39 | 22–35 | ~4–17 |
| Fleet-capacity-exceeded day | 39 (overloaded) | 39 (flagged unassigned) | 0 — genuine constraint |

### 4.3 When Orders Go Unassigned

On one dataset, 14 orders (1.3% of total) could not be assigned. This is not a software failure — it is the system correctly identifying a day where demand exceeds total fleet capacity. The manual system "assigned" those orders by ignoring weight limits.

The optimizer surfaces this as actionable output: which orders, which stops, and why — so dispatchers can schedule a second dispatch wave or request temporary fleet augmentation.

### 4.4 Processing Time

| Condition | Time |
|---|---|
| All addresses in geocode cache | 2–3 minutes |
| New addresses (first upload) | +~1 sec per new address |
| Geocode cache populated after first run | Subsequent runs: 2–3 min always |

---

## 5. Special Instructions

Dispatchers can override routing behavior without modifying the solver. Instructions are applied **before** the solver runs — excluded orders are invisible to the optimizer entirely.

### 5.1 Method 1 — Column in the Orders File

Add an **`Instructions`** column to the orders file. Leave blank for normal routing.

| Work Order | Name | Instructions |
|---|---|---|
| 977187 | Food Bank Mobile Pantry | `skip: WO#977187` |
| 976054 | MUNA Social Service | `window: WO#976054 → 08:30-10:00` |
| 976055 | Salt & Sea Mission | `lock: Salt & Sea Mission → truck=FB-1` |
| 976056 | Campaign Against Hunger | `note: WO#976056 → call ahead 30min` |
| 976057 | Bethel AME Church | *(blank — routes normally)* |

- Multi-line cells supported (Alt+Enter in Excel)
- Column is optional — if absent, silently ignored
- Accepted column names: `Instructions`, `Special Instructions`, `Routing Instructions`, `Dispatcher Notes`

### 5.2 Method 2 — API Text Field

Pass `special_instructions` as a form field in the upload request. Useful for same-day changes without touching the source file.

```
skip: WO#977187
lock: Salt & Sea Mission → truck=FB-1
priority: MUNA Social Service
window: WO#976054 → 08:30-10:00
note: WO#976055 → call 30min ahead
```

Both sources are merged before processing. Duplicates are harmless.

### 5.3 Supported Directives

| Directive | Syntax | Effect |
|---|---|---|
| `skip` | `skip: WO#977187` | Removes order — never routed |
| `lock` | `lock: <name> → truck=FB-1` | Pins stop to a specific vehicle |
| `priority` | `priority: <name>` | Forces Seq 1 on its route |
| `window` | `window: WO#976054 → 08:30-10:00` | Overrides the file's time window |
| `note` | `note: WO#976055 → call 30min ahead` | Label in output CSV, no routing effect |

Malformed lines are returned as warnings in the API response — no silent failures.

---

## 6. Geocoding & Address Resolution

When coordinates are missing from the input file, the system geocodes each address automatically using OpenStreetMap.

### 6.1 Cache Architecture

```
Address → Check SQLite DB → Hit: use stored coords (instant, 0 API calls)
                          → Miss: call Nominatim API (~1 sec) → Save to DB
```

- Each address is geocoded **once, ever** — all future uploads use the cache
- Cache is a single `geocache.db` file — portable, backupable, transferable
- **Azure SQL migration**: replace one function (`_get_conn()`) with a connection string — schema is identical

### 6.2 Geocoding Providers

| Provider | Rate | Free Tier | Notes |
|---|---|---|---|
| Nominatim (OSM) | 1 req/sec | Unlimited | Current — sufficient with cache |
| Google Maps | 50 req/sec | 40K/month | Upgrade path for high new-customer volume |
| Mapbox | 10 req/sec | 100K/month | Alternative |

With ~500 unique customer addresses and a warm cache, daily new-address volume is typically 0–5 — well within any free tier.

---

## 7. API Reference

| Method | Endpoint | Input | Output |
|---|---|---|---|
| `POST` | `/api/v1/optimize` | Orders file + Assets file | JSON route assignments |
| `POST` | `/api/v1/optimize/csv` | Orders file + Assets file | Downloadable CSV with Rt, Seq, Vehicle, Arrival |
| `GET` | `/api/v1/geocache/stats` | — | Cached address count + DB size |
| `GET` | `/api/v1/health` | — | Service status |

Both upload endpoints accept `special_instructions` as an optional form field and support `?use_ors=false` for offline mode (Haversine distances).

---

## 8. Deployment

### Current (Local / Linux Server)
```bash
pip install -r requirements.txt
echo "ORS_API_KEY=your_key" > .env   # optional — improves distance accuracy
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Azure Migration Path
| Component | Current | Azure Target |
|---|---|---|
| API server | uvicorn on Linux | Azure App Service (Python) |
| Geocode DB | `geocache.db` (SQLite) | Azure SQL Database (one connection string change) |
| File storage | Local filesystem | Azure Blob Storage |
| Secrets | `.env` file | Azure Key Vault |

The solver (OR-Tools) and all business logic require no changes for Azure.

---

## 9. Configurable Parameters

| Parameter | Default | Description |
|---|---|---|
| `SOLVER_TIME_LIMIT_SECONDS` | 120 | Max solver runtime |
| `DEFAULT_SERVICE_TIME` | 30 min | Unload time per stop |
| `DEPOT_OPEN_MINUTES` | 480 (8:00 AM) | Earliest departure |
| `DEPOT_CLOSE_MINUTES` | 1020 (5:00 PM) | Latest return |
| `DROP_PENALTY` | 1,000,000 | Cost weight for unassigned orders |
| `GEOCACHE_DB` | `geocache.db` | Override DB path via environment variable |

---

## 10. Open Questions for Production

| # | Question | Impact |
|---|---|---|
| 1 | What is the exact depot coordinates (loading dock)? | Affects every route's first/last leg |
| 2 | Are time windows in the file hard cutoffs or preferred ranges? | Changes how violations are penalized |
| 3 | Should large recurring stops (e.g. Mobile Pantries) be pre-configured as fixed multi-truck deliveries? | Reduces unassigned risk on high-volume days |
| 4 | Does truck type matter per stop (e.g. straight trucks only)? | Requires per-stop vehicle type constraint in solver |
| 5 | What is the source system for orders — and can we pull directly vs. file upload? | Eliminates manual export step |
| 6 | Is a two-wave dispatch formalized for days exceeding fleet capacity? | Resolves the unassigned orders problem completely |

---

*piTech Route Optimization System — tested across 8 delivery datasets, 1,053 total orders.*
*Report version: March 2026*
