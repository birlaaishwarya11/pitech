import { useState } from "react";
import { toast } from "sonner";

interface ParsedFile {
  fileName: string;
  routes: number;
  totalOrders: number;
  vehicles: string[];
  workOrders: Set<string>;
}

interface ComparisonResult {
  fileA: ParsedFile;
  fileB: ParsedFile;
  addedOrders: string[];
  removedOrders: string[];
  commonOrders: number;
}

function parseCSV(text: string, fileName: string): ParsedFile | null {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return null;

  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  const woIdx = headers.findIndex((h) => h === "Work Order Number");
  const rtIdx = headers.findIndex((h) => h === "Rt");
  const vehicleIdx = headers.findIndex((h) => h === "Assigned Vehicle");

  if (woIdx === -1) return null;

  const workOrders = new Set<string>();
  const vehicles = new Set<string>();
  const routes = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    const wo = cols[woIdx];
    if (wo) workOrders.add(wo);
    if (rtIdx !== -1 && cols[rtIdx] && cols[rtIdx] !== "UNASSIGNED" && cols[rtIdx] !== "REMOVED") {
      routes.add(cols[rtIdx]);
    }
    if (vehicleIdx !== -1 && cols[vehicleIdx]) {
      vehicles.add(cols[vehicleIdx]);
    }
  }

  return {
    fileName,
    routes: routes.size,
    totalOrders: workOrders.size,
    vehicles: Array.from(vehicles),
    workOrders,
  };
}

function compare(a: ParsedFile, b: ParsedFile): ComparisonResult {
  const addedOrders = [...b.workOrders].filter((wo) => !a.workOrders.has(wo));
  const removedOrders = [...a.workOrders].filter((wo) => !b.workOrders.has(wo));
  const commonOrders = [...a.workOrders].filter((wo) => b.workOrders.has(wo)).length;

  return { fileA: a, fileB: b, addedOrders, removedOrders, commonOrders };
}

function DiffBadge({ value, suffix = "" }: { value: number; suffix?: string }) {
  if (value === 0) return <span className="text-gray-500 text-xs">no change</span>;
  const color = value > 0 ? "text-red-600" : "text-green-600";
  const sign = value > 0 ? "+" : "";
  return <span className={`text-xs font-medium ${color}`}>{sign}{value}{suffix}</span>;
}

interface RouteComparisonProps {
  currentOrders?: string[];
  currentRouteCount?: number;
  currentVehicles?: string[];
}

export function RouteComparison({ currentOrders, currentRouteCount, currentVehicles }: RouteComparisonProps) {
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const hasCurrentRoutes = currentOrders && currentOrders.length > 0;

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

  const [fileA, setFileA] = useState<ParsedFile | null>(null);
  const [fileB, setFileB] = useState<ParsedFile | null>(null);

  // Mode 1: compare uploaded file against current optimization
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
      };

      setFileA(parsed);
      setFileB(currentParsed);
      setResult(compare(parsed, currentParsed));
    };
    reader.readAsText(file);
    e.target.value = "";
  };

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
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">Orders</p>
              <p className="text-lg font-semibold">{result.fileA.totalOrders} → {result.fileB.totalOrders}</p>
              <DiffBadge value={result.fileB.totalOrders - result.fileA.totalOrders} />
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">Routes</p>
              <p className="text-lg font-semibold">{result.fileA.routes} → {result.fileB.routes}</p>
              <DiffBadge value={result.fileB.routes - result.fileA.routes} />
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">Vehicles</p>
              <p className="text-lg font-semibold">{result.fileA.vehicles.length} → {result.fileB.vehicles.length}</p>
              <DiffBadge value={result.fileB.vehicles.length - result.fileA.vehicles.length} />
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
