import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { logger } from "./logger";

describe("logger", () => {
	const originalEnv = process.env.NODE_ENV;
	const spies = {
		info: mock((..._: unknown[]) => {}),
		warn: mock((..._: unknown[]) => {}),
		error: mock((..._: unknown[]) => {}),
		debug: mock((..._: unknown[]) => {}),
	};
	const originals = {
		// biome-ignore lint/suspicious/noConsole: testing logger which wraps console
		info: console.info,
		// biome-ignore lint/suspicious/noConsole: testing logger which wraps console
		warn: console.warn,
		// biome-ignore lint/suspicious/noConsole: testing logger which wraps console
		error: console.error,
		// biome-ignore lint/suspicious/noConsole: testing logger which wraps console
		debug: console.debug,
	};

	beforeEach(() => {
		// Replace console methods with spies (safe: restored in afterEach)
		// biome-ignore lint/suspicious/noConsole: testing logger which wraps console
		console.info = spies.info;
		// biome-ignore lint/suspicious/noConsole: testing logger which wraps console
		console.warn = spies.warn;
		// biome-ignore lint/suspicious/noConsole: testing logger which wraps console
		console.error = spies.error;
		// biome-ignore lint/suspicious/noConsole: testing logger which wraps console
		console.debug = spies.debug;
	});

	afterEach(() => {
		// Always restore — even if a test throws
		// biome-ignore lint/suspicious/noConsole: testing logger which wraps console
		console.info = originals.info;
		// biome-ignore lint/suspicious/noConsole: testing logger which wraps console
		console.warn = originals.warn;
		// biome-ignore lint/suspicious/noConsole: testing logger which wraps console
		console.error = originals.error;
		// biome-ignore lint/suspicious/noConsole: testing logger which wraps console
		console.debug = originals.debug;
		process.env.NODE_ENV = originalEnv;
		for (const spy of Object.values(spies)) spy.mockClear();
	});

	test("info calls console.info with formatted message", () => {
		logger.info("test message");

		expect(spies.info).toHaveBeenCalledTimes(1);
		expect(spies.info).toHaveBeenCalledWith("[INFO] test message");
	});

	test("warn calls console.warn with formatted message", () => {
		logger.warn("warning message");

		expect(spies.warn).toHaveBeenCalledTimes(1);
		expect(spies.warn).toHaveBeenCalledWith("[WARN] warning message");
	});

	test("error calls console.error with formatted message", () => {
		logger.error("error message");

		expect(spies.error).toHaveBeenCalledTimes(1);
		expect(spies.error).toHaveBeenCalledWith("[ERROR] error message");
	});

	test("debug calls console.debug in non-production", () => {
		process.env.NODE_ENV = "development";

		logger.debug("debug message");

		expect(spies.debug).toHaveBeenCalledTimes(1);
		expect(spies.debug).toHaveBeenCalledWith("[DEBUG] debug message");
	});

	test("debug suppresses output in production", () => {
		process.env.NODE_ENV = "production";

		logger.debug("should not appear");

		expect(spies.debug).not.toHaveBeenCalled();
	});

	test("passes extra arguments through to console methods", () => {
		logger.info("msg", { key: "value" }, 42);

		expect(spies.info).toHaveBeenCalledTimes(1);
		expect(spies.info).toHaveBeenCalledWith("[INFO] msg", { key: "value" }, 42);
	});
});
