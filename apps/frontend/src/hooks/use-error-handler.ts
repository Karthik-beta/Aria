/**
 * useErrorHandler Hook
 * 
 * A standardized hook for handling errors throughout the application.
 * Provides consistent error parsing, toast notifications, and error state management.
 */

'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { type UserFriendlyError, parseError, getToastMessage } from '@/lib/errors';

type Operation = 'load' | 'create' | 'update' | 'delete';

interface UseErrorHandlerOptions {
    /** Default operation context for error messages */
    defaultOperation?: Operation;
    /** Custom title prefix for toast messages */
    toastTitlePrefix?: string;
    /** Whether to automatically show toast on error (default: true) */
    showToast?: boolean;
}

interface ErrorHandler {
    /** Current error info (null if no error) */
    error: UserFriendlyError | null;
    /** Whether there is an active error */
    hasError: boolean;
    /** Handle an error with toast notification */
    handleError: (error: unknown, operation?: Operation) => UserFriendlyError;
    /** Handle an error silently (no toast) */
    handleErrorSilent: (error: unknown, operation?: Operation) => UserFriendlyError;
    /** Show error toast for a given error */
    showErrorToast: (error: unknown, operation?: Operation) => void;
    /** Clear the current error */
    clearError: () => void;
    /** Set a custom error */
    setError: (error: UserFriendlyError | null) => void;
}

/**
 * Hook for standardized error handling
 * 
 * @example
 * ```tsx
 * const { error, handleError, clearError } = useErrorHandler({ defaultOperation: 'load' });
 * 
 * const { data, isLoading, error: queryError } = trpc.items.list.useQuery();
 * 
 * React.useEffect(() => {
 *   if (queryError) {
 *     handleError(queryError);
 *   }
 * }, [queryError, handleError]);
 * 
 * if (error) {
 *   return <ErrorState error={error} onRetry={clearError} />;
 * }
 * ```
 */
export function useErrorHandler(options: UseErrorHandlerOptions = {}): ErrorHandler {
    const {
        defaultOperation,
        showToast = true,
    } = options;

    const [error, setError] = React.useState<UserFriendlyError | null>(null);

    const handleErrorSilent = React.useCallback(
        (rawError: unknown, operation?: Operation): UserFriendlyError => {
            const parsed = parseError(rawError, operation ?? defaultOperation);
            setError(parsed);
            return parsed;
        },
        [defaultOperation]
    );

    const showErrorToast = React.useCallback(
        (rawError: unknown, operation?: Operation): void => {
            const message = getToastMessage(rawError, operation ?? defaultOperation);
            toast.error(message);
        },
        [defaultOperation]
    );

    const handleError = React.useCallback(
        (rawError: unknown, operation?: Operation): UserFriendlyError => {
            const parsed = handleErrorSilent(rawError, operation);

            if (showToast) {
                toast.error(parsed.message);
            }

            return parsed;
        },
        [handleErrorSilent, showToast]
    );

    const clearError = React.useCallback(() => {
        setError(null);
    }, []);

    return {
        error,
        hasError: error !== null,
        handleError,
        handleErrorSilent,
        showErrorToast,
        clearError,
        setError,
    };
}

/**
 * Hook for query error handling (works with tRPC/React Query)
 * Automatically handles error state from query results
 * 
 * @example
 * ```tsx
 * const { data, isLoading, error: queryError } = trpc.items.list.useQuery();
 * const { error, retry } = useQueryError(queryError, { 
 *   operation: 'load',
 *   onRetry: () => utils.items.list.refetch() 
 * });
 * 
 * if (error) {
 *   return <ErrorState error={error} onRetry={retry} />;
 * }
 * ```
 */
export function useQueryError(
    queryError: unknown,
    options: {
        operation?: Operation;
        onRetry?: () => void;
        showToast?: boolean;
    } = {}
) {
    const { operation = 'load', onRetry, showToast = false } = options;
    const { error, handleError, handleErrorSilent, clearError } = useErrorHandler({
        defaultOperation: operation,
        showToast,
    });

    const prevErrorRef = React.useRef<unknown>(null);

    React.useEffect(() => {
        // Only update if the error reference has actually changed
        if (queryError !== prevErrorRef.current) {
            prevErrorRef.current = queryError;

            if (queryError) {
                if (showToast) {
                    handleError(queryError);
                } else {
                    handleErrorSilent(queryError);
                }
            } else {
                clearError();
            }
        }
    }, [queryError, handleError, handleErrorSilent, clearError, showToast]);

    const retry = React.useCallback(() => {
        clearError();
        onRetry?.();
    }, [clearError, onRetry]);

    return {
        error,
        hasError: !!error,
        retry: onRetry ? retry : undefined,
        clearError,
    };
}

/**
 * Hook for mutation error handling
 * Provides a standardized onError callback for mutations
 * 
 * @example
 * ```tsx
 * const { onError } = useMutationError({ operation: 'create' });
 * 
 * const mutation = trpc.items.create.useMutation({
 *   onSuccess: () => toast.success('Item created!'),
 *   onError,
 * });
 * ```
 */
export function useMutationError(options: {
    operation: Operation;
    customMessages?: Partial<Record<string, string>>;
}) {
    const { operation } = options;

    const onError = React.useCallback(
        (error: unknown) => {
            const message = getToastMessage(error, operation);
            toast.error(message);
        },
        [operation]
    );

    return { onError };
}
