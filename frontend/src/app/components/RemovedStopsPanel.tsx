import { useState } from "react";
import { X, Plus } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

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
  sourceRouteNumber: number;
}

interface RemovedStopsPanelProps {
  removedStops: Stop[];
  onRestoreStop: (stop: Stop) => void;
  onAddToRoute?: (stop: Stop, routeNumber: number) => void;
}

export function RemovedStopsPanel({
  removedStops,
  onRestoreStop,
  onAddToRoute,
}: RemovedStopsPanelProps) {
  const [expandedStop, setExpandedStop] = useState<number | null>(null);

  if (removedStops.length === 0) {
    return null;
  }

  return (
    <Card className="border border-amber-200 bg-amber-50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-amber-500"></span>
          Removed Stops ({removedStops.length})
        </CardTitle>
        <p className="text-xs text-gray-600 mt-1">
          Drag stops to routes or click "Add" to reassign
        </p>
      </CardHeader>
      <CardContent className="space-y-2 max-h-96 overflow-y-auto">
        {removedStops.map((stop) => (
          <div
            key={`${stop.customer_number}-${stop.seq}`}
            className="bg-white rounded border border-amber-200 p-3 text-sm"
            draggable
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData(
                "removedStop",
                JSON.stringify(stop)
              );
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">
                  {stop.name}
                </p>
                <p className="text-xs text-gray-600 truncate">
                  {stop.address}, {stop.city}, {stop.state}
                </p>
                <div className="flex gap-2 mt-1">
                  <span className="inline-block bg-gray-100 text-gray-800 px-2 py-0.5 rounded text-xs">
                    Route {stop.sourceRouteNumber}
                  </span>
                  <span className="inline-block bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-xs">
                    {stop.pallets} pallets
                  </span>
                  {stop.order_types?.length > 0 && (
                    <span className="inline-block bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs">
                      {stop.order_types.join(", ")}
                    </span>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRestoreStop(stop)}
                title="Undo removal"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
