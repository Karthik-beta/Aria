/**
 * Asset Maintenance Form Page — create and edit asset maintenance schedules.
 *
 * Reads ?id= param to switch between create/edit modes.
 *
 * Business logic mirrors ERPNext Asset Maintenance:
 * - One AssetMaintenance record per asset (unique assetId constraint).
 * - At least one maintenance task is required.
 * - Each task has: task name, type, periodicity, start date, and optional
 *   end date, assignee, certificate requirement, and description.
 * - Next due dates are calculated automatically by the backend.
 *
 * Client component: uses hooks for form state and tRPC mutations.
 */
"use client";

import { Asset } from "@aria/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useTransition } from "react";
import {
	Controller,
	type Resolver,
	useFieldArray,
	useForm,
} from "react-hook-form";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { getToastMessage } from "@/lib/errors";
import { trpc } from "@/lib/trpc";
import {
	type AssetMaintenanceFormValues,
	assetMaintenanceFormSchema,
	getAssetMaintenanceFormDefaults,
} from "../asset-maintenance.schema";
import {
	toCreateAssetMaintenanceInput,
	toUpdateAssetMaintenanceInput,
} from "../asset-maintenance.utils";

export default function AssetMaintenanceFormPage() {
	return (
		<Suspense fallback={<AssetMaintenanceFormFallback />}>
			<AssetMaintenanceFormContent />
		</Suspense>
	);
}

function AssetMaintenanceFormFallback() {
	return (
		<div className="flex min-h-screen items-center justify-center">
			<Loader2 className="h-8 w-8 animate-spin text-primary" />
		</div>
	);
}

