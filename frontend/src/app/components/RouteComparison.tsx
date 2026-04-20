import { useState } from "react";
import { toast } from "sonner";
import { X, Loader2 } from "lucide-react";

interface ParsedFile {
  fileName: string;
  routes: number;
  totalOrders: number;
  vehicles: string[];
  workOrders: Set<string>;
  totalDistanceKm: number | null;
  distanceLoading: boolean;
  rawFile?: File;
}

interface ComparisonResult {
  fileA: ParsedFile;
  fileB: ParsedFile;
  addedOrders: string[];
  removedOrders: string[];
  commonOrders: number;
}

function parseCSVText(text: string, fileName: string): Omit<ParsedFile, "distanceLoading" | "rawFile"> | null {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return null;

  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  const woIdx = headers.findIndex((h) => h === "Work Order Number");
  const rtIdx = headers.findIndex((h) => h === "Rt");
  const vehicleIdx = headers.findIndex((h) => h === "Assigned Vehicle");

  if (woIdx === -1) return null;

  const workOrders = new Set<string>();
  const vehicles = new Set<string>();
  const routeIds = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    const wo = cols[woIdx];
    if (wo) workOrders.add(wo);

    const rt = rtIdx !== -1 ? cols[rtIdx] : "";
    if (rt && rt !== "UNASSIGNED" && rt !== "REMOVED") routeIds.add(rt);
    if (vehicleIdx !== -1 && cols[vehicleIdx]) vehicles.add(cols[vehicleIdx]);
  }

  return {
    fileName,
    routes: routeIds.size,
    totalOrders: workOrders.size,
    vehicles: Array.from(vehicles),
    workOrders,
    totalDistanceKm: null,
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
  apiBaseUrl?: string;
}

