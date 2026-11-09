import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("frontend health route", () => {
	it("returns a non-cacheable exact-200 response", async () => {
		const response = GET();

		expect(response.status).toBe(200);
		expect(response.headers.get("cache-control")).toBe("no-store");
		await expect(response.json()).resolves.toEqual({
			status: "ok",
			service: "frontend",
		});
	});
});