function AssetMaintenanceFormContent() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const id = searchParams.get("id");
	const isEditMode = Boolean(id);
	const [isPending, startTransition] = useTransition();
	const hasHandledMissingRef = useRef(false);
	const utils = trpc.useUtils();

	const form = useForm<AssetMaintenanceFormValues>({
		resolver: zodResolver(
			assetMaintenanceFormSchema,
		) as Resolver<AssetMaintenanceFormValues>,
		defaultValues: getAssetMaintenanceFormDefaults(),
	});

	const {
		fields: taskFields,
		append: appendTask,
		remove: removeTask,
	} = useFieldArray({ control: form.control, name: "tasks" });

	const { data: record, isLoading: isFetchingRecord } =
		trpc.asset.getAssetMaintenanceById.useQuery(
			{ id: id ?? "" },
			{ enabled: isEditMode },
		);

	// Hydrate form in edit mode
	useEffect(() => {
		if (!isEditMode || !record) return;
		if (form.formState.isDirty) return;

		form.reset({
			assetId: record.assetId,
			company: record.company,
			maintenanceTeamId: record.maintenanceTeamId,
			maintenanceManager: record.maintenanceManager ?? "",
			maintenanceManagerName: record.maintenanceManagerName ?? "",
			tasks: record.tasks.map((t) => ({
				id: t.id,
				maintenanceTask: t.maintenanceTask,
				maintenanceType: t.maintenanceType ?? undefined,
				maintenanceStatus: t.maintenanceStatus,
				startDate: new Date(t.startDate).toISOString().split("T")[0] ?? "",
				periodicity: t.periodicity,
				endDate: t.endDate
					? new Date(t.endDate).toISOString().split("T")[0]
					: null,
				certificateRequired: t.certificateRequired,
				assignTo: t.assignTo ?? null,
				assignToName: t.assignToName ?? null,
				description: t.description ?? null,
			})),
		});
	}, [form, isEditMode, record]);

	// Redirect to list if record not found
	useEffect(() => {
		if (
			isEditMode &&
			!isFetchingRecord &&
			!record &&
			!hasHandledMissingRef.current
		) {
			hasHandledMissingRef.current = true;
			toast.error("Asset maintenance record not found");
			startTransition(() => {
				router.push("/asset/asset-maintenance");
			});
		}
	}, [isEditMode, isFetchingRecord, record, router]);

	const createMutation = trpc.asset.createAssetMaintenance.useMutation({
		onSuccess: async (data) => {
			toast.success("Asset maintenance created successfully");
			await utils.asset.listAssetMaintenances.invalidate();
			startTransition(() => {
				router.push(`/asset/asset-maintenance/form?id=${data.id}`);
			});
		},
		onError: (error) => {
			toast.error(getToastMessage(error, "create"));
		},
	});

	const updateMutation = trpc.asset.updateAssetMaintenance.useMutation({
		onSuccess: async () => {
			toast.success("Asset maintenance updated successfully");
			await utils.asset.listAssetMaintenances.invalidate();
			if (id) {
				await utils.asset.getAssetMaintenanceById.invalidate({ id });
			}
			form.reset(form.getValues());
		},
		onError: (error) => {
			toast.error(getToastMessage(error, "update"));
		},
	});

	const onSubmit = (values: AssetMaintenanceFormValues) => {
		if (isEditMode && id) {
			const payload = toUpdateAssetMaintenanceInput(id, values);
			const parsed = Asset.updateAssetMaintenanceSchema.safeParse(payload);
			if (!parsed.success) {
				toast.error(parsed.error.issues[0]?.message ?? "Invalid form values");
				return;
			}
			updateMutation.mutate(parsed.data);
			return;
		}

		const payload = toCreateAssetMaintenanceInput(values);
		const parsed = Asset.createAssetMaintenanceSchema.safeParse(payload);
		if (!parsed.success) {
			toast.error(parsed.error.issues[0]?.message ?? "Invalid form values");
			return;
		}
		createMutation.mutate(parsed.data);
	};

	const isSubmitting =
		createMutation.isPending || updateMutation.isPending || isPending;
	const hasUnsavedChanges = form.formState.isDirty;

	if (isEditMode && isFetchingRecord) {
		return <AssetMaintenanceFormFallback />;
	}

	const title =
		isEditMode && record ? record.assetName : "New Asset Maintenance";

	return (
		<div className="flex min-h-screen flex-col bg-muted/20 px-4 py-4 md:px-6">
			<div className="mb-4 flex items-center justify-between">
				<div className="flex items-center gap-3">
					<h1 className="text-3xl font-bold tracking-tight">{title}</h1>
					{hasUnsavedChanges && (
						<Badge className="border-none bg-orange-100 text-orange-700 hover:bg-orange-100 dark:bg-orange-900 dark:text-orange-300">
							Not Saved
						</Badge>
					)}
				</div>
				<div className="flex items-center gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={() =>
							startTransition(() => router.push("/asset/asset-maintenance"))
						}
					>
						Back to List
					</Button>
					<Button
						onClick={form.handleSubmit(onSubmit)}
						disabled={isSubmitting}
						className="h-9 px-6"
					>
						{isSubmitting ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							"Save"
						)}
					</Button>
				</div>
			</div>

			<div className="space-y-4 overflow-hidden rounded-lg border bg-background shadow-sm">
				{/* ── Asset & Company ── */}
				<div className="border-b px-5 py-5">
					<h2 className="mb-4 text-lg font-semibold">Asset Information</h2>
					<div className="grid gap-6 md:grid-cols-2">
						<div className="space-y-2">
							<Label htmlFor="assetId">
								Asset ID <span className="text-destructive">*</span>
							</Label>
							<Input
								id="assetId"
								placeholder="Asset CUID"
								{...form.register("assetId")}
								disabled={isEditMode}
							/>
							{form.formState.errors.assetId && (
								<p className="text-xs text-destructive">
									{form.formState.errors.assetId.message}
								</p>
							)}
						</div>

						<div className="space-y-2">
							<Label htmlFor="company">
								Company <span className="text-destructive">*</span>
							</Label>
							<Input
								id="company"
								placeholder="Company name"
								{...form.register("company")}
							/>
							{form.formState.errors.company && (
								<p className="text-xs text-destructive">
									{form.formState.errors.company.message}
								</p>
							)}
						</div>
					</div>
				</div>

				{/* ── Maintenance Team ── */}
				<div className="border-b px-5 py-5">
					<h2 className="mb-4 text-lg font-semibold">Maintenance Team</h2>
					<div className="grid gap-6 md:grid-cols-2">
						<div className="space-y-2">
							<Label htmlFor="maintenanceTeamId">
								Maintenance Team ID <span className="text-destructive">*</span>
							</Label>
							<Input
								id="maintenanceTeamId"
								placeholder="Team CUID"
								{...form.register("maintenanceTeamId")}
							/>
							{form.formState.errors.maintenanceTeamId && (
								<p className="text-xs text-destructive">
									{form.formState.errors.maintenanceTeamId.message}
								</p>
							)}
						</div>

						<div className="space-y-2">
							<Label htmlFor="maintenanceManager">Maintenance Manager</Label>
							<Input
								id="maintenanceManager"
								placeholder="Email or username (optional)"
								{...form.register("maintenanceManager")}
							/>
							{form.formState.errors.maintenanceManager && (
								<p className="text-xs text-destructive">
									{form.formState.errors.maintenanceManager.message}
								</p>
							)}
						</div>

						<div className="space-y-2">
							<Label htmlFor="maintenanceManagerName">
								Manager Display Name
							</Label>
							<Input
								id="maintenanceManagerName"
								placeholder="Full name (optional)"
								{...form.register("maintenanceManagerName")}
							/>
							{form.formState.errors.maintenanceManagerName && (
								<p className="text-xs text-destructive">
									{form.formState.errors.maintenanceManagerName.message}
								</p>
							)}
						</div>
					</div>
				</div>

				{/* ── Maintenance Tasks ── */}
				<div className="px-5 py-5">
					<div className="mb-4 flex items-center justify-between">
						<div>
							<h2 className="text-lg font-semibold">
								Maintenance Tasks <span className="text-destructive">*</span>
							</h2>
							{form.formState.errors.tasks?.root && (
								<p className="text-xs text-destructive">
									{form.formState.errors.tasks.root.message}
								</p>
							)}
							{typeof form.formState.errors.tasks?.message === "string" && (
								<p className="text-xs text-destructive">
									{form.formState.errors.tasks.message}
								</p>
							)}
						</div>
					</div>

					<div className="overflow-x-auto rounded-md border">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead className="w-10" />
									<TableHead className="min-w-[160px]">
										Task Name <span className="text-destructive">*</span>
									</TableHead>
									<TableHead className="min-w-[140px]">Type</TableHead>
									<TableHead className="min-w-[140px]">
										Periodicity <span className="text-destructive">*</span>
									</TableHead>
									<TableHead className="min-w-[140px]">
										Start Date <span className="text-destructive">*</span>
									</TableHead>
									<TableHead className="min-w-[140px]">End Date</TableHead>
									<TableHead className="w-24 text-center">Cert?</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{taskFields.length === 0 && (
									<TableRow>
										<TableCell
											colSpan={7}
											className="py-8 text-center text-sm text-muted-foreground"
										>
											No tasks added. Click &ldquo;Add Task&rdquo; to get
											started.
										</TableCell>
									</TableRow>
								)}
								{taskFields.map((field, index) => (
									<TableRow key={field.id}>
										<TableCell>
											<Button
												type="button"
												variant="ghost"
												size="icon"
												className="h-7 w-7"
												onClick={() => removeTask(index)}
												aria-label={`Remove task ${index + 1}`}
											>
												<Trash2 className="h-4 w-4" />
											</Button>
										</TableCell>
										<TableCell>
											<Controller
												name={`tasks.${index}.maintenanceTask`}
												control={form.control}
												render={({ field: f }) => (
													<Input
														className="h-9"
														placeholder="Task name"
														value={f.value}
														onChange={f.onChange}
														onBlur={f.onBlur}
													/>
												)}
											/>
											{form.formState.errors.tasks?.[index]
												?.maintenanceTask && (
												<p className="mt-1 text-xs text-destructive">
													{
														form.formState.errors.tasks[index].maintenanceTask
															?.message
													}
												</p>
											)}
										</TableCell>
										<TableCell>
											<Controller
												name={`tasks.${index}.maintenanceType`}
												control={form.control}
												render={({ field: f }) => (
													<Select
														value={f.value ?? "__none"}
														onValueChange={(val) =>
															f.onChange(
																val === "__none"
																	? null
																	: (val as Asset.AssetMaintenanceTaskType),
															)
														}
													>
														<SelectTrigger className="h-9 w-full">
															<SelectValue placeholder="None" />
														</SelectTrigger>
														<SelectContent>
															<SelectItem value="__none">None</SelectItem>
															<SelectItem value="PREVENTIVE_MAINTENANCE">
																Preventive
															</SelectItem>
															<SelectItem value="CALIBRATION">
																Calibration
															</SelectItem>
														</SelectContent>
													</Select>
												)}
											/>
										</TableCell>
										<TableCell>
											<Controller
												name={`tasks.${index}.periodicity`}
												control={form.control}
												render={({ field: f }) => (
													<Select
														value={f.value}
														onValueChange={(
															val: Asset.AssetMaintenancePeriodicity,
														) => f.onChange(val)}
													>
														<SelectTrigger className="h-9 w-full">
															<SelectValue placeholder="Select…" />
														</SelectTrigger>
														<SelectContent>
															<SelectItem value="DAILY">Daily</SelectItem>
															<SelectItem value="WEEKLY">Weekly</SelectItem>
															<SelectItem value="MONTHLY">Monthly</SelectItem>
															<SelectItem value="QUARTERLY">
																Quarterly
															</SelectItem>
															<SelectItem value="HALF_YEARLY">
																Half-Yearly
															</SelectItem>
															<SelectItem value="YEARLY">Yearly</SelectItem>
															<SelectItem value="TWO_YEARLY">
																2-Yearly
															</SelectItem>
															<SelectItem value="THREE_YEARLY">
																3-Yearly
															</SelectItem>
														</SelectContent>
													</Select>
												)}
											/>
											{form.formState.errors.tasks?.[index]?.periodicity && (
												<p className="mt-1 text-xs text-destructive">
													{
														form.formState.errors.tasks[index].periodicity
															?.message
													}
												</p>
											)}
										</TableCell>
										<TableCell>
											<Controller
												name={`tasks.${index}.startDate`}
												control={form.control}
												render={({ field: f }) => (
													<Input
														type="date"
														className="h-9"
														value={f.value}
														onChange={f.onChange}
														onBlur={f.onBlur}
													/>
												)}
											/>
											{form.formState.errors.tasks?.[index]?.startDate && (
												<p className="mt-1 text-xs text-destructive">
													{
														form.formState.errors.tasks[index].startDate
															?.message
													}
												</p>
											)}
										</TableCell>
										<TableCell>
											<Controller
												name={`tasks.${index}.endDate`}
												control={form.control}
												render={({ field: f }) => (
													<Input
														type="date"
														className="h-9"
														value={f.value ?? ""}
														onChange={(e) => f.onChange(e.target.value || null)}
														onBlur={f.onBlur}
													/>
												)}
											/>
										</TableCell>
										<TableCell className="text-center">
											<Controller
												name={`tasks.${index}.certificateRequired`}
												control={form.control}
												render={({ field: f }) => (
													<Checkbox
														checked={f.value}
														onCheckedChange={f.onChange}
														aria-label={`Certificate required for task ${index + 1}`}
													/>
												)}
											/>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>

					<Button
						type="button"
						variant="outline"
						size="sm"
						className="mt-3"
						onClick={() =>
							appendTask({
								maintenanceTask: "",
								maintenanceType: null,
								maintenanceStatus: "PLANNED",
								startDate: "",
								periodicity: "MONTHLY",
								endDate: null,
								certificateRequired: false,
								assignTo: null,
								assignToName: null,
								description: null,
							})
						}
					>
						<Plus className="mr-2 h-4 w-4" />
						Add Task
					</Button>
				</div>
			</div>
		</div>
	);
}
