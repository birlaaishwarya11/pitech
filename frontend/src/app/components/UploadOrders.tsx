import { FileText, Package } from "lucide-react";

interface UploadOrdersProps {
  ordersCount: number;
  totalPallets: number;
  ordersFile: File | null;
  assetsFile: File | null;
  specialInstructions: string;
  isOptimizing: boolean;
  onOrdersFileChange: (file: File | null) => void;
  onAssetsFileChange: (file: File | null) => void;
  onSpecialInstructionsChange: (value: string) => void;
}

export function UploadOrders({
  ordersCount,
  totalPallets,
  ordersFile,
  assetsFile,
  specialInstructions,
  isOptimizing,
  onOrdersFileChange,
  onAssetsFileChange,
  onSpecialInstructionsChange,
}: UploadOrdersProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Upload Files</h3>

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-2">
            Orders file
          </label>
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            disabled={isOptimizing}
            onChange={(e) => onOrdersFileChange(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-blue-600 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-blue-700"
          />
          <p className="text-xs text-gray-500 mt-1">
            {ordersFile ? ordersFile.name : "No orders file selected"}
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-2">
            Assets file
          </label>
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            disabled={isOptimizing}
            onChange={(e) => onAssetsFileChange(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-blue-600 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-blue-700"
          />
          <p className="text-xs text-gray-500 mt-1">
            {assetsFile ? assetsFile.name : "No assets file selected"}
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-2">
            Special instructions (optional)
          </label>
          <textarea
            value={specialInstructions}
            disabled={isOptimizing}
            onChange={(e) => onSpecialInstructionsChange(e.target.value)}
            placeholder="Add any special routing instructions..."
            rows={4}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
          Backend optimize endpoint requires both files:
          <span className="font-medium"> orders_file </span>
          and
          <span className="font-medium"> assets_file</span>.
        </div>

        {ordersCount > 0 && (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm font-medium text-gray-900">
                Optimization result loaded
              </p>
              <p className="text-xs text-gray-600 mt-1">
                Backend response received successfully
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center gap-2 text-gray-600 mb-1">
                  <FileText className="size-4" />
                  <span className="text-xs">Orders</span>
                </div>
                <p className="text-2xl font-semibold text-gray-900">
                  {ordersCount}
                </p>
              </div>

              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center gap-2 text-gray-600 mb-1">
                  <Package className="size-4" />
                  <span className="text-xs">Pallets</span>
                </div>
                <p className="text-2xl font-semibold text-gray-900">
                  {totalPallets}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}