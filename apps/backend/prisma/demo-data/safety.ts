/**
 * Safety gates for the demo loader.
 *
 * Demo loading always deletes the previous dataset before seeding.  That is a
 * destructive operation and, because some inventory reference tables are not
 * company-scoped, it is only safe when the operator has explicitly opted in
 * and identified the database as an isolated demo database.
 */

export const DEMO_MUTATION_ENV = "ARIA_ALLOW_DEMO_DATA_MUTATION";
export const DEMO_ISOLATION_ENV = "ARIA_DEMO_DATABASE_ISOLATED";

export interface DemoMutationSafetyOptions {
	/** Explicit confirmation that the caller intends to mutate demo data. */
	allowDestructive?: boolean;
	/** Explicit confirmation that the target database is disposable/isolated. */
	isolatedDatabase?: boolean;
}

export class DemoDataSafetyError extends Error {
	readonly code = "DEMO_DATA_SAFETY_GUARD";

	constructor(message: string) {
		super(message);
		this.name = "DemoDataSafetyError";
	}
}

function isAffirmative(value: string | undefined): boolean {
	return value?.trim().toLowerCase() === "true" || value?.trim() === "1";
}

/** Resolve CLI options with environment defaults. */
export function resolveDemoMutationSafety(
	options: DemoMutationSafetyOptions = {},
): Required<DemoMutationSafetyOptions> {
	return {
		allowDestructive:
			options.allowDestructive ?? isAffirmative(process.env[DEMO_MUTATION_ENV]),
		isolatedDatabase:
			options.isolatedDatabase ??
			isAffirmative(process.env[DEMO_ISOLATION_ENV]),
	};
}

/**
 * Assert the guard before any cleanup or load work starts.
 *
 * `isolatedDatabase` is deliberately an explicit operator assertion rather
 * than a heuristic based on the database name.  Names can be URL encoded and
 * a production database may contain the word "demo".  Deployment runbooks
 * therefore require both variables to be set only for a disposable target.
 */
export function assertDemoMutationSafety(
	operation: "load" | "clean",
	options: DemoMutationSafetyOptions = {},
): void {
	const resolved = resolveDemoMutationSafety(options);
	if (!resolved.allowDestructive) {
		throw new DemoDataSafetyError(
			`Refusing demo ${operation}: set ${DEMO_MUTATION_ENV}=true only for an intentional demo-data mutation.`,
		);
	}
	if (!resolved.isolatedDatabase) {
		throw new DemoDataSafetyError(
			`Refusing demo ${operation}: set ${DEMO_ISOLATION_ENV}=true only when DATABASE_URL points to an isolated disposable demo database.`,
		);
	}
}
