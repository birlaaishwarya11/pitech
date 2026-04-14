import { Upload, Loader2 } from "lucide-react";

interface EmptyStateProps {
  isGenerating?: boolean;
}

export function EmptyState({ isGenerating = false }: EmptyStateProps) {
  if (isGenerating) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-140px)]">
        <div className="text-center max-w-md">
          <div className="size-20 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-6">
            <Loader2 className="size-10 text-blue-600 animate-spin" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Optimizing routes...
          </h2>
          <p className="text-base text-gray-600">
            Building distance matrix, solving vehicle routing, and generating
            road geometry. This may take a minute for large order sets.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-[calc(100vh-140px)]">
      <div className="text-center max-w-md">
        <div className="size-20 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-6">
          <Upload className="size-10 text-blue-600" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Upload today's orders to begin
        </h2>
        <p className="text-base text-gray-600">
          Start by uploading a CSV file with delivery orders in the left panel.
          The system will help you create efficient routes for your drivers.
        </p>
      </div>
    </div>
  );
}
