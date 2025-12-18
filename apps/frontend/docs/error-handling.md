# Standardized Error Handling

This document describes the standardized error handling system used throughout the Aria frontend application to provide consistent, user-friendly error messages.

## Overview

The error handling system ensures that:
1. **End users never see technical error details** (database queries, stack traces, file paths)
2. **Consistent error messaging** across all features and components
3. **Actionable guidance** for users when errors occur
4. **Proper error logging** for developers in development mode

## Quick Start

### For Toast Notifications (Most Common)

```tsx
import { getToastMessage } from '@/lib/errors';
import { toast } from 'sonner';

// In a mutation error handler:
const mutation = trpc.items.create.useMutation({
  onSuccess: () => toast.success('Item created!'),
  onError: (error) => {
    toast.error(getToastMessage(error, 'create'));
  },
});
```

### For Full Error States

```tsx
import { ErrorState } from '@/components/ui/error-display';

// When a page fails to load:
if (queryError && !isLoading) {
  return (
    <ErrorState
      error={queryError}
      operation="load"
      title="Failed to load inventory items"
      onRetry={() => utils.items.list.refetch()}
    />
  );
}
```

### For Inline Alerts

```tsx
import { ErrorAlert } from '@/components/ui/error-display';

// Show an inline error in a form or section:
{error && (
  <ErrorAlert
    error={error}
    operation="update"
    onRetry={handleRetry}
  />
)}
```

## Available Components

### ErrorState
Full-page or full-section error display with icon, title, message, and retry button.

**Props:**
- `error` - The raw error or UserFriendlyError object
- `operation` - Optional: 'load' | 'create' | 'update' | 'delete'
- `onRetry` - Optional: Callback for retry button
- `isRetrying` - Optional: Show loading state on retry button
- `title` - Optional: Custom title override
- `className` - Optional: Additional CSS classes

### ErrorAlert
Inline alert for form validation errors or section errors.

**Props:**
- `error` - The raw error or UserFriendlyError object
- `operation` - Optional: 'load' | 'create' | 'update' | 'delete'
- `onRetry` - Optional: Callback for retry button
- `showRetry` - Optional: Override auto-determined retry visibility
- `className` - Optional: Additional CSS classes

### ErrorCard
Card-style error display for dashboard widgets.

**Props:**
- `error` - The raw error or UserFriendlyError object
- `operation` - Optional: 'load' | 'create' | 'update' | 'delete'
- `onRetry` - Optional: Callback for retry button
- `compact` - Optional: Use compact mode for smaller widgets
- `className` - Optional: Additional CSS classes

### ErrorBoundaryFallback
Default fallback UI for React Error Boundaries.

**Props:**
- `error` - The Error object
- `resetErrorBoundary` - Optional: Callback to reset the error boundary

## Available Utility Functions

### parseError(error, operation?)
Converts any error into a structured `UserFriendlyError` object.

```tsx
import { parseError } from '@/lib/errors';

const errorInfo = parseError(error, 'create');
// Returns: { title, message, category, severity, suggestion, canRetry, ... }
```

### getToastMessage(error, operation?)
Returns a short, user-friendly message suitable for toast notifications.

```tsx
import { getToastMessage } from '@/lib/errors';

toast.error(getToastMessage(error, 'delete'));
// Returns: "Unable to delete the item. Please check your connection."
```

### isTechnicalError(message)
Checks if an error message contains technical details that should be hidden.

```tsx
import { isTechnicalError } from '@/lib/errors';

if (isTechnicalError(error.message)) {
  // Show generic message instead
}
```

## Available Hooks

### useErrorHandler
Main hook for managing error state and handling.

```tsx
import { useErrorHandler } from '@/hooks/use-error-handler';

const { error, handleError, clearError } = useErrorHandler({
  defaultOperation: 'load',
  showToast: true,
});

// Use handleError in callbacks
const onSubmit = async (data) => {
  try {
    await submitData(data);
  } catch (e) {
    handleError(e, 'create');
  }
};

// Display error state
if (error) {
  return <ErrorState error={error} onRetry={clearError} />;
}
```

### useQueryError
Automatically handles errors from React Query/tRPC queries.

```tsx
import { useQueryError } from '@/hooks/use-error-handler';

const { data, isLoading, error: queryError } = trpc.items.list.useQuery();
const { error, retry } = useQueryError(queryError, {
  operation: 'load',
  onRetry: () => utils.items.list.refetch(),
});

if (error) {
  return <ErrorState error={error} onRetry={retry} />;
}
```

### useMutationError
Provides a standardized `onError` callback for mutations.

```tsx
import { useMutationError } from '@/hooks/use-error-handler';

const { onError } = useMutationError({ operation: 'create' });

const mutation = trpc.items.create.useMutation({
  onSuccess: () => toast.success('Created!'),
  onError,
});
```

## Error Categories

| Category | Description | Example Message |
|----------|-------------|-----------------|
| `network` | Connection issues | "We're having trouble connecting to the server." |
| `server` | Internal server errors | "We encountered an unexpected issue on our end." |
| `validation` | Invalid input | "Some of the information provided is not valid." |
| `authentication` | Session/login issues | "Your session has expired. Please sign in again." |
| `authorization` | Permission denied | "You don't have permission to perform this action." |
| `not_found` | Resource not found | "The requested resource could not be found." |
| `conflict` | Duplicate/constraint | "This action conflicts with an existing record." |
| `rate_limit` | Too many requests | "You've made too many requests. Please wait." |
| `unknown` | Unhandled errors | "Something unexpected happened. Please try again." |

## Operation-Specific Messages

The system automatically tailors messages based on the operation context:

- **load**: "Unable to load the data..."
- **create**: "Unable to create the item..."
- **update**: "Unable to save changes..."
- **delete**: "Unable to delete the item..."

## Development Mode

In development mode, the technical error details are preserved in the `technicalDetails` field and displayed in a collapsible section. This helps developers debug issues while still showing user-friendly messages.

## Migration Guide

### Before (Exposing Technical Errors)

```tsx
// ❌ BAD: Exposes technical details to users
onError: (error) => {
  toast.error(`Failed to create item: ${error.message}`);
}
```

### After (User-Friendly Errors)

```tsx
// ✅ GOOD: Shows user-friendly message
import { getToastMessage } from '@/lib/errors';

onError: (error) => {
  toast.error(getToastMessage(error, 'create'));
}
```

### Before (Manual Error Display)

```tsx
// ❌ BAD: Manual error display with technical details
{queryError && (
  <div className="error">
    <h3>Failed to load</h3>
    <p>{queryError.message}</p>
  </div>
)}
```

### After (Standardized Component)

```tsx
// ✅ GOOD: Standardized error display
import { ErrorState } from '@/components/ui/error-display';

{queryError && (
  <ErrorState
    error={queryError}
    operation="load"
    onRetry={() => refetch()}
  />
)}
```

## Best Practices

1. **Always specify the operation** when calling error utilities to get context-appropriate messages.

2. **Use ErrorState for full-page errors** and ErrorAlert for inline/section errors.

3. **Provide retry mechanisms** whenever the error is retryable (network, server issues).

4. **Don't override the message** unless you have specific user-facing text that improves clarity.

5. **Log errors to monitoring** (Sentry) for debugging, but show friendly messages to users.
