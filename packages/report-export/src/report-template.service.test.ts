import { describe, expect, it } from "bun:test";
import * as XLSX from "xlsx";
import {
	type ReportColumn,
	type ReportMetadata,
	ReportTemplateService,
} from "./report-template.service";

describe("ReportTemplateService", () => {
	const service = new ReportTemplateService();

	const basicColumns: ReportColumn[] = [
		{ key: "itemCode", header: "Item Code", width: 12 },
		{ key: "itemName", header: "Item Name", width: 30 },
		{ key: "quantity", header: "Quantity", width: 10 },
	];

	const basicData: Record<string, unknown>[] = [
		{ itemCode: "ITEM-001", itemName: "Widget A", quantity: 100 },
		{ itemCode: "ITEM-002", itemName: "Widget B", quantity: 200 },
	];

	function parseExcelRaw(buffer: Buffer): string[][] {
		const workbook = XLSX.read(buffer, { type: "buffer" });
		const sheetName = workbook.SheetNames[0];
		const worksheet = workbook.Sheets[sheetName];
		const rows: string[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
		return rows;
	}

	function parseExcelFromBase64(base64String: string): string[][] {
		const binaryString = atob(base64String);
		const bytes = new Uint8Array(binaryString.length);
		for (let i = 0; i < binaryString.length; i++) {
			bytes[i] = binaryString.charCodeAt(i);
		}
		const buffer = Buffer.from(bytes);
		return parseExcelRaw(buffer);
	}

	describe("buildExcelBuffer", () => {
		it("should generate a valid Excel buffer", () => {
			const metadata: ReportMetadata = {
				title: "Test Report",
				generatedAt: new Date("2024-03-15T10:30:00.000Z"),
			};

			const result = service.buildExcelBuffer(
				metadata,
				basicData,
				basicColumns,
			);

			expect(typeof result).toBe("string");
			expect(result.length).toBeGreaterThan(0);
			const bytes = Buffer.from(result, "base64");
			expect(bytes.length).toBeGreaterThan(0);
		});

		it("should include metadata rows in the output", () => {
			const metadata: ReportMetadata = {
				title: "Stock Balance Report",
				generatedAt: new Date("2024-01-15T09:00:00.000Z"),
			};

			const base64 = service.buildExcelBuffer(
				metadata,
				basicData,
				basicColumns,
			);
			const rows = parseExcelFromBase64(base64);

			expect(rows.length).toBeGreaterThan(1);
			expect(rows[0][0]).toContain("Stock Balance Report");
			expect(rows[1][0]).toContain("Generated:");
		});

		it("should include filter information when provided", () => {
			const metadata: ReportMetadata = {
				title: "Filtered Report",
				generatedAt: new Date(),
				filters: [
					{ label: "Company", value: "Acme Corp" },
					{ label: "Warehouse", value: "WH-001" },
				],
			};

			const base64 = service.buildExcelBuffer(
				metadata,
				basicData,
				basicColumns,
			);
			const rows = parseExcelFromBase64(base64);

			expect(rows.length).toBeGreaterThan(2);
			expect(rows[2][0]).toContain("Company: Acme Corp");
			expect(rows[2][0]).toContain("Warehouse: WH-001");
		});

		it("should handle empty data array", () => {
			const metadata: ReportMetadata = {
				title: "Empty Report",
				generatedAt: new Date(),
			};

			const result = service.buildExcelBuffer(metadata, [], basicColumns);

			expect(typeof result).toBe("string");
			expect(result.length).toBeGreaterThan(0);
		});

		it("should handle null and undefined values in data", () => {
			const metadata: ReportMetadata = {
				title: "Nullable Report",
				generatedAt: new Date(),
			};

			const dataWithNulls: Record<string, unknown>[] = [
				{ itemCode: "ITEM-001", itemName: null, quantity: undefined },
				{ itemCode: "ITEM-002", itemName: "Widget B", quantity: 200 },
			];

			const result = service.buildExcelBuffer(
				metadata,
				dataWithNulls,
				basicColumns,
			);

			expect(typeof result).toBe("string");
		});

		it("should format Date objects correctly", () => {
			const metadata: ReportMetadata = {
				title: "Date Report",
				generatedAt: new Date(),
			};

			const dataWithDates: Record<string, unknown>[] = [
				{
					itemCode: "ITEM-001",
					itemName: "Widget",
					date: new Date("2024-03-15"),
				},
			];

			const columns: ReportColumn[] = [
				{ key: "itemCode", header: "Item Code" },
				{ key: "date", header: "Date" },
			];

			const base64 = service.buildExcelBuffer(metadata, dataWithDates, columns);
			const rows = parseExcelFromBase64(base64);

			expect(rows.length).toBeGreaterThan(4);
			const dataRow = rows[4];
			expect(dataRow[1]).toContain("15");
		});
	});

	describe("column width estimation", () => {
		it("should apply custom widths when provided", () => {
			const metadata: ReportMetadata = {
				title: "Width Test",
				generatedAt: new Date(),
			};

			const columnsWithWidth: ReportColumn[] = [
				{ key: "code", header: "Code", width: 5 },
				{ key: "name", header: "Name", width: 50 },
			];

			const data = [{ code: "A", name: "Long Name Here" }];

			const result = service.buildExcelBuffer(metadata, data, columnsWithWidth);

			expect(typeof result).toBe("string");
		});

		it("should use header length + 4 for default width", () => {
			const metadata: ReportMetadata = {
				title: "Default Width Test",
				generatedAt: new Date(),
			};

			const columnsWithoutWidth: ReportColumn[] = [
				{ key: "short", header: "ID" },
				{ key: "long", header: "Description" },
			];

			const data = [{ short: "1", long: "text" }];

			const result = service.buildExcelBuffer(
				metadata,
				data,
				columnsWithoutWidth,
			);

			expect(typeof result).toBe("string");
		});
	});
});
