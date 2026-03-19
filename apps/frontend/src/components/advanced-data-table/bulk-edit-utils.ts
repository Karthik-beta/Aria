/**
 * Helpers for advanced-table bulk edit eligibility and request normalization.
 */

import type { Column, Row, RowData, Table } from "@tanstack/react-table";
import type { BulkEditRequest, ResolvedBulkEditField } from "./types";

type BulkEditNormalizationResult<TData extends RowData> =
	| { ok: true; request: BulkEditRequest<TData> }
	| { ok: false; error: string };

function resolveBulkEditField<TData extends RowData>(
	column: Column<TData, unknown>,
): ResolvedBulkEditField | null {
	const columnMeta = column.columnDef.meta;
	const bulkEdit = columnMeta?.bulkEdit;
	if (!bulkEdit) {
		return null;
	}

	const accessorKey =
		"accessorKey" in column.columnDef &&
		typeof column.columnDef.accessorKey === "string"
			? column.columnDef.accessorKey
			: undefined;
	const field = bulkEdit.field ?? accessorKey;

	if (!field) {
		return null;
	}

	return {
		columnId: column.id,
		field,
		type: bulkEdit.type,
		label: bulkEdit.label ?? columnMeta?.label ?? column.id,
		placeholder: bulkEdit.placeholder ?? columnMeta?.placeholder,
		options:
			bulkEdit.type === "select"
				? (bulkEdit.options ?? columnMeta?.options ?? [])
				: bulkEdit.options,
		allowClear: bulkEdit.allowClear ?? false,
		columnConfig: bulkEdit,
	};
}

/**
 * Resolves the table columns that are explicitly eligible for bulk edit.
 */
export function getBulkEditableFields<TData extends RowData>(
	table: Table<TData>,
): ResolvedBulkEditField[] {
	return table
		.getAllColumns()
		.map(resolveBulkEditField)
		.filter((field): field is ResolvedBulkEditField => field !== null);
}

/**
 * Converts raw dialog input into a validated bulk-edit request payload.
 */
export function normalizeBulkEditRequest<TData extends RowData>({
	rows,
	field,
	rawValue,
}: {
	rows: readonly Row<TData>[];
	field: ResolvedBulkEditField;
	rawValue: string;
}): BulkEditNormalizationResult<TData> {
	const value = rawValue.trim();

	if (value.length === 0) {
		if (!field.allowClear) {
			const emptyValueError =
				field.type === "number"
					? "Enter a valid number."
					: field.type === "select"
						? "Select a valid option."
						: field.type === "date"
							? "Enter a valid date."
							: field.type === "boolean"
								? "Select either True or False."
								: "Enter a value before updating this field.";

			return { ok: false, error: emptyValueError };
		}

		return {
			ok: true,
			request: {
				rows,
				columnId: field.columnId,
				field: field.field,
				operation: "clear",
				config: field,
			},
		};
	}

	switch (field.type) {
		case "number": {
			const parsed = Number(value);
			if (!Number.isFinite(parsed)) {
				return { ok: false, error: "Enter a valid number." };
			}

			return {
				ok: true,
				request: {
					rows,
					columnId: field.columnId,
					field: field.field,
					operation: "set",
					value: parsed,
					config: field,
				},
			};
		}
		case "boolean": {
			if (value !== "true" && value !== "false") {
				return { ok: false, error: "Select either True or False." };
			}

			return {
				ok: true,
				request: {
					rows,
					columnId: field.columnId,
					field: field.field,
					operation: "set",
					value: value === "true",
					config: field,
				},
			};
		}
		case "select": {
			const isValidOption = field.options?.some(
				(option) => option.value === value,
			);
			if (!isValidOption) {
				return { ok: false, error: "Select a valid option." };
			}

			return {
				ok: true,
				request: {
					rows,
					columnId: field.columnId,
					field: field.field,
					operation: "set",
					value,
					config: field,
				},
			};
		}
		case "date": {
			const parsed = Date.parse(value);
			if (Number.isNaN(parsed)) {
				return { ok: false, error: "Enter a valid date." };
			}

			return {
				ok: true,
				request: {
					rows,
					columnId: field.columnId,
					field: field.field,
					operation: "set",
					value,
					config: field,
				},
			};
		}
		default:
			return {
				ok: true,
				request: {
					rows,
					columnId: field.columnId,
					field: field.field,
					operation: "set",
					value: rawValue,
					config: field,
				},
			};
	}
}
