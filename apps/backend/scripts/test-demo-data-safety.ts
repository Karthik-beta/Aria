#!/usr/bin/env bun

import {
	assertDemoMutationSafety,
	DemoDataSafetyError,
	resolveDemoMutationSafety,
} from "../prisma/demo-data/safety.js";

function expectSafetyFailure(callback: () => void, expected: string) {
	try {
		callback();
		throw new Error("expected the demo safety guard to reject the operation");
	} catch (error) {
		if (!(error instanceof DemoDataSafetyError)) throw error;
		if (!error.message.includes(expected)) {
			throw new Error(`unexpected safety error: ${error.message}`);
		}
	}
}

const previousMutation = process.env.ARIA_ALLOW_DEMO_DATA_MUTATION;
const previousIsolation = process.env.ARIA_DEMO_DATABASE_ISOLATED;
try {
	delete process.env.ARIA_ALLOW_DEMO_DATA_MUTATION;
	delete process.env.ARIA_DEMO_DATABASE_ISOLATED;
	expectSafetyFailure(() => assertDemoMutationSafety("clean"), "ARIA_ALLOW");

	process.env.ARIA_ALLOW_DEMO_DATA_MUTATION = "true";
	expectSafetyFailure(
		() => assertDemoMutationSafety("load"),
		"ARIA_DEMO_DATABASE_ISOLATED",
	);

	if (
		JSON.stringify(
			resolveDemoMutationSafety({
				allowDestructive: true,
				isolatedDatabase: true,
			}),
		) !== JSON.stringify({ allowDestructive: true, isolatedDatabase: true })
	) {
		throw new Error("explicit demo safety options were not preserved");
	}

	assertDemoMutationSafety("clean", {
		allowDestructive: true,
		isolatedDatabase: true,
	});
	process.stdout.write("Demo-data safety checks passed.\n");
} finally {
	if (previousMutation === undefined)
		delete process.env.ARIA_ALLOW_DEMO_DATA_MUTATION;
	else process.env.ARIA_ALLOW_DEMO_DATA_MUTATION = previousMutation;
	if (previousIsolation === undefined)
		delete process.env.ARIA_DEMO_DATABASE_ISOLATED;
	else process.env.ARIA_DEMO_DATABASE_ISOLATED = previousIsolation;
}
