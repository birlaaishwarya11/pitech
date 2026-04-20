import { useState } from "react";
import { FileText, Package, Clock, Layers, TruckIcon } from "lucide-react";
import { SpecialInstructionsBuilder } from "./SpecialInstructionsBuilder";

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
  depotOpen: string;
  depotClose: string;
  numWaves: number;
  wave2Cutoff: string;
  onDepotOpenChange: (value: string) => void;
  onDepotCloseChange: (value: string) => void;
  onNumWavesChange: (value: number) => void;
  onWave2CutoffChange: (value: string) => void;
  vehicleNames: string[];
  avoidedVehicles: string[];
  onAvoidedVehiclesChange: (vehicles: string[]) => void;
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
  depotOpen,
  depotClose,
  numWaves,
  wave2Cutoff,
  onDepotOpenChange,
  onDepotCloseChange,
  onNumWavesChange,
  onWave2CutoffChange,
  vehicleNames,
  avoidedVehicles,
  onAvoidedVehiclesChange,
}: UploadOrdersProps) {
  const [instructionMode, setInstructionMode] = useState<"structured" | "raw">(
    "structured"
  );

  return (
    <div className="space-y-4">
      {/* File Uploads */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">
          Upload Files
        </h3>
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
        </div>
      </div>

      {/* Depot & Wave Settings */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Clock className="size-4 text-gray-500" />
          Schedule
        </h3>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Depot opens
              </label>
              <input
                type="time"
                value={depotOpen}
                disabled={isOptimizing}
                onChange={(e) => onDepotOpenChange(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Depot closes
              </label>
              <input
                type="time"
                value={depotClose}
                disabled={isOptimizing}
                onChange={(e) => onDepotCloseChange(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <div className="flex items-center gap-2">
              <Layers className="size-3.5 text-gray-500" />
              <label className="text-xs font-medium text-gray-700">Waves</label>
            </div>
            <div className="flex rounded-md border border-gray-300 overflow-hidden text-xs">
              <button
                type="button"
                disabled={isOptimizing}
                className={`px-3 py-1.5 font-medium transition-colors ${
                  numWaves === 1
                    ? "bg-blue-600 text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
                onClick={() => onNumWavesChange(1)}
              >
                1 wave
              </button>
              <button
                type="button"
                disabled={isOptimizing}
                className={`px-3 py-1.5 font-medium transition-colors border-l border-gray-300 ${
                  numWaves === 2
                    ? "bg-blue-600 text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
                onClick={() => onNumWavesChange(2)}
              >
                2 waves
              </button>
            </div>
          </div>

          {numWaves === 2 && (
            <div className="pl-6">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Wave 2 cutoff (latest dispatch)
              </label>
              <input
                type="time"
                value={wave2Cutoff}
                disabled={isOptimizing}
                onChange={(e) => onWave2CutoffChange(e.target.value)}
                className="w-full max-w-[140px] rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          )}
        </div>
      </div>

      {/* Avoid Vehicles */}
      {vehicleNames.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <TruckIcon className="size-4 text-gray-500" />
            Avoid vehicles
            {avoidedVehicles.length > 0 && (
              <span className="ml-auto text-xs bg-red-100 text-red-700 rounded-full px-1.5 py-0.5 font-medium">
                {avoidedVehicles.length}
              </span>
            )}
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            Unchecked vehicles will be excluded from route assignments.
          </p>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {vehicleNames.map((name) => {
              const isAvoided = avoidedVehicles.includes(name);
              return (
                <label
                  key={name}
                  className={`flex items-center gap-2 rounded px-2 py-1.5 text-sm cursor-pointer transition-colors ${
                    isAvoided
                      ? "bg-red-50 text-red-700"
                      : "hover:bg-gray-50 text-gray-900"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={!isAvoided}
                    disabled={isOptimizing}
                    onChange={() => {
                      if (isAvoided) {
                        onAvoidedVehiclesChange(
                          avoidedVehicles.filter((v) => v !== name)
                        );
                      } else {
                        onAvoidedVehiclesChange([...avoidedVehicles, name]);
                      }
                    }}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className={isAvoided ? "line-through" : ""}>
                    {name}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* Special Instructions */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">
            Special Instructions
          </h3>
          <button
            type="button"
            className="text-xs text-gray-500 hover:text-gray-700 underline"
            onClick={() =>
              setInstructionMode(
                instructionMode === "structured" ? "raw" : "structured"
              )
            }
          >
            {instructionMode === "structured" ? "Raw text" : "Guided"}
          </button>
        </div>

        {instructionMode === "structured" ? (
          <SpecialInstructionsBuilder
            onChange={onSpecialInstructionsChange}
            disabled={isOptimizing}
          />
        ) : (
          <textarea
            value={specialInstructions}
            disabled={isOptimizing}
            onChange={(e) => onSpecialInstructionsChange(e.target.value)}
            placeholder={`skip: WO#977187\nlock: Name → truck=FB-1\npriority: Stop Name\nwindow: WO#976054 → 08:30-10:00\nnote: WO#976055 → call ahead`}
            rows={5}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 font-mono placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        )}
      </div>

      {/* Result Stats */}
      {ordersCount > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
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
  );
}
