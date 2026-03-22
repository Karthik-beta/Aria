/**
 * Dialog for built-in advanced-table bulk edit.
 */

"use client";

import type { Row, RowData } from "@tanstack/react-table";
import * as React from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { normalizeBulkEditRequest } from "./bulk-edit-utils";
import type { BulkEditRequest, ResolvedBulkEditField } from "./types";

const EMPTY_OPTION_VALUE = "__aria_bulk_edit_empty__";

interface BulkEditDialogProps<TData extends RowData> {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	rows: readonly Row<TData>[];
	fields: readonly ResolvedBulkEditField[];
	isSubmitting?: boolean;
	onSubmit: (request: BulkEditRequest<TData>) => void | Promise<void>;
}

/**
 * Renders the built-in bulk-edit dialog for selected table rows.
 */
export function BulkEditDialog<TData extends RowData>({
	open,
	onOpenChange,
	rows,
	fields,
	isSubmitting = false,
	onSubmit,
}: BulkEditDialogProps<TData>) {
	const [selectedColumnId, setSelectedColumnId] = React.useState<string>("");
	const [rawValue, setRawValue] = React.useState("");

	React.useEffect(() => {
		if (!open) {
			return;
		}

		const hasSelectedField = fields.some(
			(field) => field.columnId === selectedColumnId,
		);
		const nextField = hasSelectedField
			? selectedColumnId
			: (fields[0]?.columnId ?? "");
		setSelectedColumnId(nextField);
		setRawValue("");
	}, [fields, open, selectedColumnId]);

	const selectedField = React.useMemo(
		() => fields.find((field) => field.columnId === selectedColumnId) ?? null,
		[fields, selectedColumnId],
	);

	const normalizedRequest = React.useMemo(() => {
		if (!selectedField) {
			return { ok: false as const, error: "Select a field to update." };
		}

		return normalizeBulkEditRequest({
			rows,
			field: selectedField,
			rawValue,
		});
	}, [rawValue, rows, selectedField]);

	const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!normalizedRequest.ok) {
			return;
		}

		await onSubmit(normalizedRequest.request);
	};

	const isClearSelection =
		selectedField?.allowClear && rawValue.trim().length === 0;
	const helperMessage = isClearSelection
		? "You have not entered a value. The field will be set to empty."
		: normalizedRequest.ok
			? null
			: normalizedRequest.error;

	const renderValueEditor = () => {
		if (!selectedField) {
			return null;
		}

		if (selectedField.type === "boolean") {
			return (
				<Select
					value={isClearSelection ? EMPTY_OPTION_VALUE : rawValue || undefined}
					onValueChange={(value) =>
						setRawValue(value === EMPTY_OPTION_VALUE ? "" : value)
					}
				>
					<SelectTrigger
						id="bulk-edit-value"
						aria-label="Value"
						className="w-full"
					>
						<SelectValue placeholder="Select a value" />
					</SelectTrigger>
					<SelectContent>
						{selectedField.allowClear && (
							<SelectItem value={EMPTY_OPTION_VALUE}>Empty</SelectItem>
						)}
						<SelectItem value="true">True</SelectItem>
						<SelectItem value="false">False</SelectItem>
					</SelectContent>
				</Select>
			);
		}

		if (selectedField.type === "select") {
			return (
				<Select
					value={isClearSelection ? EMPTY_OPTION_VALUE : rawValue || undefined}
					onValueChange={(value) =>
						setRawValue(value === EMPTY_OPTION_VALUE ? "" : value)
					}
				>
					<SelectTrigger
						id="bulk-edit-value"
						aria-label="Value"
						className="w-full"
					>
						<SelectValue placeholder="Select a value" />
					</SelectTrigger>
					<SelectContent>
						{selectedField.allowClear && (
							<SelectItem value={EMPTY_OPTION_VALUE}>Empty</SelectItem>
						)}
						{selectedField.options?.map((option) => (
							<SelectItem key={option.value} value={option.value}>
								{option.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			);
		}

		if (selectedField.type === "date") {
			return (
				<Input
					id="bulk-edit-value"
					aria-label="Value"
					type="date"
					value={rawValue}
					onChange={(event) => setRawValue(event.target.value)}
				/>
			);
		}

		return (
			<Input
				id="bulk-edit-value"
				aria-label="Value"
				type={selectedField.type === "number" ? "number" : "text"}
				inputMode={selectedField.type === "number" ? "decimal" : undefined}
				placeholder={selectedField.placeholder ?? "Enter a value"}
				value={rawValue}
				onChange={(event) => setRawValue(event.target.value)}
			/>
		);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-[575px] gap-0 overflow-hidden p-0">
				<form onSubmit={handleSubmit}>
					<DialogHeader className="border-b px-5 py-4">
						<DialogTitle>Bulk Edit</DialogTitle>
					</DialogHeader>
					<div className="space-y-5 px-5 py-5">
						<div className="space-y-2">
							<Label htmlFor="bulk-edit-field">
								Field <span className="text-destructive">*</span>
							</Label>
							<Select
								value={selectedColumnId}
								onValueChange={(value) => {
									setSelectedColumnId(value);
									setRawValue("");
								}}
							>
								<SelectTrigger
									id="bulk-edit-field"
									aria-label="Field"
									className="w-full"
								>
									<SelectValue placeholder="Select a field" />
								</SelectTrigger>
								<SelectContent>
									{fields.map((field) => (
										<SelectItem key={field.columnId} value={field.columnId}>
											{field.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<div className="space-y-2">
							<Label htmlFor="bulk-edit-value">Value</Label>
							{renderValueEditor()}
							{helperMessage && (
								<p
									className={cn(
										"text-sm",
										normalizedRequest.ok
											? "text-muted-foreground"
											: "text-destructive",
									)}
								>
									{helperMessage}
								</p>
							)}
						</div>
					</div>
					<DialogFooter className="border-t px-5 py-4">
						<Button
							type="submit"
							disabled={isSubmitting || !normalizedRequest.ok}
						>
							{isSubmitting
								? "Updating..."
								: `Update ${rows.length} record${rows.length === 1 ? "" : "s"}`}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
