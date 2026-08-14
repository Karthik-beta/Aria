/**
 * Vitest Setup File
 * Configures testing environment for React components
 */

import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Vitest does not execute next.config.ts, so reproduce its build-time contract
// from the same authoritative application setting used by backend and Next.
const applicationTimeZone = process.env.APP_TIME_ZONE?.trim();
const publicApplicationTimeZone = process.env.NEXT_PUBLIC_APP_TIME_ZONE?.trim();
if (
	applicationTimeZone &&
	publicApplicationTimeZone &&
	applicationTimeZone !== publicApplicationTimeZone
) {
	throw new Error(
		"APP_TIME_ZONE and NEXT_PUBLIC_APP_TIME_ZONE must agree in frontend tests.",
	);
}
if (applicationTimeZone && !publicApplicationTimeZone) {
	process.env.NEXT_PUBLIC_APP_TIME_ZONE = applicationTimeZone;
}

// Cleanup after each test
afterEach(() => {
	cleanup();
});

// Mock Next.js router
vi.mock("next/navigation", () => ({
	useRouter: () => ({
		push: vi.fn(),
		replace: vi.fn(),
		prefetch: vi.fn(),
		back: vi.fn(),
		pathname: "/",
		query: {},
	}),
	useSearchParams: () => new URLSearchParams(),
	usePathname: () => "/",
}));

// Mock Next.js Link
vi.mock("next/link", () => ({
	default: ({
		children,
		_href,
	}: {
		children: React.ReactNode;
		_href: string;
	}) => children,
}));

// Mock window.matchMedia
Object.defineProperty(window, "matchMedia", {
	writable: true,
	value: vi.fn().mockImplementation((query: string) => ({
		matches: false,
		media: query,
		onchange: null,
		addListener: vi.fn(),
		removeListener: vi.fn(),
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		dispatchEvent: vi.fn(),
	})),
});

// Mock IntersectionObserver
class MockIntersectionObserver implements IntersectionObserver {
	readonly root: Element | Document | null = null;
	readonly rootMargin = "";
	readonly scrollMargin = "";
	readonly thresholds: ReadonlyArray<number> = [];
	readonly callback: IntersectionObserverCallback;
	constructor(
		callback: IntersectionObserverCallback,
		_options?: IntersectionObserverInit,
	) {
		this.callback = callback;
	}
	disconnect() {
		// Test mock - no implementation needed
	}
	observe(_target: Element) {
		// Test mock - no implementation needed
	}
	takeRecords() {
		return [];
	}
	unobserve(_target: Element) {
		// Test mock - no implementation needed
	}
}
global.IntersectionObserver = MockIntersectionObserver;

// Mock ResizeObserver
class MockResizeObserver implements ResizeObserver {
	readonly callback: ResizeObserverCallback;
	constructor(callback: ResizeObserverCallback) {
		this.callback = callback;
	}
	disconnect() {
		// Test mock - no implementation needed
	}
	observe(_target: Element, _options?: ResizeObserverOptions) {
		// Test mock - no implementation needed
	}
	unobserve(_target: Element) {
		// Test mock - no implementation needed
	}
}
global.ResizeObserver = MockResizeObserver;

// Radix Select pointer-event helpers used in JSDOM tests
if (!Element.prototype.hasPointerCapture) {
	Element.prototype.hasPointerCapture = () => false;
}
if (!Element.prototype.setPointerCapture) {
	Element.prototype.setPointerCapture = () => {
		// Test mock - no implementation needed
	};
}
if (!Element.prototype.releasePointerCapture) {
	Element.prototype.releasePointerCapture = () => {
		// Test mock - no implementation needed
	};
}
if (!Element.prototype.scrollIntoView) {
	Element.prototype.scrollIntoView = () => {
		// Test mock - no implementation needed
	};
}

// Suppress console errors/warnings in tests (unless needed for debugging)
global.console = {
	...console,
	error: vi.fn(),
	warn: vi.fn(),
};
