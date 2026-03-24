import { Calendar, Truck, MapPin, Route, Clock } from "lucide-react";
import { Button } from "./ui/button";

interface TopBarProps {
  selectedDate: string;
  totalStops: number;
  vehiclesAvailable: number;
  totalDistance: string;
  estimatedFinishTime: string;
  onGenerateRoutes: () => void;
  hasOrders: boolean;
  isGenerating: boolean;
  needsRerun: boolean;
}

export function TopBar({
  selectedDate,
  totalStops,
  vehiclesAvailable,
  totalDistance,
  estimatedFinishTime,
  onGenerateRoutes,
  hasOrders,
  isGenerating,
  needsRerun,
}: TopBarProps) {
  return (
    <div className="border-b bg-white px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <h1 className="text-xl font-semibold text-gray-900">
          Delivery Route Planner
        </h1>
        
        <div className="flex items-center gap-4 ml-8">
          <div className="flex items-center gap-2 text-gray-700">
            <Calendar className="size-4 text-gray-500" />
            <input
              type="date"
              value={selectedDate}
              readOnly
              className="text-sm bg-transparent border-none outline-none cursor-pointer"
            />
          </div>
          
          <div className="h-6 w-px bg-gray-300" />
          
          <div className="flex items-center gap-2 text-gray-700">
            <MapPin className="size-4 text-gray-500" />
            <span className="text-sm font-medium">{totalStops}</span>
            <span className="text-sm text-gray-500">stops</span>
          </div>
          
          <div className="h-6 w-px bg-gray-300" />
          
          <div className="flex items-center gap-2 text-gray-700">
            <Truck className="size-4 text-gray-500" />
            <span className="text-sm font-medium">{vehiclesAvailable}</span>
            <span className="text-sm text-gray-500">vehicles</span>
          </div>
          
          {totalDistance && (
            <>
              <div className="h-6 w-px bg-gray-300" />
              
              <div className="flex items-center gap-2 text-gray-700">
                <Route className="size-4 text-gray-500" />
                <span className="text-sm font-medium">{totalDistance}</span>
                <span className="text-sm text-gray-500">total</span>
              </div>
            </>
          )}
          
          {estimatedFinishTime && (
            <>
              <div className="h-6 w-px bg-gray-300" />
              
              <div className="flex items-center gap-2 text-gray-700">
                <Clock className="size-4 text-gray-500" />
                <span className="text-sm text-gray-500">Done by</span>
                <span className="text-sm font-medium">{estimatedFinishTime}</span>
              </div>
            </>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        {needsRerun && (
          <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
            <div className="size-2 rounded-full bg-orange-500 animate-pulse" />
            <span className="text-sm font-medium text-orange-800">
              Routes modified - re-run recommended
            </span>
          </div>
        )}
        
        <Button
          onClick={onGenerateRoutes}
          disabled={!hasOrders || isGenerating}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 text-base font-medium disabled:bg-gray-300 disabled:text-gray-500"
        >
          {isGenerating ? "Generating..." : "Generate Routes"}
        </Button>
      </div>
    </div>
  );
}