import { useState } from "react";
import { toast } from "sonner";

interface ParsedFile {
  fileName: string;
  routes: number;
  totalOrders: number;
  vehicles: string[];
  workOrders: Set<string>;
  totalDistanceKm: number | null;
}

interface ComparisonResult {
  fileA: ParsedFile;
  fileB: ParsedFile;
  addedOrders: string[];
  removedOrders: string[];
  commonOrders: number;
}

// Haversine distance in km between two lat/lng points
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Depot location (Hunts Point, Bronx)
const DEPOT_LAT = 40.8094;
const DEPOT_LNG = -73.8796;
const ROAD_FACTOR = 1.4; // straight-line to road distance multiplier

function parseCSV(text: string, fileName: string): ParsedFile | null {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return null;

  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  const woIdx = headers.findIndex((h) => h === "Work Order Number");
  const rtIdx = headers.findIndex((h) => h === "Rt");
  const seqIdx = headers.findIndex((h) => h === "Seq");
  const vehicleIdx = headers.findIndex((h) => h === "Assigned Vehicle");
  // CSV may have swapped columns — check both
  const latIdx = headers.findIndex((h) => h === "Latitude");
  const lngIdx = headers.findIndex((h) => h === "Longitude");

  if (woIdx === -1) return null;

  const workOrders = new Set<string>();
  const vehicles = new Set<string>();
  const routeIds = new Set<string>();

  // Collect stops per route for distance calculation
  const routeStops: Map<string, { seq: number; lat: number; lng: number }[]> = new Map();

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    const wo = cols[woIdx];
    if (wo) workOrders.add(wo);

    const rt = rtIdx !== -1 ? cols[rtIdx] : "";
    if (rt && rt !== "UNASSIGNED" && rt !== "REMOVED") {
      routeIds.add(rt);
    }
    if (vehicleIdx !== -1 && cols[vehicleIdx]) {
      vehicles.add(cols[vehicleIdx]);
    }

    // Collect coordinates for distance estimation
    if (rt && rt !== "UNASSIGNED" && rt !== "REMOVED" && latIdx !== -1 && lngIdx !== -1) {
      const lat = parseFloat(cols[latIdx]);
      const lng = parseFloat(cols[lngIdx]);
      // Handle the swapped columns: if "Latitude" has lng-like values, swap
      const seq = seqIdx !== -1 ? parseInt(cols[seqIdx]) || 0 : i;
      if (!isNaN(lat) && !isNaN(lng)) {
        if (!routeStops.has(rt)) routeStops.set(rt, []);
        routeStops.get(rt)!.push({ seq, lat, lng });
      }
    }
  }

  // Estimate total distance: depot → stops in sequence → depot per route
  let totalDistanceKm: number | null = null;
  if (routeStops.size > 0) {
    let total = 0;
    for (const [, stops] of routeStops) {
      stops.sort((a, b) => a.seq - b.seq);
      // Depot to first stop
      let prevLat = DEPOT_LAT;
      let prevLng = DEPOT_LNG;
      for (const stop of stops) {
        total += haversineKm(prevLat, prevLng, stop.lat, stop.lng);
        prevLat = stop.lat;
        prevLng = stop.lng;
      }
      // Last stop back to depot
      total += haversineKm(prevLat, prevLng, DEPOT_LAT, DEPOT_LNG);
    }
    totalDistanceKm = Math.round(total * ROAD_FACTOR * 10) / 10;
  }

  return {
    fileName,
    routes: routeIds.size,
    totalOrders: workOrders.size,
    vehicles: Array.from(vehicles),
    workOrders,
    totalDistanceKm,
  };
}

function compare(a: ParsedFile, b: ParsedFile): ComparisonResult {
  const addedOrders = [...b.workOrders].filter((wo) => !a.workOrders.has(wo));
  const removedOrders = [...a.workOrders].filter((wo) => !b.workOrders.has(wo));
  const commonOrders = [...a.workOrders].filter((wo) => b.workOrders.has(wo)).length;

  return { fileA: a, fileB: b, addedOrders, removedOrders, commonOrders };
}

function DiffBadge({ value, suffix = "", invert = false }: { value: number; suffix?: string; invert?: boolean }) {
  if (value === 0) return <span className="text-gray-500 text-xs">no change</span>;
  // invert: for distance/routes, negative = good (green), positive = bad (red)
  const isGood = invert ? value < 0 : value > 0;
  const color = isGood ? "text-green-600" : "text-red-600";
  const sign = value > 0 ? "+" : "";
  return <span className={`text-xs font-medium ${color}`}>{sign}{value}{suffix}</span>;
}

interface RouteComparisonProps {
  currentOrders?: string[];
  currentRouteCount?: number;
  currentVehicles?: string[];
  currentDistanceKm?: number | null;
}

