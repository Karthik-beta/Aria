import { AuthService } from "../auth.service";

/**
 * Unit tests for AuthService helper methods.
 *
 * The public seeding / user-creation methods are tightly coupled to the
 * database and to better-auth, so they are best covered by integration tests.
 * Here we exercise the pure private helpers via casting to `any` to verify
 * edge-case handling of the error-reporting utilities.
 */
describe("AuthService", () => {
	let service: AuthService;

	beforeEach(() => {
		// Construct the service without DI — we only test pure helpers
		service = Object.create(AuthService.prototype) as AuthService;
	});

	// ── getSafeErrorMessage ─────────────────────────────────────────────

	describe("getSafeErrorMessage", () => {
		const call = (error: unknown) =>
			// biome-ignore lint/suspicious/noExplicitAny: accessing private helper
			(service as any).getSafeErrorMessage(error);

		it("returns the message from an Error instance", () => {
			expect(call(new Error("boom"))).toBe("boom");
		});

		it("returns the string directly when given a non-empty string", () => {
			expect(call("something went wrong")).toBe("something went wrong");
		});

		it("falls back for an Error with an empty message", () => {
			expect(call(new Error(""))).toBe("Unexpected error");
		});

		it("falls back for a whitespace-only Error message", () => {
			expect(call(new Error("   "))).toBe("Unexpected error");
		});

		it("falls back for a whitespace-only string", () => {
			expect(call("   ")).toBe("Unexpected error");
		});

		it("falls back for null", () => {
			expect(call(null)).toBe("Unexpected error");
		});

		it("falls back for undefined", () => {
			expect(call(undefined)).toBe("Unexpected error");
		});

		it("falls back for a number", () => {
			expect(call(42)).toBe("Unexpected error");
		});

		it("falls back for an empty object", () => {
			expect(call({})).toBe("Unexpected error");
		});
	});

	// ── getErrorDetails ─────────────────────────────────────────────────

	describe("getErrorDetails", () => {
		const call = (error: unknown) =>
			// biome-ignore lint/suspicious/noExplicitAny: accessing private helper
			(service as any).getErrorDetails(error);

		it("returns stack from an Error", () => {
			const err = new Error("oops");
			expect(call(err)).toBe(err.stack);
		});

		it("returns the string itself for a non-empty string", () => {
			expect(call("detail text")).toBe("detail text");
		});

		it("returns undefined for a whitespace-only string", () => {
			expect(call("  ")).toBeUndefined();
		});

		it("JSON-serializes a plain object with content", () => {
			expect(call({ code: 42 })).toBe('{"code":42}');
		});

		it("returns undefined for an empty object", () => {
			expect(call({})).toBeUndefined();
		});

		it("returns undefined for null", () => {
			expect(call(null)).toBeUndefined();
		});

		it("returns undefined for undefined", () => {
			expect(call(undefined)).toBeUndefined();
		});

		it("returns undefined for a number", () => {
			expect(call(42)).toBeUndefined();
		});

		it("returns undefined when JSON.stringify throws (circular ref)", () => {
			const circular: Record<string, unknown> = {};
			circular.self = circular;
			expect(call(circular)).toBeUndefined();
		});
	});
});
