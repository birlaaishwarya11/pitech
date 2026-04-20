import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { TopBar } from "./components/TopBar";
import { UploadOrders } from "./components/UploadOrders";
import { EmptyState } from "./components/EmptyState";
import { toast } from "sonner";
import { Toaster } from "./components/ui/sonner";
import { RouteMap } from "./components/RouteMap";
import { RemovedStopsPanel } from "./components/RemovedStopsPanel";
import { EditableRouteList } from "./components/EditableRouteList";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { Button } from "./components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./components/ui/select";
import { RefreshCw } from "lucide-react";

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

export default function Optimization() {
  // Restore session state on mount
  const loadSession = <T,>(key: string, fallback: T): T => {
    try {
      const raw = sessionStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  };

  const [ordersCount, setOrdersCount] = useState(() => loadSession("pi_ordersCount", 0));
  const [totalPallets, setTotalPallets] = useState(() => loadSession("pi_totalPallets", 0));

  const [ordersFile, setOrdersFile] = useState<File | null>(null);
  const [assetsFile, setAssetsFile] = useState<File | null>(null);
  const [specialInstructionsText, setSpecialInstructionsText] = useState("");
  const [optimizationResult, setOptimizationResult] =
    useState<OptimizationResponse | null>(() => loadSession("pi_result", null));

  // Manual route editing state
  const [removedStops, setRemovedStops] = useState<OptimizationStopResult[]>(() => loadSession("pi_removedStops", []));
  const [modifiedRoutes, setModifiedRoutes] = useState<OptimizationRouteResult[]>(() => loadSession("pi_modifiedRoutes", []));
  const [activeTab, setActiveTab] = useState("map");
  const [routesToShow, setRoutesToShow] = useState<number[]>([]);

  // Depot & wave settings
  const [depotOpen, setDepotOpen] = useState("08:00");
  const [depotClose, setDepotClose] = useState("17:00");
  const [numWaves, setNumWaves] = useState(2);
  const [wave2Cutoff, setWave2Cutoff] = useState("16:00");

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
  const [apiStatus, setApiStatus] = useState<ApiStatus>("checking");
  const [isGenerating, setIsGenerating] = useState(false);

  // Persist optimization state to sessionStorage so it survives page refresh
  useEffect(() => {
    if (optimizationResult) {
      sessionStorage.setItem("pi_result", JSON.stringify(optimizationResult));
      sessionStorage.setItem("pi_ordersCount", JSON.stringify(ordersCount));
      sessionStorage.setItem("pi_totalPallets", JSON.stringify(totalPallets));
    } else {
      sessionStorage.removeItem("pi_result");
      sessionStorage.removeItem("pi_ordersCount");
      sessionStorage.removeItem("pi_totalPallets");
    }
  }, [optimizationResult, ordersCount, totalPallets]);

  useEffect(() => {
    sessionStorage.setItem("pi_modifiedRoutes", JSON.stringify(modifiedRoutes));
  }, [modifiedRoutes]);

  useEffect(() => {
    sessionStorage.setItem("pi_removedStops", JSON.stringify(removedStops));
  }, [removedStops]);

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

  const downloadRoutePlanXlsx = () => {
    if (!optimizationResult) {
      toast.error("No optimization result to download");
      return;
    }

    // Use modifiedRoutes (edited state) if available, otherwise original
    const routes =
      modifiedRoutes.length > 0 ? modifiedRoutes : optimizationResult.routes;

    // Build flat rows — one per stop, reflecting all frontend edits
    const rows: Record<string, string | number>[] = [];

    for (const route of routes) {
      for (const stop of route.stops) {
        rows.push({
          "Rt": route.route_number,
          "Seq": stop.seq,
          "Assigned Vehicle": route.vehicle,
          "Work Order Numbers": stop.work_order_numbers.join(", "),
          "Customer Number": stop.customer_number,
          "Name": stop.name,
          "Address": stop.address,
          "City": stop.city,
          "State": stop.state,
          "Zip": stop.zip_code,
          "Est. Arrival": formatMinutesToTime(stop.arrival_time_minutes),
          "Pallets": stop.pallets,
          "Order Types": stop.order_types?.join(", ") ?? "",
          "Latitude": stop.latitude,
          "Longitude": stop.longitude,
        });
      }
    }

    // Add removed stops as UNASSIGNED
    for (const stop of removedStops) {
      rows.push({
        "Rt": "REMOVED",
        "Seq": 0,
        "Assigned Vehicle": "",
        "Work Order Numbers": stop.work_order_numbers.join(", "),
        "Customer Number": stop.customer_number,
        "Name": stop.name,
        "Address": stop.address,
        "City": stop.city,
        "State": stop.state,
        "Zip": stop.zip_code,
        "Est. Arrival": "",
        "Pallets": stop.pallets,
        "Order Types": stop.order_types?.join(", ") ?? "",
        "Latitude": stop.latitude,
        "Longitude": stop.longitude,
      });
    }

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Optimized Routes");
    XLSX.writeFile(wb, "optimized_routes.xlsx");

    toast.success("Route plan downloaded as Excel");
  };

  const resetOptimizationView = () => {
    setOrdersCount(0);
    setTotalPallets(0);
    setOptimizationResult(null);
    setRemovedStops([]);
    setModifiedRoutes([]);
    sessionStorage.removeItem("pi_result");
    sessionStorage.removeItem("pi_ordersCount");
    sessionStorage.removeItem("pi_totalPallets");
    sessionStorage.removeItem("pi_modifiedRoutes");
    sessionStorage.removeItem("pi_removedStops");
  };

  const handleRemoveStop = (routeNumber: number, stopSeq: number) => {
    if (!optimizationResult) return;

    const updatedRoutes = modifiedRoutes.length > 0 ? modifiedRoutes : optimizationResult.routes;
    const route = updatedRoutes.find((r) => r.route_number === routeNumber);
    if (!route) return;

    const stopToRemove = route.stops.find((s) => s.seq === stopSeq);
    if (!stopToRemove) return;

    setRemovedStops([...removedStops, stopToRemove]);

    const newRoutes = updatedRoutes.map((r) => {
      if (r.route_number === routeNumber) {
        return {
          ...r,
          stops: r.stops.filter((s) => s.seq !== stopSeq),
          num_stops: r.num_stops - 1,
          total_pallets: r.total_pallets - stopToRemove.pallets,
        };
      }
      return r;
    });

    setModifiedRoutes(newRoutes);
    toast.success("Stop removed", {
      description: `${stopToRemove.name} removed from route ${routeNumber}`,
    });
  };

  const handleRestoreStop = (stop: OptimizationStopResult) => {
    setRemovedStops(removedStops.filter((s) => s.seq !== stop.seq));
    toast.success("Stop restored", {
      description: `${stop.name} moved back to unassigned`,
    });
  };

  const handleMoveStop = (
    stop: OptimizationStopResult,
    sourceRouteNumber: number,
    targetRouteNumber: number
  ) => {
    if (!optimizationResult) return;

    const updatedRoutes = modifiedRoutes.length > 0 ? modifiedRoutes : optimizationResult.routes;

    const newRoutes = updatedRoutes.map((route) => {
      // Remove from source route
      if (route.route_number === sourceRouteNumber) {
        return {
          ...route,
          stops: route.stops.filter((s) => s.seq !== stop.seq),
          num_stops: route.num_stops - 1,
          total_pallets: route.total_pallets - stop.pallets,
        };
      }
      // Add to target route
      if (route.route_number === targetRouteNumber) {
        return {
          ...route,
          stops: [...route.stops, stop],
          num_stops: route.num_stops + 1,
          total_pallets: route.total_pallets + stop.pallets,
        };
      }
      return route;
    });

    setModifiedRoutes(newRoutes);
    toast.success("Stop moved", {
      description: `${stop.name} moved from route ${sourceRouteNumber} to route ${targetRouteNumber}`,
    });
  };

  const getFilteredRoutes = () => {
    const allRoutes = modifiedRoutes.length > 0 ? modifiedRoutes : optimizationResult?.routes || [];
    if (Array.isArray(routesToShow)) {
      return allRoutes.filter(route => routesToShow.includes(route.route_number));
    }
    return allRoutes.slice(0, routesToShow);
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

      // Load settings from localStorage
      const savedSettings = localStorage.getItem("backendSettings");
      if (savedSettings) {
        formData.append("settings", savedSettings);
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
            depotOpen={depotOpen}
            depotClose={depotClose}
            numWaves={numWaves}
            wave2Cutoff={wave2Cutoff}
            onDepotOpenChange={setDepotOpen}
            onDepotCloseChange={setDepotClose}
            onNumWavesChange={setNumWaves}
            onWave2CutoffChange={setWave2Cutoff}
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
            <EmptyState isGenerating={isGenerating} />
          ) : (
            <div className="p-6 space-y-6">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <div className="flex items-center justify-between mb-6">
<TabsList className="grid w-full max-w-md grid-cols-3">
                  <TabsTrigger value="map">Map</TabsTrigger>
                  <TabsTrigger value="routes">Routes</TabsTrigger>
                    <TabsTrigger value="edit">Edit Routes</TabsTrigger>
                  </TabsList>
                  
                  {activeTab === "map" && (
                    <Button
                      onClick={() => {
                        // Force re-render of map by updating a key or state
                        setActiveTab("map");
                        toast.success("Map refreshed");
                      }}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Refresh Map
                    </Button>
                  )}
                </div>

                <TabsContent value="map" className="space-y-6">
                  <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <div className="px-6 pt-6 pb-3">
                      <h2 className="text-lg font-semibold text-gray-900">
                        Route map
                      </h2>
                      <p className="text-sm text-gray-600 mt-1">
                        Optimized routes displayed on the map. You can edit routes by removing or moving stops.
                      </p>
                    </div>

                    <div className="px-6 pb-6">
                      <RouteMap
                        key={modifiedRoutes.length} // Force re-render when routes change
                        depot={optimizationResult.depot}
                        routes={modifiedRoutes.length > 0 ? modifiedRoutes : optimizationResult.routes}
                        removedStops={removedStops}
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="routes" className="space-y-6">
                  {removedStops.length > 0 && (
                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                      <RemovedStopsPanel
                        removedStops={removedStops}
                        onRestoreStop={handleRestoreStop}
                      />
                    </div>
                  )}

                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h2 className="text-lg font-semibold text-gray-900">
                          Routes
                        </h2>
                        <p className="text-sm text-gray-600 mt-1">
                          View all routes with capacity information. Use the Edit Routes tab for detailed editing.
                        </p>
                      </div>

                      <button
                        onClick={downloadRoutePlanXlsx}
                        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                      >
                        Download Route Plan
                      </button>
                    </div>

                    <EditableRouteList
                      routes={modifiedRoutes.length > 0 ? modifiedRoutes : optimizationResult.routes}
                      onRemoveStop={handleRemoveStop}
                      onMoveStop={handleMoveStop}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="edit" className="space-y-6">
                  {removedStops.length > 0 && (
                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                      <RemovedStopsPanel
                        removedStops={removedStops}
                        onRestoreStop={handleRestoreStop}
                      />
                    </div>
                  )}

                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h2 className="text-lg font-semibold text-gray-900">
                          Edit Routes
                        </h2>
                        <p className="text-sm text-gray-600 mt-1">
                          Select exactly 2 routes to edit side by side. Drag stops between routes for easy rebalancing.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 mb-6">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">Route 1:</span>
                        <Select 
                          value={routesToShow[0]?.toString() || ""}
                          onValueChange={(value) => {
                            const routeNum = parseInt(value);
                            const newSelection = [...routesToShow];
                            newSelection[0] = routeNum;
                            // Remove from second position if same
                            if (newSelection[1] === routeNum) {
                              newSelection[1] = undefined;
                            }
                            setRoutesToShow(newSelection.filter(r => r !== undefined));
                          }}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue placeholder="Select route" />
                          </SelectTrigger>
                          <SelectContent>
                            {(modifiedRoutes.length > 0 ? modifiedRoutes : optimizationResult?.routes || [])
                              .filter(route => !routesToShow.includes(route.route_number) || route.route_number === routesToShow[0])
                              .map((route) => (
                              <SelectItem key={route.route_number} value={route.route_number.toString()}>
                                Route {route.route_number}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">Route 2:</span>
                        <Select 
                          value={routesToShow[1]?.toString() || ""}
                          onValueChange={(value) => {
                            const routeNum = parseInt(value);
                            const newSelection = [...routesToShow];
                            newSelection[1] = routeNum;
                            // Remove from first position if same
                            if (newSelection[0] === routeNum) {
                              newSelection[0] = undefined;
                            }
                            setRoutesToShow(newSelection.filter(r => r !== undefined));
                          }}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue placeholder="Select route" />
                          </SelectTrigger>
                          <SelectContent>
                            {(modifiedRoutes.length > 0 ? modifiedRoutes : optimizationResult?.routes || [])
                              .filter(route => !routesToShow.includes(route.route_number) || route.route_number === routesToShow[1])
                              .map((route) => (
                              <SelectItem key={route.route_number} value={route.route_number.toString()}>
                                Route {route.route_number}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {Array.isArray(routesToShow) && routesToShow.length === 2 ? (
                      <div className="grid grid-cols-2 gap-6">
                        {routesToShow.map(routeNumber => {
                          const route = (modifiedRoutes.length > 0 ? modifiedRoutes : optimizationResult?.routes || [])
                            .find(r => r.route_number === routeNumber);
                          return route ? (
                            <div key={route.route_number} className="space-y-3">
                              <div className="flex items-center gap-2 mb-4">
                                <h3 className="text-sm font-medium text-gray-700">
                                  Route {route.route_number} · {route.vehicle}
                                </h3>
                                <span className="text-xs text-gray-600">
                                  {route.total_pallets} / {route.vehicle_capacity_pallets} pallets
                                </span>
                                {(() => {
                                  const percentage = Math.round((route.total_pallets / route.vehicle_capacity_pallets) * 100);
                                  const isOverCapacity = route.total_pallets > route.vehicle_capacity_pallets;
                                  const isNearCapacity = percentage >= 85 && !isOverCapacity;
                                  
                                  return (
                                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                      isOverCapacity 
                                        ? 'bg-red-100 text-red-800' 
                                        : isNearCapacity 
                                          ? 'bg-amber-100 text-amber-800' 
                                          : 'bg-green-100 text-green-800'
                                    }`}>
                                      {percentage}%
                                    </span>
                                  );
                                })()}
                              </div>
                              
                              <EditableRouteList
                                routes={[route]}
                                onRemoveStop={handleRemoveStop}
                                onMoveStop={handleMoveStop}
                              />
                            </div>
                          ) : null;
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-12 text-gray-500">
                        <p>Please select exactly 2 routes to edit side by side.</p>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>

              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">
                  Route summary
                </h3>

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
                      {(modifiedRoutes.length > 0 ? modifiedRoutes : optimizationResult.routes).length}
                    </p>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-1">
                      Removed stops
                    </p>
                    <p className="text-sm font-semibold text-gray-900">
                      {removedStops.length}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}