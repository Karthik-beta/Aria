/**
 * Quality Inspection Template form page — create and edit a single template.
 *
 * A template consists of a name and an ordered list of inspection parameters,
 * each with an acceptance criterion: numeric range, exact string value, or
 * a custom formula expression.
 *
 * Reads `?id=` from the URL to switch between create and edit modes.
 * Client component: uses hooks and browser APIs.
 */
"use client";

import { Inventory } from "@aria/types";
import { zodResolver } from "@hookform/resolvers/zod";
import {
	ArrowLeft,
	ChevronDown,
	ChevronUp,
	Loader2,
	Plus,
	Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { Suspense, useEffect, useRef } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";
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

// ── Local form schema ─────────────────────────────────────────────────────────
// Items use the update schema so they can carry an optional `id` for edit mode.
// The superRefine acceptance-criteria check is inherited from updateQiTemplateItemSchema.

const qiTemplateFormSchema = z.object({
	name: z
		.string()
		.min(1, "Template name is required")
		.max(255, "Template name must be at most 255 characters"),
	items: z
		.array(Inventory.updateQiTemplateItemSchema)
		.min(1, "At least one parameter is required"),
});

/** Form values — uses z.input (pre-defaults) to match zodResolver typing convention */
type TemplateFormValues = z.input<typeof qiTemplateFormSchema>;
type TemplateItemFormValues = TemplateFormValues["items"][number];

// ── Add / Edit Parameter Dialog ───────────────────────────────────────────────

interface ParameterDialogProps {
	open: boolean;
	onClose: () => void;
	onSubmit: (item: TemplateItemFormValues) => void;
	/** When editing, the index of the item being edited. */
	editingItem?: TemplateItemFormValues;
	/** IDs already in the template so we can exclude them from the list (unless editing). */
	usedParameterIds: string[];
}

function ParameterDialog({
	open,
	onClose,
	onSubmit,
	editingItem,
	usedParameterIds,
}: ParameterDialogProps) {
	const isEditing = Boolean(editingItem);

	const { data: parameters = [], isLoading: loadingParams } =
		trpc.inventory.listQiParameters.useQuery(undefined, {
			enabled: open,
			staleTime: 60_000,
		});

	const [parameterId, setParameterId] = React.useState(
		editingItem?.parameterId ?? "",
	);
	const [mode, setMode] = React.useState<"NUMERIC" | "VALUE" | "FORMULA">(
		() => {
			if (!editingItem) return "NUMERIC";
			if (editingItem.formulaBased) return "FORMULA";
			if (editingItem.numeric) return "NUMERIC";
			return "VALUE";
		},
	);
	const [value, setValue] = React.useState(editingItem?.value ?? "");
	const [minValue, setMinValue] = React.useState(
		editingItem?.minValue != null ? String(editingItem.minValue) : "",
	);
	const [maxValue, setMaxValue] = React.useState(
		editingItem?.maxValue != null ? String(editingItem.maxValue) : "",
	);
	const [formula, setFormula] = React.useState(
		editingItem?.acceptanceFormula ?? "",
	);
	const [paramError, setParamError] = React.useState("");
	const [criteriaError, setCriteriaError] = React.useState("");

	// Reset local state when the dialog opens/closes
	useEffect(() => {
		if (!open) return;
		setParameterId(editingItem?.parameterId ?? "");
		setMode(() => {
			if (!editingItem) return "NUMERIC";
			if (editingItem.formulaBased) return "FORMULA";
			if (editingItem.numeric) return "NUMERIC";
			return "VALUE";
		});
		setValue(editingItem?.value ?? "");
		setMinValue(
			editingItem?.minValue != null ? String(editingItem.minValue) : "",
		);
		setMaxValue(
			editingItem?.maxValue != null ? String(editingItem.maxValue) : "",
		);
		setFormula(editingItem?.acceptanceFormula ?? "");
		setParamError("");
		setCriteriaError("");
	}, [open, editingItem]);

	const availableParams = parameters.filter(
		(p) =>
			!usedParameterIds.includes(p.id) ||
			(isEditing && p.id === editingItem?.parameterId),
	);

	const [showNewParam, setShowNewParam] = React.useState(false);
	const [newParamName, setNewParamName] = React.useState("");
	const [newParamDesc, setNewParamDesc] = React.useState("");
	const utils = trpc.useUtils();
	const createParamMutation = trpc.inventory.createQiParameter.useMutation({
		onSuccess: (created) => {
			setParameterId(created.id);
			setShowNewParam(false);
			setNewParamName("");
			setNewParamDesc("");
			// Invalidate the parameters query so the new param appears
			void utils.inventory.listQiParameters.invalidate();
		},
		onError: (err) => setParamError(getToastMessage(err, "create parameter")),
	});

	function handleCreateParam() {
		if (!newParamName.trim()) {
			setParamError("Parameter name is required");
			return;
		}
		createParamMutation.mutate({
			parameter: newParamName.trim(),
			description: newParamDesc.trim() || null,
		});
	}

	function handleSubmit() {
		setParamError("");
		setCriteriaError("");

		if (!parameterId) {
			setParamError("Please select a parameter");
			return;
		}

		if (mode === "NUMERIC") {
			const min = minValue !== "" ? Number(minValue) : null;
			const max = maxValue !== "" ? Number(maxValue) : null;
			if (min == null && max == null) {
				setCriteriaError("Provide at least a min or max value");
				return;
			}
			onSubmit({
				id: editingItem?.id,
				parameterId,
				sortOrder: editingItem?.sortOrder ?? 0,
				numeric: true,
				formulaBased: false,
				value: null,
				minValue: min,
				maxValue: max,
				acceptanceFormula: null,
			});
		} else if (mode === "VALUE") {
			onSubmit({
				id: editingItem?.id,
				parameterId,
				sortOrder: editingItem?.sortOrder ?? 0,
				numeric: false,
				formulaBased: false,
				value: value.trim() || null,
				minValue: null,
				maxValue: null,
				acceptanceFormula: null,
			});
		} else {
			onSubmit({
				id: editingItem?.id,
				parameterId,
				sortOrder: editingItem?.sortOrder ?? 0,
				numeric: false,
				formulaBased: true,
				value: null,
				minValue: null,
				maxValue: null,
				acceptanceFormula: formula.trim() || null,
			});
		}
	}

	return (
		<Dialog
			open={open}
			onOpenChange={(v) => {
				if (!v) onClose();
			}}
		>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>
						{isEditing ? "Edit Parameter" : "Add Parameter"}
					</DialogTitle>
				</DialogHeader>

				<div className="space-y-4 py-2">
					{/* Parameter selection */}
					<div className="space-y-1.5">
						<Label htmlFor="param-select">Parameter *</Label>
						{!showNewParam ? (
							<div className="flex gap-2">
								<Select
									value={parameterId}
									onValueChange={(v) => {
										setParameterId(v);
										setParamError("");
									}}
									disabled={loadingParams}
								>
									<SelectTrigger id="param-select" className="flex-1">
										<SelectValue placeholder="Select a parameter…" />
									</SelectTrigger>
									<SelectContent>
										{availableParams.length === 0 && (
											<div className="px-3 py-2 text-sm text-muted-foreground">
												No parameters available
											</div>
										)}
										{availableParams.map((p) => (
											<SelectItem key={p.id} value={p.id}>
												{p.parameter}
												{p.groupName ? (
													<span className="ml-1 text-muted-foreground">
														({p.groupName})
													</span>
												) : null}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() => setShowNewParam(true)}
								>
									<Plus className="h-4 w-4" />
								</Button>
							</div>
						) : (
							<div className="space-y-2 rounded-md border p-3">
								<p className="text-sm font-medium">New parameter</p>
								<Input
									placeholder="Parameter name *"
									value={newParamName}
									onChange={(e) => setNewParamName(e.target.value)}
								/>
								<Textarea
									placeholder="Description (optional)"
									value={newParamDesc}
									onChange={(e) => setNewParamDesc(e.target.value)}
									rows={2}
									className="resize-none"
								/>
								<div className="flex gap-2">
									<Button
										type="button"
										size="sm"
										onClick={handleCreateParam}
										disabled={createParamMutation.isPending}
									>
										{createParamMutation.isPending && (
											<Loader2 className="mr-2 h-3 w-3 animate-spin" />
										)}
										Create
									</Button>
									<Button
										type="button"
										size="sm"
										variant="ghost"
										onClick={() => {
											setShowNewParam(false);
											setNewParamName("");
											setNewParamDesc("");
										}}
									>
										Cancel
									</Button>
								</div>
							</div>
						)}
						{paramError && (
							<p className="text-sm text-destructive">{paramError}</p>
						)}
					</div>

					{/* Acceptance mode */}
					<div className="space-y-1.5">
						<Label>Acceptance Criteria</Label>
						<Select
							value={mode}
							onValueChange={(v) =>
								setMode(v as "NUMERIC" | "VALUE" | "FORMULA")
							}
						>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="NUMERIC">Numeric Range</SelectItem>
								<SelectItem value="VALUE">Exact Value</SelectItem>
								<SelectItem value="FORMULA">Formula</SelectItem>
							</SelectContent>
						</Select>
					</div>

					{mode === "NUMERIC" && (
						<div className="grid grid-cols-2 gap-3">
							<div className="space-y-1.5">
								<Label htmlFor="min-value">Min Value</Label>
								<Input
									id="min-value"
									type="number"
									step="any"
									placeholder="e.g. 0"
									value={minValue}
									onChange={(e) => setMinValue(e.target.value)}
								/>
							</div>
							<div className="space-y-1.5">
								<Label htmlFor="max-value">Max Value</Label>
								<Input
									id="max-value"
									type="number"
									step="any"
									placeholder="e.g. 100"
									value={maxValue}
									onChange={(e) => setMaxValue(e.target.value)}
								/>
							</div>
						</div>
					)}

					{mode === "VALUE" && (
						<div className="space-y-1.5">
							<Label htmlFor="accept-value">Accepted Value</Label>
							<Input
								id="accept-value"
								placeholder="e.g. Pass, OK, Grade A"
								value={value}
								onChange={(e) => setValue(e.target.value)}
							/>
						</div>
					)}

					{mode === "FORMULA" && (
						<div className="space-y-1.5">
							<Label htmlFor="formula">Acceptance Formula</Label>
							<Textarea
								id="formula"
								placeholder="e.g. reading >= 90 and reading <= 110"
								value={formula}
								onChange={(e) => setFormula(e.target.value)}
								rows={3}
								className="font-mono resize-none"
							/>
							<p className="text-xs text-muted-foreground">
								Use{" "}
								<code className="rounded bg-muted px-1 text-xs">reading</code>{" "}
								as the variable representing the actual inspection reading.
							</p>
						</div>
					)}

					{criteriaError && (
						<p className="text-sm text-destructive">{criteriaError}</p>
					)}
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={onClose}>
						Cancel
					</Button>
					<Button onClick={handleSubmit}>{isEditing ? "Update" : "Add"}</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function QualityInspectionTemplateFormPage() {
	return (
		<Suspense
			fallback={
				<div className="flex min-h-screen items-center justify-center">
					<Loader2 className="h-8 w-8 animate-spin text-primary" />
				</div>
			}
		>
			<QualityInspectionTemplateFormContent />
		</Suspense>
	);
}

// ── Form content ──────────────────────────────────────────────────────────────

/**
 * QualityInspectionTemplateFormContent — form body for create / edit.
 *
 * In create mode no `?id=` query parameter is present. In edit mode
 * the template is loaded by id and the form is pre-populated.
 */
function QualityInspectionTemplateFormContent() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const id = searchParams.get("id");
	const isEditMode = Boolean(id);
	const hasHandledMissingRef = useRef(false);
	const utils = trpc.useUtils();

	const [dialogOpen, setDialogOpen] = React.useState(false);
	const [editingIndex, setEditingIndex] = React.useState<number | null>(null);

	const form = useForm<TemplateFormValues>({
		resolver: zodResolver(qiTemplateFormSchema),
		defaultValues: { name: "", items: [] },
	});

	const {
		fields: itemFields,
		append: appendItem,
		update: updateItem,
		remove: removeItem,
		move: moveItem,
	} = useFieldArray({ control: form.control, name: "items" });

	// ── Load existing template in edit mode ───────────────────────────────────

	const { data: template, isLoading: isFetchingTemplate } =
		trpc.inventory.getQiTemplateById.useQuery(
			{ id: id ?? "" },
			{ enabled: isEditMode, refetchOnWindowFocus: false },
		);

	useEffect(() => {
		if (!isEditMode || !template) return;
		form.reset({
			name: template.name,
			items: template.items.map((item) => ({
				id: item.id,
				parameterId: item.parameterId,
				sortOrder: item.sortOrder,
				numeric: item.numeric,
				formulaBased: item.formulaBased,
				value: item.value,
				minValue: item.minValue,
				maxValue: item.maxValue,
				acceptanceFormula: item.acceptanceFormula,
			})),
		});
	}, [form, isEditMode, template]);

	useEffect(() => {
		if (
			isEditMode &&
			!isFetchingTemplate &&
			!template &&
			!hasHandledMissingRef.current
		) {
			hasHandledMissingRef.current = true;
			toast.error("Template not found");
			router.replace("/inventory/inventory-tools/quality-inspection-template");
		}
	}, [isEditMode, isFetchingTemplate, template, router]);

	// ── Mutations ─────────────────────────────────────────────────────────────

	const createMutation = trpc.inventory.createQiTemplate.useMutation({
		onSuccess: (created) => {
			toast.success("Template created");
			void utils.inventory.listQiTemplates.invalidate();
			router.push(
				`/inventory/inventory-tools/quality-inspection-template/form?id=${created.id}`,
			);
		},
		onError: (err) => toast.error(getToastMessage(err, "create")),
	});

	const updateMutation = trpc.inventory.updateQiTemplate.useMutation({
		onSuccess: () => {
			toast.success("Template saved");
			void utils.inventory.listQiTemplates.invalidate();
			void utils.inventory.getQiTemplateById.invalidate({ id: id ?? "" });
		},
		onError: (err) => toast.error(getToastMessage(err, "save")),
	});

	// ── Submit ────────────────────────────────────────────────────────────────

	function onSubmit(values: TemplateFormValues) {
		if (isEditMode && id) {
			updateMutation.mutate({
				id,
				name: values.name,
				items: values.items.map((item, idx) => ({
					...item,
					sortOrder: idx,
				})),
			});
		} else {
			createMutation.mutate({
				name: values.name,
				items: values.items.map((item, idx) => ({
					...item,
					sortOrder: idx,
				})),
			});
		}
	}

	// ── Dialog handlers ───────────────────────────────────────────────────────

	function handleAddItem(item: TemplateItemFormValues) {
		if (editingIndex !== null) {
			updateItem(editingIndex, { ...item, sortOrder: editingIndex });
		} else {
			appendItem({ ...item, sortOrder: itemFields.length });
		}
		setDialogOpen(false);
		setEditingIndex(null);
	}

	function openEditDialog(index: number) {
		setEditingIndex(index);
		setDialogOpen(true);
	}

	const usedParameterIds = itemFields.map((f) => f.parameterId);

	const isPending = createMutation.isPending || updateMutation.isPending;

	if (isEditMode && isFetchingTemplate) {
		return (
			<div className="flex min-h-screen items-center justify-center">
				<Loader2 className="h-8 w-8 animate-spin text-primary" />
			</div>
		);
	}

	return (
		<div className="mx-auto max-w-3xl space-y-6 p-6">
			{/* Header */}
			<div className="flex items-center gap-3">
				<Link
					href="/inventory/inventory-tools/quality-inspection-template"
					className="text-muted-foreground hover:text-foreground transition-colors"
					aria-label="Back to templates"
				>
					<ArrowLeft className="h-5 w-5" />
				</Link>
				<h1 className="text-xl font-semibold">
					{isEditMode ? "Edit Template" : "New Template"}
				</h1>
			</div>

			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
				{/* Template name */}
				<div className="space-y-1.5">
					<Label htmlFor="template-name">Template Name *</Label>
					<Input
						id="template-name"
						placeholder="e.g. Incoming Raw Material Inspection"
						autoFocus={!isEditMode}
						{...form.register("name")}
						aria-invalid={Boolean(form.formState.errors.name)}
					/>
					{form.formState.errors.name && (
						<p className="text-sm text-destructive">
							{form.formState.errors.name.message}
						</p>
					)}
				</div>

				{/* Parameters table */}
				<div className="space-y-2">
					<div className="flex items-center justify-between">
						<Label>
							Inspection Parameters{" "}
							<span className="font-normal text-muted-foreground text-sm">
								({itemFields.length})
							</span>
						</Label>
						<Button
							type="button"
							size="sm"
							variant="outline"
							onClick={() => {
								setEditingIndex(null);
								setDialogOpen(true);
							}}
						>
							<Plus className="mr-1.5 h-4 w-4" />
							Add Parameter
						</Button>
					</div>

					{form.formState.errors.items?.root && (
						<p className="text-sm text-destructive">
							{form.formState.errors.items.root.message}
						</p>
					)}
					{/* Handle the case where items is required but empty (createQiTemplateSchema) */}
					{form.formState.errors.items?.message && (
						<p className="text-sm text-destructive">
							{form.formState.errors.items.message}
						</p>
					)}

					{itemFields.length === 0 ? (
						<div className="flex flex-col items-center justify-center rounded-md border border-dashed py-10 text-center">
							<p className="text-sm text-muted-foreground">
								No parameters added yet.
							</p>
							<Button
								type="button"
								variant="link"
								size="sm"
								className="mt-1"
								onClick={() => {
									setEditingIndex(null);
									setDialogOpen(true);
								}}
							>
								Add the first parameter
							</Button>
						</div>
					) : (
						<div className="rounded-md border">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead className="w-8" />
										<TableHead>Parameter</TableHead>
										<TableHead>Group</TableHead>
										<TableHead>Criteria</TableHead>
										<TableHead className="w-20" />
									</TableRow>
								</TableHeader>
								<TableBody>
									{itemFields.map((field, index) => {
										// Find parameter info from the loaded template items (edit mode)
										const templateItemInfo = template?.items.find(
											(ti) => ti.parameterId === field.parameterId,
										);
										const paramName =
											templateItemInfo?.parameterName ?? field.parameterId;
										const groupName =
											templateItemInfo?.parameterGroupName ?? null;

										return (
											<TableRow key={field.id}>
												{/* Sort order controls */}
												<TableCell className="w-8 py-1">
													<div className="flex flex-col gap-0.5">
														<button
															type="button"
															className="rounded p-0.5 hover:bg-muted disabled:opacity-30"
															disabled={index === 0}
															onClick={() => moveItem(index, index - 1)}
															aria-label="Move up"
														>
															<ChevronUp className="h-3 w-3" />
														</button>
														<button
															type="button"
															className="rounded p-0.5 hover:bg-muted disabled:opacity-30"
															disabled={index === itemFields.length - 1}
															onClick={() => moveItem(index, index + 1)}
															aria-label="Move down"
														>
															<ChevronDown className="h-3 w-3" />
														</button>
													</div>
												</TableCell>
												<TableCell className="font-medium">
													{paramName}
												</TableCell>
												<TableCell className="text-sm text-muted-foreground">
													{groupName ?? "—"}
												</TableCell>
												<TableCell className="text-sm text-muted-foreground">
													<AcceptanceCriteriaDisplay item={field} />
												</TableCell>
												<TableCell className="w-20">
													<div className="flex items-center gap-1">
														<Button
															type="button"
															variant="ghost"
															size="sm"
															className="h-7 w-7 p-0"
															onClick={() => openEditDialog(index)}
															aria-label="Edit"
														>
															<span className="sr-only">Edit</span>
															<svg
																xmlns="http://www.w3.org/2000/svg"
																width="14"
																height="14"
																viewBox="0 0 24 24"
																fill="none"
																stroke="currentColor"
																strokeWidth="2"
																strokeLinecap="round"
																strokeLinejoin="round"
																aria-hidden="true"
															>
																<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
																<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
															</svg>
														</Button>
														<Button
															type="button"
															variant="ghost"
															size="sm"
															className="h-7 w-7 p-0 text-destructive hover:text-destructive"
															onClick={() => removeItem(index)}
															aria-label="Remove"
														>
															<Trash2 className="h-3.5 w-3.5" />
														</Button>
													</div>
												</TableCell>
											</TableRow>
										);
									})}
								</TableBody>
							</Table>
						</div>
					)}
				</div>

				{/* Actions */}
				<div className="flex items-center justify-end gap-3 border-t pt-4">
					<Link
						href="/inventory/inventory-tools/quality-inspection-template"
						className="text-sm text-muted-foreground hover:text-foreground transition-colors"
					>
						Cancel
					</Link>
					<Button type="submit" disabled={isPending}>
						{isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
						{isEditMode ? "Save Changes" : "Create Template"}
					</Button>
				</div>
			</form>

			{/* Add / edit parameter dialog */}
			<ParameterDialog
				open={dialogOpen}
				onClose={() => {
					setDialogOpen(false);
					setEditingIndex(null);
				}}
				onSubmit={handleAddItem}
				editingItem={
					editingIndex !== null ? itemFields[editingIndex] : undefined
				}
				usedParameterIds={usedParameterIds}
			/>
		</div>
	);
}

// ── Display helper ─────────────────────────────────────────────────────────────

/**
 * AcceptanceCriteriaDisplay — compact inline display of acceptance criteria.
 * Pure display component; no side-effects.
 */
function AcceptanceCriteriaDisplay({ item }: { item: TemplateItemFormValues }) {
	if (item.formulaBased) {
		return (
			<span className="font-mono text-xs">
				{item.acceptanceFormula || <em>formula (empty)</em>}
			</span>
		);
	}
	if (item.numeric) {
		const parts: string[] = [];
		if (item.minValue != null) parts.push(`min: ${item.minValue}`);
		if (item.maxValue != null) parts.push(`max: ${item.maxValue}`);
		return <span>{parts.length > 0 ? parts.join(", ") : "—"}</span>;
	}
	return <span>{item.value || "—"}</span>;
}
