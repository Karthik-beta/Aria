/**
 * Standardized Error Handling Library
 *
 * This module exports all error handling utilities for consistent
 * user-friendly error messages throughout the application.
 *
 * @example
 * ```tsx
 * import { parseError, getToastMessage } from '@/lib/errors';
 *
 * // In a mutation error handler:
 * onError: (error) => {
 *   toast.error(getToastMessage(error, 'create'));
 * }
 *
 * // For detailed error display:
 * const errorInfo = parseError(error, 'load');
 * ```
 */

// Types
export type { UserFriendlyError, ErrorSeverity, ErrorCategory } from './types';

export { HTTP_ERROR_CATEGORIES, DEFAULT_ERROR_MESSAGES, OPERATION_ERROR_MESSAGES } from './types';

// Parser utilities
export {
  parseError,
  getToastMessage,
  getDetailedError,
  isTechnicalError,
  detectErrorCategory,
  extractErrorMessage,
  getErrorSeverity,
  isRetryableError,
} from './parser';
