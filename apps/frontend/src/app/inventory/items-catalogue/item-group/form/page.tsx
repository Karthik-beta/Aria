"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
	ArrowLeft,
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
import * as z from "zod";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
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
	const initialParentId = (() => {
		const parentId = searchParams.get("parentId")?.trim();
		if (!parentId) {
			return null;
		}

		return z.string().cuid().safeParse(parentId).success ? parentId : null;
	})();
	const [isPending, startTransition] = useTransition();
	const [hasUnsavedChanges, setHasUnsavedChanges] = useState(!isEditMode);
	const [isInitialized, setIsInitialized] = useState(!isEditMode);

	// Combobox states
	const [parentGroupOpen, setParentGroupOpen] = useState(false);

	const form = useForm<FormInput>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			groupName: "",
			parentId: isEditMode ? null : initialParentId,
			isGroup: false,
			defaults: [],
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

	// Watch for changes
	useEffect(() => {
		if (!isInitialized) return;
		const subscription = form.watch(() => setHasUnsavedChanges(true));
		return () => subscription.unsubscribe();
	}, [form, isInitialized]);

	// Fetch item groups once and reuse the same source for edit hydration and the parent dropdown.
	const { data: itemGroups = [], isLoading: isFetchingItemGroups } =
		trpc.inventory.listItemGroups.useQuery(undefined, {
			staleTime: 30000,
		});

	const itemGroup = itemGroups.find((g) => g.id === groupId);

	// Initialize form with data
	useEffect(() => {
		if (isEditMode && itemGroup) {
			form.reset({
				groupName: itemGroup.groupName,
				parentId: itemGroup.parentId ?? null, // Normalize undefined from the backend to null for the form.
				isGroup: itemGroup.isGroup,
				defaults: itemGroup.defaults || [],
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
		if (isEditMode && groupId) {
			updateMutation.mutate({ id: groupId, ...data });
		} else {
			createMutation.mutate(data);
		}
	};

	const isSubmitting =
		createMutation.isPending || updateMutation.isPending || isPending;
	const selectedParentGroup = itemGroups.find(
		(g) => g.id === form.watch("parentId"),
	);
	const parentDropdownGroups = itemGroups.filter((g) => g.id !== groupId);

	if (isEditMode && isFetchingItemGroups) {
		return (
			<div className="flex min-h-screen items-center justify-center">
				<Loader2 className="h-8 w-8 animate-spin text-primary" />
			</div>
		);
	}

	if (isEditMode && !isFetchingItemGroups && !itemGroup) {
		return (
			<div className="flex min-h-screen items-center justify-center">
				<Card className="w-full max-w-md">
					<CardHeader>
						<CardTitle>Item Group Not Found</CardTitle>
						<CardDescription>
							The item group you are looking for does not exist or has been
							deleted.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Link
							href="/inventory/items-catalogue/item-group"
							className={buttonVariants({ variant: "outline" })}
						>
							<ArrowLeft className="mr-2 h-4 w-4" />
							Back to Item Groups
						</Link>
					</CardContent>
				</Card>
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
								className={cn(
									"h-10 bg-gray-50/50",
									form.formState.errors.groupName && "border-red-500",
								)}
							/>
							{form.formState.errors.groupName && (
								<p className="text-xs text-red-500">
									{form.formState.errors.groupName.message}
								</p>
							)}
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
													!selectedParentGroup && "text-muted-foreground",
												)}
											>
												{selectedParentGroup?.groupName || "Top-level group"}
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
													<CommandEmpty>No item groups found.</CommandEmpty>
													<CommandItem
														onSelect={() => {
															field.onChange(null);
															setParentGroupOpen(false);
														}}
													>
														<div className="flex flex-col items-start">
															<span className="font-medium">
																Top-level group
															</span>
															<span className="text-xs text-muted-foreground">
																No parent assigned
															</span>
														</div>
													</CommandItem>
													<CommandSeparator />
													<CommandGroup heading="All Item Groups">
														{parentDropdownGroups.map((group) => (
															<CommandItem
																key={group.id}
																onSelect={() => {
																	field.onChange(group.id);
																	setParentGroupOpen(false);
																}}
															>
																<div className="flex flex-col items-start">
																	<span className="font-medium">
																		{group.groupName}
																	</span>
																	<span className="text-xs text-muted-foreground">
																		{group.parentGroupName || "All Item Groups"}
																	</span>
																</div>
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
