/**
 * Error Display Components
 *
 * Reusable UI components for displaying user-friendly error messages
 * throughout the application.
 */

"use client";

import {
	AlertTriangle,
	Ban,
	Clock,
	HelpCircle,
	RefreshCw,
	ShieldAlert,
	WifiOff,
	XCircle,
} from "lucide-react";
import * as React from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	type ErrorCategory,
	parseError,
	type UserFriendlyError,
} from "@/lib/errors";
import { cn } from "@/lib/utils";

/**
 * Get the icon for a specific error category
 */
function getErrorIcon(category: ErrorCategory) {
	switch (category) {
		case "network":
			return WifiOff;
		case "authentication":
			return ShieldAlert;
		case "authorization":
			return Ban;
		case "rate_limit":
			return Clock;
		case "not_found":
			return HelpCircle;
		default:
			return AlertTriangle;
	}
}

/**
 * Get the color scheme for a specific error severity/category
 */
function getErrorColors(category: ErrorCategory) {
	switch (category) {
		case "network":
			return {
				bg: "bg-blue-50 dark:bg-blue-950/20",
				border: "border-blue-200 dark:border-blue-800",
				icon: "text-blue-500",
				title: "text-blue-900 dark:text-blue-100",
			};
		case "authentication":
		case "authorization":
			return {
				bg: "bg-amber-50 dark:bg-amber-950/20",
				border: "border-amber-200 dark:border-amber-800",
				icon: "text-amber-500",
				title: "text-amber-900 dark:text-amber-100",
			};
		case "rate_limit":
			return {
				bg: "bg-orange-50 dark:bg-orange-950/20",
				border: "border-orange-200 dark:border-orange-800",
				icon: "text-orange-500",
				title: "text-orange-900 dark:text-orange-100",
			};
		case "server":
		case "unknown":
			return {
				bg: "bg-red-50 dark:bg-red-950/20",
				border: "border-red-200 dark:border-red-800",
				icon: "text-red-500",
				title: "text-red-900 dark:text-red-100",
			};
		default:
			return {
				bg: "bg-destructive/5",
				border: "border-destructive/20",
				icon: "text-destructive",
				title: "text-destructive",
			};
	}
}

// ============================================================================
// ErrorAlert - Inline alert for form/section errors
// ============================================================================

interface ErrorAlertProps {
	/** Raw error or parsed user-friendly error */
	error: unknown | UserFriendlyError;
	/** Operation context for better error messages */
	operation?: "load" | "create" | "update" | "delete";
	/** Optional callback when retry button is clicked */
	onRetry?: () => void;
	/** Whether to show retry button (auto-determined if not specified) */
	showRetry?: boolean;
	/** Additional CSS classes */
	className?: string;
}

/**
 * Inline error alert component for displaying errors within a section
 */
export function ErrorAlert({
	error,
	operation,
	onRetry,
	showRetry,
	className,
}: ErrorAlertProps) {
	// Parse error if it's not already a UserFriendlyError
	const errorInfo: UserFriendlyError = React.useMemo(() => {
		if (error && typeof error === "object" && "category" in error) {
			return error as UserFriendlyError;
		}
		return parseError(error, operation);
	}, [error, operation]);

	const colors = getErrorColors(errorInfo.category);
	const Icon = getErrorIcon(errorInfo.category);
	const shouldShowRetry = showRetry ?? (errorInfo.canRetry && onRetry);

	return (
		<Alert
			variant="destructive"
			className={cn("relative", colors.bg, colors.border, className)}
		>
			<Icon className={cn("h-4 w-4", colors.icon)} />
			<AlertTitle className={cn("font-semibold", colors.title)}>
				{errorInfo.title}
			</AlertTitle>
			<AlertDescription className="mt-1">
				<p className="text-sm text-muted-foreground">{errorInfo.message}</p>
				{errorInfo.suggestion && (
					<p className="text-sm text-muted-foreground mt-1 italic">
						{errorInfo.suggestion}
					</p>
				)}
				{shouldShowRetry && onRetry && (
					<Button
						variant="outline"
						size="sm"
						onClick={onRetry}
						className="mt-3"
					>
						<RefreshCw className="mr-2 h-3 w-3" />
						Try Again
					</Button>
				)}
			</AlertDescription>
		</Alert>
	);
}

// ============================================================================
// ErrorState - Full page/section error state
// ============================================================================

interface ErrorStateProps {
	/** Raw error or parsed user-friendly error */
	error: unknown | UserFriendlyError;
	/** Operation context for better error messages */
	operation?: "load" | "create" | "update" | "delete";
	/** Optional callback when retry button is clicked */
	onRetry?: () => void;
	/** Whether retry is currently in progress */
	isRetrying?: boolean;
	/** Custom title override */
	title?: string;
	/** Additional CSS classes */
	className?: string;
}

/**
 * Full error state component for when the entire section/page fails to load
 */
