/**
 * Report Column definition for Excel exports
 */
export interface ReportColumn {
	/** Key to access the value from each data row object */
	key: string;
	/** Display header text for the column */
	header: string;
	/** Optional width in characters for the column */
	width?: number;
}

/**
 * Metadata for Excel report generation
 */
export interface ReportMetadata {
	/** Report title displayed at the top */
	title: string;
	/** Timestamp when the report was generated */
	generatedAt: Date;
	/** Optional filter information to display in the report */
	filters?: Array<{ label: string; value: string }>;
}

/**
 * Report Template Service
 *
 * Provides styled Excel export capabilities for reports across the Aria monorepo.
 * Uses the xlsx library to generate properly formatted Excel files.
 *
 * @example
 * const service = new ReportTemplateService();
 * const buffer = service.buildExcelBuffer(
 *   { title: "Stock Balance Report", generatedAt: new Date() },
 *   [{ itemCode: "ITEM-001", qty: 100 }],
 *   [{ key: "itemCode", header: "Item Code" }, { key: "qty", header: "Quantity" }]
 * );
 */
export class ReportTemplateService {
	/**
	 * Build a styled Excel buffer from data and configuration
	 *
	 * @param metadata - Report title, timestamp, and optional filters
	 * @param data - Array of row objects to export
	 * @param columns - Column definitions mapping keys to headers
	 * @returns Buffer containing the Excel file
	 */
	buildExcelBuffer(
		metadata: ReportMetadata,
		data: Record<string, unknown>[],
		columns: ReportColumn[],
	): Buffer {
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const XLSX = require("xlsx") as typeof import("xlsx");

		const wb = XLSX.utils.book_new();

		const metadataRows = this.buildMetadataSection(metadata, columns);
		const headerRow = this.buildHeaderRow(columns);
		const dataRows = this.buildDataRows(data, columns);

		const allRows: XLSXRow[] = [...metadataRows, headerRow, ...dataRows];

		const ws = XLSX.utils.aoa_to_sheet(allRows);

		this.applyColumnWidths(ws, columns);

		XLSX.utils.book_append_sheet(wb, ws, "Report");

		const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
		return Buffer.from(buffer);
	}

	private buildMetadataSection(
		metadata: ReportMetadata,
		columns: ReportColumn[],
	): XLSXRow[] {
		const rows: XLSXRow[] = [];

		rows.push([metadata.title]);

		const timestamp = metadata.generatedAt.toLocaleString("en-IN", {
			day: "2-digit",
			month: "short",
			year: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
		rows.push([`Generated: ${timestamp}`]);

		if (metadata.filters && metadata.filters.length > 0) {
			const filterLabel = metadata.filters
				.map((f) => `${f.label}: ${f.value}`)
				.join(" | ");
			rows.push([filterLabel]);
		}

		rows.push(Array(columns.length).fill(""));

		return rows;
	}

	private buildHeaderRow(columns: ReportColumn[]): XLSXRow {
		return columns.map((col) => col.header);
	}

	private buildDataRows(
		data: Record<string, unknown>[],
		columns: ReportColumn[],
	): XLSXRow[] {
		return data.map((row) =>
			columns.map((col) => {
				const value = row[col.key];
				if (value === null || value === undefined) return "";
				if (value instanceof Date) {
					return value.toLocaleDateString("en-IN");
				}
				return String(value);
			}),
		);
	}

	private applyColumnWidths(
		ws: import("xlsx").WorkSheet,
		columns: ReportColumn[],
	): void {
		ws["!cols"] = columns.map((col) => ({
			wch: col.width ?? this.estimateWidth(col.header),
		}));
	}

	private estimateWidth(header: string): number {
		return Math.max(8, header.length + 4);
	}
}

type XLSXRow = unknown[];
