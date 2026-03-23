/**
 * API Configuration
 * Handles base URL configuration for different environments
 */

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const API_ENDPOINTS = {
  OPTIMIZE: '/api/v1/optimize',
  DELETE_STOP: '/api/v1/delete-stop',
} as const;

export const getApiUrl = (endpoint: string): string => {
  return `${API_BASE_URL}${endpoint}`;
};
