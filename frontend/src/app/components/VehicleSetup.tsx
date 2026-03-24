import { Truck, Plus, Trash2 } from "lucide-react";
import { Switch } from "./ui/switch";
import { Button } from "./ui/button";

interface Vehicle {
  id: string;
  name: string;
  capacity: number;
  available: boolean;
}

interface VehicleSetupProps {
  vehicles: Vehicle[];
  onToggleAvailable: (id: string) => void;
  onRemoveVehicle: (id: string) => void;
  onAddVehicle: () => void;
}

export function VehicleSetup({
  vehicles,
  onToggleAvailable,
  onRemoveVehicle,
  onAddVehicle,
}: VehicleSetupProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">Vehicle Setup</h3>
        <Button
          onClick={onAddVehicle}
          variant="ghost"
          size="sm"
          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 -mr-2"
        >
          <Plus className="size-4 mr-1" />
          Add
        </Button>
      </div>
      
      <div className="space-y-3">
        {vehicles.map((vehicle) => (
          <div
            key={vehicle.id}
            className={`border rounded-lg p-3 transition-colors ${
              vehicle.available
                ? "border-gray-200 bg-white"
                : "border-gray-200 bg-gray-50"
            }`}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2 flex-1">
                <Truck
                  className={`size-4 ${
                    vehicle.available ? "text-blue-600" : "text-gray-400"
                  }`}
                />
                <span
                  className={`text-sm font-medium ${
                    vehicle.available ? "text-gray-900" : "text-gray-500"
                  }`}
                >
                  {vehicle.name}
                </span>
              </div>
              <button
                onClick={() => onRemoveVehicle(vehicle.id)}
                className="text-gray-400 hover:text-red-600 p-1 -mt-1 -mr-1"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="text-xs text-gray-600">
                Capacity: <span className="font-medium text-gray-900">{vehicle.capacity}</span> pallets
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600">
                  {vehicle.available ? "Available" : "Unavailable"}
                </span>
                <Switch
                  checked={vehicle.available}
                  onCheckedChange={() => onToggleAvailable(vehicle.id)}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
