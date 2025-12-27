/**
 * Standardized Error Types
 *
 * This module defines the error types and interfaces used throughout the application
 * for consistent error handling and user-friendly error messages.
 */

/**
 * Error severity levels for display purposes
 */
export type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical';

/**
 * Error categories for grouping and handling different error types
 */
export type ErrorCategory =
  | 'network' // Connection issues, timeouts
  | 'server' // 5xx errors, internal server errors
  | 'validation' // Form validation, input errors
  | 'authentication' // Login, session, token errors
  | 'authorization' // Permission, access denied errors
  | 'not_found' // Resource not found (404)
  | 'conflict' // Duplicate entries, constraint violations
  | 'rate_limit' // Too many requests
  | 'unknown'; // Unhandled/unexpected errors

/**
 * Structured user-friendly error information
 */
export interface UserFriendlyError {
  /** User-friendly title/heading for the error */
  title: string;
  /** User-friendly description explaining what went wrong */
  message: string;
  /** Error category for programmatic handling */
  category: ErrorCategory;
  /** Severity level for display purposes */
  severity: ErrorSeverity;
  /** Suggested action the user can take */
  suggestion?: string;
  /** Whether the user should retry the action */
  canRetry: boolean;
  /** Technical error details (only for development/logging) */
  technicalDetails?: string;
  /** Error code for support reference */
  errorCode?: string;
}

/**
 * Common HTTP status code mappings
 */
export const HTTP_ERROR_CATEGORIES: Record<number, ErrorCategory> = {
  400: 'validation',
  401: 'authentication',
  403: 'authorization',
  404: 'not_found',
  409: 'conflict',
  422: 'validation',
  429: 'rate_limit',
  500: 'server',
  502: 'server',
  503: 'server',
  504: 'network',
};

/**
 * Default error messages by category
 */
export const DEFAULT_ERROR_MESSAGES: Record<
  ErrorCategory,
  { title: string; message: string; suggestion?: string }
> = {
  network: {
    title: 'Connection Problem',
    message:
      "We're having trouble connecting to the server. Please check your internet connection.",
    suggestion: 'Check your internet connection and try again.',
  },
  server: {
    title: 'Something Went Wrong',
    message: 'We encountered an unexpected issue on our end. Our team has been notified.',
    suggestion: 'Please try again in a few moments.',
  },
  validation: {
    title: 'Invalid Input',
    message:
      'Some of the information provided is not valid. Please review and correct the highlighted fields.',
  },
  authentication: {
    title: 'Session Expired',
    message: 'Your session has expired. Please sign in again to continue.',
    suggestion: 'Sign in again to continue.',
  },
  authorization: {
    title: 'Access Denied',
    message: "You don't have permission to perform this action.",
    suggestion: 'Contact your administrator if you believe this is a mistake.',
  },
  not_found: {
    title: 'Not Found',
    message: 'The requested resource could not be found. It may have been moved or deleted.',
  },
  conflict: {
    title: 'Conflict Detected',
    message: 'This action conflicts with an existing record. Please use a different value.',
  },
  rate_limit: {
    title: 'Too Many Requests',
    message: "You've made too many requests. Please wait a moment before trying again.",
    suggestion: 'Wait a minute and try again.',
  },
  unknown: {
    title: 'Unexpected Error',
    message: 'Something unexpected happened. Please try again.',
    suggestion: 'If the problem persists, contact support.',
  },
};

/**
 * Context-specific error messages for common operations
 */
export const OPERATION_ERROR_MESSAGES: Record<string, Record<ErrorCategory, string>> = {
  load: {
    network: 'Unable to load the data. Please check your connection.',
    server: 'Unable to load the data due to a server issue.',
    validation: 'Unable to load the data due to invalid parameters.',
    authentication: 'Please sign in to view this data.',
    authorization: "You don't have permission to view this data.",
    not_found: 'The requested data could not be found.',
    conflict: 'Unable to load due to a data conflict.',
    rate_limit: 'Too many requests. Please wait a moment.',
    unknown: 'Unable to load the data. Please try again.',
  },
  create: {
    network: 'Unable to create the item. Please check your connection.',
    server: 'Unable to create the item due to a server issue.',
    validation: 'Please correct the errors in the form.',
    authentication: 'Please sign in to create items.',
    authorization: "You don't have permission to create items.",
    not_found: 'Unable to create the item. Required resources were not found.',
    conflict: 'An item with this information already exists.',
    rate_limit: 'Too many requests. Please wait a moment.',
    unknown: 'Unable to create the item. Please try again.',
  },
  update: {
    network: 'Unable to save changes. Please check your connection.',
    server: 'Unable to save changes due to a server issue.',
    validation: 'Please correct the errors in the form.',
    authentication: 'Please sign in to make changes.',
    authorization: "You don't have permission to edit this item.",
    not_found: "The item you're trying to update no longer exists.",
    conflict: 'This item was modified by someone else. Please refresh and try again.',
    rate_limit: 'Too many requests. Please wait a moment.',
    unknown: 'Unable to save changes. Please try again.',
  },
  delete: {
    network: 'Unable to delete the item. Please check your connection.',
    server: 'Unable to delete the item due to a server issue.',
    validation: 'Unable to delete. The item has dependencies.',
    authentication: 'Please sign in to delete items.',
    authorization: "You don't have permission to delete this item.",
    not_found: "The item you're trying to delete no longer exists.",
    conflict: 'Unable to delete. The item is currently in use.',
    rate_limit: 'Too many requests. Please wait a moment.',
    unknown: 'Unable to delete the item. Please try again.',
  },
};
