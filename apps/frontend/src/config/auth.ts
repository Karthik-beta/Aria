/**
 * Centralized Authentication Configuration for SSO-style Auth
 *
 * This configuration enables Single Sign-On functionality across all Aria ERP apps:
 * - Asset Management
 * - CRM
 * - HRMS
 * - Inventory
 *
 * All apps share the same authentication routes and session.
 */

export const AUTH_CONFIG = {
  // Centralized auth routes (shared across all apps)
  routes: {
    signIn: '/auth/sign-in',
    signUp: '/auth/sign-up',
  },

  // App-specific default redirect paths after successful authentication
  appRedirects: {
    asset: '/asset/dashboard/overview',
    crm: '/crm/dashboard/overview',
    hrms: '/hrms/dashboard/overview',
    inventory: '/inventory/dashboard/overview',
  },

  // Default redirect if no app is specified
  defaultRedirect: '/dashboard',

  // Public routes that don't require authentication
  publicRoutes: ['/', '/auth/sign-in', '/auth/sign-up'],

  // Protected route patterns
  protectedPatterns: [
    '/asset/dashboard',
    '/crm/dashboard',
    '/hrms/dashboard',
    '/inventory/dashboard',
  ],
} as const;

/**
 * Detect which app the user is trying to access from the callback URL
 */
export function detectAppFromCallbackUrl(
  callbackUrl: string | null
): keyof typeof AUTH_CONFIG.appRedirects | null {
  if (!callbackUrl) return null;

  if (callbackUrl.includes('/asset')) return 'asset';
  if (callbackUrl.includes('/crm')) return 'crm';
  if (callbackUrl.includes('/hrms')) return 'hrms';
  if (callbackUrl.includes('/inventory')) return 'inventory';

  return null;
}

/**
 * Get the appropriate redirect URL based on the callback URL or app context
 */
export function getAuthRedirectUrl(callbackUrl: string | null): string {
  // If callback URL is provided, use it
  if (callbackUrl) {
    return callbackUrl;
  }

  // Detect app from callback and return appropriate default
  const app = detectAppFromCallbackUrl(callbackUrl);
  if (app) {
    return AUTH_CONFIG.appRedirects[app];
  }

  // Fallback to default redirect
  return AUTH_CONFIG.defaultRedirect;
}

/**
 * Build sign-in URL with callback
 */
export function buildSignInUrl(callbackUrl?: string): string {
  const url = AUTH_CONFIG.routes.signIn;
  if (callbackUrl) {
    return `${url}?callbackUrl=${encodeURIComponent(callbackUrl)}`;
  }
  return url;
}

/**
 * Build sign-up URL with callback
 */
export function buildSignUpUrl(callbackUrl?: string): string {
  const url = AUTH_CONFIG.routes.signUp;
  if (callbackUrl) {
    return `${url}?callbackUrl=${encodeURIComponent(callbackUrl)}`;
  }
  return url;
}
