"use client";

import { Asset } from "@aria/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save, Send } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import {
	Suspense,
	useEffect,
	useMemo,
	useRef,
	useState,
	useTransition,
} from "react";
import { type Resolver, useForm } from "react-hook-form";
import { toast } from "sonner";
import { AlertModal } from "@/components/modal/alert-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { getToastMessage } from "@/lib/errors";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
	type AssetValueAdjustmentFormValues,
	assetValueAdjustmentFormSchema,
	getAssetValueAdjustmentFormDefaults,
} from "../value-adjustment.schema";
import {
	formatAdjustmentDirection,
	formatAdjustmentStatus,
	formatCurrency,
	formatDate,
	getAdjustmentStatusClassName,
	getDirectionClassName,
	toCreateAssetValueAdjustmentInput,
	toUpdateAssetValueAdjustmentInput,
} from "../value-adjustment.utils";

export default function AssetValueAdjustmentFormPage() {
	return (
		<Suspense fallback={<AssetValueAdjustmentFormFallback />}>
			<AssetValueAdjustmentFormContent />
		</Suspense>
	);
}

function AssetValueAdjustmentFormFallback() {
	return (
		<div className="flex min-h-screen items-center justify-center">
			<Loader2 className="h-8 w-8 animate-spin text-primary" />
		</div>
	);
}

