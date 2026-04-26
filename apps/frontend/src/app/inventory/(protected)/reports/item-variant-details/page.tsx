"use client";

import type { ColumnDef, Row } from "@tanstack/react-table";
import * as React from "react";
import {
	AdvancedDataTable,
	useAdvancedDataTable,
} from "@/components/advanced-data-table";
import { downloadExcelBuffer } from "@/components/advanced-data-table/utils";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-display";
import { Input } from "@/components/ui/input";
import { DataTableColumnHeader } from "@/components/ui/table/data-table-column-header";
import { trpc } from "@/lib/trpc";
import {
	formatOptional,
	formatQty,
	formatRate,
	type ItemVariantDetailsRow,
} from "./item-variant-details.utils";

// ---------------------------------------------------------------------------
// Fixed columns (always present)
// ---------------------------------------------------------------------------

function buildColumns(
	attributeNames: string[],
): ColumnDef<ItemVariantDetailsRow>[] {
	const cols: ColumnDef<ItemVariantDetailsRow>[] = [
		{
			accessorKey: "variantCode",
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Variant" />
			),
			cell: ({ row }) => (
				<span className="font-medium">{row.original.variantCode}</span>
			),
			meta: { label: "Variant", exportable: true },
		},
		{
			accessorKey: "variantName",
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Variant Name" />
			),
			cell: ({ row }) => (
				<span className="text-sm text-muted-foreground">
					{row.original.variantName}
				</span>
			),
			meta: { label: "Variant Name", exportable: true },
		},
	];

	// Dynamic attribute columns
	for (const attrName of attributeNames) {
		cols.push({
			id: `attr_${attrName}`,
			accessorFn: (row) => row.attributes[attrName] ?? "",
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title={attrName} />
			),
			cell: ({ row }) => (
				<span className="text-sm">
					{formatOptional(row.original.attributes[attrName])}
				</span>
			),
			meta: { label: attrName, exportable: true },
		});
	}

	// Fixed metric columns
	cols.push(
		{
			accessorKey: "avgBuyingPriceListRate",
			header: ({ column }) => (
				<DataTableColumnHeader
					column={column}
					title="Avg. Buying Price List Rate"
				/>
			),
			cell: ({ row }) => (
				<span className="tabular-nums">
					{formatRate(row.original.avgBuyingPriceListRate)}
				</span>
			),
			meta: { label: "Avg. Buying Price List Rate", exportable: true },
		},
		{
			accessorKey: "avgSellingPriceListRate",
			header: ({ column }) => (
				<DataTableColumnHeader
					column={column}
					title="Avg. Selling Price List Rate"
				/>
			),
			cell: ({ row }) => (
				<span className="tabular-nums">
					{formatRate(row.original.avgSellingPriceListRate)}
				</span>
			),
			meta: { label: "Avg. Selling Price List Rate", exportable: true },
		},
		{
			accessorKey: "currentStock",
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Current Stock" />
			),
			cell: ({ row }) => (
				<span className="tabular-nums">
					{formatQty(row.original.currentStock)}
				</span>
			),
			meta: { label: "Current Stock", exportable: true },
		},
		{
			accessorKey: "openOrders",
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Open Sales Orders" />
			),
			cell: ({ row }) => (
				<span className="tabular-nums">
					{formatQty(row.original.openOrders)}
				</span>
			),
			meta: { label: "Open Sales Orders", exportable: true },
		},
	);

	return cols;
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function ItemVariantDetailsPage() {
	const [itemCode, setItemCode] = React.useState("");
	const [submittedItemCode, setSubmittedItemCode] = React.useState("");

	const handleSubmit = React.useCallback(
		(e: React.FormEvent) => {
			e.preventDefault();
			const trimmed = itemCode.trim();
			if (trimmed) {
				setSubmittedItemCode(trimmed);
			}
		},
		[itemCode],
	);

	const handleReset = React.useCallback(() => {
		setItemCode("");
		setSubmittedItemCode("");
	}, []);

	const { data, isLoading, error, refetch } =
		trpc.inventory.listItemVariantDetails.useQuery(
			{ itemCode: submittedItemCode },
			{
				enabled: submittedItemCode.length > 0,
				refetchOnWindowFocus: false,
				retry: 2,
				staleTime: 60_000,
			},
		);

	const result = data ?? { attributeNames: [], rows: [] };
	const rows = result.rows;

	const columns = React.useMemo(
		() => buildColumns(result.attributeNames),
		[result.attributeNames],
	);

	const handleReload = React.useCallback(async () => {
		await refetch();
	}, [refetch]);

	const { table } = useAdvancedDataTable<ItemVariantDetailsRow>({
		data: rows,
		columns,
		initialSorting: [{ id: "variantCode", desc: false }],
		initialPageSize: 50,
		enableRowSelection: false,
		enableMultiRowSelection: false,
		enableGlobalFilter: false,
		onReload: handleReload,
		getRowId: (row) => row.id,
	});

	const exportItemVariantDetailsExcel =
		trpc.inventory.exportItemVariantDetailsExcel.useMutation();

	const handleExport = React.useCallback(
		async (_format: string, _rows: readonly Row<ItemVariantDetailsRow>[]) => {
			const buffer = (await exportItemVariantDetailsExcel.mutateAsync({
				itemCode: submittedItemCode,
			})) as string;
			downloadExcelBuffer(buffer, `item-variant-details-${Date.now()}.xlsx`);
		},
		[submittedItemCode, exportItemVariantDetailsExcel],
	);

	return (
		<div className="flex flex-1 flex-col gap-6 p-6">
			{/* Header */}
			<div>
				<h1 className="text-2xl font-bold tracking-tight">
					Item Variant Details
				</h1>
				<p className="mt-1 text-sm text-muted-foreground">
					Shows all variants of a template item with their attribute values,
					pricing, stock levels, and open sales orders.
				</p>
			</div>

			{/* Filter */}
			<form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
				<div className="flex flex-col gap-1">
					<label htmlFor="item-code-input" className="text-sm font-medium">
						Item (Template) <span className="text-destructive">*</span>
					</label>
					<Input
						id="item-code-input"
						placeholder="Enter template item code"
						value={itemCode}
						onChange={(e) => setItemCode(e.target.value)}
						className="h-9 w-64"
						aria-label="Template item code"
						required
					/>
				</div>

				<Button type="submit" size="sm" className="h-9">
					Generate
				</Button>

				<Button
					type="button"
					variant="outline"
					size="sm"
					onClick={handleReset}
					disabled={!submittedItemCode && !itemCode}
					className="h-9"
				>
					Reset
				</Button>
			</form>

			{/* Loading */}
			{submittedItemCode && isLoading && (
				<p className="text-sm text-muted-foreground">
					Loading variant details…
				</p>
			)}

			{/* Error */}
			{submittedItemCode && !isLoading && error && (
				<ErrorState error={error} title="Failed to load item variant details" />
			)}

			{/* Empty — no item submitted yet */}
			{!submittedItemCode && (
				<div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
					<p className="text-lg font-medium text-muted-foreground">
						Select a template item
					</p>
					<p className="mt-1 text-sm text-muted-foreground">
						Enter the code of an item that has variants to see details.
					</p>
				</div>
			)}

			{/* Empty — no variants found */}
			{submittedItemCode && !isLoading && !error && rows.length === 0 && (
				<div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
					<p className="text-lg font-medium text-muted-foreground">
						No variants found
					</p>
					<p className="mt-1 text-sm text-muted-foreground">
						The item &quot;{submittedItemCode}&quot; has no active variants, or
						is not a template item.
					</p>
				</div>
			)}

			{/* Results */}
			{submittedItemCode && !isLoading && !error && rows.length > 0 && (
				<section
					className="rounded-lg border bg-background"
					aria-label="Item variant details data table"
				>
					<div className="p-3 text-sm text-muted-foreground">
						{rows.length} variant{rows.length !== 1 ? "s" : ""} of{" "}
						<span className="font-medium">{submittedItemCode}</span>
					</div>
					<AdvancedDataTable<ItemVariantDetailsRow>
						table={table}
						data={rows}
						onExport={handleExport}
					/>
				</section>
			)}
		</div>
	);
}
