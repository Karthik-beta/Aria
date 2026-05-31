/**
 * Quick Stock Balance — instant on-hand lookup for a single item at a warehouse.
 *
 * User selects a warehouse, a date, and enters either an item code or a barcode.
 * The page immediately fetches and displays the current stock quantity, stock
 * value, and item metadata. A link to the full Stock Balance report is provided
 * for deeper analysis.
 *
 * Client component: uses hooks for tRPC queries and local filter state.
 */
"use client";

import { Package, RotateCcw, TrendingUp } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-display";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayISODate(): string {
	return new Date().toISOString().slice(0, 10);
}

function formatQuantity(value: number): string {
	return new Intl.NumberFormat("en-IN", {
		minimumFractionDigits: 0,
		maximumFractionDigits: 3,
	}).format(value);
}

function formatCurrency(value: number): string {
	return new Intl.NumberFormat("en-IN", {
		style: "currency",
		currency: "INR",
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(value);
}

// ─── Sub-components ──────────────────────────────────────────────────────────

/**
 * StatCard — a single KPI card for qty or value display.
 * Pure display component; no side-effects.
 */
function StatCard({
	label,
	value,
	icon: Icon,
	className,
}: {
	label: string;
	value: string;
	icon: React.ElementType;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"flex flex-col gap-1 rounded-lg border bg-background p-4",
				className,
			)}
		>
			<div className="flex items-center gap-2">
				<Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
				<span className="text-sm text-muted-foreground">{label}</span>
			</div>
			<span className="text-2xl font-semibold tabular-nums">{value}</span>
		</div>
	);
}

/**
 * ResultSection — displays item details and KPI cards after a successful lookup.
 * Pure display component.
 */
function ResultSection({
	itemCode,
	itemName,
	description,
	barcodes,
	availableQty,
	stockValue,
	warehouse,
}: {
	itemCode: string;
	itemName: string | null;
	description: string | null;
	barcodes: string[];
	availableQty: number;
	stockValue: number;
	warehouse: string;
}) {
	const stockBalanceReportHref = `/inventory/stock-reports/stock-balance?itemCode=${encodeURIComponent(itemCode)}&warehouse=${encodeURIComponent(warehouse)}`;

	return (
		<div className="space-y-4">
			{/* Item metadata */}
			<div className="rounded-lg border bg-background p-5 space-y-3">
				<div className="flex items-start justify-between gap-4 flex-wrap">
					<div className="space-y-0.5">
						<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
							Item Code
						</p>
						<p className="text-lg font-semibold">{itemCode}</p>
					</div>
					{itemName && (
						<div className="space-y-0.5">
							<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
								Item Name
							</p>
							<p className="text-base font-medium">{itemName}</p>
						</div>
					)}
				</div>

				{description && (
					<div className="space-y-0.5">
						<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
							Description
						</p>
						<p className="text-sm text-muted-foreground">{description}</p>
					</div>
				)}

				{barcodes.length > 0 && (
					<div className="space-y-1">
						<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
							Barcodes
						</p>
						<div className="flex flex-wrap gap-2">
							{barcodes.map((bc) => (
								<span
									key={bc}
									className="inline-flex items-center rounded-full border bg-muted px-2.5 py-0.5 text-xs font-mono"
								>
									{bc}
								</span>
							))}
						</div>
					</div>
				)}
			</div>

			{/* KPIs */}
			<div className="grid gap-4 sm:grid-cols-2">
				<StatCard
					label="Available Quantity"
					value={formatQuantity(availableQty)}
					icon={Package}
					className={
						availableQty <= 0
							? "border-destructive/30 bg-destructive/5"
							: undefined
					}
				/>
				<StatCard
					label="Stock Value"
					value={formatCurrency(stockValue)}
					icon={TrendingUp}
				/>
			</div>

			{/* Link to full report */}
			<div className="flex justify-end">
				<Button variant="outline" size="sm" asChild>
					<Link href={stockBalanceReportHref}>View Stock Balance Report</Link>
				</Button>
			</div>
		</div>
	);
}

/**
 * ResultSkeleton — loading placeholder while the balance query runs.
 */
function ResultSkeleton() {
	return (
		<div className="space-y-4">
			<div className="rounded-lg border bg-background p-5 space-y-3">
				<Skeleton className="h-5 w-1/3" />
				<Skeleton className="h-4 w-1/2" />
				<Skeleton className="h-3 w-2/3" />
			</div>
			<div className="grid gap-4 sm:grid-cols-2">
				<Skeleton className="h-20 rounded-lg" />
				<Skeleton className="h-20 rounded-lg" />
			</div>
		</div>
	);
}

// ─── Main page ────────────────────────────────────────────────────────────────

type LookupMode = "itemCode" | "barcode";

type LookupState = {
	warehouse: string;
	date: string;
	itemCode: string;
	barcode: string;
	mode: LookupMode;
};

const INITIAL_STATE: LookupState = {
	warehouse: "",
	date: todayISODate(),
	itemCode: "",
	barcode: "",
	mode: "itemCode",
};

/**
 * QuickStockBalancePage — instant single-item stock balance lookup.
 *
 * Allows warehouse staff or managers to quickly check how much of an item is
 * available at a given warehouse on a given date, and see its stock value.
 * Client component: uses controlled inputs and tRPC query with `enabled` flag.
 */