function AssetValueAdjustmentFormContent() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const id = searchParams.get("id");
	const preselectedAssetId = searchParams.get("assetId");
	const isEditMode = Boolean(id);
	const [isPending, startTransition] = useTransition();
	const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
	const hasHandledMissingRef = useRef(false);
	const utils = trpc.useUtils();

	const form = useForm<AssetValueAdjustmentFormValues>({
		resolver: zodResolver(
			assetValueAdjustmentFormSchema,
		) as Resolver<AssetValueAdjustmentFormValues>,
		defaultValues: getAssetValueAdjustmentFormDefaults(preselectedAssetId),
	});

	const { data: record, isLoading: isFetchingRecord } =
		trpc.asset.getAssetValueAdjustmentById.useQuery(
			{ id: id ?? "" },
			{ enabled: isEditMode },
		);

	const { data: assetsData, isLoading: isFetchingAssets } =
		trpc.asset.listAssets.useQuery(
			{ take: 250 },
			{ refetchOnWindowFocus: false, staleTime: 30_000 },
		);

	useEffect(() => {
		if (!isEditMode || !record) return;
		if (form.formState.isDirty) return;

		form.reset({
			assetId: record.assetId,
			financeBookId: record.financeBookId ?? "",
			adjustmentDate:
				new Date(record.adjustmentDate).toISOString().split("T")[0] ?? "",
			newAssetValue: String(record.newAssetValue),
			differenceAccount: record.differenceAccount,
			costCenter: record.costCenter ?? "",
			notes: record.notes ?? "",
		});
	}, [form, isEditMode, record]);

	useEffect(() => {
		if (
			isEditMode &&
			!isFetchingRecord &&
			!record &&
			!hasHandledMissingRef.current
		) {
			hasHandledMissingRef.current = true;
			toast.error("Asset value adjustment not found");
			startTransition(() => {
				router.push("/asset/value-adjustments");
			});
		}
	}, [isEditMode, isFetchingRecord, record, router]);

	const watchedAssetId = form.watch("assetId");
	const watchedFinanceBookId = form.watch("financeBookId");
	const watchedAdjustmentDate = form.watch("adjustmentDate");
	const watchedNewAssetValue = form.watch("newAssetValue");
	const watchedDifferenceAccount = form.watch("differenceAccount");
	const numericNewAssetValue = Number(watchedNewAssetValue);
	const selectedAsset = useMemo(
		() =>
			assetsData?.items.find((asset) => asset.id === watchedAssetId) ??
			assetsData?.items.find((asset) => asset.id === record?.assetId) ??
			null,
		[assetsData?.items, record?.assetId, watchedAssetId],
	);
	const financeBookOptions = useMemo(
		() =>
			[...(selectedAsset?.financeBooks ?? [])].sort(
				(left, right) =>
					left.financeBookName.localeCompare(right.financeBookName) ||
					left.financeBookId.localeCompare(right.financeBookId),
			),
		[selectedAsset?.financeBooks],
	);

	useEffect(() => {
		if (
			!watchedFinanceBookId &&
			financeBookOptions.length === 1 &&
			financeBookOptions[0]
		) {
			form.setValue("financeBookId", financeBookOptions[0].financeBookId, {
				shouldDirty: false,
				shouldValidate: true,
			});
		}
	}, [financeBookOptions, form, watchedFinanceBookId]);

	const previewEnabled =
		!isEditMode || record?.status === "DRAFT"
			? Boolean(
					watchedAssetId &&
						(financeBookOptions.length <= 1 || watchedFinanceBookId) &&
						watchedAdjustmentDate &&
						watchedNewAssetValue &&
						!Number.isNaN(numericNewAssetValue),
				)
			: false;

	const { data: preview, error: previewError } =
		trpc.asset.previewAssetValueAdjustment.useQuery(
			{
				assetId: watchedAssetId || "",
				financeBookId: watchedFinanceBookId || null,
				adjustmentDate: new Date(watchedAdjustmentDate || new Date()),
				newAssetValue: Number.isNaN(numericNewAssetValue)
					? 0
					: numericNewAssetValue,
			},
			{
				enabled: previewEnabled,
				retry: 1,
				refetchOnWindowFocus: false,
			},
		);

	const assetOptions = useMemo(() => {
		const preservedId = record?.assetId ?? preselectedAssetId;
		return (assetsData?.items ?? []).filter((asset) => {
			if (asset.id === preservedId) return true;
			return !["DRAFT", "CANCELLED", "SOLD", "SCRAPPED"].includes(asset.status);
		});
	}, [assetsData?.items, preselectedAssetId, record?.assetId]);

	const isReadonly =
		record?.status === "SUBMITTED" || record?.status === "CANCELLED";
	const summary =
		preview ??
		(record
			? {
					assetId: record.assetId,
					assetSeries: record.assetSeries,
					assetName: record.assetName,
					assetCategoryName: record.assetCategoryName,
					company: record.company,
					financeBookId: record.financeBookId,
					financeBookName: record.financeBookName,
					assetFinanceBookId:
						record.depreciationSchedule?.assetFinanceBookId ?? null,
					adjustmentDate: record.adjustmentDate,
					currentAssetValue: record.currentAssetValue,
					newAssetValue: record.newAssetValue,
					differenceAmount: record.differenceAmount,
					direction: record.direction,
					fixedAssetAccount: record.fixedAssetAccount,
					resultingStatus: record.previousAssetStatus,
					resultingIsFullyDepreciated: record.previousIsFullyDepreciated,
					validationMessages: [],
					depreciationSchedule: null,
				}
			: null);

	const displayedSchedule = isReadonly
		? (record?.depreciationSchedule ?? null)
		: (preview?.depreciationSchedule ?? null);
	const displayedScheduleEntries = useMemo(
		() =>
			displayedSchedule?.entries.map((entry) => ({
				sequence: entry.sequence,
				scheduleDate: new Date(entry.scheduleDate),
				depreciationAmount: entry.depreciationAmount,
				accumulatedDepreciationAmount: entry.accumulatedDepreciationAmount,
				bookValueAfterDepreciation: entry.bookValueAfterDepreciation,
			})) ?? [],
		[displayedSchedule],
	);
	const displayedScheduleBaseValue =
		isReadonly && record?.depreciationSchedule
			? record.depreciationSchedule.baseAssetValue
			: summary?.newAssetValue;

	const previewJournalLines = summary
		? summary.direction === "INCREASE"
			? [
					{
						account: summary.fixedAssetAccount,
						debitAmount: Math.abs(summary.differenceAmount),
						creditAmount: 0,
					},
					{
						account: watchedDifferenceAccount.trim() || "Difference account",
						debitAmount: 0,
						creditAmount: Math.abs(summary.differenceAmount),
					},
				]
			: [
					{
						account: watchedDifferenceAccount.trim() || "Difference account",
						debitAmount: Math.abs(summary.differenceAmount),
						creditAmount: 0,
					},
					{
						account: summary.fixedAssetAccount,
						debitAmount: 0,
						creditAmount: Math.abs(summary.differenceAmount),
					},
				]
		: [];

	const createMutation = trpc.asset.createAssetValueAdjustment.useMutation();
	const updateMutation = trpc.asset.updateAssetValueAdjustment.useMutation();
	const submitMutation = trpc.asset.submitAssetValueAdjustment.useMutation();
	const cancelMutation = trpc.asset.cancelAssetValueAdjustment.useMutation();

	const saveAdjustment = async (mode: "save" | "submit") => {
		const values = form.getValues();
		if (financeBookOptions.length > 1 && !values.financeBookId) {
			form.setError("financeBookId", {
				type: "required",
				message: "Finance book is required for an asset with multiple books",
			});
			toast.error("Select the finance book to adjust");
			return;
		}

		if (isEditMode && id) {
			const payload = toUpdateAssetValueAdjustmentInput(id, values);
			const parsed = Asset.updateAssetValueAdjustmentSchema.safeParse(payload);
			if (!parsed.success) {
				toast.error(parsed.error.issues[0]?.message ?? "Invalid form values");
				return;
			}

			try {
				const updated = await updateMutation.mutateAsync(parsed.data);
				await Promise.all([
					utils.asset.listAssetValueAdjustments.invalidate(),
					utils.asset.getAssetValueAdjustmentById.invalidate({ id }),
					utils.asset.listAssets.invalidate(),
				]);
				form.reset(form.getValues());
				toast.success("Asset value adjustment saved successfully");

				if (mode === "submit") {
					await submitMutation.mutateAsync({ id: updated.id });
					await Promise.all([
						utils.asset.listAssetValueAdjustments.invalidate(),
						utils.asset.getAssetValueAdjustmentById.invalidate({
							id: updated.id,
						}),
						utils.asset.listAssets.invalidate(),
					]);
					toast.success("Asset value adjustment submitted successfully");
				}
			} catch (error) {
				toast.error(
					getToastMessage(error, mode === "submit" ? "submit" : "update"),
				);
			}
			return;
		}

		const payload = toCreateAssetValueAdjustmentInput(values);
		const parsed = Asset.createAssetValueAdjustmentSchema.safeParse(payload);
		if (!parsed.success) {
			toast.error(parsed.error.issues[0]?.message ?? "Invalid form values");
			return;
		}

		try {
			const created = await createMutation.mutateAsync(parsed.data);
			await Promise.all([
				utils.asset.listAssetValueAdjustments.invalidate(),
				utils.asset.listAssets.invalidate(),
			]);
			toast.success("Asset value adjustment created successfully");

			if (mode === "submit") {
				await submitMutation.mutateAsync({ id: created.id });
				await Promise.all([
					utils.asset.listAssetValueAdjustments.invalidate(),
					utils.asset.getAssetValueAdjustmentById.invalidate({
						id: created.id,
					}),
					utils.asset.listAssets.invalidate(),
				]);
				toast.success("Asset value adjustment submitted successfully");
			}

			startTransition(() => {
				router.push(`/asset/value-adjustments/form?id=${created.id}`);
			});
		} catch (error) {
			toast.error(
				getToastMessage(error, mode === "submit" ? "submit" : "create"),
			);
		}
	};

	const handleCancelAdjustment = async () => {
		if (!record) {
			return;
		}

		try {
			await cancelMutation.mutateAsync({ id: record.id });
			await Promise.all([
				utils.asset.listAssetValueAdjustments.invalidate(),
				utils.asset.getAssetValueAdjustmentById.invalidate({ id: record.id }),
				utils.asset.listAssets.invalidate(),
			]);
			toast.success("Asset value adjustment cancelled successfully");
			setIsCancelDialogOpen(false);
		} catch (error) {
			toast.error(getToastMessage(error, "cancel"));
		}
	};

	const isSaving =
		createMutation.isPending ||
		updateMutation.isPending ||
		submitMutation.isPending ||
		cancelMutation.isPending ||
		isPending;
	const hasUnsavedChanges = form.formState.isDirty;

	if (isEditMode && isFetchingRecord) {
		return <AssetValueAdjustmentFormFallback />;
	}

	return (
		<>
			<AlertModal
				isOpen={isCancelDialogOpen}
				onClose={() => setIsCancelDialogOpen(false)}
				onConfirm={handleCancelAdjustment}
				loading={cancelMutation.isPending}
			/>

			<div className="flex min-h-screen flex-col bg-muted/20 px-4 py-4 md:px-6">
				<div className="mb-4 flex flex-wrap items-center justify-between gap-3">
					<div className="flex items-center gap-3">
						<h1 className="text-3xl font-bold tracking-tight">
							{record?.series ?? "New Asset Value Adjustment"}
						</h1>
						{record?.status && (
							<Badge
								className={cn(
									"border-none hover:bg-current/10",
									getAdjustmentStatusClassName(record.status),
								)}
							>
								{formatAdjustmentStatus(record.status)}
							</Badge>
						)}
						{hasUnsavedChanges && !isReadonly && (
							<Badge className="border-none bg-orange-100 text-orange-700 hover:bg-orange-100">
								Not Saved
							</Badge>
						)}
					</div>
					<div className="flex flex-wrap items-center gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={() =>
								startTransition(() => router.push("/asset/value-adjustments"))
							}
						>
							Back to List
						</Button>
						{!isReadonly && (
							<>
								<Button
									variant="outline"
									onClick={() => void saveAdjustment("save")}
									disabled={isSaving}
								>
									{isSaving ? (
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									) : (
										<Save className="mr-2 h-4 w-4" />
									)}
									Save Draft
								</Button>
								<Button
									onClick={() => void saveAdjustment("submit")}
									disabled={isSaving}
								>
									{isSaving ? (
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									) : (
										<Send className="mr-2 h-4 w-4" />
									)}
									{isEditMode ? "Save & Submit" : "Create & Submit"}
								</Button>
							</>
						)}
						{record?.status === "SUBMITTED" && (
							<Button
								variant="destructive"
								onClick={() => setIsCancelDialogOpen(true)}
								disabled={isSaving}
							>
								Cancel Adjustment
							</Button>
						)}
					</div>
				</div>

				<div className="space-y-4">
					<Card>
						<CardHeader>
							<CardTitle>Adjustment Details</CardTitle>
						</CardHeader>
						<CardContent className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
							<div className="space-y-2">
								<Label htmlFor="assetId">
									Asset <span className="text-destructive">*</span>
								</Label>
								<Select
									value={form.watch("assetId") || undefined}
									onValueChange={(value) => {
										form.setValue("assetId", value, {
											shouldDirty: true,
											shouldValidate: true,
										});
										const selectedBooks =
											assetsData?.items.find((asset) => asset.id === value)
												?.financeBooks ?? [];
										form.setValue(
											"financeBookId",
											selectedBooks.length === 1 && selectedBooks[0]
												? selectedBooks[0].financeBookId
												: "",
											{
												shouldDirty: true,
												shouldValidate: true,
											},
										);
									}}
									disabled={isReadonly || isFetchingAssets}
								>
									<SelectTrigger id="assetId">
										<SelectValue placeholder="Select an asset" />
									</SelectTrigger>
									<SelectContent>
										{assetOptions.map((asset) => (
											<SelectItem key={asset.id} value={asset.id}>
												{asset.series} · {asset.assetName}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								{form.formState.errors.assetId && (
									<p className="text-xs text-destructive">
										{form.formState.errors.assetId.message}
									</p>
								)}
							</div>

							<div className="space-y-2">
								<Label htmlFor="financeBookId">
									Finance Book
									{financeBookOptions.length > 1 && (
										<span className="text-destructive"> *</span>
									)}
								</Label>
								<Select
									value={watchedFinanceBookId || undefined}
									onValueChange={(value) =>
										form.setValue("financeBookId", value, {
											shouldDirty: true,
											shouldValidate: true,
										})
									}
									disabled={
										isReadonly ||
										isFetchingAssets ||
										financeBookOptions.length === 0
									}
								>
									<SelectTrigger id="financeBookId">
										<SelectValue
											placeholder={
												financeBookOptions.length === 0
													? "No finance book"
													: "Select a finance book"
											}
										/>
									</SelectTrigger>
									<SelectContent>
										{financeBookOptions.map((book) => (
											<SelectItem
												key={book.financeBookId}
												value={book.financeBookId}
											>
												{book.financeBookName}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								{form.formState.errors.financeBookId && (
									<p className="text-xs text-destructive">
										{form.formState.errors.financeBookId.message}
									</p>
								)}
								{financeBookOptions.length > 1 &&
									!form.formState.errors.financeBookId && (
										<p className="text-xs text-muted-foreground">
											Only this book's carrying value and schedule will be
											revised.
										</p>
									)}
							</div>

							<div className="space-y-2">
								<Label htmlFor="adjustmentDate">
									Adjustment Date <span className="text-destructive">*</span>
								</Label>
								<Input
									id="adjustmentDate"
									type="date"
									{...form.register("adjustmentDate")}
									disabled={isReadonly}
								/>
								{form.formState.errors.adjustmentDate && (
									<p className="text-xs text-destructive">
										{form.formState.errors.adjustmentDate.message}
									</p>
								)}
							</div>

							<div className="space-y-2">
								<Label htmlFor="newAssetValue">
									New Asset Value <span className="text-destructive">*</span>
								</Label>
								<Input
									id="newAssetValue"
									type="number"
									step="0.01"
									placeholder="0.00"
									{...form.register("newAssetValue")}
									disabled={isReadonly}
								/>
								{form.formState.errors.newAssetValue && (
									<p className="text-xs text-destructive">
										{form.formState.errors.newAssetValue.message}
									</p>
								)}
							</div>

							<div className="space-y-2">
								<Label htmlFor="differenceAccount">
									Difference Account <span className="text-destructive">*</span>
								</Label>
								<Input
									id="differenceAccount"
									placeholder="Asset Revaluation Reserve"
									{...form.register("differenceAccount")}
									disabled={isReadonly}
								/>
								{form.formState.errors.differenceAccount && (
									<p className="text-xs text-destructive">
										{form.formState.errors.differenceAccount.message}
									</p>
								)}
							</div>

							<div className="space-y-2">
								<Label htmlFor="costCenter">Cost Center</Label>
								<Input
									id="costCenter"
									placeholder="Optional cost center"
									{...form.register("costCenter")}
									disabled={isReadonly}
								/>
							</div>

							<div className="space-y-2 xl:col-span-3">
								<Label htmlFor="notes">Notes</Label>
								<Textarea
									id="notes"
									rows={4}
									placeholder="Describe why the carrying value is changing"
									{...form.register("notes")}
									disabled={isReadonly}
								/>
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>Preview</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
								<PreviewStatCard
									label="Current Carrying Value"
									value={formatCurrency(summary?.currentAssetValue)}
									helper={
										selectedAsset?.assetName ??
										record?.assetName ??
										"Select an asset"
									}
								/>
								<PreviewStatCard
									label="Difference"
									value={formatCurrency(
										summary ? Math.abs(summary.differenceAmount) : undefined,
									)}
									helper={
										summary ? formatAdjustmentDirection(summary.direction) : "-"
									}
								/>
								<PreviewStatCard
									label="Company"
									value={summary?.company ?? selectedAsset?.company ?? "-"}
									helper={
										summary?.assetCategoryName ??
										record?.assetCategoryName ??
										"-"
									}
								/>
								<PreviewStatCard
									label="Finance Book"
									value={
										summary?.financeBookName ??
										(financeBookOptions.length === 0
											? "Not applicable"
											: "Select a book")
									}
									helper="Targeted schedule only"
								/>
								<PreviewStatCard
									label="Fixed Asset Account"
									value={summary?.fixedAssetAccount ?? "-"}
									helper={
										summary
											? `Resulting status: ${summary.resultingStatus}`
											: "-"
									}
								/>
							</div>

							{previewError && !isReadonly && (
								<div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
									{getToastMessage(previewError, "preview")}
								</div>
							)}

							{summary?.validationMessages?.length ? (
								<div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
									<ul className="space-y-1">
										{summary.validationMessages.map((message) => (
											<li key={message}>{message}</li>
										))}
									</ul>
								</div>
							) : null}

							{summary && (
								<div className="rounded-lg border bg-muted/30 p-4">
									<div className="mb-3 flex flex-wrap items-center gap-2">
										<span className="text-sm font-medium">Direction</span>
										<span
											className={cn(
												"inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
												getDirectionClassName(summary.direction),
											)}
										>
											{formatAdjustmentDirection(summary.direction)}
										</span>
										{record?.status && (
											<span
												className={cn(
													"inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
													getAdjustmentStatusClassName(record.status),
												)}
											>
												{formatAdjustmentStatus(record.status)}
											</span>
										)}
									</div>

									<div className="grid gap-6 lg:grid-cols-2">
										<div className="space-y-3">
											<h3 className="text-sm font-semibold">
												Revaluation Entry
											</h3>
											{record?.revaluationEntry ? (
												<div className="rounded-lg border bg-background p-3">
													<div className="mb-3 flex flex-wrap gap-4 text-sm">
														<div>
															<p className="text-muted-foreground">Series</p>
															<p className="font-medium">
																{record.revaluationEntry.series}
															</p>
														</div>
														<div>
															<p className="text-muted-foreground">
																Posting Date
															</p>
															<p className="font-medium">
																{formatDate(
																	record.revaluationEntry.postingDate,
																)}
															</p>
														</div>
														<div>
															<p className="text-muted-foreground">Status</p>
															<p className="font-medium">
																{record.revaluationEntry.status}
															</p>
														</div>
													</div>
													<Table>
														<TableHeader>
															<TableRow>
																<TableHead>Account</TableHead>
																<TableHead className="text-right">
																	Debit
																</TableHead>
																<TableHead className="text-right">
																	Credit
																</TableHead>
															</TableRow>
														</TableHeader>
														<TableBody>
															{record.revaluationEntry.lines.map((line) => (
																<TableRow key={line.id}>
																	<TableCell>{line.account}</TableCell>
																	<TableCell className="text-right">
																		{formatCurrency(line.debitAmount)}
																	</TableCell>
																	<TableCell className="text-right">
																		{formatCurrency(line.creditAmount)}
																	</TableCell>
																</TableRow>
															))}
														</TableBody>
													</Table>
												</div>
											) : (
												<div className="rounded-lg border bg-background p-3">
													<Table>
														<TableHeader>
															<TableRow>
																<TableHead>Account</TableHead>
																<TableHead className="text-right">
																	Debit
																</TableHead>
																<TableHead className="text-right">
																	Credit
																</TableHead>
															</TableRow>
														</TableHeader>
														<TableBody>
															{previewJournalLines.map((line) => (
																<TableRow
																	key={`${line.account}-${line.debitAmount}-${line.creditAmount}`}
																>
																	<TableCell>{line.account}</TableCell>
																	<TableCell className="text-right">
																		{formatCurrency(line.debitAmount)}
																	</TableCell>
																	<TableCell className="text-right">
																		{formatCurrency(line.creditAmount)}
																	</TableCell>
																</TableRow>
															))}
														</TableBody>
													</Table>
												</div>
											)}
										</div>

										<div className="space-y-3">
											<h3 className="text-sm font-semibold">
												Depreciation Schedule
												{summary?.financeBookName
													? ` · ${summary.financeBookName}`
													: ""}
											</h3>
											{displayedSchedule ? (
												<div className="rounded-lg border bg-background">
													<div className="grid gap-4 border-b p-3 text-sm md:grid-cols-2">
														<div>
															<p className="text-muted-foreground">Method</p>
															<p className="font-medium">
																{displayedSchedule.depreciationMethod ?? "-"}
															</p>
														</div>
														<div>
															<p className="text-muted-foreground">Frequency</p>
															<p className="font-medium">
																Every{" "}
																{displayedSchedule.frequencyOfDepreciation}{" "}
																month(s)
															</p>
														</div>
														<div>
															<p className="text-muted-foreground">
																Remaining Periods
															</p>
															<p className="font-medium">
																{displayedSchedule.remainingDepreciations}
															</p>
														</div>
														<div>
															<p className="text-muted-foreground">
																Base Value
															</p>
															<p className="font-medium">
																{formatCurrency(displayedScheduleBaseValue)}
															</p>
														</div>
													</div>
													<ScrollArea className="max-h-[320px]">
														<Table>
															<TableHeader>
																<TableRow>
																	<TableHead>#</TableHead>
																	<TableHead>Date</TableHead>
																	<TableHead className="text-right">
																		Amount
																	</TableHead>
																	<TableHead className="text-right">
																		Accumulated
																	</TableHead>
																	<TableHead className="text-right">
																		Book Value
																	</TableHead>
																</TableRow>
															</TableHeader>
															<TableBody>
																{displayedScheduleEntries.map((entry) => (
																	<TableRow
																		key={`entry-${entry.sequence}-${entry.scheduleDate.toString()}`}
																	>
																		<TableCell>{entry.sequence}</TableCell>
																		<TableCell>
																			{formatDate(entry.scheduleDate)}
																		</TableCell>
																		<TableCell className="text-right">
																			{formatCurrency(entry.depreciationAmount)}
																		</TableCell>
																		<TableCell className="text-right">
																			{formatCurrency(
																				entry.accumulatedDepreciationAmount,
																			)}
																		</TableCell>
																		<TableCell className="text-right">
																			{formatCurrency(
																				entry.bookValueAfterDepreciation,
																			)}
																		</TableCell>
																	</TableRow>
																))}
															</TableBody>
														</Table>
													</ScrollArea>
												</div>
											) : (
												<div className="rounded-lg border bg-background p-3 text-sm text-muted-foreground">
													No depreciation schedule revision will be created for
													this adjustment.
												</div>
											)}
										</div>
									</div>
								</div>
							)}
						</CardContent>
					</Card>
				</div>
			</div>
		</>
	);
}

function PreviewStatCard(props: {
	label: string;
	value: string;
	helper: string;
}) {
	return (
		<div className="rounded-lg border bg-background p-4">
			<p className="text-xs uppercase tracking-wide text-muted-foreground">
				{props.label}
			</p>
			<p className="mt-2 text-xl font-semibold text-foreground">
				{props.value}
			</p>
			<p className="mt-1 text-xs text-muted-foreground">{props.helper}</p>
		</div>
	);
}
