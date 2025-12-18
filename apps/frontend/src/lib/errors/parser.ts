/**
 * Error Parser Utilities
 * 
 * This module provides utilities to parse raw errors (from API, network, etc.)
 * and convert them into user-friendly error objects.
 */

import {
    type UserFriendlyError,
    type ErrorCategory,
    type ErrorSeverity,
    HTTP_ERROR_CATEGORIES,
    DEFAULT_ERROR_MESSAGES,
    OPERATION_ERROR_MESSAGES,
} from './types';

/**
 * Patterns to detect technical error messages that should be hidden from users
 */
const TECHNICAL_PATTERNS = [
    // Database/ORM errors
    /prisma/i,
    /postgres/i,
    /sqlite/i,
    /mysql/i,
    /mongodb/i,
    /database/i,
    /query failed/i,
    /constraint/i,
    /foreign key/i,
    /unique.*violation/i,
    /duplicate.*key/i,
    /column.*does not exist/i,
    /relation.*does not exist/i,
    /table.*does not exist/i,

    // Network/Transport errors
    /econnrefused/i,
    /enotfound/i,
    /etimedout/i,
    /socket hang up/i,
    /connection.*reset/i,
    /network.*error/i,

    // Server/Runtime errors
    /internal server error/i,
    /stack trace/i,
    /at.*\.(ts|js|tsx|jsx):\d+/i,
    /null.*reference/i,
    /undefined.*is not/i,
    /cannot read.*property/i,
    /cannot.*of undefined/i,
    /cannot.*of null/i,

    // File path patterns
    /[A-Za-z]:\\.*\\/,  // Windows paths
    /\/home\//,          // Linux paths
    /\/Users\//,         // Mac paths
    /node_modules/i,
    /\.ts:\d+/,          // TypeScript line references
    /\.js:\d+/,          // JavaScript line references

    // Code patterns
    /syntax error/i,
    /unexpected token/i,
    /invocation/i,
    /findMany|findUnique|findFirst|create|update|delete/i, // Prisma methods
];

/**
 * Patterns to extract useful information from errors
 */
const VALIDATION_PATTERNS = [
    { pattern: /already exists/i, category: 'conflict' as ErrorCategory },
    { pattern: /not found|doesn't exist|does not exist/i, category: 'not_found' as ErrorCategory },
    { pattern: /unauthorized|not authenticated|invalid token/i, category: 'authentication' as ErrorCategory },
    { pattern: /forbidden|not allowed|permission denied/i, category: 'authorization' as ErrorCategory },
    { pattern: /too many requests|rate limit/i, category: 'rate_limit' as ErrorCategory },
    { pattern: /invalid|required|must be|cannot be empty/i, category: 'validation' as ErrorCategory },
    { pattern: /fetch.*failed|network|connection|timeout/i, category: 'network' as ErrorCategory },
];

/**
 * Check if an error message contains technical/developer-only information
 */
export function isTechnicalError(message: string): boolean {
    return TECHNICAL_PATTERNS.some(pattern => pattern.test(message));
}

/**
 * Detect the error category from an error message
 */
export function detectErrorCategory(error: unknown): ErrorCategory {
    const message = extractErrorMessage(error);

    // Check for HTTP status codes in the error
    const statusMatch = message.match(/\b(\d{3})\b/);
    if (statusMatch) {
        const status = parseInt(statusMatch[1], 10);
        if (status in HTTP_ERROR_CATEGORIES) {
            return HTTP_ERROR_CATEGORIES[status];
        }
    }

    // Check for specific patterns
    for (const { pattern, category } of VALIDATION_PATTERNS) {
        if (pattern.test(message)) {
            return category;
        }
    }

    // Check for network-related errors
    if (error instanceof TypeError && message.includes('fetch')) {
        return 'network';
    }

    // Default to unknown
    return 'unknown';
}

/**
 * Extract the error message from various error types
 */
export function extractErrorMessage(error: unknown): string {
    if (typeof error === 'string') {
        return error;
    }

    if (error instanceof Error) {
        return error.message;
    }

    if (error && typeof error === 'object') {
        // Handle tRPC errors
        if ('message' in error && typeof error.message === 'string') {
            return error.message;
        }

        // Handle API response errors
        if ('error' in error && typeof error.error === 'string') {
            return error.error;
        }

        // Handle response data errors
        if ('data' in error && typeof error.data === 'object' && error.data) {
            const data = error.data as Record<string, unknown>;
            if ('message' in data && typeof data.message === 'string') {
                return data.message;
            }
        }
    }

    return 'An unexpected error occurred';
}

/**
 * Determine error severity based on category
 */
export function getErrorSeverity(category: ErrorCategory): ErrorSeverity {
    switch (category) {
        case 'server':
        case 'unknown':
            return 'critical';
        case 'authentication':
        case 'authorization':
        case 'conflict':
            return 'error';
        case 'validation':
        case 'not_found':
        case 'rate_limit':
            return 'warning';
        case 'network':
            return 'info';
        default:
            return 'error';
    }
}

/**
 * Determine if the error is retryable
 */
export function isRetryableError(category: ErrorCategory): boolean {
    switch (category) {
        case 'network':
        case 'server':
        case 'rate_limit':
        case 'unknown':
            return true;
        case 'validation':
        case 'authentication':
        case 'authorization':
        case 'not_found':
        case 'conflict':
            return false;
        default:
            return true;
    }
}

/**
 * Parse any error into a user-friendly error object
 * 
 * @param error - The raw error from API, network, or other source
 * @param operation - Optional operation context (e.g., 'load', 'create', 'update', 'delete')
 * @returns UserFriendlyError object ready for display
 */
export function parseError(error: unknown, operation?: string): UserFriendlyError {
    const rawMessage = extractErrorMessage(error);
    const category = detectErrorCategory(error);
    const severity = getErrorSeverity(category);
    const canRetry = isRetryableError(category);

    // Get default messages for this category
    const defaults = DEFAULT_ERROR_MESSAGES[category];

    // Get operation-specific message if available
    const operationMessages = operation ? OPERATION_ERROR_MESSAGES[operation] : undefined;
    const operationMessage = operationMessages?.[category];

    // Determine if we should show the raw message or use a generic one
    const isTechnical = isTechnicalError(rawMessage);

    // For validation errors that aren't technical, we can show the actual message
    const shouldShowRawMessage = !isTechnical &&
        (category === 'validation' || category === 'conflict' || category === 'not_found');

    return {
        title: defaults.title,
        message: shouldShowRawMessage
            ? rawMessage
            : (operationMessage || defaults.message),
        category,
        severity,
        suggestion: defaults.suggestion,
        canRetry,
        technicalDetails: process.env.NODE_ENV === 'development' ? rawMessage : undefined,
        errorCode: category.toUpperCase().replace('_', '-'),
    };
}

/**
 * Get a short, toast-friendly error message
 */
export function getToastMessage(error: unknown, operation?: string): string {
    const parsed = parseError(error, operation);
    return parsed.message;
}

/**
 * Get a full error object for detailed display
 */
export function getDetailedError(error: unknown, operation?: string): UserFriendlyError {
    return parseError(error, operation);
}