export function ErrorState({
	error,
	operation,
	onRetry,
	isRetrying = false,
	title,
	className,
}: ErrorStateProps) {
	const errorInfo: UserFriendlyError = React.useMemo(() => {
		if (error && typeof error === "object" && "category" in error) {
			return error as UserFriendlyError;
		}
		return parseError(error, operation);
	}, [error, operation]);

	const colors = getErrorColors(errorInfo.category);
	const Icon = getErrorIcon(errorInfo.category);

	return (
		<div
			className={cn(
				"flex flex-col items-center justify-center py-12 px-4",
				className,
			)}
		>
			<div className={cn("rounded-full p-4 mb-4", colors.bg)}>
				<Icon className={cn("h-12 w-12", colors.icon)} />
			</div>

			<h3 className="text-lg font-semibold text-center mb-2">
				{title || errorInfo.title}
			</h3>

			<p className="text-sm text-muted-foreground text-center max-w-md mb-2">
				{errorInfo.message}
			</p>

			{errorInfo.suggestion && (
				<p className="text-sm text-muted-foreground/80 text-center max-w-md italic mb-4">
					{errorInfo.suggestion}
				</p>
			)}

			{errorInfo.canRetry && onRetry && (
				<Button onClick={onRetry} disabled={isRetrying} className="mt-2">
					{isRetrying ? (
						<>
							<RefreshCw className="mr-2 h-4 w-4 animate-spin" />
							Retrying...
						</>
					) : (
						<>
							<RefreshCw className="mr-2 h-4 w-4" />
							Try Again
						</>
					)}
				</Button>
			)}

			{/* Development mode: Show technical details */}
			{process.env.NODE_ENV === "development" && errorInfo.technicalDetails && (
				<details className="mt-6 w-full max-w-lg">
					<summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
						Technical Details (dev only)
					</summary>
					<pre className="mt-2 p-3 bg-muted rounded-md text-xs overflow-auto max-h-32">
						{errorInfo.technicalDetails}
					</pre>
				</details>
			)}
		</div>
	);
}

// ============================================================================
// ErrorCard - Card-style error for dashboard widgets
// ============================================================================

interface ErrorCardProps {
	/** Raw error or parsed user-friendly error */
	error: unknown | UserFriendlyError;
	/** Operation context for better error messages */
	operation?: "load" | "create" | "update" | "delete";
	/** Optional callback when retry button is clicked */
	onRetry?: () => void;
	/** Compact mode for smaller widgets */
	compact?: boolean;
	/** Additional CSS classes */
	className?: string;
}

/**
 * Card-style error component for dashboard widgets
 */
export function ErrorCard({
	error,
	operation,
	onRetry,
	compact = false,
	className,
}: ErrorCardProps) {
	const errorInfo: UserFriendlyError = React.useMemo(() => {
		if (error && typeof error === "object" && "category" in error) {
			return error as UserFriendlyError;
		}
		return parseError(error, operation);
	}, [error, operation]);

	const colors = getErrorColors(errorInfo.category);
	const Icon = getErrorIcon(errorInfo.category);

	if (compact) {
		return (
			<div
				className={cn(
					"flex items-center gap-3 p-3 rounded-lg border",
					colors.bg,
					colors.border,
					className,
				)}
			>
				<Icon className={cn("h-5 w-5 flex-shrink-0", colors.icon)} />
				<span className="text-sm text-muted-foreground truncate flex-1">
					{errorInfo.message}
				</span>
				{errorInfo.canRetry && onRetry && (
					<Button
						variant="ghost"
						size="sm"
						onClick={onRetry}
						className="flex-shrink-0"
					>
						<RefreshCw className="h-3 w-3" />
					</Button>
				)}
			</div>
		);
	}

	return (
		<div
			className={cn(
				"flex flex-col items-center justify-center p-6 rounded-lg border text-center",
				colors.bg,
				colors.border,
				className,
			)}
		>
			<Icon className={cn("h-8 w-8 mb-3", colors.icon)} />
			<h4 className="font-medium mb-1">{errorInfo.title}</h4>
			<p className="text-sm text-muted-foreground mb-3">{errorInfo.message}</p>
			{errorInfo.canRetry && onRetry && (
				<Button variant="outline" size="sm" onClick={onRetry}>
					<RefreshCw className="mr-2 h-3 w-3" />
					Retry
				</Button>
			)}
		</div>
	);
}

// ============================================================================
// ErrorBoundaryFallback - Default fallback for React Error Boundaries
// ============================================================================

interface ErrorBoundaryFallbackProps {
	error: Error;
	resetErrorBoundary?: () => void;
}

/**
 * Default fallback component for React Error Boundaries
 */
export function ErrorBoundaryFallback({
	error,
	resetErrorBoundary,
}: ErrorBoundaryFallbackProps) {
	const errorInfo = parseError(error);

	return (
		<div className="flex flex-col items-center justify-center min-h-[400px] p-8">
			<div className="rounded-full bg-red-50 dark:bg-red-950/20 p-4 mb-4">
				<XCircle className="h-12 w-12 text-red-500" />
			</div>

			<h2 className="text-xl font-semibold text-center mb-2">
				{errorInfo.title}
			</h2>

			<p className="text-muted-foreground text-center max-w-md mb-6">
				{errorInfo.message}
			</p>

			<div className="flex gap-3">
				{resetErrorBoundary && (
					<Button onClick={resetErrorBoundary}>
						<RefreshCw className="mr-2 h-4 w-4" />
						Try Again
					</Button>
				)}
				<Button variant="outline" onClick={() => window.location.reload()}>
					Refresh Page
				</Button>
			</div>

			{/* Development mode: Show technical details */}
			{process.env.NODE_ENV === "development" && (
				<details className="mt-8 w-full max-w-2xl">
					<summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
						Error Stack (dev only)
					</summary>
					<pre className="mt-2 p-4 bg-muted rounded-md text-xs overflow-auto max-h-48">
						{error.stack}
					</pre>
				</details>
			)}
		</div>
	);
}
