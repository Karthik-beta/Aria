/**
 * Report Template Service
 *
 * Provides styled Excel export capabilities for inventory reports.
 * Uses the xlsx library to generate properly formatted Excel files.
 */
type XLSXRow = unknown[];

interface ReportColumn {
	key: string;
	header: string;
	width?: number;
}

interface ReportMetadata {
	title: string;
	generatedAt: Date;
	filters?: Array<{ label: string; value: string }>;
}

export class ReportTemplateService {
	/**
	 * Build a styled Excel buffer from data and configuration
	 */
	buildExcelBuffer(
		metadata: ReportMetadata,
		data: Record<string, unknown>[],
		columns: ReportColumn[],
	): Buffer {
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const XLSX = require("xlsx") as typeof import("xlsx");

		const wb = XLSX.utils.book_new();

		// Build metadata section (title + filter rows)
		const metadataRows = this.buildMetadataSection(metadata, columns);

		// Build header row
		const headerRow = this.buildHeaderRow(columns);

		// Build data rows
		const dataRows = this.buildDataRows(data, columns);

		// Combine all rows
		const allRows: XLSXRow[] = [...metadataRows, headerRow, ...dataRows];

		// Create worksheet
		const ws = XLSX.utils.aoa_to_sheet(allRows);

		// Apply column widths
		this.applyColumnWidths(ws, columns);

		// Add workbook
		XLSX.utils.book_append_sheet(wb, ws, "Report");

		// Write to buffer
		const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
		return Buffer.from(buffer);
	}

	private buildMetadataSection(
		metadata: ReportMetadata,
		columns: ReportColumn[],
	): XLSXRow[] {
		const rows: XLSXRow[] = [];

		// Row 1: Report title
		rows.push([metadata.title]);

		// Row 2: Generated timestamp
		const timestamp = metadata.generatedAt.toLocaleString("en-IN", {
			day: "2-digit",
			month: "short",
			year: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
		rows.push([`Generated: ${timestamp}`]);

		// Filter rows (if any)
		if (metadata.filters && metadata.filters.length > 0) {
			const filterLabel = metadata.filters
				.map((f) => `${f.label}: ${f.value}`)
				.join(" | ");
			rows.push([filterLabel]);
		}

		// Empty separator row
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
