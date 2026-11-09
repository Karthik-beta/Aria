"use client";

import { Inventory } from "@aria/types";
import { ChevronDown, Loader2, Plus } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { getToastMessage } from "@/lib/errors";
import { trpc } from "@/lib/trpc";

type QuickCreateItemValues = {
	code: string;
	itemGroupId?: string;
	defaultUnitOfMeasureId?: string;
	maintainStock: boolean;
	isFixedAsset: boolean;
};

/**
 * NewItemDialog renders the inventory item quick-create modal from the catalogue list.
 *
 * Client component: uses tRPC queries, react-hook-form, and a compact dialog to capture the
 * common item fields before handing users off to the full item form when they need it.
 */
export function NewItemDialog() {
	const utils = trpc.useUtils();
	const [isOpen, setIsOpen] = React.useState(false);
	const [itemGroupOpen, setItemGroupOpen] = React.useState(false);
	const [unitOfMeasureOpen, setUnitOfMeasureOpen] = React.useState(false);

	const { data: itemGroups = [] } = trpc.inventory.listItemGroups.useQuery(
		{ search: "" },
		{ staleTime: 30_000 },
	);
	const { data: unitsOfMeasure = [] } =
		trpc.inventory.listUnitsOfMeasure.useQuery(
			{ search: "" },
			{ staleTime: 30_000 },
		);

	const quickForm = useForm<QuickCreateItemValues>({
		defaultValues: {
			code: "",
			itemGroupId: undefined,
			defaultUnitOfMeasureId: undefined,
			maintainStock: true,
			isFixedAsset: false,
		},
	});

	const preferredUnitOfMeasureId = React.useMemo(
		() =>
			unitsOfMeasure.find((unit) => unit.name === "Nos")?.id ??
			unitsOfMeasure[0]?.id,
		[unitsOfMeasure],
	);

	const resetQuickForm = React.useCallback(() => {
		quickForm.reset({
			code: "",
			itemGroupId: undefined,
			defaultUnitOfMeasureId: undefined,
			maintainStock: true,
			isFixedAsset: false,
		});
	}, [quickForm]);

	const closeDialog = React.useCallback(() => {
		setIsOpen(false);
		setItemGroupOpen(false);
		setUnitOfMeasureOpen(false);
		resetQuickForm();
	}, [resetQuickForm]);

	React.useEffect(() => {
		if (!isOpen || !preferredUnitOfMeasureId) {
			return;
		}

		if (quickForm.getValues("defaultUnitOfMeasureId")) {
			return;
		}

		quickForm.setValue("defaultUnitOfMeasureId", preferredUnitOfMeasureId, {
			shouldDirty: false,
		});
	}, [isOpen, preferredUnitOfMeasureId, quickForm]);

	const quickCode = quickForm.watch("code");
	const selectedItemGroupId = quickForm.watch("itemGroupId");
	const selectedUnitOfMeasureId = quickForm.watch("defaultUnitOfMeasureId");
	const maintainStock = quickForm.watch("maintainStock");
	const isFixedAsset = quickForm.watch("isFixedAsset");

	const selectedItemGroup = React.useMemo(
		() => itemGroups.find((itemGroup) => itemGroup.id === selectedItemGroupId),
		[itemGroups, selectedItemGroupId],
	);
	const selectedUnitOfMeasure = React.useMemo(
		() => unitsOfMeasure.find((unit) => unit.id === selectedUnitOfMeasureId),
		[unitsOfMeasure, selectedUnitOfMeasureId],
	);

	const editFullFormHref = React.useMemo(() => {
		const params = new URLSearchParams();
		const normalizedCode = quickCode.trim().toUpperCase();

		if (normalizedCode) {
			params.set("code", normalizedCode);
			params.set("name", normalizedCode);
		}

		if (selectedItemGroupId) {
			params.set("itemGroupId", selectedItemGroupId);
		}

		if (selectedUnitOfMeasureId) {
			params.set("defaultUnitOfMeasureId", selectedUnitOfMeasureId);
		}

		if (!maintainStock) {
			params.set("maintainStock", "false");
		}

		if (isFixedAsset) {
			params.set("isFixedAsset", "true");
		}

		const query = params.toString();
		return query
			? `/inventory/items-catalogue/item/form?${query}`
			: "/inventory/items-catalogue/item/form";
	}, [
		isFixedAsset,
		maintainStock,
		quickCode,
		selectedItemGroupId,
		selectedUnitOfMeasureId,
	]);

	const createMutation = trpc.inventory.createItem.useMutation({
		onSuccess: async () => {
			closeDialog();
			await utils.inventory.listItems.invalidate();
		},
		onError: (error) => {
			toast.error(getToastMessage(error, "create"));
		},
	});

	const submitQuickCreate = quickForm.handleSubmit((values) => {
		const normalizedCode = values.code.trim().toUpperCase();
		if (!normalizedCode) {
			toast.error("Item code is required");
			return;
		}

		const payload = {
			name: normalizedCode,
			code: normalizedCode,
			itemGroupId: values.itemGroupId || undefined,
			defaultUnitOfMeasureId: values.defaultUnitOfMeasureId || undefined,
			maintainStock: values.maintainStock ?? true,
			isFixedAsset: values.isFixedAsset ?? false,
		};

		const parsed = Inventory.createSchema.safeParse(payload);
		if (!parsed.success) {
			toast.error(parsed.error.issues[0]?.message ?? "Invalid form values");
			return;
		}

		createMutation.mutate(parsed.data);
	});

	return (
		<Dialog
			open={isOpen}
			onOpenChange={(open) => {
				if (open) {
					setIsOpen(true);
					return;
				}

				closeDialog();
			}}
		>
			<DialogTrigger asChild>
				<Button type="button" size="sm">
					<Plus className="mr-2 h-4 w-4" />
					Add Item
				</Button>
			</DialogTrigger>

			<DialogContent className="max-w-[575px] gap-0 overflow-hidden p-0">
				<DialogHeader className="border-b px-5 py-4">
					<DialogTitle>New Item</DialogTitle>
					<DialogDescription>
						Quickly create a new inventory item with the required fields.
					</DialogDescription>
				</DialogHeader>

				<form
					id="new-item-quick-create-form"
					onSubmit={submitQuickCreate}
					className="space-y-5 px-5 py-5"
				>
					<div className="space-y-2">
						<Label
							htmlFor="quick-item-code"
							className="text-xs font-medium text-gray-500"
						>
							Item Code <span className="text-destructive">*</span>
						</Label>
						<Input
							id="quick-item-code"
							autoFocus
							placeholder="Enter item code"
							className="h-10"
							{...quickForm.register("code")}
						/>
					</div>

					<div className="space-y-2">
						<Label className="text-xs font-medium text-gray-500">
							Item Group <span className="text-destructive">*</span>
						</Label>
						<Controller
							name="itemGroupId"
							control={quickForm.control}
							render={({ field }) => (
								<Popover open={itemGroupOpen} onOpenChange={setItemGroupOpen}>
									<PopoverTrigger asChild>
										<Button
											id="quick-item-group"
											type="button"
											variant="outline"
											aria-label={selectedItemGroup?.groupName ?? "Item Group"}
											className="h-10 w-full justify-between font-normal"
										>
											<span className="truncate">
												{selectedItemGroup?.groupName ?? ""}
											</span>
											<ChevronDown className="h-4 w-4 opacity-50" />
										</Button>
									</PopoverTrigger>
									<PopoverContent
										className="p-0 pointer-events-auto"
										style={{
											width: "var(--radix-popover-trigger-width)",
										}}
									>
										<Command>
											<CommandInput placeholder="Search item groups..." />
											<CommandList>
												<CommandEmpty>No results</CommandEmpty>
												<CommandGroup>
													{itemGroups.map((itemGroup) => (
														<CommandItem
															key={itemGroup.id}
															onSelect={() => {
																field.onChange(itemGroup.id);
																setItemGroupOpen(false);
															}}
														>
															{itemGroup.groupName}
														</CommandItem>
													))}
												</CommandGroup>
											</CommandList>
										</Command>
									</PopoverContent>
								</Popover>
							)}
						/>
					</div>

					<div className="space-y-2">
						<Label className="text-xs font-medium text-gray-500">
							Default Unit of Measure{" "}
							<span className="text-destructive">*</span>
						</Label>
						<Controller
							name="defaultUnitOfMeasureId"
							control={quickForm.control}
							render={({ field }) => (
								<Popover
									open={unitOfMeasureOpen}
									onOpenChange={setUnitOfMeasureOpen}
								>
									<PopoverTrigger asChild>
										<Button
											id="quick-unit-of-measure"
											type="button"
											variant="outline"
											aria-label={
												selectedUnitOfMeasure?.name ?? "Default Unit of Measure"
											}
											className="h-10 w-full justify-between font-normal"
										>
											<span className="truncate">
												{selectedUnitOfMeasure?.name ?? "Nos"}
											</span>
											<ChevronDown className="h-4 w-4 opacity-50" />
										</Button>
									</PopoverTrigger>
									<PopoverContent
										className="pointer-events-auto max-h-[min(24rem,calc(var(--radix-popover-content-available-height)-1rem))] overflow-hidden p-0"
										style={{
											width: "var(--radix-popover-trigger-width)",
										}}
									>
										<Command className="min-h-0">
											<CommandInput placeholder="Search units..." />
											<CommandList className="max-h-full min-h-0">
												<CommandEmpty>No results</CommandEmpty>
												<CommandGroup>
													{unitsOfMeasure.map((unit) => (
														<CommandItem
															key={unit.id}
															onSelect={() => {
																field.onChange(unit.id);
																setUnitOfMeasureOpen(false);
															}}
														>
															{unit.name}
														</CommandItem>
													))}
												</CommandGroup>
											</CommandList>
										</Command>
									</PopoverContent>
								</Popover>
							)}
						/>
					</div>

					<div className="flex items-center gap-2">
						<Checkbox
							id="quick-maintain-stock"
							checked={maintainStock}
							onCheckedChange={(checked) =>
								quickForm.setValue("maintainStock", Boolean(checked), {
									shouldDirty: true,
								})
							}
						/>
						<Label htmlFor="quick-maintain-stock">Maintain Stock</Label>
					</div>

					<div className="flex items-center gap-2">
						<Checkbox
							id="quick-is-fixed-asset"
							checked={isFixedAsset}
							onCheckedChange={(checked) =>
								quickForm.setValue("isFixedAsset", Boolean(checked), {
									shouldDirty: true,
								})
							}
						/>
						<Label htmlFor="quick-is-fixed-asset">Is Fixed Asset</Label>
					</div>
				</form>

				<DialogFooter className="flex items-center justify-between border-t px-5 py-4 sm:flex-row sm:justify-between">
					<Button asChild type="button" variant="secondary">
						<Link href={editFullFormHref}>Edit Full Form</Link>
					</Button>
					<Button
						type="submit"
						form="new-item-quick-create-form"
						disabled={createMutation.isPending}
					>
						{createMutation.isPending ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							"Save"
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
