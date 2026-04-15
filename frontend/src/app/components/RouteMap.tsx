import { Fragment, useEffect, useMemo, useState } from "react";
import type { LatLngBoundsExpression, LatLngExpression } from "leaflet";
import {
  CircleMarker,
  MapContainer,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";
import { AlertTriangle } from "lucide-react";

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

interface RouteGeometry {
  type: string;
  coordinates: number[][];
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

interface DepotInfo {
  name: string;
  latitude: number;
  longitude: number;
}

interface RouteMapProps {
  depot: DepotInfo;
  routes: OptimizationRouteResult[];
  removedStops?: OptimizationStopResult[];
}

interface RouteOption {
  value: string;
  label: string;
}

const routeColors = [
  "#2563eb",
  "#dc2626",
  "#16a34a",
  "#9333ea",
  "#ea580c",
  "#0891b2",
  "#4f46e5",
];

function FitBounds({ bounds }: { bounds: LatLngBoundsExpression }) {
  const map = useMap();

  useEffect(() => {
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [map, bounds]);

  return null;
}

function FocusStop({
  stop,
}: {
  stop: OptimizationStopResult | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (!stop) return;
    map.setView([stop.latitude, stop.longitude], 13, { animate: true });
  }, [map, stop]);

  return null;
}

function formatMinutesToTime(minutes: number) {
  if (!Number.isFinite(minutes)) return "N/A";

  const totalMinutes = Math.round(minutes);
  const hours24 = Math.floor(totalMinutes / 60) % 24;
  const mins = totalMinutes % 60;

  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;

  return `${hours12}:${mins.toString().padStart(2, "0")} ${period}`;
}

function renderStopMarker(
  route: OptimizationRouteResult,
  stop: OptimizationStopResult,
  color: string,
  selectedRouteValue: string,
  focusedStopKey: string | null,
  handleStopSelect: (routeNumber: number, stopSeq: number) => void
) {
  const stopKey = `${route.route_number}-${stop.seq}`;
  const isFocused = stopKey === focusedStopKey;

  return (
    <CircleMarker
      key={`${route.route_number}-${stop.seq}-${stop.customer_number}-${isFocused ? "focused" : "normal"}`}
      center={[stop.latitude, stop.longitude]}
      radius={isFocused ? 13 : selectedRouteValue === "all" ? 8 : 10}
      pathOptions={{
        color,
        fillColor: color,
        fillOpacity: 1,
        weight: isFocused ? 5 : 2,
      }}
      eventHandlers={{
        click: () => handleStopSelect(route.route_number, stop.seq),
      }}
    >
      <Tooltip
        permanent
        direction="top"
        offset={isFocused ? [0, -10] : [0, -6]}
        className={isFocused ? "route-seq-tooltip font-bold" : "route-seq-tooltip"}
      >
        {String(stop.seq)}
      </Tooltip>

      <Popup>
        <div className="text-sm space-y-1 min-w-[240px]">
          <div className="font-semibold">
            Route {route.route_number} · Stop {stop.seq}
          </div>
          <div className="text-gray-700">Vehicle: {route.vehicle}</div>
          <div className="font-medium">{stop.name}</div>
          <div>
            {stop.address}, {stop.city}, {stop.state} {stop.zip_code}
          </div>
          <div>
            Arrival: {formatMinutesToTime(stop.arrival_time_minutes)}
          </div>
          <div>Pallets: {stop.pallets}</div>
          <div>Customer number: {stop.customer_number}</div>
          <div>
            Order types:{" "}
            {stop.order_types?.length ? stop.order_types.join(", ") : "N/A"}
          </div>
          <div>
            Work orders:{" "}
            {stop.work_order_numbers?.length
              ? stop.work_order_numbers.join(", ")
              : "N/A"}
          </div>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${stop.latitude},${stop.longitude}`}
            target="_blank"
            rel="noreferrer"
            className="inline-block pt-1 text-blue-600 underline"
          >
            Open in Google Maps
          </a>
        </div>
      </Popup>
    </CircleMarker>
  );
}

export function RouteMap({ depot, routes, removedStops = [] }: RouteMapProps) {
  const [selectedRouteValue, setSelectedRouteValue] = useState<string>("all");
  const [focusedStopKey, setFocusedStopKey] = useState<string | null>(null);

  const depotPosition: LatLngExpression = [depot.latitude, depot.longitude];

  const routeOptions = useMemo<RouteOption[]>(() => {
    return [
      { value: "all", label: "All routes" },
      ...routes.map((route) => {
        const capacityPercentage = Math.round((route.total_pallets / route.vehicle_capacity_pallets) * 100);
        const isOverCapacity = route.total_pallets > route.vehicle_capacity_pallets;
        const isNearCapacity = capacityPercentage >= 85 && !isOverCapacity;
        
        let capacityStatus = "";
        if (isOverCapacity) {
          capacityStatus = " (OVER CAPACITY)";
        } else if (isNearCapacity) {
          capacityStatus = " (NEAR CAPACITY)";
        }
        
        return {
          value: String(route.route_number),
          label: `Route ${route.route_number} · ${route.vehicle} · ${route.total_pallets}/${route.vehicle_capacity_pallets} pallets (${capacityPercentage}%${capacityStatus})`,
        };
      }),
    ];
  }, [routes]);

  const visibleRoutes = useMemo(() => {
    if (selectedRouteValue === "all") {
      return routes;
    }

    return routes.filter(
      (route) => String(route.route_number) === selectedRouteValue
    );
  }, [routes, selectedRouteValue]);

  const selectedSingleRoute = useMemo(() => {
    if (selectedRouteValue === "all") return null;
    return (
      routes.find(
        (route) => String(route.route_number) === selectedRouteValue
      ) ?? null
    );
  }, [routes, selectedRouteValue]);

  const focusedStop = useMemo(() => {
    if (!focusedStopKey || !selectedSingleRoute) return null;

    return (
      selectedSingleRoute.stops.find(
        (stop) =>
          `${selectedSingleRoute.route_number}-${stop.seq}` === focusedStopKey
      ) ?? null
    );
  }, [focusedStopKey, selectedSingleRoute]);

  const handleRouteSelect = (routeNumber: number) => {
    setSelectedRouteValue(String(routeNumber));
    setFocusedStopKey(null);
  };

  const handleStopSelect = (routeNumber: number, stopSeq: number) => {
    setSelectedRouteValue(String(routeNumber));
    setFocusedStopKey(`${routeNumber}-${stopSeq}`);
  };

  const bounds = useMemo<LatLngBoundsExpression>(() => {
    const points: [number, number][] = [[depot.latitude, depot.longitude]];

    visibleRoutes.forEach((route) => {
      route.stops.forEach((stop) => {
        points.push([stop.latitude, stop.longitude]);
      });
    });

    return points;
  }, [depot, visibleRoutes]);

  const missingGeometry = routes.length > 0 && routes.every((r) => !r.geometry);

  return (
    <div className="space-y-4">
      {missingGeometry && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
          <div className="text-sm text-amber-800">
            <span className="font-medium">Road geometry unavailable.</span>{" "}
            Routes are shown as straight lines because the ORS container is not
            reachable. Run{" "}
            <code className="rounded bg-amber-100 px-1 font-mono text-xs">
              docker compose up -d
            </code>{" "}
            to start it, then re-generate routes.
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <label
          htmlFor="route-filter"
          className="text-sm font-medium text-gray-700"
        >
          Show route
        </label>

        <select
          id="route-filter"
          value={selectedRouteValue}
          onChange={(e) => {
            setSelectedRouteValue(e.target.value);
            setFocusedStopKey(null);
          }}
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
        >
          {routeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {selectedSingleRoute && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-gray-900">
              Route {selectedSingleRoute.route_number} · {selectedSingleRoute.vehicle}
            </h3>
            <div className="mt-2 flex items-center gap-4">
              <div className="text-sm text-gray-600">
                Capacity: {selectedSingleRoute.total_pallets} / {selectedSingleRoute.vehicle_capacity_pallets} pallets
              </div>
              {(() => {
                const percentage = Math.round((selectedSingleRoute.total_pallets / selectedSingleRoute.vehicle_capacity_pallets) * 100);
                const isOverCapacity = selectedSingleRoute.total_pallets > selectedSingleRoute.vehicle_capacity_pallets;
                const isNearCapacity = percentage >= 85 && !isOverCapacity;
                
                return (
                  <span className={`px-2 py-1 rounded text-sm font-medium ${
                    isOverCapacity 
                      ? 'bg-red-100 text-red-800' 
                      : isNearCapacity 
                        ? 'bg-amber-100 text-amber-800' 
                        : 'bg-green-100 text-green-800'
                  }`}>
                    {percentage}% capacity
                  </span>
                );
              })()}
            </div>
            <p className="text-sm text-gray-600 mt-1">
              Click a stop to jump to it on the map.
            </p>
          </div>

          <div className="max-h-56 overflow-y-auto rounded-md border border-gray-200">
            <div className="divide-y divide-gray-200">
              {selectedSingleRoute.stops.map((stop) => {
                const stopKey = `${selectedSingleRoute.route_number}-${stop.seq}`;
                const isFocused = stopKey === focusedStopKey;

                return (
                  <button
                    key={stopKey}
                    type="button"
                    onClick={() =>
                      handleStopSelect(selectedSingleRoute.route_number, stop.seq)
                    }
                    className={`w-full px-4 py-3 text-left transition ${
                      isFocused ? "bg-blue-50" : "bg-white hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-gray-900">
                          {stop.seq}. {stop.name}
                        </div>
                        <div className="mt-1 text-sm text-gray-600">
                          {stop.address}, {stop.city}, {stop.state} {stop.zip_code}
                        </div>
                      </div>
                      <div className="shrink-0 text-xs text-gray-500">
                        {formatMinutesToTime(stop.arrival_time_minutes)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="h-[520px] w-full">
        <MapContainer
          center={depotPosition}
          zoom={11}
          scrollWheelZoom={true}
          className="h-full w-full"
        >
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <FitBounds bounds={bounds} />
          <FocusStop stop={focusedStop} />

          <CircleMarker
            center={depotPosition}
            radius={10}
            pathOptions={{
              color: "#111827",
              fillColor: "#111827",
              fillOpacity: 1,
            }}
          >
            <Tooltip permanent direction="top" offset={[0, -8]}>
              Depot
            </Tooltip>
            <Popup>
              <div className="text-sm">
                <div className="font-semibold">{depot.name}</div>
                <div>
                  {depot.latitude}, {depot.longitude}
                </div>
              </div>
            </Popup>
          </CircleMarker>

          {removedStops.map((stop) => (
            <CircleMarker
              key={`removed-${stop.seq}`}
              center={[stop.latitude, stop.longitude]}
              radius={7}
              pathOptions={{
                color: "#9ca3af",
                fillColor: "#f3f4f6",
                fillOpacity: 0.8,
                weight: 2,
                dashArray: "4, 4",
              }}
            >
              <Tooltip direction="top">
                <div className="text-xs">
                  <div className="font-medium">{stop.name}</div>
                  <div className="text-gray-600">Removed</div>
                </div>
              </Tooltip>
              <Popup>
                <div className="text-sm">
                  <div className="font-semibold text-amber-700 mb-1">
                    ⚠ Removed Stop
                  </div>
                  <div className="font-medium">{stop.name}</div>
                  <div className="text-gray-600">
                    {stop.address}, {stop.city}, {stop.state}
                  </div>
                  <div className="mt-2 pt-2 border-t text-xs">
                    <div>Pallets: {stop.pallets}</div>
                    <div>
                      Order types: {stop.order_types?.join(", ") || "N/A"}
                    </div>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          ))}

          {visibleRoutes.map((route, routeIndex) => {
            const color = routeColors[routeIndex % routeColors.length];

            const polylinePositions: [number, number][] =
              route.geometry?.coordinates?.length
                ? route.geometry.coordinates.map(([lng, lat]) => [lat, lng])
                : [
                    [depot.latitude, depot.longitude],
                    ...route.stops.map(
                      (stop) =>
                        [stop.latitude, stop.longitude] as [number, number]
                    ),
                    [depot.latitude, depot.longitude],
                  ];

            return (
              <Fragment key={route.route_number}>
                {polylinePositions.length > 1 && (
                  <Polyline
                    positions={polylinePositions}
                    pathOptions={{
                      color,
                      weight: selectedRouteValue === "all" ? 5 : 7,
                      opacity: selectedRouteValue === "all" ? 0.85 : 0.95,
                    }}
                    eventHandlers={{
                      click: () => handleRouteSelect(route.route_number),
                    }}
                  />
                )}

                {route.stops
                  .filter(
                    (stop) => `${route.route_number}-${stop.seq}` !== focusedStopKey
                  )
                  .map((stop) =>
                    renderStopMarker(
                      route,
                      stop,
                      color,
                      selectedRouteValue,
                      focusedStopKey,
                      handleStopSelect
                    )
                  )}

                {route.stops
                  .filter(
                    (stop) => `${route.route_number}-${stop.seq}` === focusedStopKey
                  )
                  .map((stop) =>
                    renderStopMarker(
                      route,
                      stop,
                      color,
                      selectedRouteValue,
                      focusedStopKey,
                      handleStopSelect
                    )
                  )}
              </Fragment>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
}