export function RouteComparison({ currentOrders, currentRouteCount, currentVehicles, currentDistanceKm, apiBaseUrl }: RouteComparisonProps) {
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [distanceLoading, setDistanceLoading] = useState<"A" | "B" | "both" | null>(null);
  const hasCurrentRoutes = currentOrders && currentOrders.length > 0;

  const [fileA, setFileA] = useState<ParsedFile | null>(null);
  const [fileB, setFileB] = useState<ParsedFile | null>(null);

  const baseUrl = apiBaseUrl || import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

  // Fetch ORS road distance from backend for a file
  const fetchDistance = async (file: File): Promise<number | null> => {
    try {
      const formData = new FormData();
      formData.append("file", file);
      const resp = await fetch(`${baseUrl}/api/v1/compare/distance`, {
        method: "POST",
        body: formData,
      });
      if (!resp.ok) return null;
      const data = await resp.json();
      return data.total_distance_km ?? null;
    } catch {
      return null;
    }
  };

  const processFile = async (
    file: File,
    text: string,
    slot: "A" | "B",
    otherSlot: ParsedFile | null,
  ) => {
    const parsed = parseCSVText(text, file.name);
    if (!parsed) {
      toast.error(`Could not parse ${file.name}. Ensure it has a 'Work Order Number' column.`);
      return;
    }

    const full: ParsedFile = { ...parsed, distanceLoading: true, rawFile: file };

    if (slot === "A") {
      setFileA(full);
      if (otherSlot) setResult(compare(full, otherSlot));
    } else {
      setFileB(full);
      if (otherSlot) setResult(compare(otherSlot, full));
    }

    // Check if file has Rt + Lat/Lng columns for distance calculation
    const firstLine = text.trim().split("\n")[0];
    const headers = firstLine.split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
    const hasRouteData = headers.includes("Rt") && headers.includes("Latitude") && headers.includes("Longitude");

    let distance: number | null = null;
    if (hasRouteData) {
      setDistanceLoading(slot);
      distance = await fetchDistance(file);
      setDistanceLoading(null);
    }

    const withDist: ParsedFile = { ...full, totalDistanceKm: distance, distanceLoading: false };

    if (slot === "A") {
      setFileA(withDist);
      if (otherSlot) setResult(compare(withDist, otherSlot));
    } else {
      setFileB(withDist);
      if (otherSlot) setResult(compare(otherSlot, withDist));
    }
  };

  const handleFile = (fileNum: "A" | "B") => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const other = fileNum === "A" ? fileB : fileA;
      processFile(file, text, fileNum, other);
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

      const currentParsed: ParsedFile = {
        fileName: "Current optimization",
        routes: currentRouteCount ?? 0,
        totalOrders: currentOrders.length,
        vehicles: currentVehicles ?? [],
        workOrders: new Set(currentOrders),
        totalDistanceKm: currentDistanceKm ?? null,
        distanceLoading: false,
      };

      setFileB(currentParsed);
      processFile(file, text, "A", currentParsed);
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
          {/* Header with file names and close button */}
          <div className="flex items-start justify-between">
            <div className="text-xs space-y-1">
              <div className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-gray-400" />
                <span className="text-gray-500">Old:</span>
                <span className="font-medium text-gray-700 truncate max-w-[200px]">{result.fileA.fileName}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-gray-500">New:</span>
                <span className="font-medium text-gray-700 truncate max-w-[200px]">{result.fileB.fileName}</span>
              </div>
            </div>
            <button
              onClick={() => { setResult(null); setFileA(null); setFileB(null); }}
              className="p-1 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600"
              title="Close comparison"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Comparison table */}
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Metric</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-400">Old</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-blue-500">New</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr>
                  <td className="px-3 py-2 text-gray-700">Orders</td>
                  <td className="px-3 py-2 text-right font-medium text-gray-500">{result.fileA.totalOrders}</td>
                  <td className="px-3 py-2 text-right font-medium">{result.fileB.totalOrders}</td>
                  <td className="px-3 py-2 text-right"><DiffBadge value={result.fileB.totalOrders - result.fileA.totalOrders} /></td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-gray-700">Routes</td>
                  <td className="px-3 py-2 text-right font-medium text-gray-500">{result.fileA.routes}</td>
                  <td className="px-3 py-2 text-right font-medium">{result.fileB.routes}</td>
                  <td className="px-3 py-2 text-right"><DiffBadge value={result.fileB.routes - result.fileA.routes} invert /></td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-gray-700">Vehicles</td>
                  <td className="px-3 py-2 text-right font-medium text-gray-500">{result.fileA.vehicles.length}</td>
                  <td className="px-3 py-2 text-right font-medium">{result.fileB.vehicles.length}</td>
                  <td className="px-3 py-2 text-right"><DiffBadge value={result.fileB.vehicles.length - result.fileA.vehicles.length} invert /></td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-gray-700">
                    Road Distance
                    <span className="text-[10px] text-gray-400 ml-1">(km, via ORS)</span>
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-gray-500">
                    {distanceLoading === "A" || distanceLoading === "both"
                      ? <Loader2 className="size-3 animate-spin inline" />
                      : distA != null ? distA : "-"}
                  </td>
                  <td className="px-3 py-2 text-right font-medium">
                    {distanceLoading === "B" || distanceLoading === "both"
                      ? <Loader2 className="size-3 animate-spin inline" />
                      : distB != null ? distB : "-"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {distDiff != null ? <DiffBadge value={distDiff} suffix=" km" invert /> : <span className="text-gray-300 text-xs">-</span>}
                  </td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="px-3 py-2 text-gray-700">Common orders</td>
                  <td colSpan={2} className="px-3 py-2 text-center font-medium">{result.commonOrders}</td>
                  <td className="px-3 py-2" />
                </tr>
                <tr className="bg-gray-50">
                  <td className="px-3 py-2 text-gray-700">Added</td>
                  <td colSpan={2} className="px-3 py-2 text-center font-medium text-green-600">+{result.addedOrders.length}</td>
                  <td className="px-3 py-2" />
                </tr>
                <tr className="bg-gray-50">
                  <td className="px-3 py-2 text-gray-700">Removed</td>
                  <td colSpan={2} className="px-3 py-2 text-center font-medium text-red-600">-{result.removedOrders.length}</td>
                  <td className="px-3 py-2" />
                </tr>
              </tbody>
            </table>
          </div>

          <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2.5 text-[11px] text-blue-800 space-y-1">
            <p>
              <strong>Road Distance</strong> is calculated using ORS Directions (real driving paths
              on actual roads). For uploaded files, the backend reads the Rt, Seq, Latitude,
              and Longitude columns to compute depot &rarr; stops &rarr; depot distance per route.
              Files without these columns show &ldquo;-&rdquo;.
            </p>
          </div>

          {(result.addedOrders.length > 0 || result.removedOrders.length > 0) && (
            <div className="grid grid-cols-2 gap-3 text-xs">
              {result.addedOrders.length > 0 && (
                <div className="rounded-lg bg-green-50 border border-green-200 p-3">
                  <p className="font-semibold text-green-800 mb-2">Added ({result.addedOrders.length})</p>
                  <div className="max-h-36 overflow-y-auto space-y-1">
                    {result.addedOrders.map((wo) => (
                      <div key={wo} className="text-green-700 font-mono">{wo}</div>
                    ))}
                  </div>
                </div>
              )}
              {result.removedOrders.length > 0 && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                  <p className="font-semibold text-red-800 mb-2">Removed ({result.removedOrders.length})</p>
                  <div className="max-h-36 overflow-y-auto space-y-1">
                    {result.removedOrders.map((wo) => (
                      <div key={wo} className="text-red-700 font-mono">{wo}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
