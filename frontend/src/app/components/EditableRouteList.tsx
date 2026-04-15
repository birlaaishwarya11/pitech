import { Trash2, ChevronDown, ChevronUp, ArrowUpDown } from "lucide-react";
import { useState } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

interface Stop {
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

interface Route {
  route_number: number;
  vehicle: string;
  vehicle_capacity_pallets: number;
  total_pallets: number;
  num_stops: number;
  stops: Stop[];
}

interface EditableRouteListProps {
  routes: Route[];
  onRemoveStop: (routeNumber: number, stopSeq: number) => void;
  onMoveStop?: (
    stop: Stop,
    sourceRouteNumber: number,
    targetRouteNumber: number
  ) => void;
  capacityWarnings?: Record<number, boolean>;
}

export function EditableRouteList({
  routes,
  onRemoveStop,
  onMoveStop,
  capacityWarnings = {},
}: EditableRouteListProps) {
  const [expandedRoutes, setExpandedRoutes] = useState<Set<number>>(
    new Set(routes.map((r) => r.route_number))
  );
  const [sortBy, setSortBy] = useState<"route" | "capacity-high" | "capacity-low">("route");

  const toggleRoute = (routeNumber: number) => {
    const newExpanded = new Set(expandedRoutes);
    if (newExpanded.has(routeNumber)) {
      newExpanded.delete(routeNumber);
    } else {
      newExpanded.add(routeNumber);
    }
    setExpandedRoutes(newExpanded);
  };

  const formatTime = (minutes: number) => {
    if (!Number.isFinite(minutes)) return "N/A";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const period = hours >= 12 ? "PM" : "AM";
    const hours12 = hours % 12 === 0 ? 12 : hours % 12;
    return `${hours12}:${mins.toString().padStart(2, "0")} ${period}`;
  };

  const sortedRoutes = [...routes].sort((a, b) => {
    switch (sortBy) {
      case "capacity-high":
        const capacityA = Math.round((a.total_pallets / a.vehicle_capacity_pallets) * 100);
        const capacityB = Math.round((b.total_pallets / b.vehicle_capacity_pallets) * 100);
        return capacityB - capacityA; // Higher capacity first
      case "capacity-low":
        const capacityLowA = Math.round((a.total_pallets / a.vehicle_capacity_pallets) * 100);
        const capacityLowB = Math.round((b.total_pallets / b.vehicle_capacity_pallets) * 100);
        return capacityLowA - capacityLowB; // Lower capacity first
      case "route":
      default:
        return a.route_number - b.route_number;
    }
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-700">Routes</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Sort by:</span>
          <Select value={sortBy} onValueChange={(value: "route" | "capacity-high" | "capacity-low") => setSortBy(value)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="route">Route Number</SelectItem>
              <SelectItem value="capacity-high">Capacity (High to Low)</SelectItem>
              <SelectItem value="capacity-low">Capacity (Low to High)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {sortedRoutes.map((route) => (
        <Card
          key={route.route_number}
          className={`${
            capacityWarnings[route.route_number]
              ? "border-red-300 bg-red-50"
              : "border-gray-200"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            e.currentTarget.classList.add("border-blue-400", "ring-2", "ring-blue-200");
          }}
          onDragLeave={(e) => {
            e.currentTarget.classList.remove("border-blue-400", "ring-2", "ring-blue-200");
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.currentTarget.classList.remove("border-blue-400", "ring-2", "ring-blue-200");
            try {
              const moveStopData = e.dataTransfer.getData("moveStop");
              if (moveStopData) {
                const { stop, sourceRoute } = JSON.parse(moveStopData);
                if (onMoveStop && sourceRoute !== route.route_number) {
                  onMoveStop(stop, sourceRoute, route.route_number);
                }
              }
            } catch {
              // No moved stop data
            }
          }}
        >
          <CardHeader
            className="pb-2 cursor-pointer hover:bg-gray-50 rounded-t"
            onClick={() => toggleRoute(route.route_number)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {expandedRoutes.has(route.route_number) ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
                <CardTitle className="text-sm">
                  Route {route.route_number}
                </CardTitle>
                <span className="text-xs text-gray-600">
                  {route.vehicle}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-xs text-gray-600">
                  {route.total_pallets} / {route.vehicle_capacity_pallets} pallets
                </div>
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
            </div>
          </CardHeader>

          {expandedRoutes.has(route.route_number) && (
            <CardContent className="pt-0 pb-3 space-y-2">
              {route.stops.length === 0 ? (
                <p className="text-xs text-gray-500 italic">No stops</p>
              ) : (
                <>
                  <p className="text-xs text-gray-500 mb-2">
                    Drag stops between routes or click to remove
                  </p>
                  {route.stops.map((stop) => (
                    <div
                      key={`${route.route_number}-${stop.seq}`}
                      className="bg-white border border-gray-200 rounded p-2 text-xs flex items-start justify-between gap-2 hover:border-gray-300 hover:shadow-sm cursor-move transition-all"
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData(
                          "moveStop",
                          JSON.stringify({
                            stop,
                            sourceRoute: route.route_number,
                          })
                        );
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">
                          {stop.seq}. {stop.name}
                        </p>
                        <p className="text-gray-600 truncate">
                          {stop.address}, {stop.city}
                        </p>
                        <div className="flex gap-1 mt-1 flex-wrap">
                          <span className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded text-xs">
                            {stop.pallets} pallets
                          </span>
                          <span className="bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded text-xs">
                            {formatTime(stop.arrival_time_minutes)}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          onRemoveStop(route.route_number, stop.seq)
                        }
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
                        title="Remove stop"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </>
              )}
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  );
}
