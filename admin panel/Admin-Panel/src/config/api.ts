/**
 * API Configuration
 *
 * Centralized configuration for backend API endpoints.
 * All API services should import from this file.
 */

// Base URL from environment variable, with fallback for development
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

// API Endpoints
export const API_ENDPOINTS = {
  // Swap & Points
  SWAP_COMPLETE: '/api/swap/complete',
  USER_POINTS: (wallet: string) => `/api/points/${wallet}`,
  LEADERBOARD: '/api/leaderboard',
  SWAP_HISTORY: (wallet: string) => `/api/swaps/${wallet}`,

  // Fee Configuration
  FEE_CONFIG: '/api/config/fee-config',
  FEE_TIERS: '/api/config/fee-tiers',
  CALCULATE_FEE: '/api/config/calculate-fee',

  // Community
  COMMUNITY_AWARD: '/api/community/award',

  // Contributions
  SUBMIT_CONTRIBUTION: '/api/contributions/submit',
  MY_CONTRIBUTIONS: (wallet: string) => `/api/contributions/${wallet}`,
  CONTRIBUTION_LIMITS: (wallet: string) => `/api/contributions/${wallet}/limits`,

  // Admin - Verify
  ADMIN_VERIFY: '/api/v1/admin/verify',

  // Admin - Contributions
  ADMIN_PENDING_CONTRIBUTIONS: '/api/v1/admin/contributions/pending',
  ADMIN_APPROVED_CONTRIBUTIONS: '/api/v1/admin/contributions/approved',
  ADMIN_REJECTED_CONTRIBUTIONS: '/api/v1/admin/contributions/rejected',
  ADMIN_APPROVE_CONTRIBUTION: (id: string) => `/api/v1/admin/contributions/${id}/approve`,
  ADMIN_REJECT_CONTRIBUTION: (id: string) => `/api/v1/admin/contributions/${id}/reject`,

  // Admin - Fee Configuration
  ADMIN_FEE_CONFIG_UPDATE: '/api/v1/admin/config/fee-config',

  // Admin - Admin Management (Super Admin only)
  ADMIN_LIST: '/api/v1/admin/admins',
  ADMIN_CREATE: '/api/v1/admin/admins',
  ADMIN_UPDATE: (adminId: string) => `/api/v1/admin/admins/${adminId}`,
  ADMIN_DELETE: (adminId: string) => `/api/v1/admin/admins/${adminId}`,
  ADMIN_CHECK_SUPER: '/api/v1/admin/check-super',

  // Platform
  STATS: '/api/stats',
  HEALTH: '/api/health',
} as const;

// Request timeout in milliseconds
export const API_TIMEOUT_MS = 10000;

// Helper to build full URL
export function buildApiUrl(endpoint: string, queryParams?: Record<string, string | number>): string {
  const url = new URL(endpoint, API_BASE_URL);

  if (queryParams) {
    Object.entries(queryParams).forEach(([key, value]) => {
      url.searchParams.append(key, String(value));
    });
  }

  return url.toString();
}

// Log configuration on module load (development only)
if (import.meta.env.DEV) {
  console.log('[API Config] Base URL:', API_BASE_URL);
}
