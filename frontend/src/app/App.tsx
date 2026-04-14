import { useEffect, useState } from "react";
import { TopBar } from "./components/TopBar";
import { UploadOrders } from "./components/UploadOrders";
import { EmptyState } from "./components/EmptyState";
import { toast } from "sonner";
import { Toaster } from "./components/ui/sonner";
import { RouteMap } from "./components/RouteMap";

interface DepotInfo {
  name: string;
  latitude: number;
  longitude: number;
}

interface RouteGeometry {
  type: string;
  coordinates: number[][];
}

interface OptimizationStopResult {
  seq: number;
  work_order_numbers: string[];
  customer_number: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  arrival_time_minutes: number;
  pallets: number;
  order_types: string[];
  latitude: number;
  longitude: number;
}

interface OptimizationRouteResult {
  route_number: number;
  vehicle: string;
  vehicle_capacity_pallets: number;
  total_pallets: number;
  num_stops: number;
  stops: OptimizationStopResult[];
  geometry?: RouteGeometry | null;
}

interface OptimizationResponse {
  status: string;
  solver_status: string;
  total_orders: number;
  total_stops: number;
  assigned_orders: number;
  unassigned_orders: number;
  routes_used: number;
  vehicles_available: number;
  depot: DepotInfo;
  routes: OptimizationRouteResult[];
  unassigned: Record<string, unknown>[];
}

type ApiStatus = "checking" | "connected" | "error";

