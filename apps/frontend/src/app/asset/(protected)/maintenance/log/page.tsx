/**
 * Asset Maintenance Log List Page
 *
 * Standalone, paginated list of all maintenance log entries across all assets.
 * Mirrors ERPNext Asset Maintenance Log list view behaviour:
 * - PLANNED logs are orange, COMPLETED are green, OVERDUE/CANCELLED are red.
 * - Users can complete an open log via an inline action dialog.
 * - Users can cancel a PLANNED or OVERDUE log via a confirmation prompt.
 * - Real-time updates arrive via the existing asset maintenance WebSocket subscription.
 *
 * Logs are created automatically by the system when maintenance tasks are
 * scheduled (on create) or when a previous log is completed (next scheduled log).
 *
 * Client component: uses hooks for data fetching, state, and mutations.
 */
"use client";

import type { Asset } from "@aria/types";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ColumnDef, PaginationState } from "@tanstack/react-table";
import {
	CheckCircle,
	ClipboardList,
	MoreHorizontal,
	XCircle,
} from "lucide-react";
import * as React from "react";
import { useDeferredValue } from "react";
import { type Resolver, useForm } from "react-hook-form";
import { toast } from "sonner";
import {
	AdvancedDataTable,
	useAdvancedDataTable,
} from "@/components/advanced-data-table";
import { AlertModal } from "@/components/modal/alert-modal";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { DataTableColumnHeader } from "@/components/ui/table/data-table-column-header";
import { useAssetWriteAccess } from "@/hooks/use-asset-write-access";
import { getToastMessage } from "@/lib/errors";
import { trpc } from "@/lib/trpc";
import {
	type CompleteMaintenanceLogFormValues,
	completeMaintenanceLogFormSchema,
	getCompleteLogFormDefaults,
} from "./asset-maintenance-log.schema";
import {
	buildMaintenanceLogListInput,
	canCancelLog,
	canCompleteLog,
	formatDate,
	formatLogStatus,
	formatMaintenanceType,
	formatPeriodicity,
	getLogStatusVariant,
	getRelativeAge,
	LOG_PAGE_SIZE,
	toCompleteMaintenanceLogInput,
} from "./asset-maintenance-log.utils";

// Status badge colours map to Tailwind classes.
const STATUS_CLASS: Record<ReturnType<typeof getLogStatusVariant>, string> = {
	orange:
		"bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
	green: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	red: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
	gray: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400",
};

type LogRow = Omit<
	Asset.AssetMaintenanceLogListItem,
	"createdAt" | "updatedAt" | "taskDueDate" | "completionDate"
> & {
	createdAt: Date;
	updatedAt: Date;
	taskDueDate: Date | null;
	completionDate: Date | null;
};

type MaintenanceLogsChangedEvent = {
	type: "created" | "updated" | "deleted" | "log_completed";
	data: Asset.AssetMaintenanceRecord | { id: string };
};

// ──────────────────────────────────────────────────────────────────────────────
// Realtime subscription (isolated so it mounts only when the socket is ready)
// ──────────────────────────────────────────────────────────────────────────────

function MaintenanceLogsRealtimeSubscription({
	onData,
}: {
	onData: (event: MaintenanceLogsChangedEvent) => void;
}) {
	trpc.asset.onAssetMaintenancesChanged.useSubscription(undefined, {
		onData,
	});
	return null;
}

// ──────────────────────────────────────────────────────────────────────────────
// Complete Log Dialog
// ──────────────────────────────────────────────────────────────────────────────

interface CompleteLogDialogProps {
	logId: string | null;
	logLabel: string;
	onClose: () => void;
	onSuccess: () => void;
}

