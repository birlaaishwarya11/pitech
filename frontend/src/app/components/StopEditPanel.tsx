import { X, MapPin, Truck, Clock, Package, AlertCircle, ArrowRight } from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";

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

interface Vehicle {
  id: string;
  name: string;
  capacity: number;
  currentLoad: number;
  color: string;
}

interface StopEditPanelProps {
  stop: Stop | null;
  vehicles: Vehicle[];
  onClose: () => void;
  onMoveToVehicle: (stopId: string, newVehicleId: string) => void;
  onReschedule: (stopId: string, newWindow: string) => void;
  onRemoveStop: (stopId: string) => void;
}

export function StopEditPanel({
  stop,
  vehicles,
  onClose,
  onMoveToVehicle,
  onReschedule,
  onRemoveStop,
}: StopEditPanelProps) {
  if (!stop) return null;

  const currentVehicle = vehicles.find((v) => v.id === stop.vehicleId);
  const availableVehicles = vehicles.filter(
    (v) => v.id !== stop.vehicleId
  );

  const canMoveToVehicle = (vehicle: Vehicle) => {
    const remainingCapacity = vehicle.capacity - vehicle.currentLoad;
    return remainingCapacity >= stop.pallets;
  };

  const timeWindows = [
    { value: "8:00 AM - 10:00 AM", label: "Morning (8:00 AM - 10:00 AM)" },
    { value: "10:00 AM - 12:00 PM", label: "Late Morning (10:00 AM - 12:00 PM)" },
    { value: "12:00 PM - 2:00 PM", label: "Afternoon (12:00 PM - 2:00 PM)" },
    { value: "2:00 PM - 4:00 PM", label: "Late Afternoon (2:00 PM - 4:00 PM)" },
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={onClose}
      />

      {/* Slide-over Panel */}
      <div className="fixed inset-y-0 right-0 w-[480px] bg-white shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Edit Delivery Stop
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {/* Stop Info */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="flex items-start gap-3 mb-4">
              <div className="size-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                <MapPin className="size-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-gray-900 leading-tight">
                  {stop.agencyName}
                </h3>
                <p className="text-sm text-gray-600 mt-0.5">
                  Stop #{stop.number}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-lg p-3 border border-gray-200">
                <div className="flex items-center gap-2 text-gray-600 mb-1">
                  <Package className="size-4" />
                  <span className="text-xs">Pallets</span>
                </div>
                <p className="text-xl font-semibold text-gray-900">
                  {stop.pallets}
                </p>
              </div>

              <div className="bg-white rounded-lg p-3 border border-gray-200">
                <div className="flex items-center gap-2 text-gray-600 mb-1">
                  <Clock className="size-4" />
                  <span className="text-xs">Est. Arrival</span>
                </div>
                <p className="text-sm font-semibold text-gray-900">
                  {stop.estimatedArrival}
                </p>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-gray-200">
              <div className="flex items-center gap-2">
                <Truck className="size-4 text-gray-600" />
                <span className="text-sm text-gray-600">Current Truck:</span>
                <span className="text-sm font-medium text-gray-900">
                  {currentVehicle?.name || stop.vehicleId}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Clock className="size-4 text-gray-600" />
                <span className="text-sm text-gray-600">Delivery Window:</span>
                <span className="text-sm font-medium text-gray-900">
                  {stop.deliveryWindow}
                </span>
              </div>
            </div>
          </div>

          {/* Helper Text */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
            <AlertCircle className="size-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-blue-900">
              Real-world changes happen. You can adjust routes before exporting.
            </p>
          </div>

          {/* Action 1: Move to Another Truck */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Move to Another Truck
            </h3>
            <div className="space-y-2">
              {availableVehicles.map((vehicle) => {
                const canMove = canMoveToVehicle(vehicle);
                const remainingCapacity = vehicle.capacity - vehicle.currentLoad;

                return (
                  <button
                    key={vehicle.id}
                    onClick={() => canMove && onMoveToVehicle(stop.id, vehicle.id)}
                    disabled={!canMove}
                    className={`w-full border rounded-lg p-4 text-left transition-colors ${
                      canMove
                        ? "border-gray-200 hover:border-blue-400 hover:bg-blue-50 cursor-pointer"
                        : "border-gray-200 bg-gray-50 cursor-not-allowed opacity-60"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Truck
                          className="size-4"
                          style={{ color: vehicle.color }}
                        />
                        <span className="text-sm font-medium text-gray-900">
                          {vehicle.name}
                        </span>
                      </div>
                      {canMove ? (
                        <ArrowRight className="size-4 text-blue-600" />
                      ) : (
                        <Badge className="bg-red-100 text-red-800 hover:bg-red-100 text-xs">
                          Full
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-600">
                        Current: {vehicle.currentLoad} / {vehicle.capacity} pallets
                      </span>
                      {canMove ? (
                        <span className="text-green-700 font-medium">
                          {remainingCapacity} available
                        </span>
                      ) : (
                        <span className="text-red-700 font-medium">
                          Not enough space
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action 2: Reschedule Delivery Time */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Reschedule Delivery Time
            </h3>
            <div className="space-y-2">
              {timeWindows.map((window) => (
                <button
                  key={window.value}
                  onClick={() => onReschedule(stop.id, window.value)}
                  className={`w-full border rounded-lg p-3 text-left transition-colors ${
                    window.value === stop.deliveryWindow
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-blue-400 hover:bg-blue-50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900">
                      {window.label}
                    </span>
                    {window.value === stop.deliveryWindow && (
                      <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 text-xs">
                        Current
                      </Badge>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Action 3: Remove from Today's Delivery */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Remove from Today's Delivery
            </h3>
            <Button
              onClick={() => onRemoveStop(stop.id)}
              variant="outline"
              className="w-full border-red-300 text-red-700 hover:bg-red-50 hover:border-red-400"
            >
              Remove Stop
            </Button>
            <p className="text-xs text-gray-600 mt-2">
              This stop will be removed from today's route. You'll need to reschedule it manually.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
