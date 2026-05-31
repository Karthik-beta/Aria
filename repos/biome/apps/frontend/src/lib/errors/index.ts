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

// Parser utilities
export {
	detectErrorCategory,
	extractErrorMessage,
	getDetailedError,
	getErrorSeverity,
	getToastMessage,
	isRetryableError,
	isTechnicalError,
	parseError,
} from "./parser";
// Types
export type { ErrorCategory, ErrorSeverity, UserFriendlyError } from "./types";
export {
	DEFAULT_ERROR_MESSAGES,
	HTTP_ERROR_CATEGORIES,
	OPERATION_ERROR_MESSAGES,
} from "./types";
