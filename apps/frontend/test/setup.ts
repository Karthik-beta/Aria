/**
 * Vitest Setup File
 * Configures testing environment for React components
 */

import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

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
global.IntersectionObserver = class IntersectionObserver {
	disconnect() {
		// Test mock - no implementation needed
	}
	observe() {
		// Test mock - no implementation needed
	}
	takeRecords() {
		return [];
	}
	unobserve() {
		// Test mock - no implementation needed
	}
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
	disconnect() {
		// Test mock - no implementation needed
	}
	observe() {
		// Test mock - no implementation needed
	}
	unobserve() {
		// Test mock - no implementation needed
	}
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

// Suppress console errors/warnings in tests (unless needed for debugging)
global.console = {
	...console,
	error: vi.fn(),
	warn: vi.fn(),
};
