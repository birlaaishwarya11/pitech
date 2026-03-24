'use client';

import React, { useState, useEffect } from 'react';
import { useParams, OptimizerParams } from '@/lib/params-context';
import Link from 'next/link';

export default function ParametersPage() {
  const { params, loading, error, fetchParams, updateParams, resetParams } = useParams();
  const [formData, setFormData] = useState<OptimizerParams | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch parameters on mount
    fetchParams('default');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Update form when params are loaded
    if (params) {
      setFormData({ ...params });
    }
  }, [params]);

  const handleChange = (field: keyof OptimizerParams, value: string | number | boolean) => {
    if (formData) {
      setFormData({
        ...formData,
        [field]: typeof formData[field] === 'boolean' ? value === 'true' : Number(value),
      });
    }
  };

  const handleSave = async () => {
    if (!formData) return;
    setSaveSuccess(false);
    setSaveError(null);
    try {
      await updateParams(formData);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save parameters');
    }
  };

  const handleReset = async () => {
    if (window.confirm('Are you sure you want to reset to default parameters?')) {
      try {
        await resetParams();
        setSaveSuccess(true);
        setSaveError(null);
        setTimeout(() => setSaveSuccess(false), 3000);
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : 'Failed to reset parameters');
      }
    }
  };

  if (loading || !formData) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-4xl mx-auto">
          <p className="text-gray-600">Loading parameters...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Optimizer Settings</h1>
            <p className="text-gray-600 mt-1">
              Configure parameters for route optimization
            </p>
          </div>
          <Link
            href="/"
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            ← Back to Optimization
          </Link>
        </div>

        {/* Status Messages */}
        {saveSuccess && (
          <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg">
            Parameters saved successfully!
          </div>
        )}
        {saveError && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
            {saveError}
          </div>
        )}

        {/* Parameters Form */}
        <div className="bg-white rounded-lg shadow space-y-6 p-6">
          {/* Solver - Wave 1 */}
          <div className="border-b pb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Solver — Wave 1 (Initial Optimization)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Time Limit (seconds)
                </label>
                <input
                  type="number"
                  value={formData.solver_time_limit_seconds}
                  onChange={(e) =>
                    handleChange('solver_time_limit_seconds', parseInt(e.target.value))
                  }
                  min="10"
                  max="600"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  How long the solver can run (10-600 seconds)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Vehicle Time (minutes)
                </label>
                <input
                  type="number"
                  value={formData.solver_max_vehicle_time_minutes}
                  onChange={(e) =>
                    handleChange('solver_max_vehicle_time_minutes', parseInt(e.target.value))
                  }
                  min="60"
                  max="1440"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Maximum hours on the road per vehicle
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Waiting Time (minutes)
                </label>
                <input
                  type="number"
                  value={formData.solver_max_waiting_minutes}
                  onChange={(e) =>
                    handleChange('solver_max_waiting_minutes', parseInt(e.target.value))
                  }
                  min="0"
                  max="600"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Maximum idle time allowed
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Drop Penalty
                </label>
                <input
                  type="number"
                  value={formData.drop_penalty}
                  onChange={(e) =>
                    handleChange('drop_penalty', parseInt(e.target.value))
                  }
                  min="100"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Higher = minimize unassigned orders
                </p>
              </div>
            </div>
          </div>

          {/* Solver - Wave 2 */}
          <div className="border-b pb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Solver — Wave 2 (Second Dispatch)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reload Buffer Time (minutes)
                </label>
                <input
                  type="number"
                  value={formData.wave2_reload_buffer_minutes}
                  onChange={(e) =>
                    handleChange('wave2_reload_buffer_minutes', parseInt(e.target.value))
                  }
                  min="0"
                  max="120"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Depot turnaround time between waves
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Wave 2 Cutoff Time (minutes from midnight)
                </label>
                <input
                  type="number"
                  value={formData.wave2_cutoff_minutes}
                  onChange={(e) =>
                    handleChange('wave2_cutoff_minutes', parseInt(e.target.value))
                  }
                  min="300"
                  max="1440"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Latest time wave 2 can start
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Wave 2 Solver Time Limit (seconds)
                </label>
                <input
                  type="number"
                  value={formData.wave2_solver_time_limit_seconds}
                  onChange={(e) =>
                    handleChange('wave2_solver_time_limit_seconds', parseInt(e.target.value))
                  }
                  min="10"
                  max="300"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Time limit for second dispatch optimization
                </p>
              </div>
            </div>
          </div>

          {/* Time Windows */}
          <div className="border-b pb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Depot & Service Time
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Depot Opening Time (minutes from midnight)
                </label>
                <input
                  type="number"
                  value={formData.depot_open_minutes}
                  onChange={(e) =>
                    handleChange('depot_open_minutes', parseInt(e.target.value))
                  }
                  min="0"
                  max="1440"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  480 = 8:00 AM
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Depot Closing Time (minutes from midnight)
                </label>
                <input
                  type="number"
                  value={formData.depot_close_minutes}
                  onChange={(e) =>
                    handleChange('depot_close_minutes', parseInt(e.target.value))
                  }
                  min="0"
                  max="1440"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  1020 = 5:00 PM
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Default Service Time per Stop (minutes)
                </label>
                <input
                  type="number"
                  value={formData.default_service_time}
                  onChange={(e) =>
                    handleChange('default_service_time', parseInt(e.target.value))
                  }
                  min="5"
                  max="120"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Time spent at each delivery location
                </p>
              </div>
            </div>
          </div>

          {/* Matrix Options */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Routing & Distance Matrix
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Use OpenRouteService
                </label>
                <select
                  value={formData.use_ors ? 'true' : 'false'}
                  onChange={(e) =>
                    handleChange('use_ors', e.target.value === 'true')
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="true">Yes (Real routing)</option>
                  <option value="false">No (Haversine fallback)</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Real routing or straight-line distance
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ORS Batch Size
                </label>
                <input
                  type="number"
                  value={formData.ors_matrix_batch_size}
                  onChange={(e) =>
                    handleChange('ors_matrix_batch_size', parseInt(e.target.value))
                  }
                  min="10"
                  max="100"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Matrix API batch size (10-100)
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={handleReset}
            className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 font-medium hover:bg-gray-50 transition-colors"
          >
            Reset to Defaults
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Saving...' : 'Save Parameters'}
          </button>
        </div>
      </div>
    </div>
  );
}
