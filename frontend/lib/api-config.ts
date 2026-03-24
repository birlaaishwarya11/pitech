/**
 * API Configuration
 * Handles base URL configuration for different environments
 */

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

export const API_ENDPOINTS = {
  OPTIMIZE: '/api/v1/optimize',
  DELETE_STOP: '/api/v1/delete-stop',
  PARAMETERS: '/api/v1/parameters',
  PARAMETERS_RESET: '/api/v1/parameters/reset',
  PARAMETERS_DEFAULTS: '/api/v1/parameters/defaults',
} as const;

export const getApiUrl = (endpoint: string): string => {
  return `${API_BASE_URL}${endpoint}`;
};
