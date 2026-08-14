import { FiscalYearService } from "../fiscal-year.service";

describe("FiscalYearService", () => {
	const createMockPrisma = () => {
		return {
			fiscalYear: {
				findFirst: jest.fn(),
			},
			fiscalYearCompany: {
				findFirst: jest.fn(),
			},
		};
	};

	it("getFiscalYear returns fiscal year record when found for date", async () => {
		const mockPrisma = createMockPrisma();
		const service = new FiscalYearService(mockPrisma as never);

		const mockFY = {
			id: "fy-001",
			year: "2024-25",
			yearStartDate: new Date("2024-04-01"),
			yearEndDate: new Date("2025-03-31"),
			disabled: false,
			isShortYear: false,
		};
		mockPrisma.fiscalYear.findFirst = jest.fn().mockResolvedValue(mockFY);

		const result = await service.getFiscalYear(new Date("2024-07-15"));

		expect(result).toEqual({
			id: "fy-001",
			year: "2024-25",
			yearStartDate: new Date("2024-04-01"),
			yearEndDate: new Date("2025-03-31"),
			disabled: false,
			isShortYear: false,
		});
	});

	it("getFiscalYear returns null when no fiscal year found and falls back to India default", async () => {
		const mockPrisma = createMockPrisma();
		const service = new FiscalYearService(mockPrisma as never);
		mockPrisma.fiscalYear.findFirst = jest.fn().mockResolvedValue(null);

		const result = await service.getFiscalYear(new Date("2024-07-15"));

		expect(result?.year).toBe("2024-25");
		expect(result?.yearStartDate).toEqual(new Date("2024-04-01T00:00:00.000Z"));
		expect(result?.yearEndDate).toEqual(new Date("2025-03-31T00:00:00.000Z"));
	});

	it("getFiscalYear returns default India FY for January date", async () => {
		const mockPrisma = createMockPrisma();
		const service = new FiscalYearService(mockPrisma as never);
		mockPrisma.fiscalYear.findFirst = jest.fn().mockResolvedValue(null);

		const result = await service.getFiscalYear(new Date("2025-01-15"));

		expect(result?.year).toBe("2024-25");
		expect(result?.yearStartDate).toEqual(new Date("2024-04-01T00:00:00.000Z"));
		expect(result?.yearEndDate).toEqual(new Date("2025-03-31T00:00:00.000Z"));
	});

	it("keeps an April 1 date in the correct fiscal year across host timezones", async () => {
		const mockPrisma = createMockPrisma();
		const service = new FiscalYearService(mockPrisma as never);
		mockPrisma.fiscalYear.findFirst = jest.fn().mockResolvedValue(null);

		const result = await service.getFiscalYear(
			new Date("2026-04-01T00:00:00.000Z"),
		);

		expect(result?.year).toBe("2026-27");
		expect(result?.yearStartDate).toEqual(new Date("2026-04-01T00:00:00.000Z"));
	});

	it("detectFiscalYearChange returns changed=true for first schedule (null previous)", async () => {
		const mockPrisma = createMockPrisma();
		const service = new FiscalYearService(mockPrisma as never);

		const result = await service.detectFiscalYearChange(
			new Date("2024-04-15"),
			null,
		);

		expect(result.changed).toBe(true);
		expect(result.newFiscalYearEndDate).toEqual(
			new Date("2025-03-31T00:00:00.000Z"),
		);
	});

	it("detectFiscalYearChange returns changed=false when schedule date is within current FY", async () => {
		const mockPrisma = createMockPrisma();
		const service = new FiscalYearService(mockPrisma as never);
		const currentFYEnd = new Date("2025-03-31T00:00:00.000Z");

		const result = await service.detectFiscalYearChange(
			new Date("2024-07-15"),
			currentFYEnd,
		);

		expect(result.changed).toBe(false);
		expect(result.newFiscalYearEndDate).toEqual(currentFYEnd);
	});

	it("detectFiscalYearChange returns changed=true when schedule date exceeds current FY end", async () => {
		const mockPrisma = createMockPrisma();
		const service = new FiscalYearService(mockPrisma as never);
		const currentFYEnd = new Date("2025-03-31T00:00:00.000Z");

		const result = await service.detectFiscalYearChange(
			new Date("2025-04-15"),
			currentFYEnd,
		);

		expect(result.changed).toBe(true);
		expect(result.newFiscalYearEndDate).toEqual(
			new Date("2026-03-31T00:00:00.000Z"),
		);
	});
});
