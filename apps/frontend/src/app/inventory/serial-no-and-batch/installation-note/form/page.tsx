"use client";

import { Inventory } from "@aria/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import {
	Suspense,
	useEffect,
	useMemo,
	useRef,
	useState,
	useTransition,
} from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
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
import {
	getInstallationNoteFormDefaults,
	type InstallationNoteFormValues,
	installationNoteFormSchema,
} from "../installation-note.schema";
import {
	buildInstallationNoteFromDeliveryNote,
	formatInstallationNoteStatus,
	getInstallationNoteStatusBadgeClass,
	toInstallationNoteFormValues,
	toInstallationNoteMutationInput,
} from "../installation-note.utils";

function StatusBadge({ status }: { status: Inventory.InstallationNoteStatus }) {
	return (
		<span
			className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getInstallationNoteStatusBadgeClass(status)}`}
		>
			{formatInstallationNoteStatus(status)}
		</span>
	);
}

export default function InstallationNoteFormPage() {
	return (
		<Suspense fallback={<InstallationNoteFormFallback />}>
			<InstallationNoteFormContent />
		</Suspense>
	);
}

function InstallationNoteFormContent() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const id = searchParams.get("id");
	const isEditMode = Boolean(id);
	const [isPending, startTransition] = useTransition();
	const [isSourceDialogOpen, setIsSourceDialogOpen] = useState(false);
	const [sourceDeliveryNoteId, setSourceDeliveryNoteId] = useState("");
	const hasHandledMissingRef = useRef(false);
	const utils = trpc.useUtils();

	const form = useForm<InstallationNoteFormValues>({
		resolver: zodResolver(installationNoteFormSchema),
		defaultValues: getInstallationNoteFormDefaults(),
	});

	const { fields, append, remove, replace } = useFieldArray({
		control: form.control,
		name: "items",
	});

	const { data: installationNote, isLoading: isFetchingInstallationNote } =
		trpc.inventory.getInstallationNoteById.useQuery(
			{ id: id ?? "" },
			{ enabled: isEditMode },
		);

	const { data: rawItems = [] } = trpc.inventory.listItems.useQuery(undefined, {
		staleTime: 30_000,
	});
	const { data: deliveryNotes = [] } =
		trpc.inventory.listDeliveryNotes.useQuery(undefined, {
			staleTime: 30_000,
		});

	const selectedCompany = useWatch({ control: form.control, name: "company" });
	const selectedStatus = useWatch({ control: form.control, name: "status" });
	const watchedItems = useWatch({ control: form.control, name: "items" });

	const { data: availableSerialNos } = trpc.inventory.listSerialNos.useQuery(
		{
			take: 250,
			company: (selectedCompany ?? "").trim() || undefined,
			status: "AVAILABLE",
		},
		{ staleTime: 30_000 },
	);
	const { data: deliveredSerialNos } = trpc.inventory.listSerialNos.useQuery(
		{
			take: 250,
			company: (selectedCompany ?? "").trim() || undefined,
			status: "DELIVERED",
		},
		{
			staleTime: 30_000,
		},
	);
	const { data: sourceDeliverySerialNos } =
		trpc.inventory.listSerialNos.useQuery(
			{
				take: 250,
				status: "DELIVERED",
			},
			{
				staleTime: 30_000,
			},
		);

	const itemOptions = useMemo(
		() => rawItems.filter((item) => !item.disabled),
		[rawItems],
	);
	const serialOptions = useMemo(() => {
		const combined = [
			...(availableSerialNos?.items ?? []),
			...(deliveredSerialNos?.items ?? []),
		];
		const unique = new Map(combined.map((serial) => [serial.id, serial]));
		return [...unique.values()];
	}, [availableSerialNos?.items, deliveredSerialNos?.items]);

	useEffect(() => {
		if (!isEditMode || !installationNote) return;
		form.reset(toInstallationNoteFormValues(installationNote));
	}, [form, installationNote, isEditMode]);

	useEffect(() => {
		if (
			isEditMode &&
			!isFetchingInstallationNote &&
			!installationNote &&
			!hasHandledMissingRef.current
		) {
			hasHandledMissingRef.current = true;
			toast.error("Installation note not found");
			startTransition(() => {
				router.push("/inventory/serial-no-and-batch/installation-note");
			});
		}
	}, [installationNote, isEditMode, isFetchingInstallationNote, router]);

	const createMutation = trpc.inventory.createInstallationNote.useMutation({
		onSuccess: async () => {
			toast.success("Installation note created successfully");
			await Promise.all([
				utils.inventory.listInstallationNotes.invalidate(),
				utils.inventory.listSerialNos.invalidate(),
			]);
			startTransition(() => {
				router.push("/inventory/serial-no-and-batch/installation-note");
			});
		},
		onError: (error) => {
			toast.error(getToastMessage(error, "create"));
		},
	});

	const updateMutation = trpc.inventory.updateInstallationNote.useMutation({
		onSuccess: async () => {
			toast.success("Installation note updated successfully");
			await Promise.all([
				utils.inventory.listInstallationNotes.invalidate(),
				utils.inventory.listSerialNos.invalidate(),
				id
					? utils.inventory.getInstallationNoteById.invalidate({ id })
					: Promise.resolve(),
			]);
			startTransition(() => {
				router.push("/inventory/serial-no-and-batch/installation-note");
			});
		},
		onError: (error) => {
			toast.error(getToastMessage(error, "update"));
		},
	});

	const onSubmit = (values: InstallationNoteFormValues) => {
		const payload = toInstallationNoteMutationInput(values);

		if (isEditMode && id) {
			const parsed = Inventory.updateInstallationNoteSchema.safeParse({
				id,
				...payload,
				items: values.items.map((item) => ({
					id: item.id,
					itemId: item.itemId,
					serialNoId: item.serialNoId || null,
					description: item.description?.trim() || null,
					installedQty: item.installedQty,
				})),
			});
			if (!parsed.success) {
				toast.error(parsed.error.issues[0]?.message ?? "Invalid form values");
				return;
			}
			updateMutation.mutate(parsed.data);
			return;
		}

		const parsed = Inventory.createInstallationNoteSchema.safeParse(payload);
		if (!parsed.success) {
			toast.error(parsed.error.issues[0]?.message ?? "Invalid form values");
			return;
		}
		createMutation.mutate(parsed.data);
	};

	const handleLoadFromDeliveryNote = () => {
		if (!sourceDeliveryNoteId) return;
		const deliveryNote = deliveryNotes.find(
			(note) => note.id === sourceDeliveryNoteId,
		);
		if (!deliveryNote) {
			toast.error("Selected delivery note could not be found");
			return;
		}

		const serials = (sourceDeliverySerialNos?.items ?? []).filter(
			(serial) => serial.deliveryNoteId === sourceDeliveryNoteId,
		);
		const mapped = buildInstallationNoteFromDeliveryNote({
			deliveryNote,
			serialNos: serials,
		});

		form.setValue("customer", mapped.customer, { shouldDirty: true });
		form.setValue("customerName", mapped.customerName, { shouldDirty: true });
		form.setValue("company", mapped.company, { shouldDirty: true });
		form.setValue("deliveryNoteId", mapped.deliveryNoteId, {
			shouldDirty: true,
		});
		replace(mapped.items);
		setIsSourceDialogOpen(false);
	};

	const isSubmitting =
		createMutation.isPending || updateMutation.isPending || isPending;

	if (isEditMode && isFetchingInstallationNote) {
		return <InstallationNoteFormFallback />;
	}

	const title =
		isEditMode && installationNote
			? installationNote.series
			: "New Installation Note";

	return (
		<div className="flex min-h-screen flex-col gap-4 bg-muted/30 px-4 py-4 md:px-6">
			<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
				<div className="flex items-center gap-3">
					<h1 className="text-3xl font-bold tracking-tight">{title}</h1>
					{form.formState.isDirty && (
						<Badge variant="secondary">Not Saved</Badge>
					)}
					<StatusBadge status={selectedStatus ?? "DRAFT"} />
				</div>
				<div className="flex items-center gap-2">
					<Button
						type="button"
						variant="outline"
						onClick={() => setIsSourceDialogOpen(true)}
						disabled={isEditMode}
					>
						From Delivery Note
					</Button>
					<Button onClick={form.handleSubmit(onSubmit)} disabled={isSubmitting}>
						{isSubmitting ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							"Save"
						)}
					</Button>
				</div>
			</div>

			<div className="rounded-xl border bg-background">
				<div className="border-b px-5 py-5">
					<h2 className="text-xl font-semibold">Installation Note</h2>
					<p className="text-sm text-muted-foreground">
						Record installation handoffs, customer context, and row-level serial
						deployments.
					</p>
				</div>

				<div className="grid gap-6 border-b px-5 py-5 md:grid-cols-2">
					<div className="space-y-2">
						<Label htmlFor="seriesPattern">Series</Label>
						<Input
							id="seriesPattern"
							{...form.register("seriesPattern")}
							readOnly={isEditMode}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="installationDate">
							Installation Date <span className="text-destructive">*</span>
						</Label>
						<Input
							id="installationDate"
							type="date"
							{...form.register("installationDate")}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="installationTime">Installation Time</Label>
						<Input
							id="installationTime"
							type="time"
							{...form.register("installationTime")}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="status">
							Status <span className="text-destructive">*</span>
						</Label>
						<Controller
							control={form.control}
							name="status"
							render={({ field }) => (
								<Select value={field.value} onValueChange={field.onChange}>
									<SelectTrigger id="status">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{Inventory.installationNoteStatusSchema.options.map(
											(status) => (
												<SelectItem key={status} value={status}>
													{formatInstallationNoteStatus(status)}
												</SelectItem>
											),
										)}
									</SelectContent>
								</Select>
							)}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="customer">
							Customer <span className="text-destructive">*</span>
						</Label>
						<Input id="customer" {...form.register("customer")} />
					</div>

					<div className="space-y-2">
						<Label htmlFor="customerName">Name</Label>
						<Input id="customerName" {...form.register("customerName")} />
					</div>

					<div className="space-y-2">
						<Label htmlFor="customerAddress">Customer Address</Label>
						<Input id="customerAddress" {...form.register("customerAddress")} />
					</div>

					<div className="space-y-2">
						<Label htmlFor="contactPerson">Contact Person</Label>
						<Input id="contactPerson" {...form.register("contactPerson")} />
					</div>

					<div className="space-y-2">
						<Label htmlFor="territory">
							Territory <span className="text-destructive">*</span>
						</Label>
						<Input id="territory" {...form.register("territory")} />
					</div>

					<div className="space-y-2">
						<Label htmlFor="customerGroup">Customer Group</Label>
						<Input id="customerGroup" {...form.register("customerGroup")} />
					</div>

					<div className="space-y-2">
						<Label htmlFor="company">
							Company <span className="text-destructive">*</span>
						</Label>
						<Input id="company" {...form.register("company")} />
					</div>

					<div className="space-y-2">
						<Label htmlFor="deliveryNoteId">Delivery Note</Label>
						<Controller
							control={form.control}
							name="deliveryNoteId"
							render={({ field }) => (
								<Select
									value={field.value || "__none"}
									onValueChange={(value) =>
										field.onChange(value === "__none" ? "" : value)
									}
								>
									<SelectTrigger id="deliveryNoteId">
										<SelectValue placeholder="Select delivery note" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="__none">Direct installation</SelectItem>
										{deliveryNotes.map((note) => (
											<SelectItem key={note.id} value={note.id}>
												{note.series}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							)}
						/>
					</div>

					<div className="space-y-2 md:col-span-2">
						<Label htmlFor="remarks">Remarks</Label>
						<Textarea id="remarks" rows={4} {...form.register("remarks")} />
					</div>
				</div>

				<div className="px-5 py-5">
					<div className="mb-4 flex items-center justify-between">
						<div>
							<h3 className="text-lg font-semibold">Items</h3>
							<p className="text-sm text-muted-foreground">
								Link installed items to their serial numbers where applicable.
							</p>
						</div>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() =>
								append({
									itemId: "",
									serialNoId: "",
									description: "",
									installedQty: 1,
								})
							}
						>
							<Plus className="mr-2 h-4 w-4" />
							Add Row
						</Button>
					</div>

					<div className="rounded-lg border">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Item</TableHead>
									<TableHead>Serial No</TableHead>
									<TableHead className="w-32">Installed Qty</TableHead>
									<TableHead>Description</TableHead>
									<TableHead className="w-16" />
								</TableRow>
							</TableHeader>
							<TableBody>
								{fields.map((field, index) => {
									const currentRow = watchedItems?.[index];
									const selectedItem = itemOptions.find(
										(item) => item.id === currentRow?.itemId,
									);
									const rowSerialOptions = serialOptions.filter(
										(serial) => serial.itemId === currentRow?.itemId,
									);

									return (
										<TableRow key={field.id}>
											<TableCell>
												<Controller
													control={form.control}
													name={`items.${index}.itemId`}
													render={({ field: itemField }) => (
														<Select
															value={itemField.value || "__none"}
															onValueChange={(value) => {
																itemField.onChange(
																	value === "__none" ? "" : value,
																);
																form.setValue(`items.${index}.serialNoId`, "", {
																	shouldDirty: true,
																});
																if (
																	itemOptions.find((item) => item.id === value)
																		?.hasSerialNo
																) {
																	form.setValue(
																		`items.${index}.installedQty`,
																		1,
																		{ shouldDirty: true },
																	);
																}
															}}
														>
															<SelectTrigger>
																<SelectValue placeholder="Select item" />
															</SelectTrigger>
															<SelectContent>
																<SelectItem value="__none">
																	Select item
																</SelectItem>
																{itemOptions.map((item) => (
																	<SelectItem key={item.id} value={item.id}>
																		{item.code}
																	</SelectItem>
																))}
															</SelectContent>
														</Select>
													)}
												/>
											</TableCell>
											<TableCell>
												<Controller
													control={form.control}
													name={`items.${index}.serialNoId`}
													render={({ field: serialField }) => (
														<Select
															value={serialField.value || "__none"}
															onValueChange={(value) => {
																serialField.onChange(
																	value === "__none" ? "" : value,
																);
																if (value !== "__none") {
																	form.setValue(
																		`items.${index}.installedQty`,
																		1,
																		{ shouldDirty: true },
																	);
																}
															}}
															disabled={!selectedItem?.hasSerialNo}
														>
															<SelectTrigger>
																<SelectValue
																	placeholder={
																		selectedItem?.hasSerialNo
																			? "Select serial no"
																			: "Not required"
																	}
																/>
															</SelectTrigger>
															<SelectContent>
																<SelectItem value="__none">
																	{selectedItem?.hasSerialNo
																		? "Select serial no"
																		: "Not required"}
																</SelectItem>
																{rowSerialOptions.map((serial) => (
																	<SelectItem key={serial.id} value={serial.id}>
																		{serial.serialNo}
																	</SelectItem>
																))}
															</SelectContent>
														</Select>
													)}
												/>
											</TableCell>
											<TableCell>
												<Controller
													control={form.control}
													name={`items.${index}.installedQty`}
													render={({ field: qtyField }) => (
														<Input
															type="number"
															min={0.0001}
															step="0.001"
															value={qtyField.value}
															onChange={(event) =>
																qtyField.onChange(
																	Number(event.target.value) || 0,
																)
															}
															disabled={Boolean(selectedItem?.hasSerialNo)}
														/>
													)}
												/>
											</TableCell>
											<TableCell>
												<Input
													{...form.register(`items.${index}.description`)}
													placeholder={
														selectedItem
															? `${selectedItem.name} installation notes`
															: "Description"
													}
												/>
											</TableCell>
											<TableCell>
												<Button
													type="button"
													variant="ghost"
													size="icon"
													onClick={() => remove(index)}
													disabled={fields.length === 1}
												>
													<Trash2 className="h-4 w-4" />
												</Button>
											</TableCell>
										</TableRow>
									);
								})}
							</TableBody>
						</Table>
					</div>
				</div>
			</div>

			<Dialog open={isSourceDialogOpen} onOpenChange={setIsSourceDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Load From Delivery Note</DialogTitle>
						<DialogDescription>
							Prefill customer details and delivered serials from an existing
							delivery note.
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-2">
						<Label htmlFor="source-delivery-note">Delivery Note</Label>
						<Select
							value={sourceDeliveryNoteId || "__none"}
							onValueChange={(value) =>
								setSourceDeliveryNoteId(value === "__none" ? "" : value)
							}
						>
							<SelectTrigger id="source-delivery-note">
								<SelectValue placeholder="Select delivery note" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="__none">Select delivery note</SelectItem>
								{deliveryNotes.map((note) => (
									<SelectItem key={note.id} value={note.id}>
										{note.series}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => setIsSourceDialogOpen(false)}
						>
							Cancel
						</Button>
						<Button
							type="button"
							onClick={handleLoadFromDeliveryNote}
							disabled={!sourceDeliveryNoteId}
						>
							Load Delivery Note
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

function InstallationNoteFormFallback() {
	return (
		<div className="flex min-h-screen items-center justify-center bg-muted/30">
			<div className="flex items-center gap-2 text-sm text-muted-foreground">
				<Loader2 className="h-4 w-4 animate-spin" />
				Loading installation note...
			</div>
		</div>
	);
}
