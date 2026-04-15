import { AlertTriangle } from "lucide-react";
import { Card, CardContent } from "./ui/card";

interface CapacityWarning {
  routeNumber: number;
  vehicle: string;
  capacity: number;
  currentLoad: number;
  isOverCapacity: boolean;
}

interface CapacityWarningsProps {
  warnings: CapacityWarning[];
}

export function CapacityWarnings({ warnings }: CapacityWarningsProps) {
  const overCapacityWarnings = warnings.filter((w) => w.isOverCapacity);
  const nearCapacityWarnings = warnings.filter(
    (w) => !w.isOverCapacity && w.currentLoad / w.capacity > 0.85
  );

  if (overCapacityWarnings.length === 0 && nearCapacityWarnings.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {overCapacityWarnings.length > 0 && (
        <Card className="border border-red-200 bg-red-50">
          <CardContent className="pt-4">
            <div className="space-y-2">
              {overCapacityWarnings.map((warning) => (
                <div key={warning.routeNumber} className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-red-900">
                      Route {warning.routeNumber} ({warning.vehicle}) is
                      over-capacity
                    </p>
                    <p className="text-red-800 text-xs">
                      {warning.currentLoad} / {warning.capacity} pallets
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {nearCapacityWarnings.length > 0 && (
        <Card className="border border-amber-200 bg-amber-50">
          <CardContent className="pt-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-amber-900">
                Routes approaching capacity:
              </p>
              {nearCapacityWarnings.map((warning) => (
                <p key={warning.routeNumber} className="text-xs text-amber-800">
                  Route {warning.routeNumber} ({warning.vehicle}):{" "}
                  {Math.round((warning.currentLoad / warning.capacity) * 100)}%
                  full
                </p>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
