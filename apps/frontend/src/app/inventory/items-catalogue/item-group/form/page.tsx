"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
	ChevronDown,
	List,
	Loader2,
	MoreHorizontal,
	Settings,
	Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, useTransition } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { getToastMessage } from "@/lib/errors";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

// Extend the base schema to include the UI-only 'taxes' field if needed,
// or just use the base schema if we were strictly following backend.
// Since the screenshot shows Taxes, we'll mock the schema for it to allow the form to render it,
// but we'll strip it before submission if the backend doesn't support it.
const taxSchema = z.object({
	itemTaxTemplate: z.string().min(1, "Required"),
	taxCategory: z.string().optional(),
	validFrom: z.string().optional(),
	minimumNetRate: z.number().optional(),
	maximumNetRate: z.number().optional(),
});

const formSchema = z.object({
	groupName: z.string().min(1, "Group name is required").max(255).trim(),
	parentId: z.string().cuid().nullable().optional(),
	isGroup: z.boolean(),
	defaults: z
		.array(
			z.object({
				company: z.string().min(1, "Company is required"),
				defaultWarehouse: z.string().nullable().optional(),
				defaultPriceList: z.string().nullable().optional(),
			}),
		)
		.optional(),
	taxes: z.array(taxSchema).optional(),
});

type FormInput = z.infer<typeof formSchema>;

export default function ItemGroupFormPage() {
	return (
		<Suspense fallback={<ItemGroupFormFallback />}>
			<ItemGroupFormContent />
		</Suspense>
	);
}

