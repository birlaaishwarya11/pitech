'use client';

import { useState, useCallback } from 'react';
import {
  OptimizationResponse,
  DeleteStopResponse,
  DeleteStopRequest,
  OptimizationParams,
} from '../lib/types';
import { API_BASE_URL, API_ENDPOINTS } from '../lib/api-config';

export interface UseOptimizeReturn {
  data: OptimizationResponse | null;
  loading: boolean;
  error: string | null;
  optimize: (
    ordersFile: File,
    assetsFile: File,
    params?: OptimizationParams
  ) => Promise<void>;
  reset: () => void;
}

/**
 * Hook for running route optimization
 * Uploads orders and assets files, returns optimized routes
 */
export const useOptimize = (): UseOptimizeReturn => {
  const [data, setData] = useState<OptimizationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
  }, []);

  const optimize = useCallback(
    async (
      ordersFile: File,
      assetsFile: File,
      params?: OptimizationParams
    ) => {
      setLoading(true);
      setError(null);

      try {
        const formData = new FormData();
        formData.append('orders_file', ordersFile);
        formData.append('assets_file', assetsFile);

        // Add optional parameters
        if (params?.use_ors !== undefined) {
          formData.append('use_ors', String(params.use_ors));
        }
        if (params?.time_limit_seconds !== undefined) {
          formData.append('time_limit_seconds', String(params.time_limit_seconds));
        }
        if (params?.special_instructions) {
          formData.append('special_instructions', params.special_instructions);
        }

        const response = await fetch(
          `${API_BASE_URL}${API_ENDPOINTS.OPTIMIZE}`,
          {
            method: 'POST',
            body: formData,
            signal: AbortSignal.timeout(300000), // 5 minute timeout
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.detail || `API error: ${response.statusText}`
          );
        }

        const result = await response.json();
        setData(result);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Unknown error occurred';
        setError(errorMessage);
        console.error('Optimization error:', err);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { data, loading, error, optimize, reset };
};

export interface UseDeleteStopReturn {
  data: DeleteStopResponse | null;
  loading: boolean;
  error: string | null;
  deleteStop: (request: DeleteStopRequest) => Promise<void>;
  reset: () => void;
}

/**
 * Hook for deleting a stop from an optimized route
 */
export const useDeleteStop = (): UseDeleteStopReturn => {
  const [data, setData] = useState<DeleteStopResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
  }, []);

  const deleteStop = useCallback(async (request: DeleteStopRequest) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}${API_ENDPOINTS.DELETE_STOP}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(request),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.detail || `API error: ${response.statusText}`
        );
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Delete stop error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, deleteStop, reset };
};
