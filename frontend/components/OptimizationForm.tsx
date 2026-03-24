'use client';

import React, { useState } from 'react';
import { useOptimize } from '@/hooks/useApi';
import { OptimizationParams, DeleteStopRequest } from '@/lib/types';

/**
 * Demo component showing how to use the optimization API
 */
export default function OptimizationForm() {
  const { data, loading, error, optimize, reset } = useOptimize();
  const [ordersFile, setOrdersFile] = useState<File | null>(null);
  const [assetsFile, setAssetsFile] = useState<File | null>(null);
  const [useORS, setUseORS] = useState(true);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [timeLimitSeconds, setTimeLimitSeconds] = useState(60);

  const handleOptimize = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!ordersFile || !assetsFile) {
      alert('Please upload both files');
      return;
    }

    const params: OptimizationParams = {
      use_ors: useORS,
      time_limit_seconds: timeLimitSeconds,
      special_instructions: specialInstructions || undefined,
    };

    await optimize(ordersFile, assetsFile, params);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Route Optimization
          </h1>
          <p className="text-gray-600">
            Upload orders and assets to optimize delivery routes
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Left Column: Upload Form */}
          <div>
            <form
              onSubmit={handleOptimize}
              className="bg-white rounded-lg shadow p-6 space-y-4"
            >
              <h2 className="text-xl font-semibold text-gray-900">
                Upload Files
              </h2>

              {/* Orders File Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Orders File (CSV or XLS)
                </label>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOrdersFile(e.target.files?.[0] || null)}
                  className="block w-full text-sm text-gray-500
                    file:mr-4 file:py-2 file:px-4 file:rounded-md
                    file:border-0 file:text-sm file:font-semibold
                    file:bg-blue-50 file:text-blue-700
                    hover:file:bg-blue-100"
                />
                {ordersFile && (
                  <p className="mt-2 text-sm text-green-600">
                    Selected: {ordersFile.name}
                  </p>
                )}
              </div>

              {/* Assets File Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Assets File (CSV)
                </label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAssetsFile(e.target.files?.[0] || null)}
                  className="block w-full text-sm text-gray-500
                    file:mr-4 file:py-2 file:px-4 file:rounded-md
                    file:border-0 file:text-sm file:font-semibold
                    file:bg-blue-50 file:text-blue-700
                    hover:file:bg-blue-100"
                />
                {assetsFile && (
                  <p className="mt-2 text-sm text-green-600">
                    Selected: {assetsFile.name}
                  </p>
                )}
              </div>

              {/* Options */}
              <div className="space-y-3 pt-4 border-t">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="useORS"
                    checked={useORS}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUseORS(e.target.checked)}
                    className="rounded"
                  />
                  <label
                    htmlFor="useORS"
                    className="ml-2 text-sm font-medium text-gray-700"
                  >
                    Use OpenRouteService (recommended)
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Solver Time Limit (seconds)
                  </label>
                  <input
                    type="number"
                    value={timeLimitSeconds}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTimeLimitSeconds(parseInt(e.target.value, 10) || 60)}
                    min="10"
                    max="300"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md
                      text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Recommended: 60-120 seconds for large datasets
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Special Instructions (Optional)
                  </label>
                  <textarea
                    value={specialInstructions}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSpecialInstructions(e.target.value)}
                    placeholder="Examples:&#10;skip: WO#977187&#10;lock: Address → truck=FB-1&#10;priority: Customer Name&#10;window: WO#976054 → 08:30-10:00"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md
                      text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={4}
                  />
                </div>
              </div>

              {/* Error Display */}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                  <p className="text-sm font-medium">Error</p>
                  <p className="text-sm">{error}</p>
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-2 pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md
                    font-semibold hover:bg-blue-700 disabled:opacity-50
                    disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Optimizing... (may take several minutes)</span>
                    </div>
                  ) : (
                    'Optimize Routes'
                  )}
                </button>
                <button
                  type="button"
                  onClick={reset}
                  className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md
                    font-semibold hover:bg-gray-400 transition-colors"
                >
                  Reset
                </button>
              </div>
            </form>
          </div>

          {/* Right Column: Results */}
          <div className="space-y-4">
            {data && (
              <div className="bg-white rounded-lg shadow p-6 space-y-4">
                <h2 className="text-xl font-semibold text-gray-900">
                  Optimization Results
                </h2>

                {/* Summary Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-xs text-gray-600 uppercase font-semibold">
                      Total Orders
                    </p>
                    <p className="text-2xl font-bold text-blue-600">
                      {data.total_orders}
                    </p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <p className="text-xs text-gray-600 uppercase font-semibold">
                      Assigned
                    </p>
                    <p className="text-2xl font-bold text-green-600">
                      {data.assigned_orders}
                    </p>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <p className="text-xs text-gray-600 uppercase font-semibold">
                      Routes
                    </p>
                    <p className="text-2xl font-bold text-purple-600">
                      {data.routes_used}
                    </p>
                  </div>
                  <div className="bg-red-50 p-4 rounded-lg">
                    <p className="text-xs text-gray-600 uppercase font-semibold">
                      Unassigned
                    </p>
                    <p className="text-2xl font-bold text-red-600">
                      {data.unassigned_orders}
                    </p>
                  </div>
                </div>

                {/* Routes List */}
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {data.routes.map((route) => (
                    <div
                      key={route.route_number}
                      className="border border-gray-200 rounded-lg p-3"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-semibold text-gray-900">
                            Route {route.route_number}: {route.vehicle}
                          </p>
                          <p className="text-xs text-gray-500">
                            {route.num_stops} stops • {route.total_pallets}/
                            {route.vehicle_capacity_pallets} pallets
                          </p>
                        </div>
                      </div>

                      {/* Stops */}
                      <div className="space-y-1">
                        {route.stops.map((stop) => (
                          <div key={stop.seq} className="text-xs text-gray-600">
                            <span className="font-semibold">{stop.seq}.</span>{' '}
                            {stop.name} ({stop.address})
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!data && !error && !loading && (
              <div className="bg-gray-100 rounded-lg p-8 text-center">
                <p className="text-gray-600">
                  Upload files and click &quot;Optimize Routes&quot; to see results
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
