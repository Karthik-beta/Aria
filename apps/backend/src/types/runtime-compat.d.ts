/**
 * Narrow compatibility types for optional runtime integrations referenced by
 * the authentication stack. The backend does not use these runtimes directly.
 */

declare module "bun:sqlite" {
	export interface Database {}
}

/**
 * Minimal type declarations for bun:test module used in spec files.
 *
 * Spec files compile under the Jest-typed tsconfig but execute via `bun test`.
 * This shim allows importing `mock` and other test utilities from bun:test
 * without changing the project-wide tsconfig settings.
 */
declare module "bun:test" {
	// biome-ignore lint/suspicious/noExplicitAny: compatibility shim
	export function mock(
		// biome-ignore lint/suspicious/noExplicitAny: compatibility shim
		implementation?: (...args: any[]) => any,
	): jest.Mock;

	namespace mock {
		function module(
			path: string,
			factory: () => Record<string, unknown> | { default: unknown },
		): void;
	}

	export const describe: jest.Describe;

	export const it: jest.It;

	export const expect: jest.Expect;

	export function beforeEach(fn: jest.ProvidesCallback, timeout?: number): void;

	export function afterEach(fn: jest.ProvidesCallback, timeout?: number): void;
}

type Timer = ReturnType<typeof setTimeout>;