function CompleteLogDialog({
	logId,
	logLabel,
	onClose,
	onSuccess,
}: CompleteLogDialogProps) {
	const form = useForm<CompleteMaintenanceLogFormValues>({
		resolver: zodResolver(
			completeMaintenanceLogFormSchema,
		) as Resolver<CompleteMaintenanceLogFormValues>,
		defaultValues: getCompleteLogFormDefaults(),
	});

	const completeMutation = trpc.asset.completeAssetMaintenanceLog.useMutation({
		onSuccess: () => {
			toast.success("Maintenance log marked as completed");
			form.reset(getCompleteLogFormDefaults());
			onSuccess();
		},
		onError: (err) => {
			toast.error(getToastMessage(err, "complete"));
		},
	});

	const hasCertificate = form.watch("hasCertificate");

	function handleSubmit(values: CompleteMaintenanceLogFormValues) {
		if (!logId) return;
		completeMutation.mutate(toCompleteMaintenanceLogInput(logId, values));
	}

	function handleClose() {
		form.reset(getCompleteLogFormDefaults());
		onClose();
	}

	return (
		<Dialog
			open={Boolean(logId)}
			onOpenChange={(open) => {
				if (!open) handleClose();
			}}
		>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Complete Maintenance Log</DialogTitle>
				</DialogHeader>
				<p className="text-sm text-muted-foreground -mt-2">{logLabel}</p>
				<form
					onSubmit={form.handleSubmit(handleSubmit)}
					className="flex flex-col gap-4 py-2"
				>
					<div className="flex flex-col gap-1.5">
						<Label htmlFor="completionDate">
							Completion Date <span className="text-destructive">*</span>
						</Label>
						<Input
							id="completionDate"
							type="date"
							{...form.register("completionDate")}
						/>
						{form.formState.errors.completionDate && (
							<p className="text-xs text-destructive">
								{form.formState.errors.completionDate.message}
							</p>
						)}
					</div>

					<div className="flex flex-col gap-1.5">
						<Label htmlFor="actionsPerformed">Actions Performed</Label>
						<textarea
							id="actionsPerformed"
							rows={3}
							className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
							placeholder="Describe the actions taken during this maintenance…"
							{...form.register("actionsPerformed")}
						/>
					</div>

					<div className="flex items-center gap-2">
						<Checkbox
							id="hasCertificate"
							checked={form.watch("hasCertificate")}
							onCheckedChange={(checked) =>
								form.setValue("hasCertificate", Boolean(checked))
							}
						/>
						<Label htmlFor="hasCertificate" className="cursor-pointer">
							Has Certificate
						</Label>
					</div>

					{hasCertificate && (
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="certificateAttachment">
								Certificate <span className="text-destructive">*</span>
							</Label>
							<Input
								id="certificateAttachment"
								type="text"
								placeholder="Certificate URL or file path"
								{...form.register("certificateAttachment")}
							/>
							{form.formState.errors.certificateAttachment && (
								<p className="text-xs text-destructive">
									{form.formState.errors.certificateAttachment.message}
								</p>
							)}
						</div>
					)}

					<DialogFooter className="pt-2">
						<Button
							type="button"
							variant="outline"
							onClick={handleClose}
							disabled={completeMutation.isPending}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={completeMutation.isPending}>
							{completeMutation.isPending ? "Saving…" : "Mark Complete"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

// ──────────────────────────────────────────────────────────────────────────────
// Main page component
// ──────────────────────────────────────────────────────────────────────────────

export default function AssetMaintenanceLogPage() {
	const utils = trpc.useUtils();
	const canWrite = useAssetWriteAccess();

	const [search, setSearch] = React.useState("");
	const [statusFilter, setStatusFilter] = React.useState<
		Asset.AssetMaintenanceLogStatus | "ALL"
	>("ALL");
	const [pagination, setPagination] = React.useState<PaginationState>({
		pageIndex: 0,
		pageSize: LOG_PAGE_SIZE,
	});
	const [tableResetKey, setTableResetKey] = React.useState(0);

	// Dialog / confirmation state
	const [logToComplete, setLogToComplete] = React.useState<{
		id: string;
		label: string;
	} | null>(null);
	const [logToCancel, setLogToCancel] = React.useState<string | null>(null);
	const [isCancelDialogOpen, setIsCancelDialogOpen] = React.useState(false);

	const deferredSearch = useDeferredValue(search);

	const resetToFirstPage = React.useCallback(() => {
		setPagination((prev) => ({ ...prev, pageIndex: 0 }));
	}, []);

	const queryInput = React.useMemo(
		() =>
			buildMaintenanceLogListInput({
				search: deferredSearch,
				status: statusFilter === "ALL" ? "" : statusFilter,
				pageIndex: pagination.pageIndex,
				pageSize: pagination.pageSize,
			}),
		[deferredSearch, statusFilter, pagination],
	);

	const {
		data,
		isLoading,
		error: queryError,
		refetch,
	} = trpc.asset.listAssetMaintenanceLogs.useQuery(queryInput, {
		refetchOnWindowFocus: false,
		retry: 2,
		staleTime: 30_000,
	});

	const rawItems = data?.items ?? [];

	const skeletonRowKeys = React.useMemo(
		() => Array.from({ length: 8 }, () => crypto.randomUUID()),
		[],
	);
	const totalCount = data?.totalCount ?? 0;

	const logs = React.useMemo<LogRow[]>(
		() =>
			rawItems.map((item) => ({
				...item,
				taskDueDate: item.taskDueDate ? new Date(item.taskDueDate) : null,
				completionDate: item.completionDate
					? new Date(item.completionDate)
					: null,
				createdAt: new Date(item.createdAt),
				updatedAt: new Date(item.updatedAt),
			})),
		[rawItems],
	);

	// Realtime invalidation
	const handleSubscriptionData = React.useCallback(
		(_event: MaintenanceLogsChangedEvent) => {
			void utils.asset.listAssetMaintenanceLogs.invalidate();
		},
		[utils],
	);

	const handleReload = React.useCallback(() => {
		void refetch();
		setTableResetKey((k) => k + 1);
	}, [refetch]);

	// Cancel mutation
	const cancelMutation = trpc.asset.cancelAssetMaintenanceLog.useMutation({
		onMutate: async (vars) => {
			await utils.asset.listAssetMaintenanceLogs.cancel();
			const previous = utils.asset.listAssetMaintenanceLogs.getData(queryInput);
			utils.asset.listAssetMaintenanceLogs.setData(queryInput, (old) => {
				if (!old) return old;
				return {
					...old,
					items: old.items.map((item) =>
						item.id === vars.logId
							? { ...item, maintenanceStatus: "CANCELLED" as const }
							: item,
					),
				};
			});
			return { previous };
		},
		onSuccess: () => {
			toast.success("Maintenance log cancelled");
			setIsCancelDialogOpen(false);
			setLogToCancel(null);
		},
		onError: (err, _vars, ctx) => {
			if (ctx?.previous) {
				utils.asset.listAssetMaintenanceLogs.setData(queryInput, ctx.previous);
			}
			toast.error(getToastMessage(err, "cancel"));
		},
		onSettled: () => {
			void utils.asset.listAssetMaintenanceLogs.invalidate(queryInput);
		},
	});

	const confirmCancel = React.useCallback(() => {
		if (logToCancel) {
			cancelMutation.mutate({ logId: logToCancel });
		}
	}, [logToCancel, cancelMutation]);

	const handleCancelLog = React.useCallback((id: string) => {
		setLogToCancel(id);
		setIsCancelDialogOpen(true);
	}, []);

	const handleCompleteLog = React.useCallback((id: string, label: string) => {
		setLogToComplete({ id, label });
	}, []);

	const pageCount = Math.max(1, Math.ceil(totalCount / pagination.pageSize));

	// ── Column definitions ──────────────────────────────────────────────────────

	const columns = React.useMemo<ColumnDef<LogRow, unknown>[]>(
		() => [
			{
				id: "select",
				header: ({ table }) => (
					<Checkbox
						checked={
							table.getIsAllPageRowsSelected()
								? true
								: table.getIsSomePageRowsSelected()
									? "indeterminate"
									: false
						}
						onCheckedChange={(value) =>
							table.toggleAllPageRowsSelected(Boolean(value))
						}
						aria-label="Select all"
					/>
				),
				cell: ({ row }) => (
					<Checkbox
						checked={row.getIsSelected()}
						onCheckedChange={(value) => row.toggleSelected(Boolean(value))}
						aria-label="Select row"
					/>
				),
				enableSorting: false,
				enableHiding: false,
				size: 40,
			},
			{
				accessorKey: "assetName",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Asset" />
				),
				cell: ({ row }) => (
					<span className="font-medium">{row.original.assetName}</span>
				),
			},
			{
				accessorKey: "maintenanceTask",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Task" />
				),
				cell: ({ row }) => <span>{row.original.maintenanceTask}</span>,
			},
			{
				accessorKey: "maintenanceType",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Type" />
				),
				cell: ({ row }) => (
					<span className="text-muted-foreground text-sm">
						{formatMaintenanceType(row.original.maintenanceType)}
					</span>
				),
			},
			{
				accessorKey: "periodicity",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Periodicity" />
				),
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{formatPeriodicity(row.original.periodicity)}
					</span>
				),
			},
			{
				accessorKey: "assignToName",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Assigned To" />
				),
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{row.original.assignToName ?? "—"}
					</span>
				),
			},
			{
				accessorKey: "maintenanceStatus",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Status" />
				),
				cell: ({ row }) => {
					const status = row.original.maintenanceStatus;
					const variant = getLogStatusVariant(status);
					return (
						<span
							className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[variant]}`}
						>
							{formatLogStatus(status)}
						</span>
					);
				},
			},
			{
				accessorKey: "taskDueDate",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Due Date" />
				),
				cell: ({ row }) => {
					const status = row.original.maintenanceStatus;
					if (status === "COMPLETED" || status === "CANCELLED")
						return <span className="text-muted-foreground">—</span>;
					return (
						<span className="text-sm">
							{formatDate(row.original.taskDueDate)}
						</span>
					);
				},
			},
			{
				accessorKey: "completionDate",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Completed On" />
				),
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{formatDate(row.original.completionDate)}
					</span>
				),
			},
			{
				accessorKey: "createdAt",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Age" />
				),
				cell: ({ row }) => (
					<span className="text-xs text-muted-foreground">
						{getRelativeAge(row.original.createdAt)}
					</span>
				),
			},
			{
				id: "actions",
				enableHiding: false,
				cell: ({ row }) => {
					if (!canWrite) return null;
					const log = row.original;
					const canComplete = canCompleteLog(log.maintenanceStatus);
					const canCancel = canCancelLog(log.maintenanceStatus);
					if (!canComplete && !canCancel) return null;

					return (
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									variant="ghost"
									className="h-8 w-8 p-0"
									aria-label={`Actions for ${log.maintenanceTask}`}
								>
									<MoreHorizontal className="h-4 w-4" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuLabel>Actions</DropdownMenuLabel>
								<DropdownMenuSeparator />
								{canComplete && (
									<DropdownMenuItem
										onClick={() =>
											handleCompleteLog(
												log.id,
												`${log.assetName} — ${log.maintenanceTask}`,
											)
										}
									>
										<CheckCircle className="mr-2 h-4 w-4 text-green-600" />
										Mark Complete
									</DropdownMenuItem>
								)}
								{canCancel && (
									<DropdownMenuItem
										onClick={() => handleCancelLog(log.id)}
										className="text-destructive focus:text-destructive"
									>
										<XCircle className="mr-2 h-4 w-4" />
										Cancel Log
									</DropdownMenuItem>
								)}
							</DropdownMenuContent>
						</DropdownMenu>
					);
				},
			},
		],
		[canWrite, handleCompleteLog, handleCancelLog],
	);

	return (
		<>
			{/* Background realtime subscription */}
			<MaintenanceLogsRealtimeSubscription onData={handleSubscriptionData} />

			{/* Cancel confirmation */}
			<AlertModal
				isOpen={isCancelDialogOpen}
				onClose={() => {
					setIsCancelDialogOpen(false);
					setLogToCancel(null);
				}}
				onConfirm={confirmCancel}
				loading={cancelMutation.isPending}
			/>

			{/* Complete log dialog — only mount when there's a log to complete */}
			{canWrite && logToComplete !== null && (
				<CompleteLogDialog
					logId={logToComplete?.id ?? null}
					logLabel={logToComplete?.label ?? ""}
					onClose={() => setLogToComplete(null)}
					onSuccess={() => {
						setLogToComplete(null);
						void utils.asset.listAssetMaintenanceLogs.invalidate(queryInput);
					}}
				/>
			)}

			<div className="flex flex-1 flex-col gap-6 p-4 md:px-6">
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-3xl font-bold tracking-tight">
							Asset Maintenance Log
						</h1>
						<p className="text-muted-foreground">
							Track and complete scheduled maintenance events for your assets
						</p>
					</div>
				</div>

				{/* Filters */}
				<div className="flex flex-wrap items-end gap-3">
					<div className="flex flex-col gap-1">
						<Label className="text-xs text-muted-foreground">Search</Label>
						<Input
							placeholder="Search assets or tasks…"
							value={search}
							onChange={(e) => {
								setSearch(e.target.value);
								resetToFirstPage();
							}}
							className="h-8 w-56"
						/>
					</div>

					<div className="flex flex-col gap-1">
						<Label className="text-xs text-muted-foreground">Status</Label>
						<Select
							value={statusFilter}
							onValueChange={(value) => {
								setStatusFilter(
									value as Asset.AssetMaintenanceLogStatus | "ALL",
								);
								resetToFirstPage();
							}}
						>
							<SelectTrigger className="h-8 w-36">
								<SelectValue placeholder="All statuses" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="ALL">All statuses</SelectItem>
								<SelectItem value="PLANNED">Planned</SelectItem>
								<SelectItem value="OVERDUE">Overdue</SelectItem>
								<SelectItem value="COMPLETED">Completed</SelectItem>
								<SelectItem value="CANCELLED">Cancelled</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</div>

				{isLoading && (
					<div className="flex flex-1 flex-col gap-4">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-4">
								<Skeleton className="h-4 w-48" />
								<Skeleton className="h-4 w-32" />
							</div>
							<div className="flex gap-2">
								<Skeleton className="h-10 w-24" />
								<Skeleton className="h-10 w-32" />
							</div>
						</div>
						<Skeleton className="h-10 w-full" />
						<div className="rounded-lg border bg-background">
							<div className="w-full overflow-auto">
								<table className="w-full">
									<thead className="bg-muted/95">
										<tr>
											<th className="p-3">
												<Skeleton className="h-4 w-4" />
											</th>
											<th className="p-3">
												<Skeleton className="h-4 w-16" />
											</th>
											<th className="p-3">
												<Skeleton className="h-4 w-24" />
											</th>
											<th className="p-3">
												<Skeleton className="h-4 w-16" />
											</th>
											<th className="p-3">
												<Skeleton className="h-4 w-20" />
											</th>
											<th className="p-3">
												<Skeleton className="h-4 w-24" />
											</th>
											<th className="p-3">
												<Skeleton className="h-4 w-16" />
											</th>
											<th className="p-3">
												<Skeleton className="h-4 w-16" />
											</th>
											<th className="p-3">
												<Skeleton className="h-4 w-20" />
											</th>
											<th className="p-3">
												<Skeleton className="h-4 w-8" />
											</th>
											<th className="p-3">
												<Skeleton className="h-4 w-8" />
											</th>
										</tr>
									</thead>
									<tbody>
										{skeletonRowKeys.map((key) => (
											<tr key={key} className="border-t">
												<td className="p-3">
													<Skeleton className="h-4 w-4" />
												</td>
												<td className="p-3">
													<Skeleton className="h-4 w-16" />
												</td>
												<td className="p-3">
													<Skeleton className="h-4 w-24" />
												</td>
												<td className="p-3">
													<Skeleton className="h-4 w-16" />
												</td>
												<td className="p-3">
													<Skeleton className="h-4 w-20" />
												</td>
												<td className="p-3">
													<Skeleton className="h-4 w-24" />
												</td>
												<td className="p-3">
													<Skeleton className="h-4 w-16" />
												</td>
												<td className="p-3">
													<Skeleton className="h-4 w-16" />
												</td>
												<td className="p-3">
													<Skeleton className="h-4 w-20" />
												</td>
												<td className="p-3">
													<Skeleton className="h-4 w-8" />
												</td>
												<td className="p-3">
													<Skeleton className="h-4 w-8" />
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</div>
						<div className="flex items-center justify-between">
							<Skeleton className="h-7 w-40" />
							<div className="flex items-center gap-4">
								<Skeleton className="h-7 w-24" />
								<Skeleton className="h-7 w-[4.5rem]" />
								<Skeleton className="h-7 w-20" />
								<div className="flex gap-2">
									<Skeleton className="size-7" />
									<Skeleton className="size-7" />
									<Skeleton className="size-7" />
								</div>
							</div>
						</div>
					</div>
				)}

				{queryError && !isLoading && (
					<ErrorState
						error={queryError}
						operation="load"
						title="Failed to load maintenance logs"
						onRetry={() =>
							void utils.asset.listAssetMaintenanceLogs.invalidate(queryInput)
						}
					/>
				)}

				{!isLoading && !queryError && (
					<MaintenanceLogTable
						key={tableResetKey}
						data={logs}
						columns={columns}
						pageCount={pageCount}
						totalCount={totalCount}
						onPaginationChange={setPagination}
						onReload={handleReload}
						search={search}
					/>
				)}
			</div>
		</>
	);
}

// ──────────────────────────────────────────────────────────────────────────────
// Table component
// ──────────────────────────────────────────────────────────────────────────────

function MaintenanceLogTable(props: {
	data: readonly LogRow[];
	columns: ColumnDef<LogRow, unknown>[];
	pageCount: number;
	totalCount: number;
	onPaginationChange: (pagination: PaginationState) => void;
	onReload: () => void | Promise<void>;
	search: string;
}) {
	const { table } = useAdvancedDataTable<LogRow>({
		data: props.data,
		columns: props.columns,
		pageCount: props.pageCount,
		initialPageSize: LOG_PAGE_SIZE,
		initialSorting: [],
		enableRowSelection: true,
		enableMultiRowSelection: true,
		enableGlobalFilter: false,
		onPaginationChange: props.onPaginationChange,
		onReload: props.onReload,
	});

	return (
		<AdvancedDataTable
			table={table}
			data={props.data}
			totalItems={props.totalCount}
			enableGlobalSearch={false}
			enableExport
			enableBulkActions
			enableVirtualization
			enableColumnResizing
			ariaLabel="Asset maintenance log table"
			emptyState={
				<div className="flex flex-col items-center gap-2 py-12">
					<ClipboardList className="h-10 w-10 text-muted-foreground/40" />
					<p className="text-sm text-muted-foreground">
						{props.search
							? "No logs match your filters"
							: "No maintenance logs yet — create a maintenance schedule to get started"}
					</p>
				</div>
			}
		/>
	);
}
