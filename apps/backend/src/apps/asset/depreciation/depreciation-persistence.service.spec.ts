import { assertFinitePostingAmount } from "./depreciation-persistence.service";

describe("depreciation posting finite boundary", () => {
	it("accepts finite numeric values and rejects NaN, infinities, and nullish values", () => {
		expect(() => assertFinitePostingAmount("amount", 0)).not.toThrow();
		expect(() => assertFinitePostingAmount("amount", -12.5)).not.toThrow();
		expect(() => assertFinitePostingAmount("amount", Number.NaN)).toThrow(
			"Depreciation amount must be finite before posting.",
		);
		expect(() =>
			assertFinitePostingAmount("amount", Number.POSITIVE_INFINITY),
		).toThrow("Depreciation amount must be finite before posting.");
		expect(() =>
			assertFinitePostingAmount("amount", Number.NEGATIVE_INFINITY),
		).toThrow("Depreciation amount must be finite before posting.");
		expect(() => assertFinitePostingAmount("amount", null)).toThrow(
			"Depreciation amount must be finite before posting.",
		);
		expect(() => assertFinitePostingAmount("amount", undefined)).toThrow(
			"Depreciation amount must be finite before posting.",
		);
	});
});