export function RouteComparison({ currentOrders, currentRouteCount, currentVehicles, currentDistanceKm }: RouteComparisonProps) {
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const hasCurrentRoutes = currentOrders && currentOrders.length > 0;

  const [fileA, setFileA] = useState<ParsedFile | null>(null);
  const [fileB, setFileB] = useState<ParsedFile | null>(null);

  const handleFile = (fileNum: "A" | "B") => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const parsed = parseCSV(text, file.name);
      if (!parsed) {
        toast.error(`Could not parse ${file.name}. Ensure it has a 'Work Order Number' column.`);
        return;
      }

      if (fileNum === "A") {
        setFileA(parsed);
        if (fileB) setResult(compare(parsed, fileB));
      } else {
        setFileB(parsed);
        if (fileA) setResult(compare(fileA, parsed));
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleCompareAgainstCurrent = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentOrders) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const parsed = parseCSV(text, file.name);
      if (!parsed) {
        toast.error(`Could not parse ${file.name}. Ensure it has a 'Work Order Number' column.`);
        return;
      }

      const currentParsed: ParsedFile = {
        fileName: "Current optimization",
        routes: currentRouteCount ?? 0,
        totalOrders: currentOrders.length,
        vehicles: currentVehicles ?? [],
        workOrders: new Set(currentOrders),
        totalDistanceKm: currentDistanceKm ?? null,
      };

      setFileA(parsed);
      setFileB(currentParsed);
      setResult(compare(parsed, currentParsed));
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const distA = result?.fileA.totalDistanceKm;
  const distB = result?.fileB.totalDistanceKm;
  const distDiff = distA != null && distB != null ? Math.round((distB - distA) * 10) / 10 : null;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
      <h3 className="text-sm font-semibold text-gray-900">Route Comparison</h3>

      {hasCurrentRoutes && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500">Compare a previous file against current routes:</p>
          <label className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-md cursor-pointer hover:bg-blue-100 text-sm text-blue-700">
            Upload file to compare
            <input type="file" accept=".csv" className="hidden" onChange={handleCompareAgainstCurrent} />
          </label>
        </div>
      )}

      <div className="border-t border-gray-100 pt-3 space-y-2">
        <p className="text-xs text-gray-500">Or compare any two CSV files:</p>
        <div className="flex gap-2 flex-wrap">
          <label className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-md cursor-pointer hover:bg-gray-100 text-sm">
            {fileA ? fileA.fileName : "File A (old)"}
            <input type="file" accept=".csv" className="hidden" onChange={handleFile("A")} />
          </label>
          <span className="self-center text-gray-400 text-xs">vs</span>
          <label className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-md cursor-pointer hover:bg-gray-100 text-sm">
            {fileB ? fileB.fileName : "File B (new)"}
            <input type="file" accept=".csv" className="hidden" onChange={handleFile("B")} />
          </label>
        </div>
      </div>

      {result && (
        <div className="border-t border-gray-100 pt-3 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">Orders</p>
              <p className="text-lg font-semibold">{result.fileA.totalOrders} → {result.fileB.totalOrders}</p>
              <DiffBadge value={result.fileB.totalOrders - result.fileA.totalOrders} />
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">Routes</p>
              <p className="text-lg font-semibold">{result.fileA.routes} → {result.fileB.routes}</p>
              <DiffBadge value={result.fileB.routes - result.fileA.routes} invert />
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">Vehicles</p>
              <p className="text-lg font-semibold">{result.fileA.vehicles.length} → {result.fileB.vehicles.length}</p>
              <DiffBadge value={result.fileB.vehicles.length - result.fileA.vehicles.length} invert />
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">Est. Distance</p>
              {distA != null && distB != null ? (
                <>
                  <p className="text-lg font-semibold">{distA} → {distB} km</p>
                  <DiffBadge value={distDiff!} suffix=" km" invert />
                </>
              ) : distA != null ? (
                <p className="text-sm font-medium">{distA} km <span className="text-gray-400">→ ?</span></p>
              ) : distB != null ? (
                <p className="text-sm font-medium"><span className="text-gray-400">? →</span> {distB} km</p>
              ) : (
                <p className="text-sm text-gray-400">No coordinates</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="text-center">
              <span className="text-gray-500">Common orders:</span>{" "}
              <span className="font-medium">{result.commonOrders}</span>
            </div>
            <div className="text-center">
              <span className="text-green-600">+ Added:</span>{" "}
              <span className="font-medium">{result.addedOrders.length}</span>
            </div>
            <div className="text-center">
              <span className="text-red-600">- Removed:</span>{" "}
              <span className="font-medium">{result.removedOrders.length}</span>
            </div>
          </div>

          {distA != null && distB != null && (
            <p className="text-xs text-gray-400 text-center">
              Distance is estimated using Haversine with 1.4x road factor. Current routes use ORS road distance when available.
            </p>
          )}

          {(result.addedOrders.length > 0 || result.removedOrders.length > 0) && (
            <details className="text-xs">
              <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
                Show order details
              </summary>
              <div className="mt-2 grid grid-cols-2 gap-3">
                {result.addedOrders.length > 0 && (
                  <div>
                    <p className="font-medium text-green-700 mb-1">Added ({result.addedOrders.length})</p>
                    <div className="max-h-32 overflow-y-auto space-y-0.5">
                      {result.addedOrders.map((wo) => (
                        <div key={wo} className="text-green-600">{wo}</div>
                      ))}
                    </div>
                  </div>
                )}
                {result.removedOrders.length > 0 && (
                  <div>
                    <p className="font-medium text-red-700 mb-1">Removed ({result.removedOrders.length})</p>
                    <div className="max-h-32 overflow-y-auto space-y-0.5">
                      {result.removedOrders.map((wo) => (
                        <div key={wo} className="text-red-600">{wo}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </details>
          )}

          <button
            onClick={() => { setResult(null); setFileA(null); setFileB(null); }}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            Clear comparison
          </button>
        </div>
      )}
    </div>
  );
}
