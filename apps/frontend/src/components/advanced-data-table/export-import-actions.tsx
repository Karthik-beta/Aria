/**
 * Advanced Data Table - Export/Import Component
 * Handles data export to multiple formats and import from CSV/Excel/JSON
 */

"use client";

import { logger } from "@aria/utils";
import type { Row, Table } from "@tanstack/react-table";
import {
	FileDown,
	FileJson,
	FileSpreadsheet,
	FileText,
	FileUp,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ExportFormat } from "./types";
import { exportData, importData } from "./utils";

interface ExportImportActionsProps<TData> {
	table: Table<TData>;
	exportFormats?: ExportFormat[];
	onExport?: (format: ExportFormat, rows: Row<TData>[]) => void | Promise<void>;
	onImport?: (data: readonly Record<string, unknown>[]) => void | Promise<void>;
	enableImport?: boolean;
}

export function ExportImportActions<TData>({
	table,
	exportFormats = ["csv", "excel", "json"],
	onExport,
	onImport,
	enableImport = true,
}: ExportImportActionsProps<TData>) {
	const fileInputRef = React.useRef<HTMLInputElement>(null);
	const [isExporting, setIsExporting] = React.useState(false);
	const [isImporting, setIsImporting] = React.useState(false);
	const isMountedRef = React.useRef(false);

	React.useEffect(() => {
		isMountedRef.current = true;
		return () => {
			isMountedRef.current = false;
		};
	}, []);

	const handleExport = async (format: ExportFormat) => {
		try {
			setIsExporting(true);
			const selectedRows = table.getFilteredSelectedRowModel().rows;
			const rowsToExport =
				selectedRows.length > 0
					? selectedRows
					: table.getFilteredRowModel().rows;

			if (onExport) {
				await onExport(format, rowsToExport);
			} else {
				await exportData(format, rowsToExport);
			}

			toast.success(
				`Successfully exported ${rowsToExport.length} rows to ${format.toUpperCase()}`,
			);
		} catch (error) {
			logger.error("Export error:", error);
			toast.error(
				`Failed to export data: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		} finally {
			if (isMountedRef.current) {
				setIsExporting(false);
			}
		}
	};

	const handleImportClick = () => {
		fileInputRef.current?.click();
	};

	const handleFileChange = async (
		event: React.ChangeEvent<HTMLInputElement>,
	) => {
		const file = event.target.files?.[0];
		if (!file) return;

		try {
			setIsImporting(true);
			const data = await importData(file);

			if (onImport) {
				await onImport(data);
			}

			toast.success(
				`Successfully imported ${data.length} rows from ${file.name}`,
			);
		} catch (error) {
			logger.error("Import error:", error);
			toast.error(
				`Failed to import data: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		} finally {
			if (isMountedRef.current) {
				setIsImporting(false);
				// Reset file input
				if (fileInputRef.current) {
					fileInputRef.current.value = "";
				}
			}
		}
	};

	const getFormatIcon = (format: ExportFormat) => {
		switch (format) {
			case "csv":
				return <FileText className="mr-2 h-4 w-4" />;
			case "excel":
				return <FileSpreadsheet className="mr-2 h-4 w-4" />;
			case "json":
				return <FileJson className="mr-2 h-4 w-4" />;
			case "pdf":
				return <FileText className="mr-2 h-4 w-4" />;
			default:
				return <FileDown className="mr-2 h-4 w-4" />;
		}
	};

	return (
		<div className="flex items-center gap-2">
			{/* Export Dropdown */}
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant="outline" size="sm" disabled={isExporting}>
						<FileDown className="mr-2 h-4 w-4" />
						{isExporting ? "Exporting..." : "Export"}
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					<DropdownMenuLabel>Export Format</DropdownMenuLabel>
					<DropdownMenuSeparator />
					{exportFormats.map((format) => (
						<DropdownMenuItem key={format} onClick={() => handleExport(format)}>
							{getFormatIcon(format)}
							{format.toUpperCase()}
						</DropdownMenuItem>
					))}
				</DropdownMenuContent>
			</DropdownMenu>

			{/* Import Button */}
			{enableImport && (
				<>
					<Button
						variant="outline"
						size="sm"
						onClick={handleImportClick}
						disabled={isImporting}
					>
						<FileUp className="mr-2 h-4 w-4" />
						{isImporting ? "Importing..." : "Import"}
					</Button>
					<input
						ref={fileInputRef}
						type="file"
						accept=".csv,.xlsx,.xls,.json"
						className="hidden"
						onChange={handleFileChange}
					/>
				</>
			)}
		</div>
	);
}
