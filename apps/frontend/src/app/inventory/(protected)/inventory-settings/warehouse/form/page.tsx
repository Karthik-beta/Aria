"use client";

import { Inventory } from "@aria/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import {
	Suspense,
	useEffect,
	useMemo,
	useRef,
	useState,
	useTransition,
} from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { getToastMessage } from "@/lib/errors";
import { trpc } from "@/lib/trpc";
import {
	getWarehouseFormDefaults,
	type WarehouseFormValues,
	warehouseFormSchema,
} from "../warehouse.schema";
import { toWarehouseMutationInput } from "../warehouse.utils";

export default function WarehouseFormPage() {
	return (
		<Suspense fallback={<WarehouseFormFallback />}>
			<WarehouseFormContent />
		</Suspense>
	);
}

function WarehouseFormContent() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const id = searchParams.get("id");
	const isEditMode = Boolean(id);
	const [isPending, startTransition] = useTransition();
	const [contactOpen, setContactOpen] = useState(true);
	const [transitOpen, setTransitOpen] = useState(true);
	const hasHandledMissingWarehouseRef = useRef(false);
	const utils = trpc.useUtils();

	const form = useForm<WarehouseFormValues>({
		resolver: zodResolver(warehouseFormSchema),
		defaultValues: getWarehouseFormDefaults(),
	});

	const { data: warehouse, isLoading: isFetchingWarehouse } =
		trpc.inventory.getWarehouseById.useQuery(
			{ id: id ?? "" },
			{ enabled: isEditMode },
		);

	const { data: warehouseOptions } = trpc.inventory.listWarehouses.useQuery(
		{ take: 250 },
		{ refetchOnWindowFocus: false, retry: 2 },
	);

	const selectableWarehouses = useMemo(
		() =>
			(warehouseOptions?.items ?? []).filter(
				(entry) => entry.id !== warehouse?.id,
			),
		[warehouse?.id, warehouseOptions?.items],
	);

	const selectableParentWarehouses = useMemo(
		() => selectableWarehouses.filter((entry) => entry.isGroupWarehouse),
		[selectableWarehouses],
	);

	useEffect(() => {
		if (!isEditMode || !warehouse) return;
		if (form.formState.isDirty) return; // Don't overwrite user edits on refetch

		form.reset({
			name: warehouse.name,
			disabled: warehouse.disabled,
			isGroupWarehouse: warehouse.isGroupWarehouse,
			parentWarehouseId: warehouse.parentWarehouseId ?? "",
			company: warehouse.company,
			isRejectedWarehouse: warehouse.isRejectedWarehouse,
			phoneNo: warehouse.phoneNo ?? "",
			mobileNo: warehouse.mobileNo ?? "",
			addressLine1: warehouse.addressLine1 ?? "",
			addressLine2: warehouse.addressLine2 ?? "",
			city: warehouse.city ?? "",
			state: warehouse.state ?? "",
			pin: warehouse.pin ?? "",
			warehouseType: warehouse.warehouseType ?? "",
			defaultInTransitWarehouseId: warehouse.defaultInTransitWarehouseId ?? "",
		});
	}, [form, isEditMode, warehouse]);

	useEffect(() => {
		if (
			isEditMode &&
			!isFetchingWarehouse &&
			!warehouse &&
			!hasHandledMissingWarehouseRef.current
		) {
			hasHandledMissingWarehouseRef.current = true;
			toast.error("Warehouse not found");
			startTransition(() => {
				router.push("/inventory/inventory-settings/warehouse");
			});
		}
	}, [isEditMode, isFetchingWarehouse, router, warehouse]);

	const createMutation = trpc.inventory.createWarehouse.useMutation({
		onSuccess: async () => {
			toast.success("Warehouse created successfully");
			await utils.inventory.listWarehouses.invalidate();
			startTransition(() => {
				router.push("/inventory/inventory-settings/warehouse");
			});
		},
		onError: (error) => {
			toast.error(getToastMessage(error, "create"));
		},
	});

	const updateMutation = trpc.inventory.updateWarehouse.useMutation({
		onSuccess: async () => {
			toast.success("Warehouse updated successfully");
			await utils.inventory.listWarehouses.invalidate();
			if (id) {
				await utils.inventory.getWarehouseById.invalidate({ id });
			}
			startTransition(() => {
				router.push("/inventory/inventory-settings/warehouse");
			});
		},
		onError: (error) => {
			toast.error(getToastMessage(error, "update"));
		},
	});

	const disabled = useWatch({ control: form.control, name: "disabled" });
	const isGroupWarehouse = useWatch({
		control: form.control,
		name: "isGroupWarehouse",
	});
	const isRejectedWarehouse = useWatch({
		control: form.control,
		name: "isRejectedWarehouse",
	});
	const parentWarehouseId = useWatch({
		control: form.control,
		name: "parentWarehouseId",
	});
	const defaultInTransitWarehouseId = useWatch({
		control: form.control,
		name: "defaultInTransitWarehouseId",
	});

	const onSubmit = (values: WarehouseFormValues) => {
		const payload = toWarehouseMutationInput(values);

		if (isEditMode && id) {
			const parsedUpdate = Inventory.updateWarehouseSchema.safeParse({
				id,
				...payload,
			});

			if (!parsedUpdate.success) {
				toast.error(
					parsedUpdate.error.issues[0]?.message ?? "Invalid form values",
				);
				return;
			}

			updateMutation.mutate(parsedUpdate.data);
			return;
		}

		const parsedCreate = Inventory.createWarehouseSchema.safeParse(payload);
		if (!parsedCreate.success) {
			toast.error(
				parsedCreate.error.issues[0]?.message ?? "Invalid form values",
			);
			return;
		}

		createMutation.mutate(parsedCreate.data);
	};

	const isSubmitting =
		createMutation.isPending || updateMutation.isPending || isPending;
	const hasUnsavedChanges = form.formState.isDirty;

	if (isEditMode && isFetchingWarehouse) {
		return <WarehouseFormFallback />;
	}

	const title = isEditMode && warehouse ? warehouse.name : "New Warehouse";

	return (
		<div className="flex min-h-screen flex-col bg-[#f8f9fa] px-4 py-4 md:px-6">
			<div className="mb-4 flex items-center justify-between">
				<div className="flex items-center gap-3">
					<h1 className="text-3xl font-bold tracking-tight">{title}</h1>
					{hasUnsavedChanges && (
						<Badge className="border-none bg-[#fff3e0] text-[#fb8c00] hover:bg-[#fff3e0]">
							Not Saved
						</Badge>
					)}
				</div>
				<Button
					onClick={form.handleSubmit(onSubmit)}
					disabled={isSubmitting}
					className="h-9 px-6"
				>
					{isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
				</Button>
			</div>

			<div className="rounded-xl border bg-background">
				<div className="border-b px-5 py-5">
					<h2 className="text-xl font-semibold">Warehouse Detail</h2>
				</div>

				<div className="grid gap-6 border-b px-5 py-5 md:grid-cols-2">
					<div className="space-y-2 md:col-span-2">
						<Label htmlFor="name">
							Warehouse Name <span className="text-destructive">*</span>
						</Label>
						<Input
							id="name"
							placeholder="Enter warehouse name"
							{...form.register("name")}
						/>
						{form.formState.errors.name && (
							<p className="text-xs text-destructive">
								{form.formState.errors.name.message}
							</p>
						)}
					</div>

					<div className="space-y-4">
						<div className="flex items-center gap-2">
							<Checkbox
								id="isGroupWarehouse"
								checked={isGroupWarehouse}
								onCheckedChange={(checked) =>
									form.setValue("isGroupWarehouse", Boolean(checked), {
										shouldDirty: true,
									})
								}
							/>
							<Label htmlFor="isGroupWarehouse">Is Group Warehouse</Label>
						</div>

						<div className="space-y-2">
							<Label htmlFor="parentWarehouseId">Parent Warehouse</Label>
							<Select
								value={parentWarehouseId || "__none"}
								onValueChange={(value) =>
									form.setValue(
										"parentWarehouseId",
										value === "__none" ? "" : value,
										{ shouldDirty: true },
									)
								}
							>
								<SelectTrigger id="parentWarehouseId">
									<SelectValue placeholder="Select parent warehouse" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="__none">No parent warehouse</SelectItem>
									{selectableParentWarehouses.map((entry) => (
										<SelectItem key={entry.id} value={entry.id}>
											{entry.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<div className="flex items-start gap-2">
							<Checkbox
								id="isRejectedWarehouse"
								checked={isRejectedWarehouse}
								onCheckedChange={(checked) =>
									form.setValue("isRejectedWarehouse", Boolean(checked), {
										shouldDirty: true,
									})
								}
							/>
							<div className="space-y-1">
								<Label htmlFor="isRejectedWarehouse">
									Is Rejected Warehouse
								</Label>
								<p className="text-sm text-muted-foreground">
									Use this warehouse to store rejected materials.
								</p>
							</div>
						</div>

						<div className="flex items-center gap-2">
							<Checkbox
								id="disabled"
								checked={disabled}
								onCheckedChange={(checked) =>
									form.setValue("disabled", Boolean(checked), {
										shouldDirty: true,
									})
								}
							/>
							<Label htmlFor="disabled">Disabled</Label>
						</div>
					</div>

					<div className="space-y-4">
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

						<div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
							Warehouse status: {disabled ? "Disabled" : "Enabled"}
						</div>
					</div>
				</div>

				<Collapsible open={contactOpen} onOpenChange={setContactOpen}>
					<CollapsibleTrigger asChild>
						<button
							type="button"
							className="flex w-full items-center justify-between border-b px-5 py-4 text-left"
						>
							<span className="text-xl font-semibold">
								Warehouse Contact Info
							</span>
							{contactOpen ? (
								<ChevronUp className="h-4 w-4" />
							) : (
								<ChevronDown className="h-4 w-4" />
							)}
						</button>
					</CollapsibleTrigger>
					<CollapsibleContent className="px-5 py-5">
						<div className="grid gap-6 md:grid-cols-2">
							<div className="space-y-2">
								<Label htmlFor="phoneNo">Phone No</Label>
								<Input id="phoneNo" {...form.register("phoneNo")} />
							</div>
							<div className="space-y-2">
								<Label htmlFor="addressLine1">Address Line 1</Label>
								<Input id="addressLine1" {...form.register("addressLine1")} />
							</div>
							<div className="space-y-2">
								<Label htmlFor="mobileNo">Mobile No</Label>
								<Input id="mobileNo" {...form.register("mobileNo")} />
							</div>
							<div className="space-y-2">
								<Label htmlFor="addressLine2">Address Line 2</Label>
								<Input id="addressLine2" {...form.register("addressLine2")} />
							</div>
							<div className="space-y-2">
								<Label htmlFor="city">City</Label>
								<Input id="city" {...form.register("city")} />
							</div>
							<div className="space-y-2">
								<Label htmlFor="state">State</Label>
								<Input id="state" {...form.register("state")} />
							</div>
							<div className="space-y-2 md:col-span-2">
								<Label htmlFor="pin">PIN</Label>
								<Input id="pin" {...form.register("pin")} />
							</div>
						</div>
					</CollapsibleContent>
				</Collapsible>

				<Collapsible open={transitOpen} onOpenChange={setTransitOpen}>
					<CollapsibleTrigger asChild>
						<button
							type="button"
							className="flex w-full items-center justify-between px-5 py-4 text-left"
						>
							<span className="text-xl font-semibold">Transit</span>
							{transitOpen ? (
								<ChevronUp className="h-4 w-4" />
							) : (
								<ChevronDown className="h-4 w-4" />
							)}
						</button>
					</CollapsibleTrigger>
					<CollapsibleContent className="border-t px-5 py-5">
						<div className="grid gap-6 md:grid-cols-2">
							<div className="space-y-2">
								<Label htmlFor="warehouseType">Warehouse Type</Label>
								<Input id="warehouseType" {...form.register("warehouseType")} />
							</div>
							<div className="space-y-2">
								<Label htmlFor="defaultInTransitWarehouseId">
									Default In-Transit Warehouse
								</Label>
								<Select
									value={defaultInTransitWarehouseId || "__none"}
									onValueChange={(value) =>
										form.setValue(
											"defaultInTransitWarehouseId",
											value === "__none" ? "" : value,
											{ shouldDirty: true },
										)
									}
								>
									<SelectTrigger id="defaultInTransitWarehouseId">
										<SelectValue placeholder="Select in-transit warehouse" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="__none">
											No default in-transit warehouse
										</SelectItem>
										{selectableWarehouses.map((entry) => (
											<SelectItem key={entry.id} value={entry.id}>
												{entry.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</div>
					</CollapsibleContent>
				</Collapsible>
			</div>
		</div>
	);
}

function WarehouseFormFallback() {
	return (
		<div className="flex min-h-screen items-center justify-center">
			<Loader2 className="h-8 w-8 animate-spin text-primary" />
		</div>
	);
}
