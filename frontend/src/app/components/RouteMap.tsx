import { MapPin, Navigation, Building2 } from "lucide-react";
import { useState } from "react";

interface Stop {
  id: string;
  number: number;
  agencyName: string;
  deliveryWindow: string;
  pallets: number;
  estimatedArrival: string;
  lat: number;
  lng: number;
  vehicleId: string;
}

interface Route {
  vehicleId: string;
  color: string;
  stops: Stop[];
}

interface RouteMapProps {
  routes: Route[];
  hasRoutes: boolean;
  onStopClick: (stop: Stop) => void;
}

export function RouteMap({ routes, hasRoutes, onStopClick }: RouteMapProps) {
  const [hoveredStop, setHoveredStop] = useState<Stop | null>(null);
  const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 });

  const handleStopHover = (stop: Stop | null, event?: React.MouseEvent) => {
    setHoveredStop(stop);
    if (event) {
      setHoverPosition({ x: event.clientX, y: event.clientY });
    }
  };

  if (!hasRoutes) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 h-[500px] flex items-center justify-center">
        <div className="text-center">
          <div className="size-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <Navigation className="size-8 text-gray-400" />
          </div>
          <p className="text-base font-medium text-gray-900 mb-1">
            No routes generated yet
          </p>
          <p className="text-sm text-gray-600">
            Upload orders and click "Generate Routes" to begin
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 h-[500px] relative overflow-hidden">
      {/* Mock Map Background - NYC-style */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-100 via-gray-100 to-stone-100">
        {/* Grid lines for city streets */}
        <svg className="absolute inset-0 w-full h-full opacity-20">
          <defs>
            <pattern
              id="grid"
              width="40"
              height="40"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 40 0 L 0 0 0 40"
                fill="none"
                stroke="gray"
                strokeWidth="1"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
        
        {/* Water/park areas */}
        <div className="absolute top-10 right-10 w-32 h-24 bg-blue-100 rounded-xl opacity-40" />
        <div className="absolute bottom-16 left-16 w-28 h-28 bg-green-100 rounded-full opacity-40" />
      </div>

      {/* Depot/Warehouse Marker */}
      <div className="absolute transform -translate-x-1/2 -translate-y-1/2 z-10"
        style={{ left: "15%", top: "15%" }}
      >
        <div className="relative group">
          <div className="size-12 rounded-lg bg-gray-800 flex items-center justify-center shadow-lg">
            <Building2 className="size-6 text-white" />
          </div>
          <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
            Food Bank Depot
          </div>
        </div>
      </div>

      {/* Routes and Stops */}
      <div className="absolute inset-0 p-8">
        {routes.map((route) => (
          <div key={route.vehicleId}>
            {/* Route Path */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none">
              {/* Line from depot to first stop */}
              {route.stops.length > 0 && (
                <line
                  x1="15%"
                  y1="15%"
                  x2={`${route.stops[0].lng}%`}
                  y2={`${route.stops[0].lat}%`}
                  stroke={route.color}
                  strokeWidth="3"
                  strokeDasharray="8,4"
                  opacity="0.5"
                />
              )}
              
              {route.stops.map((stop, idx) => {
                if (idx === route.stops.length - 1) return null;
                const nextStop = route.stops[idx + 1];
                return (
                  <line
                    key={`${stop.id}-${nextStop.id}`}
                    x1={`${stop.lng}%`}
                    y1={`${stop.lat}%`}
                    x2={`${nextStop.lng}%`}
                    y2={`${nextStop.lat}%`}
                    stroke={route.color}
                    strokeWidth="3"
                    strokeDasharray="8,4"
                    opacity="0.6"
                  />
                );
              })}
            </svg>

            {/* Stops */}
            {route.stops.map((stop) => (
              <div
                key={stop.id}
                className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer group z-20"
                style={{
                  left: `${stop.lng}%`,
                  top: `${stop.lat}%`,
                }}
                onMouseEnter={(e) => handleStopHover(stop, e)}
                onMouseLeave={() => handleStopHover(null)}
                onClick={() => onStopClick(stop)}
              >
                <div
                  className="size-10 rounded-full flex items-center justify-center text-white text-sm font-semibold shadow-lg transition-all group-hover:scale-125 group-hover:shadow-xl border-2 border-white"
                  style={{ backgroundColor: route.color }}
                >
                  {stop.number}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Map Legend */}
      <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg border border-gray-200 p-3">
        <p className="text-xs font-semibold text-gray-900 mb-2">Routes</p>
        <div className="space-y-1.5">
          {routes.map((route) => (
            <div key={route.vehicleId} className="flex items-center gap-2">
              <div
                className="size-3 rounded-full"
                style={{ backgroundColor: route.color }}
              />
              <span className="text-xs text-gray-700">{route.vehicleId}</span>
              <span className="text-xs text-gray-500">
                ({route.stops.length} stops)
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Hover Card */}
      {hoveredStop && (
        <div
          className="fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-4 w-64 pointer-events-none"
          style={{
            left: hoverPosition.x + 15,
            top: hoverPosition.y + 15,
          }}
        >
          <div className="flex items-start gap-3 mb-3">
            <div className="size-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
              <MapPin className="size-4 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 leading-tight">
                {hoveredStop.agencyName}
              </p>
              <p className="text-xs text-gray-600 mt-0.5">
                Stop #{hoveredStop.number}
              </p>
            </div>
          </div>
          
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-600">Assigned Truck:</span>
              <span className="font-medium text-gray-900">
                {hoveredStop.vehicleId}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Delivery Window:</span>
              <span className="font-medium text-gray-900">
                {hoveredStop.deliveryWindow}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Pallets:</span>
              <span className="font-medium text-gray-900">
                {hoveredStop.pallets}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Est. Arrival:</span>
              <span className="font-medium text-gray-900">
                {hoveredStop.estimatedArrival}
              </span>
            </div>
          </div>
          
          <div className="mt-3 pt-3 border-t border-gray-200">
            <p className="text-xs text-blue-600 font-medium">Click to edit stop</p>
          </div>
        </div>
      )}
    </div>
  );
}