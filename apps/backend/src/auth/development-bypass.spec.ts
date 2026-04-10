import {
	assertValidDevelopmentAuthBypassConfiguration,
	getDevelopmentAuthBypassState,
	INVALID_DEVELOPMENT_AUTH_BYPASS_MESSAGE,
} from "./development-bypass";

const originalNodeEnv = process.env.NODE_ENV;
const originalDisableAuth = process.env.DISABLE_AUTH;

function restoreEnvVar(
	key: "NODE_ENV" | "DISABLE_AUTH",
	value: string | undefined,
) {
	if (value === undefined) {
		delete process.env[key];
		return;
	}

	process.env[key] = value;
}

describe("backend development auth bypass", () => {
	afterEach(() => {
		restoreEnvVar("NODE_ENV", originalNodeEnv);
		restoreEnvVar("DISABLE_AUTH", originalDisableAuth);
	});

	it("enables bypass only in development", () => {
		process.env.NODE_ENV = "development";
		process.env.DISABLE_AUTH = "true";

		expect(getDevelopmentAuthBypassState()).toEqual({ enabled: true });
		expect(() => assertValidDevelopmentAuthBypassConfiguration()).not.toThrow();
	});

	it("rejects bypass outside development", () => {
		process.env.NODE_ENV = "production";
		process.env.DISABLE_AUTH = "true";

		expect(getDevelopmentAuthBypassState()).toEqual({
			enabled: false,
			error: INVALID_DEVELOPMENT_AUTH_BYPASS_MESSAGE,
		});
		expect(() => assertValidDevelopmentAuthBypassConfiguration()).toThrow(
			INVALID_DEVELOPMENT_AUTH_BYPASS_MESSAGE,
		);
	});
});