function ItemGroupFormContent() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const groupId = searchParams.get("id");
	const isEditMode = Boolean(groupId);
	const [isPending, startTransition] = useTransition();
	const [hasUnsavedChanges, setHasUnsavedChanges] = useState(!isEditMode);
	const [isInitialized, setIsInitialized] = useState(!isEditMode);

	// Combobox states
	const [parentGroupOpen, setParentGroupOpen] = useState(false);
	const [parentGroupSearch, _setParentGroupSearch] = useState("");

	const form = useForm<FormInput>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			groupName: "",
			parentId: null,
			isGroup: false,
			defaults: [],
			taxes: [],
		},
	});

	const {
		fields: defaultFields,
		append: appendDefault,
		remove: removeDefault,
	} = useFieldArray({
		control: form.control,
		name: "defaults",
	});

	const {
		fields: taxFields,
		append: appendTax,
		remove: removeTax,
	} = useFieldArray({
		control: form.control,
		name: "taxes",
	});

	// Watch for changes
	useEffect(() => {
		if (!isInitialized) return;
		const subscription = form.watch(() => setHasUnsavedChanges(true));
		return () => subscription.unsubscribe();
	}, [form, isInitialized]);

	// Fetch existing group if editing
	const { data: allGroups, isLoading: isFetchingGroup } =
		trpc.inventory.listItemGroups.useQuery(undefined, {
			enabled: isEditMode,
		});

	const itemGroup = allGroups?.find((g) => g.id === groupId);

	// Fetch potential parent groups
	const { data: itemGroups = [] } = trpc.inventory.listItemGroups.useQuery(
		{ search: parentGroupSearch },
		{ staleTime: 30000 },
	);

	// Initialize form with data
	useEffect(() => {
		if (isEditMode && itemGroup) {
			form.reset({
				groupName: itemGroup.groupName,
				parentId: itemGroup.parentId,
				isGroup: itemGroup.isGroup,
				defaults: itemGroup.defaults || [],
				taxes: [], // Backend doesn't seem to return taxes yet
			});
			setHasUnsavedChanges(false);
			setIsInitialized(true);
		}
	}, [itemGroup, isEditMode, form]);

	const utils = trpc.useUtils();

	const createMutation = trpc.inventory.createItemGroup.useMutation({
		onSuccess: async (data) => {
			toast.success("Item Group created successfully!");
			setHasUnsavedChanges(false);
			await utils.inventory.listItemGroups.invalidate();
			startTransition(() => {
				router.push(`/inventory/items-catalogue/item-group/form?id=${data.id}`);
			});
		},
		onError: (error) => toast.error(getToastMessage(error, "create")),
	});

	const updateMutation = trpc.inventory.updateItemGroup.useMutation({
		onSuccess: async (_data) => {
			toast.success("Item Group updated successfully!");
			setHasUnsavedChanges(false);
			await utils.inventory.listItemGroups.invalidate();
		},
		onError: (error) => toast.error(getToastMessage(error, "update")),
	});

	const onSubmit = (data: FormInput) => {
		// Strip taxes as it's not in the backend schema yet
		const { taxes, ...submissionData } = data;

		if (isEditMode && groupId) {
			updateMutation.mutate({ id: groupId, ...submissionData });
		} else {
			createMutation.mutate(submissionData);
		}
	};

	const isSubmitting =
		createMutation.isPending || updateMutation.isPending || isPending;
	const selectedParentGroup = itemGroups.find(
		(g) => g.id === form.watch("parentId"),
	);

	if (isEditMode && isFetchingGroup) {
		return (
			<div className="flex min-h-screen items-center justify-center">
				<Loader2 className="h-8 w-8 animate-spin text-primary" />
			</div>
		);
	}

	return (
		<div className="flex min-h-screen flex-col bg-[#f8f9fa]">
			<div className="flex-1 px-8 py-4">
				{/* Header */}
				<div className="mb-6 flex items-center justify-between">
					<div className="flex items-center gap-3">
						<h1 className="text-2xl font-bold tracking-tight">
							{isEditMode ? itemGroup?.groupName : "New Item Group"}
						</h1>
						{hasUnsavedChanges && (
							<Badge className="bg-[#fff3e0] text-[#fb8c00] border-none font-medium shadow-none hover:bg-[#fff3e0]">
								Not Saved
							</Badge>
						)}
					</div>
					<div className="flex items-center gap-2">
						<Button variant="outline" size="sm" className="h-8" asChild>
							<Link href="/inventory/items-catalogue/item-group/tree">
								Item Group Tree
							</Link>
						</Button>
						<Button variant="outline" size="icon" className="h-8 w-8">
							<MoreHorizontal className="h-4 w-4" />
						</Button>
						<Button
							size="sm"
							className="h-8 px-6 bg-black hover:bg-gray-800 text-white"
							onClick={form.handleSubmit(onSubmit)}
							disabled={isSubmitting}
						>
							{isSubmitting ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								"Save"
							)}
						</Button>
					</div>
				</div>

				{/* Main Form Content */}
				<div className="rounded-lg border bg-white shadow-sm overflow-hidden p-6 space-y-8">
					{/* General Settings */}
					<section className="space-y-4">
						<h2 className="text-base font-semibold text-gray-900">
							General Settings
						</h2>

						<div className="space-y-1.5">
							<Label className="text-xs font-medium text-gray-500">
								Item Group Name <span className="text-red-500">*</span>
							</Label>
							<Input
								{...form.register("groupName")}
								className="h-10 bg-gray-50/50"
							/>
						</div>

						<div className="space-y-1.5">
							<Label className="text-xs font-medium text-gray-500">
								Parent Item Group
							</Label>
							<Controller
								name="parentId"
								control={form.control}
								render={({ field }) => (
									<Popover
										open={parentGroupOpen}
										onOpenChange={setParentGroupOpen}
									>
										<PopoverTrigger asChild>
											<Button
												variant="outline"
												role="combobox"
												className={cn(
													"h-10 w-full justify-between bg-gray-50/50 font-normal",
													!field.value && "text-muted-foreground",
												)}
											>
												{selectedParentGroup?.groupName || field.value
													? itemGroups.find((g) => g.id === field.value)
															?.groupName || field.value
													: ""}
												<ChevronDown className="h-4 w-4 opacity-50" />
											</Button>
										</PopoverTrigger>
										<PopoverContent
											className="p-0"
											style={{ width: "var(--radix-popover-trigger-width)" }}
										>
											<Command>
												<CommandInput placeholder="Search item groups..." />
												<CommandList>
													<CommandEmpty>No item group found.</CommandEmpty>
													<CommandGroup>
														{itemGroups.map((group) => (
															<CommandItem
																key={group.id}
																onSelect={() => {
																	field.onChange(group.id);
																	setParentGroupOpen(false);
																}}
															>
																{group.groupName}
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

						<div className="space-y-2 pt-2">
							<div className="flex items-center gap-2">
								<Checkbox
									id="isGroup"
									onCheckedChange={(checked) =>
										form.setValue("isGroup", !!checked)
									}
									checked={form.watch("isGroup")}
								/>
								<Label
									htmlFor="isGroup"
									className="text-sm font-normal cursor-pointer"
								>
									Is Group
								</Label>
							</div>
							<p className="text-[11px] text-gray-500">
								Only leaf nodes are allowed in transaction
							</p>
						</div>
					</section>

					{/* Defaults Section */}
					<section className="space-y-4">
						<h2 className="text-base font-semibold text-gray-900">Defaults</h2>

						<div className="space-y-2">
							<Label className="text-xs font-medium text-gray-500">
								Item Group Defaults
							</Label>
							<div className="rounded border overflow-hidden">
								<table className="w-full text-xs text-left">
									<thead className="bg-[#f8f9fa] border-b uppercase text-[10px] tracking-wider text-gray-500">
										<tr>
											<th className="px-4 py-2 w-10">
												<Checkbox className="h-3 w-3 rounded" />
											</th>
											<th className="px-4 py-2 w-16">No.</th>
											<th className="px-4 py-2">
												Company <span className="text-red-500">*</span>
											</th>
											<th className="px-4 py-2">Default Warehouse</th>
											<th className="px-4 py-2">Default Price List</th>
											<th className="px-4 py-2 w-10 text-right">
												<Settings className="ml-auto h-3 w-3" />
											</th>
										</tr>
									</thead>
									<tbody className="bg-white">
										{defaultFields.length === 0 ? (
											<tr>
												<td colSpan={6} className="p-12 text-center">
													<div className="flex flex-col items-center gap-2 opacity-40">
														<List className="h-8 w-8 text-gray-300" />
														<span className="text-[11px] text-gray-500">
															No Data
														</span>
													</div>
												</td>
											</tr>
										) : (
											defaultFields.map((field, index) => (
												<tr
													key={field.id}
													className="border-b last:border-0 hover:bg-gray-50/50"
												>
													<td className="px-4 py-2">
														<Checkbox className="h-3 w-3 rounded" />
													</td>
													<td className="px-4 py-2 text-gray-500">
														{index + 1}
													</td>
													<td className="px-4 py-2">
														<Input
															{...form.register(`defaults.${index}.company`)}
															className="h-7 text-xs border-transparent hover:border-input focus:border-input bg-transparent"
															placeholder="Company"
														/>
													</td>
													<td className="px-4 py-2">
														<Input
															{...form.register(
																`defaults.${index}.defaultWarehouse`,
															)}
															className="h-7 text-xs border-transparent hover:border-input focus:border-input bg-transparent"
														/>
													</td>
													<td className="px-4 py-2">
														<Input
															{...form.register(
																`defaults.${index}.defaultPriceList`,
															)}
															className="h-7 text-xs border-transparent hover:border-input focus:border-input bg-transparent"
														/>
													</td>
													<td className="px-4 py-2 text-right">
														<Button
															variant="ghost"
															size="icon"
															className="h-6 w-6 text-gray-400 hover:text-red-500"
															onClick={() => removeDefault(index)}
														>
															<Trash2 className="h-3 w-3" />
														</Button>
													</td>
												</tr>
											))
										)}
									</tbody>
								</table>
							</div>
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="h-7 px-3 text-xs bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-600 shadow-sm"
								onClick={() =>
									appendDefault({
										company: "",
										defaultWarehouse: "",
										defaultPriceList: "",
									})
								}
							>
								Add Row
							</Button>
						</div>
					</section>

					{/* Tax Section */}
					<section className="space-y-4">
						<h2 className="text-base font-semibold text-gray-900">Item Tax</h2>

						<div className="space-y-2">
							<Label className="text-xs font-medium text-gray-500">Taxes</Label>
							<div className="rounded border overflow-hidden">
								<table className="w-full text-xs text-left">
									<thead className="bg-[#f8f9fa] border-b uppercase text-[10px] tracking-wider text-gray-500">
										<tr>
											<th className="px-4 py-2 w-10">
												<Checkbox className="h-3 w-3 rounded" />
											</th>
											<th className="px-4 py-2 w-16">No.</th>
											<th className="px-4 py-2">
												Item Tax Template{" "}
												<span className="text-red-500">*</span>
											</th>
											<th className="px-4 py-2">Tax Category</th>
											<th className="px-4 py-2">Valid From</th>
											<th className="px-4 py-2">Minimum Net Rate</th>
											<th className="px-4 py-2">Maximum Net Rate</th>
											<th className="px-4 py-2 w-10 text-right">
												<Settings className="ml-auto h-3 w-3" />
											</th>
										</tr>
									</thead>
									<tbody className="bg-white">
										{taxFields.length === 0 ? (
											<tr>
												<td colSpan={8} className="p-12 text-center">
													<div className="flex flex-col items-center gap-2 opacity-40">
														<List className="h-8 w-8 text-gray-300" />
														<span className="text-[11px] text-gray-500">
															No Data
														</span>
													</div>
												</td>
											</tr>
										) : (
											taxFields.map((field, index) => (
												<tr
													key={field.id}
													className="border-b last:border-0 hover:bg-gray-50/50"
												>
													<td className="px-4 py-2">
														<Checkbox className="h-3 w-3 rounded" />
													</td>
													<td className="px-4 py-2 text-gray-500">
														{index + 1}
													</td>
													<td className="px-4 py-2">
														<Input
															{...form.register(
																`taxes.${index}.itemTaxTemplate`,
															)}
															className="h-7 text-xs border-transparent hover:border-input focus:border-input bg-transparent"
														/>
													</td>
													<td className="px-4 py-2">
														<Input
															{...form.register(`taxes.${index}.taxCategory`)}
															className="h-7 text-xs border-transparent hover:border-input focus:border-input bg-transparent"
														/>
													</td>
													<td className="px-4 py-2">
														<Input
															type="date"
															{...form.register(`taxes.${index}.validFrom`)}
															className="h-7 text-xs border-transparent hover:border-input focus:border-input bg-transparent"
														/>
													</td>
													<td className="px-4 py-2">
														<Input
															type="number"
															{...form.register(
																`taxes.${index}.minimumNetRate`,
																{
																	valueAsNumber: true,
																},
															)}
															className="h-7 text-xs border-transparent hover:border-input focus:border-input bg-transparent"
														/>
													</td>
													<td className="px-4 py-2">
														<Input
															type="number"
															{...form.register(
																`taxes.${index}.maximumNetRate`,
																{
																	valueAsNumber: true,
																},
															)}
															className="h-7 text-xs border-transparent hover:border-input focus:border-input bg-transparent"
														/>
													</td>
													<td className="px-4 py-2 text-right">
														<Button
															variant="ghost"
															size="icon"
															className="h-6 w-6 text-gray-400 hover:text-red-500"
															onClick={() => removeTax(index)}
														>
															<Trash2 className="h-3 w-3" />
														</Button>
													</td>
												</tr>
											))
										)}
									</tbody>
								</table>
							</div>
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="h-7 px-3 text-xs bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-600 shadow-sm"
								onClick={() =>
									appendTax({
										itemTaxTemplate: "",
										taxCategory: "",
										validFrom: "",
										minimumNetRate: 0,
										maximumNetRate: 0,
									})
								}
							>
								Add Row
							</Button>
						</div>
					</section>
				</div>
			</div>
		</div>
	);
}

function ItemGroupFormFallback() {
	return (
		<div className="flex min-h-screen items-center justify-center">
			<Loader2 className="h-8 w-8 animate-spin text-primary" />
		</div>
	);
}
