'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface OptimizerParams {
  solver_time_limit_seconds: number;
  solver_max_vehicle_time_minutes: number;
  solver_max_waiting_minutes: number;
  drop_penalty: number;
  wave2_reload_buffer_minutes: number;
  wave2_cutoff_minutes: number;
  wave2_solver_time_limit_seconds: number;
  depot_open_minutes: number;
  depot_close_minutes: number;
  default_service_time: number;
  use_ors: boolean;
  ors_matrix_batch_size: number;
}

interface ParamsContextType {
  params: OptimizerParams | null;
  loading: boolean;
  error: string | null;
  fetchParams: (sessionId?: string) => Promise<void>;
  updateParams: (newParams: OptimizerParams, sessionId?: string) => Promise<void>;
  resetParams: (sessionId?: string) => Promise<void>;
  getDefaults: () => Promise<void>;
}

const defaultParams: OptimizerParams = {
  solver_time_limit_seconds: 180,
  solver_max_vehicle_time_minutes: 600,
  solver_max_waiting_minutes: 300,
  drop_penalty: 1000000,
  wave2_reload_buffer_minutes: 30,
  wave2_cutoff_minutes: 960,
  wave2_solver_time_limit_seconds: 90,
  depot_open_minutes: 480,
  depot_close_minutes: 1020,
  default_service_time: 30,
  use_ors: true,
  ors_matrix_batch_size: 50,
};

const ParamsContext = createContext<ParamsContextType | undefined>(undefined);

export const ParamsProvider: React.FC<{ children: ReactNode; apiBaseUrl: string }> = ({ children, apiBaseUrl }) => {
  const [params, setParams] = useState<OptimizerParams | null>(defaultParams);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchParams = useCallback(
    async (sessionId: string = 'default') => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `${apiBaseUrl}/api/v1/parameters?session_id=${sessionId}`
        );
        if (!response.ok) {
          throw new Error(`Failed to fetch parameters: ${response.statusText}`);
        }
        const data = await response.json();
        setParams(data.parameters);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        console.error('Error fetching params:', err);
      } finally {
        setLoading(false);
      }
    },
    [apiBaseUrl]
  );

  const updateParams = useCallback(
    async (newParams: OptimizerParams, sessionId: string = 'default') => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `${apiBaseUrl}/api/v1/parameters?session_id=${sessionId}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newParams),
          }
        );
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.detail || `Failed to update parameters: ${response.statusText}`);
        }
        const data = await response.json();
        setParams(data.parameters);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        console.error('Error updating params:', err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [apiBaseUrl]
  );

  const resetParams = useCallback(
    async (sessionId: string = 'default') => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `${apiBaseUrl}/api/v1/parameters/reset?session_id=${sessionId}`,
          { method: 'POST' }
        );
        if (!response.ok) {
          throw new Error(`Failed to reset parameters: ${response.statusText}`);
        }
        const data = await response.json();
        setParams(data.parameters);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        console.error('Error resetting params:', err);
      } finally {
        setLoading(false);
      }
    },
    [apiBaseUrl]
  );

  const getDefaults = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/parameters/defaults`);
      if (!response.ok) {
        throw new Error(`Failed to fetch defaults: ${response.statusText}`);
      }
      const data = await response.json();
      setParams(data.parameters);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      console.error('Error fetching defaults:', err);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl]);

  return (
    <ParamsContext.Provider
      value={{
        params,
        loading,
        error,
        fetchParams,
        updateParams,
        resetParams,
        getDefaults,
      }}
    >
      {children}
    </ParamsContext.Provider>
  );
};

export const useParams = (): ParamsContextType => {
  const context = useContext(ParamsContext);
  if (!context) {
    throw new Error('useParams must be used within ParamsProvider');
  }
  return context;
};
