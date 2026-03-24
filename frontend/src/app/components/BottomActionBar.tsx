import { RefreshCw, FileDown, Send } from "lucide-react";
import { Button } from "./ui/button";

interface BottomActionBarProps {
  onRerun: () => void;
  onExportPDF: () => void;
  onExportCSV: () => void;
  onSendToDrivers: () => void;
  disabled: boolean;
}

export function BottomActionBar({
  onRerun,
  onExportPDF,
  onExportCSV,
  onSendToDrivers,
  disabled,
}: BottomActionBarProps) {
  return (
    <div className="border-t bg-white px-6 py-4 flex items-center justify-between">
      <Button
        onClick={onRerun}
        disabled={disabled}
        variant="outline"
        className="text-blue-600 border-blue-600 hover:bg-blue-50"
      >
        <RefreshCw className="size-4 mr-2" />
        Re-run Routes
      </Button>
      
      <div className="flex items-center gap-3">
        <Button
          onClick={onExportPDF}
          disabled={disabled}
          variant="outline"
        >
          <FileDown className="size-4 mr-2" />
          Export PDF
        </Button>
        
        <Button
          onClick={onExportCSV}
          disabled={disabled}
          variant="outline"
        >
          <FileDown className="size-4 mr-2" />
          Export CSV
        </Button>
        
        <Button
          onClick={onSendToDrivers}
          disabled={disabled}
          className="bg-green-600 hover:bg-green-700 text-white"
        >
          <Send className="size-4 mr-2" />
          Send to Drivers
        </Button>
      </div>
    </div>
  );
}