export default function QuickStockBalancePage() {
	const [state, setState] = React.useState<LookupState>({ ...INITIAL_STATE });

	const updateState = React.useCallback(
		<K extends keyof LookupState>(key: K, value: LookupState[K]) => {
			setState((prev) => ({ ...prev, [key]: value }));
		},
		[],
	);

	const { data: warehouseOptions, isLoading: loadingWarehouses } =
		trpc.inventory.listWarehouses.useQuery(
			{ take: 250 },
			{ staleTime: 60_000 },
		);

	// Derive the identifier used for the lookup
	const lookupItemCode =
		state.mode === "itemCode" ? state.itemCode.trim() : undefined;
	const lookupBarcode =
		state.mode === "barcode" ? state.barcode.trim() : undefined;

	const isQueryReady =
		state.warehouse.trim() !== "" &&
		state.date.trim() !== "" &&
		((state.mode === "itemCode" && lookupItemCode !== "") ||
			(state.mode === "barcode" && lookupBarcode !== ""));

	const queryInput = React.useMemo(
		() => ({
			warehouse: state.warehouse.trim(),
			date: new Date(state.date),
			itemCode: lookupItemCode || undefined,
			barcode: lookupBarcode || undefined,
		}),
		[state.warehouse, state.date, lookupItemCode, lookupBarcode],
	);

	const {
		data: result,
		isLoading: lookingUp,
		error,
		isFetching,
	} = trpc.inventory.getQuickStockBalance.useQuery(queryInput, {
		enabled: isQueryReady,
		retry: false,
		refetchOnWindowFocus: false,
	});

	const handleReset = React.useCallback(() => {
		setState({ ...INITIAL_STATE });
	}, []);

	const showSkeleton = isQueryReady && (lookingUp || isFetching) && !error;
	const showResult = isQueryReady && !lookingUp && !isFetching && !!result;
	const showError = isQueryReady && !!error && !isFetching;

	return (
		<div className="flex flex-1 flex-col gap-6 p-4 md:px-6">
			{/* Page header */}
			<div className="flex items-center justify-between gap-4">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">
						Quick Stock Balance
					</h1>
					<p className="text-muted-foreground">
						Check the available quantity and stock value for an item at a
						warehouse on any date.
					</p>
				</div>
				<Button variant="outline" size="sm" onClick={handleReset}>
					<RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
					Reset
				</Button>
			</div>

			{/* Lookup card */}
			<Card>
				<CardHeader>
					<CardTitle>Lookup Parameters</CardTitle>
					<CardDescription>
						Select a warehouse and date, then enter an item code or scan a
						barcode. Results appear automatically.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-5">
					{/* Required fields row */}
					<div className="grid gap-4 sm:grid-cols-2">
						<div className="space-y-1.5">
							<Label htmlFor="warehouse">
								Warehouse <span className="text-destructive">*</span>
							</Label>
							<Select
								value={state.warehouse}
								onValueChange={(val) => updateState("warehouse", val)}
								disabled={loadingWarehouses}
							>
								<SelectTrigger id="warehouse" aria-label="Select warehouse">
									<SelectValue
										placeholder={
											loadingWarehouses ? "Loading…" : "Select warehouse"
										}
									/>
								</SelectTrigger>
								<SelectContent>
									{(warehouseOptions?.items ?? []).map((wh) => (
										<SelectItem key={wh.id} value={wh.name}>
											{wh.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="date">
								Date <span className="text-destructive">*</span>
							</Label>
							<Input
								id="date"
								type="date"
								value={state.date}
								onChange={(e) => updateState("date", e.target.value)}
								aria-label="Lookup date"
							/>
						</div>
					</div>

					{/* Mode toggle */}
					<div className="space-y-1.5">
						<Label>Look up by</Label>
						<div className="flex gap-2">
							<Button
								type="button"
								size="sm"
								variant={state.mode === "itemCode" ? "default" : "outline"}
								onClick={() => updateState("mode", "itemCode")}
							>
								Item Code
							</Button>
							<Button
								type="button"
								size="sm"
								variant={state.mode === "barcode" ? "default" : "outline"}
								onClick={() => updateState("mode", "barcode")}
							>
								Barcode
							</Button>
						</div>
					</div>

					{/* Conditional identifier field */}
					{state.mode === "itemCode" ? (
						<div className="space-y-1.5">
							<Label htmlFor="itemCode">
								Item Code <span className="text-destructive">*</span>
							</Label>
							<Input
								id="itemCode"
								value={state.itemCode}
								onChange={(e) => updateState("itemCode", e.target.value)}
								placeholder="e.g. ITEM-001"
								aria-label="Item code"
								autoComplete="off"
							/>
						</div>
					) : (
						<div className="space-y-1.5">
							<Label htmlFor="barcode">
								Barcode <span className="text-destructive">*</span>
							</Label>
							<Input
								id="barcode"
								value={state.barcode}
								onChange={(e) => updateState("barcode", e.target.value)}
								placeholder="Scan or type barcode"
								aria-label="Item barcode"
								autoComplete="off"
							/>
						</div>
					)}

					{!isQueryReady && (
						<p className="text-sm text-muted-foreground">
							Fill in all required fields above to see the stock balance.
						</p>
					)}
				</CardContent>
			</Card>

			{/* Results area */}
			{showSkeleton && <ResultSkeleton />}

			{showError && (
				<ErrorState
					error={error}
					operation="load"
					title="Could not load stock balance"
				/>
			)}

			{showResult && (
				<ResultSection
					itemCode={result.itemCode}
					itemName={result.itemName}
					description={result.description}
					barcodes={result.barcodes}
					availableQty={result.availableQty}
					stockValue={result.stockValue}
					warehouse={state.warehouse}
				/>
			)}
		</div>
	);
}
