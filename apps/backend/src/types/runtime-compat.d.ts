/**
 * Narrow compatibility types for optional runtime integrations referenced by
 * the authentication stack. The backend does not use these runtimes directly.
 */

declare module "bun:sqlite" {
	export interface Database {}
}

type Timer = ReturnType<typeof setTimeout>;
