import { describe, expect, it, vi } from "vitest";
import {
	detectErrorCategory,
	extractErrorMessage,
	getDetailedError,
	getErrorSeverity,
	getToastMessage,
	isRetryableError,
	isTechnicalError,
	parseError,
} from "./parser";
import {
	DEFAULT_ERROR_MESSAGES,
	type ErrorCategory,
	OPERATION_ERROR_MESSAGES,
} from "./types";

// ---------------------------------------------------------------------------
// isTechnicalError
// ---------------------------------------------------------------------------
describe("isTechnicalError", () => {
	it("detects database/ORM error messages", () => {
		expect(isTechnicalError("Prisma query failed")).toBe(true);
		expect(isTechnicalError("postgres connection lost")).toBe(true);
		expect(isTechnicalError("MySQL server has gone away")).toBe(true);
		expect(isTechnicalError("MongoDB timeout")).toBe(true);
		expect(isTechnicalError("SQLite busy")).toBe(true);
		expect(isTechnicalError("database error")).toBe(true);
		expect(isTechnicalError("query failed on table")).toBe(true);
		expect(isTechnicalError("constraint violation")).toBe(true);
		expect(isTechnicalError("foreign key constraint")).toBe(true);
		expect(isTechnicalError("unique key violation")).toBe(true);
		expect(isTechnicalError("duplicate entry key")).toBe(true);
		expect(isTechnicalError('column "foo" does not exist')).toBe(true);
		expect(isTechnicalError('relation "users" does not exist')).toBe(true);
		expect(isTechnicalError('table "orders" does not exist')).toBe(true);
	});

	it("detects network/transport error messages", () => {
		expect(isTechnicalError("connect ECONNREFUSED")).toBe(true);
		expect(isTechnicalError("getaddrinfo ENOTFOUND")).toBe(true);
		expect(isTechnicalError("ETIMEDOUT 10.0.0.1:5432")).toBe(true);
		expect(isTechnicalError("socket hang up")).toBe(true);
		expect(isTechnicalError("connection reset")).toBe(true);
		expect(isTechnicalError("network error occurred")).toBe(true);
	});

	it("detects server/runtime error messages", () => {
		expect(isTechnicalError("Internal Server Error")).toBe(true);
		expect(isTechnicalError("Error: stack trace follows")).toBe(true);
		expect(isTechnicalError("at module.ts:42")).toBe(true);
		expect(isTechnicalError("null reference exception")).toBe(true);
		expect(isTechnicalError("undefined is not a function")).toBe(true);
		expect(isTechnicalError("cannot read property 'x' of undefined")).toBe(
			true,
		);
		expect(isTechnicalError("Cannot access of null")).toBe(true);
		expect(isTechnicalError("Cannot read of undefined")).toBe(true);
	});

	it("detects file path patterns", () => {
		expect(isTechnicalError("Error at C:\\Users\\dev\\app.ts")).toBe(true);
		expect(isTechnicalError("Error at /home/dev/app.ts")).toBe(true);
		expect(isTechnicalError("Error at /Users/dev/app.ts")).toBe(true);
		expect(isTechnicalError("in node_modules/express")).toBe(true);
		expect(isTechnicalError("at handler.ts:42")).toBe(true);
		expect(isTechnicalError("at handler.js:42")).toBe(true);
	});

	it("detects code patterns", () => {
		expect(isTechnicalError("syntax error near 'SELECT'")).toBe(true);
		expect(isTechnicalError("Unexpected token }")).toBe(true);
		expect(isTechnicalError("Invalid invocation")).toBe(true);
		expect(isTechnicalError("findMany failed")).toBe(true);
		expect(isTechnicalError("findUnique returned null")).toBe(true);
		expect(isTechnicalError("Invalid `prisma.location.delete()` call")).toBe(
			true,
		);
		expect(isTechnicalError("at repo.update(data)")).toBe(true);
	});

	it("does not flag business messages that contain create/update/delete", () => {
		expect(
			isTechnicalError("Cannot delete a location that has child locations"),
		).toBe(false);
		expect(isTechnicalError("Cannot update a cancelled asset")).toBe(false);
		expect(isTechnicalError("Cannot create a duplicate series")).toBe(false);
	});

	it("does not match partial words (SyntaxError vs 'syntax error')", () => {
		// The regex /syntax error/i requires a space — 'SyntaxError' (no space) won't match
		expect(isTechnicalError("SyntaxError: foo")).toBe(false);
	});

	it("returns false for user-friendly messages", () => {
		expect(isTechnicalError("Invalid email address")).toBe(false);
		expect(isTechnicalError("Name is required")).toBe(false);
		expect(isTechnicalError("Item already exists")).toBe(false);
		expect(isTechnicalError("Not found")).toBe(false);
		expect(isTechnicalError("Permission denied")).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// extractErrorMessage
// ---------------------------------------------------------------------------
describe("extractErrorMessage", () => {
	it("extracts message from plain string", () => {
		expect(extractErrorMessage("something broke")).toBe("something broke");
	});

	it("extracts message from Error instances", () => {
		expect(extractErrorMessage(new Error("test error"))).toBe("test error");
		expect(extractErrorMessage(new TypeError("type err"))).toBe("type err");
	});

	it("extracts message from objects with .message", () => {
		expect(extractErrorMessage({ message: "obj msg" })).toBe("obj msg");
	});

	it("extracts message from objects with .error", () => {
		expect(extractErrorMessage({ error: "api error" })).toBe("api error");
	});

	it("extracts message from nested .data.message", () => {
		expect(extractErrorMessage({ data: { message: "deep msg" } })).toBe(
			"deep msg",
		);
	});

	it("returns fallback for unrecognized shapes", () => {
		expect(extractErrorMessage(42)).toBe("An unexpected error occurred");
		expect(extractErrorMessage(null)).toBe("An unexpected error occurred");
		expect(extractErrorMessage(undefined)).toBe("An unexpected error occurred");
		expect(extractErrorMessage({})).toBe("An unexpected error occurred");
		expect(extractErrorMessage({ data: {} })).toBe(
			"An unexpected error occurred",
		);
		expect(extractErrorMessage({ data: { message: 123 } })).toBe(
			"An unexpected error occurred",
		);
	});

	it("prefers .message over .error when both exist", () => {
		expect(extractErrorMessage({ message: "msg", error: "err" })).toBe("msg");
	});
});

// ---------------------------------------------------------------------------
// detectErrorCategory
// ---------------------------------------------------------------------------
describe("detectErrorCategory", () => {
	it("detects HTTP status codes embedded in messages", () => {
		expect(detectErrorCategory("HTTP 400: bad request")).toBe("validation");
		expect(detectErrorCategory("401 Unauthorized")).toBe("authentication");
		expect(detectErrorCategory("403 Forbidden")).toBe("authorization");
		expect(detectErrorCategory("Error 404")).toBe("not_found");
		expect(detectErrorCategory("409 Conflict")).toBe("conflict");
		expect(detectErrorCategory("422 Unprocessable Entity")).toBe("validation");
		expect(detectErrorCategory("429 Rate limited")).toBe("rate_limit");
		expect(detectErrorCategory("500 Internal Server Error")).toBe("server");
		expect(detectErrorCategory("502 Bad Gateway")).toBe("server");
		expect(detectErrorCategory("503 Service Unavailable")).toBe("server");
		expect(detectErrorCategory("504 Gateway Timeout")).toBe("network");
	});

	it("detects validation-related patterns", () => {
		expect(detectErrorCategory("already exists")).toBe("conflict");
		expect(detectErrorCategory("Resource not found")).toBe("not_found");
		expect(detectErrorCategory("doesn't exist")).toBe("not_found");
		expect(detectErrorCategory("unauthorized")).toBe("authentication");
		expect(detectErrorCategory("not authenticated")).toBe("authentication");
		expect(detectErrorCategory("invalid token")).toBe("authentication");
		expect(detectErrorCategory("forbidden")).toBe("authorization");
		expect(detectErrorCategory("not allowed")).toBe("authorization");
		expect(detectErrorCategory("permission denied")).toBe("authorization");
		expect(detectErrorCategory("too many requests")).toBe("rate_limit");
		expect(detectErrorCategory("rate limit exceeded")).toBe("rate_limit");
		expect(detectErrorCategory("field is required")).toBe("validation");
		expect(detectErrorCategory("must be a number")).toBe("validation");
		expect(detectErrorCategory("cannot be empty")).toBe("validation");
		expect(detectErrorCategory("invalid email")).toBe("validation");
	});

	it("detects network errors from fetch TypeError", () => {
		const fetchError = new TypeError("fetch failed");
		expect(detectErrorCategory(fetchError)).toBe("network");
	});

	it("detects network pattern in string errors", () => {
		expect(detectErrorCategory("fetch request failed")).toBe("network");
		expect(detectErrorCategory("connection refused")).toBe("network");
		expect(detectErrorCategory("request timeout")).toBe("network");
	});

	it("returns 'unknown' for unrecognized errors", () => {
		expect(detectErrorCategory("something went wrong")).toBe("unknown");
		expect(detectErrorCategory(42)).toBe("unknown");
		expect(detectErrorCategory(null)).toBe("unknown");
	});

	it("handles Error objects", () => {
		expect(detectErrorCategory(new Error("already exists"))).toBe("conflict");
		expect(detectErrorCategory(new Error("unauthorized"))).toBe(
			"authentication",
		);
	});

	it("handles objects with message property", () => {
		expect(detectErrorCategory({ message: "not found" })).toBe("not_found");
	});

	it("detects tRPC structured error codes", () => {
		expect(
			detectErrorCategory({ data: { code: "BAD_REQUEST", httpStatus: 400 } }),
		).toBe("validation");
		expect(
			detectErrorCategory({
				data: { code: "UNAUTHORIZED", httpStatus: 401 },
			}),
		).toBe("authentication");
		expect(
			detectErrorCategory({ data: { code: "FORBIDDEN", httpStatus: 403 } }),
		).toBe("authorization");
		expect(
			detectErrorCategory({ data: { code: "NOT_FOUND", httpStatus: 404 } }),
		).toBe("not_found");
		expect(
			detectErrorCategory({ data: { code: "CONFLICT", httpStatus: 409 } }),
		).toBe("conflict");
		expect(
			detectErrorCategory({
				data: { code: "TOO_MANY_REQUESTS", httpStatus: 429 },
			}),
		).toBe("rate_limit");
	});

	it("falls back to httpStatus when code is not mapped", () => {
		expect(
			detectErrorCategory({
				data: { code: "TIMEOUT", httpStatus: 408 },
			}),
		).toBe("unknown");
	});

	it("prioritizes tRPC structured data over message pattern matching", () => {
		// The message says "not found" but the tRPC code says BAD_REQUEST
		expect(
			detectErrorCategory({
				message: "Resource not found",
				data: { code: "BAD_REQUEST", httpStatus: 400 },
			}),
		).toBe("validation");
	});
});

// ---------------------------------------------------------------------------
// getErrorSeverity
// ---------------------------------------------------------------------------
describe("getErrorSeverity", () => {
	it("returns critical for server and unknown", () => {
		expect(getErrorSeverity("server")).toBe("critical");
		expect(getErrorSeverity("unknown")).toBe("critical");
	});

	it("returns error for auth and conflict", () => {
		expect(getErrorSeverity("authentication")).toBe("error");
		expect(getErrorSeverity("authorization")).toBe("error");
		expect(getErrorSeverity("conflict")).toBe("error");
	});

	it("returns warning for validation, not_found, rate_limit", () => {
		expect(getErrorSeverity("validation")).toBe("warning");
		expect(getErrorSeverity("not_found")).toBe("warning");
		expect(getErrorSeverity("rate_limit")).toBe("warning");
	});

	it("returns info for network", () => {
		expect(getErrorSeverity("network")).toBe("info");
	});
});

// ---------------------------------------------------------------------------
// isRetryableError
// ---------------------------------------------------------------------------
describe("isRetryableError", () => {
	const retryable: ErrorCategory[] = [
		"network",
		"server",
		"rate_limit",
		"unknown",
	];

	const notRetryable: ErrorCategory[] = [
		"validation",
		"authentication",
		"authorization",
		"not_found",
		"conflict",
	];

	for (const cat of retryable) {
		it(`considers '${cat}' retryable`, () => {
			expect(isRetryableError(cat)).toBe(true);
		});
	}

	for (const cat of notRetryable) {
		it(`considers '${cat}' NOT retryable`, () => {
			expect(isRetryableError(cat)).toBe(false);
		});
	}
});

// ---------------------------------------------------------------------------
// parseError — the main orchestrator
// ---------------------------------------------------------------------------
describe("parseError", () => {
	it("parses a validation error with readable message", () => {
		const result = parseError("Name is required", "create");
		expect(result.category).toBe("validation");
		expect(result.severity).toBe("warning");
		expect(result.canRetry).toBe(false);
		// Validation-friendly messages are preserved
		expect(result.message).toBe("Name is required");
		expect(result.title).toBe(DEFAULT_ERROR_MESSAGES.validation.title);
	});

	it("shows the backend's reason when a delete is rejected (BAD_REQUEST)", () => {
		const message = "Cannot delete a location that has child locations";
		const result = parseError(
			{ message, data: { code: "BAD_REQUEST", httpStatus: 400 } },
			"delete",
		);
		expect(result.category).toBe("validation");
		expect(result.message).toBe(message);
	});

	it("hides technical error messages and substitutes operation defaults", () => {
		const result = parseError("Prisma query failed at findMany", "load");
		expect(result.category).not.toBe("validation");
		// Should NOT expose the raw technical message
		expect(result.message).not.toContain("Prisma");
		// Should use operation-specific message
		expect(result.message).toBe(OPERATION_ERROR_MESSAGES.load[result.category]);
	});

	it("falls back to category default when no operation given", () => {
		// "Internal Server Error" is detected as technical by isTechnicalError
		// but detectErrorCategory classifies it as 'unknown' (no HTTP status code
		// present and no VALIDATION_PATTERNS match)
		const result = parseError(new Error("Internal Server Error"));
		expect(result.category).toBe("unknown");
		expect(result.message).toBe(DEFAULT_ERROR_MESSAGES.unknown.message);
	});

	it("detects server category via embedded HTTP 500 status code", () => {
		const result = parseError(new Error("500 Internal Server Error"));
		expect(result.category).toBe("server");
		expect(result.message).toBe(DEFAULT_ERROR_MESSAGES.server.message);
	});

	it("preserves not_found messages when not technical", () => {
		const result = parseError("Item not found");
		expect(result.category).toBe("not_found");
		expect(result.message).toBe("Item not found");
	});

	it("preserves conflict messages when not technical", () => {
		const result = parseError("Record already exists");
		expect(result.category).toBe("conflict");
		expect(result.message).toBe("Record already exists");
	});

	it("includes technicalDetails only in development", () => {
		vi.stubEnv("NODE_ENV", "development");
		const devResult = parseError("oops");
		expect(devResult.technicalDetails).toBe("oops");

		vi.stubEnv("NODE_ENV", "production");
		const prodResult = parseError("oops");
		expect(prodResult.technicalDetails).toBeUndefined();

		vi.unstubAllEnvs();
	});

	it("has an errorCode derived from category", () => {
		const result = parseError("rate limit exceeded");
		expect(result.errorCode).toBe("RATE-LIMIT");
	});

	it("includes suggestion from category defaults", () => {
		const result = parseError("500 Internal Server Error");
		expect(result.suggestion).toBe(DEFAULT_ERROR_MESSAGES.server.suggestion);
	});

	it("carries over canRetry from category", () => {
		expect(parseError("connect ECONNREFUSED").canRetry).toBe(true);
		expect(parseError("field is required").canRetry).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// getToastMessage
// ---------------------------------------------------------------------------
describe("getToastMessage", () => {
	it("returns a string message suitable for toasts", () => {
		const msg = getToastMessage("Name is required", "create");
		expect(typeof msg).toBe("string");
		expect(msg.length).toBeGreaterThan(0);
	});

	it("uses operation-specific messages for technical errors", () => {
		const msg = getToastMessage("Prisma query failed", "delete");
		expect(msg).not.toContain("Prisma");
	});

	it("preserves user-friendly messages for validation errors", () => {
		const msg = getToastMessage("Email must be valid");
		expect(msg).toBe("Email must be valid");
	});
});

// ---------------------------------------------------------------------------
// getDetailedError
// ---------------------------------------------------------------------------
describe("getDetailedError", () => {
	it("returns a full UserFriendlyError object", () => {
		const err = getDetailedError("not allowed", "update");
		expect(err).toHaveProperty("title");
		expect(err).toHaveProperty("message");
		expect(err).toHaveProperty("category");
		expect(err).toHaveProperty("severity");
		expect(err).toHaveProperty("canRetry");
		expect(err.category).toBe("authorization");
	});

	it("works the same as parseError", () => {
		const rawError = new Error("already exists");
		const parsed = parseError(rawError, "create");
		const detailed = getDetailedError(rawError, "create");
		expect(detailed).toEqual(parsed);
	});
});

// ---------------------------------------------------------------------------
// Edge cases — combined flows
// ---------------------------------------------------------------------------
describe("edge cases", () => {
	it("handles empty string error", () => {
		const result = parseError("");
		expect(result.category).toBe("unknown");
		expect(result.message).toBe(DEFAULT_ERROR_MESSAGES.unknown.message);
	});

	it("handles deeply nested data message", () => {
		const err = { data: { message: "field is required" } };
		const result = parseError(err);
		expect(result.category).toBe("validation");
		expect(result.message).toBe("field is required");
	});

	it("parses tRPC-style error shape", () => {
		const trpcError = {
			message: "Item does not exist",
			data: { code: "NOT_FOUND" },
		};
		const result = parseError(trpcError);
		expect(result.category).toBe("not_found");
		expect(result.message).toBe("Item does not exist");
	});

	it("HTTP status takes priority over pattern matches", () => {
		// "400 already exists" — 400 matches validation first
		const result = parseError("400 already exists");
		expect(result.category).toBe("validation");
	});

	it("handles TypeError without fetch keyword", () => {
		const err = new TypeError("Assignment to constant variable");
		// Not a fetch error, so this tests the non-network TypeError path
		const result = parseError(err);
		expect(result).toBeDefined();
		expect(result.category).toBe("unknown");
	});
});