export default function App() {
  const [ordersCount, setOrdersCount] = useState(0);
  const [totalPallets, setTotalPallets] = useState(0);

  const [ordersFile, setOrdersFile] = useState<File | null>(null);
  const [assetsFile, setAssetsFile] = useState<File | null>(null);
  const [specialInstructionsText, setSpecialInstructionsText] = useState("");
  const [optimizationResult, setOptimizationResult] =
    useState<OptimizationResponse | null>(null);

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
  const [apiStatus, setApiStatus] = useState<ApiStatus>("checking");
  const [isGenerating, setIsGenerating] = useState(false);

  const today = new Date().toISOString().split("T")[0];
  const hasRequiredFiles = ordersFile !== null && assetsFile !== null;

  const displayStopsCount = optimizationResult
    ? optimizationResult.total_stops
    : 0;

  const displayVehiclesCount = optimizationResult
    ? optimizationResult.vehicles_available
    : 0;

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch(`${apiBaseUrl}/api/v1/health`);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        await res.json();
        setApiStatus("connected");
      } catch {
        setApiStatus("error");
      }
    };

    checkHealth();
  }, [apiBaseUrl]);

  const formatMinutesToTime = (minutes: number) => {
    if (!Number.isFinite(minutes)) return "N/A";

    const totalMinutes = Math.round(minutes);
    const hours24 = Math.floor(totalMinutes / 60) % 24;
    const mins = totalMinutes % 60;

    const period = hours24 >= 12 ? "PM" : "AM";
    const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;

    return `${hours12}:${mins.toString().padStart(2, "0")} ${period}`;
  };

  const cleanZip = (zip: string) => {
    if (!zip) return "";
    return String(zip).replace(/\.0$/, "");
  };

  const cleanAddress = (address: string) => {
    if (!address) return "";
    return address.replace(/^Address\s+/i, "").trim();
  };

  const downloadRoutePlanText = () => {
    if (!optimizationResult) {
      toast.error("No optimization result to download");
      return;
    }

    const lines: string[] = [];

    lines.push("Delivery Route Plan");
    lines.push("==================");
    lines.push(`Status: ${optimizationResult.status}`);
    lines.push(`Solver status: ${optimizationResult.solver_status}`);
    lines.push(`Total orders: ${optimizationResult.total_orders}`);
    lines.push(`Total stops: ${optimizationResult.total_stops}`);
    lines.push(`Routes used: ${optimizationResult.routes_used}`);
    lines.push(`Vehicles available: ${optimizationResult.vehicles_available}`);
    lines.push(`Unassigned orders: ${optimizationResult.unassigned_orders}`);
    lines.push("");

    optimizationResult.routes.forEach((route, routeIndex) => {
      lines.push(`Route ${route.route_number} / Vehicle ${route.vehicle}`);
      lines.push("----------------------------------------");
      lines.push(`Vehicle capacity: ${route.vehicle_capacity_pallets}`);
      lines.push(`Total pallets: ${route.total_pallets}`);
      lines.push(`Number of stops: ${route.num_stops}`);
      lines.push("");

      route.stops.forEach((stop) => {
        lines.push(`${stop.seq}. ${stop.name}`);
        lines.push(
          `   Address: ${cleanAddress(stop.address)}, ${stop.city}, ${stop.state} ${cleanZip(stop.zip_code)}`
        );
        lines.push(
          `   Arrival: ${formatMinutesToTime(stop.arrival_time_minutes)}`
        );
        lines.push(`   Pallets: ${stop.pallets}`);
        lines.push(
          `   Order types: ${
            stop.order_types?.length ? stop.order_types.join(", ") : "N/A"
          }`
        );
        lines.push(
          `   Work orders: ${
            stop.work_order_numbers?.length
              ? stop.work_order_numbers.join(", ")
              : "N/A"
          }`
        );
        lines.push("");
      });

      if (routeIndex < optimizationResult.routes.length - 1) {
        lines.push("");
      }
    });

    if (optimizationResult.unassigned?.length) {
      lines.push("");
      lines.push("Unassigned Orders");
      lines.push("-----------------");
      optimizationResult.unassigned.forEach((item, idx) => {
        lines.push(`${idx + 1}. ${JSON.stringify(item)}`);
      });
    }

    const content = lines.join("\n");
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "route_plan.txt";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);

    toast.success("Route plan downloaded");
  };

  const resetOptimizationView = () => {
    setOrdersCount(0);
    setTotalPallets(0);
    setOptimizationResult(null);
  };

  const handleOrdersFileChange = (file: File | null) => {
    setOrdersFile(file);
    resetOptimizationView();
  };

  const handleAssetsFileChange = (file: File | null) => {
    setAssetsFile(file);
    resetOptimizationView();
  };

  const handleGenerateRoutes = async () => {
    if (!ordersFile || !assetsFile) {
      toast.error("Missing required files", {
        description: "Please select both an orders file and an assets file.",
      });
      return;
    }

    setIsGenerating(true);
    setOptimizationResult(null);

    try {
      const formData = new FormData();
      formData.append("orders_file", ordersFile);
      formData.append("assets_file", assetsFile);

      if (specialInstructionsText.trim()) {
        formData.append(
          "special_instructions",
          specialInstructionsText.trim()
        );
      }

      const res = await fetch(`${apiBaseUrl}/api/v1/optimize?use_ors=true`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || `HTTP ${res.status}`);
      }

      const data: OptimizationResponse = await res.json();

      console.log("Optimization response:", data);

      setOptimizationResult(data);
      setOrdersCount(data.total_orders);

      const palletsFromRoutes = data.routes.reduce(
        (sum, route) => sum + route.total_pallets,
        0
      );
      setTotalPallets(Number(palletsFromRoutes.toFixed(2)));

      toast.success("Optimization completed", {
        description: `${data.routes_used} routes returned from backend`,
      });
    } catch (error) {
      console.error("Optimize request failed:", error);

      toast.error("Optimization failed", {
        description:
          error instanceof Error ? error.message : "Unknown backend error",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Toaster position="top-right" />

      <TopBar
        selectedDate={today}
        totalStops={displayStopsCount}
        vehiclesAvailable={displayVehiclesCount}
        totalDistance=""
        estimatedFinishTime=""
        onGenerateRoutes={handleGenerateRoutes}
        hasOrders={hasRequiredFiles}
        isGenerating={isGenerating}
        needsRerun={false}
      />

      <div className="px-6 py-2 border-b border-gray-200 bg-white text-sm text-gray-600">
        Backend status:{" "}
        {apiStatus === "checking" && (
          <span className="font-medium text-amber-600">checking...</span>
        )}
        {apiStatus === "connected" && (
          <span className="font-medium text-green-600">connected</span>
        )}
        {apiStatus === "error" && (
          <span className="font-medium text-red-600">error</span>
        )}
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-80 bg-gray-50 border-r border-gray-200 p-6 space-y-6 overflow-y-auto">
          <UploadOrders
            ordersCount={ordersCount}
            totalPallets={totalPallets}
            ordersFile={ordersFile}
            assetsFile={assetsFile}
            specialInstructions={specialInstructionsText}
            isOptimizing={isGenerating}
            onOrdersFileChange={handleOrdersFileChange}
            onAssetsFileChange={handleAssetsFileChange}
            onSpecialInstructionsChange={setSpecialInstructionsText}
          />

          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Fleet display
            </h3>
            <p className="text-sm text-gray-600">
              Detailed vehicle cards are not connected to backend route data
              yet.
            </p>
            <p className="text-xs text-gray-500 mt-2">
              This run uses backend-generated vehicle assignments in the
              downloadable route plan.
            </p>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Routing rules
            </h3>

            {specialInstructionsText.trim() ? (
              <>
                <p className="text-sm text-gray-600 mb-2">
                  Custom special instructions provided:
                </p>
                <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700 whitespace-pre-wrap">
                  {specialInstructionsText}
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-600">
                No custom rules or special instructions provided yet.
              </p>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {!optimizationResult ? (
            <EmptyState />
          ) : (
            <div className="p-6 space-y-6">
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="px-6 pt-6 pb-3">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Route map
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Optimized routes displayed on the map using road-following
                    geometry.
                  </p>
                </div>

                <div className="px-6 pb-6">
                  <RouteMap
                    depot={optimizationResult.depot}
                    routes={optimizationResult.routes}
                  />
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      Route plan ready
                    </h2>
                    <p className="text-sm text-gray-600 mt-1">
                      Optimization completed successfully. Download the route
                      plan to review vehicle assignments, stop sequence,
                      pallets, and estimated arrival times.
                    </p>
                  </div>

                  <button
                    onClick={downloadRoutePlanText}
                    className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    Download Route Plan
                  </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-1">Status</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {optimizationResult.status}
                    </p>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-1">Solver status</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {optimizationResult.solver_status}
                    </p>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-1">Routes used</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {optimizationResult.routes_used}
                    </p>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-1">
                      Unassigned orders
                    </p>
                    <p className="text-sm font-semibold text-gray-900">
                      {optimizationResult.unassigned_orders}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">
                  What is included in the route plan
                </h3>

                <div className="space-y-2 text-sm text-gray-600">
                  <p>• Vehicle assignment for each route</p>
                  <p>• Stop sequence within each route</p>
                  <p>• Estimated arrival time for each stop</p>
                  <p>• Pallets and order types for each stop</p>
                  <p>• Work order numbers for download and review</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}