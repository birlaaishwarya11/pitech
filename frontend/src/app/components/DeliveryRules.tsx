import { Clock, AlertCircle, Edit3 } from "lucide-react";
import { Switch } from "./ui/switch";

interface DeliveryRulesProps {
  respectTimeWindows: boolean;
  specialHandling: boolean;
  allowManualAdjustments: boolean;
  onToggleTimeWindows: () => void;
  onToggleSpecialHandling: () => void;
  onToggleManualAdjustments: () => void;
}

export function DeliveryRules({
  respectTimeWindows,
  specialHandling,
  allowManualAdjustments,
  onToggleTimeWindows,
  onToggleSpecialHandling,
  onToggleManualAdjustments,
}: DeliveryRulesProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">
        Delivery Rules
      </h3>
      
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1">
            <div className="mt-0.5">
              <Clock className="size-4 text-gray-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">
                Respect delivery time windows
              </p>
              <p className="text-xs text-gray-600 mt-0.5">
                Honor agency-specific delivery times
              </p>
            </div>
          </div>
          <Switch
            checked={respectTimeWindows}
            onCheckedChange={onToggleTimeWindows}
          />
        </div>
        
        <div className="h-px bg-gray-200" />
        
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1">
            <div className="mt-0.5">
              <AlertCircle className="size-4 text-gray-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">
                Special handling requirements
              </p>
              <p className="text-xs text-gray-600 mt-0.5">
                Consider cold chain & fragile items
              </p>
            </div>
          </div>
          <Switch
            checked={specialHandling}
            onCheckedChange={onToggleSpecialHandling}
          />
        </div>
        
        <div className="h-px bg-gray-200" />
        
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1">
            <div className="mt-0.5">
              <Edit3 className="size-4 text-gray-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">
                Allow manual adjustments
              </p>
              <p className="text-xs text-gray-600 mt-0.5">
                Enable route modifications after planning
              </p>
            </div>
          </div>
          <Switch
            checked={allowManualAdjustments}
            onCheckedChange={onToggleManualAdjustments}
          />
        </div>
      </div>
    </div>
  );
}
