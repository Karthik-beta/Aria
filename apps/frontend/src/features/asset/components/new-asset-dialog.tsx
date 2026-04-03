"use client";

import { Asset } from "@aria/types";
import { ChevronDown, Loader2, Plus } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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

type QuickCreateAssetValues = {
	assetName: string;
	company: string;
	assetCategoryId?: string;
	locationId?: string;
};

/**
 * NewAssetDialog — quick-create modal for the asset list page.
 *
 * Captures the minimum required fields (asset name + company) and optional
 * category/location. Redirects to the full form for complex configurations.
 * Client component: uses tRPC queries, react-hook-form, and a compact dialog.
 */
export function NewAssetDialog() {
	const utils = trpc.useUtils();
	const [isOpen, setIsOpen] = React.useState(false);
	const [categoryOpen, setCategoryOpen] = React.useState(false);
	const [locationOpen, setLocationOpen] = React.useState(false);

	const { data: categoriesData } = trpc.asset.listAssetCategories.useQuery(
		{ search: "" },
		{ staleTime: 30_000 },
	);
	const categories = categoriesData?.items ?? [];
	const { data: locationsData } = trpc.asset.listLocations.useQuery(
		{ search: "" },
		{ staleTime: 30_000 },
	);
	const locations = locationsData?.items ?? [];

	const form = useForm<QuickCreateAssetValues>({
		defaultValues: {
			assetName: "",
			company: "",
			assetCategoryId: undefined,
			locationId: undefined,
		},
	});

	const closeDialog = React.useCallback(() => {
		setIsOpen(false);
		setCategoryOpen(false);
		setLocationOpen(false);
		form.reset();
	}, [form]);

	const assetName = form.watch("assetName");
	const company = form.watch("company");
	const selectedCategoryId = form.watch("assetCategoryId");
	const selectedLocationId = form.watch("locationId");

	const selectedCategory = React.useMemo(
		() => categories.find((c) => c.id === selectedCategoryId),
		[categories, selectedCategoryId],
	);
	const selectedLocation = React.useMemo(
		() => locations.find((l) => l.id === selectedLocationId),
		[locations, selectedLocationId],
	);

	const editFullFormHref = React.useMemo(() => {
		const params = new URLSearchParams();
		const name = assetName.trim();
		if (name) params.set("assetName", name);
		if (company.trim()) params.set("company", company.trim());
		if (selectedCategoryId) params.set("assetCategoryId", selectedCategoryId);
		if (selectedLocationId) params.set("locationId", selectedLocationId);
		const query = params.toString();
		return query
			? `/asset/asset_sub_module/asset/form?${query}`
			: "/asset/asset_sub_module/asset/form";
	}, [assetName, company, selectedCategoryId, selectedLocationId]);

	const createMutation = trpc.asset.createAsset.useMutation({
		onSuccess: async () => {
			closeDialog();
			await utils.asset.listAssets.invalidate();
		},
		onError: (error) => {
			toast.error(getToastMessage(error, "create"));
		},
	});

	const onSubmit = form.handleSubmit((values) => {
		const name = values.assetName.trim();
		const comp = values.company.trim();
		if (!name) {
			toast.error("Asset name is required");
			return;
		}
		if (!comp) {
			toast.error("Company is required");
			return;
		}

		const payload = {
			assetName: name,
			company: comp,
			assetCategoryId: values.assetCategoryId ?? null,
			locationId: values.locationId ?? null,
		};

		const parsed = Asset.createAssetSchema.safeParse(payload);
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
					Add Asset
				</Button>
			</DialogTrigger>

			<DialogContent className="max-w-[575px] gap-0 overflow-hidden p-0">
				<DialogHeader className="border-b px-5 py-4">
					<DialogTitle>New Asset</DialogTitle>
				</DialogHeader>

				<form
					id="new-asset-quick-create-form"
					onSubmit={onSubmit}
					className="space-y-5 px-5 py-5"
				>
					{/* Asset Name */}
					<div className="space-y-2">
						<Label
							htmlFor="quick-asset-name"
							className="text-xs font-medium text-gray-500"
						>
							Asset Name <span className="text-destructive">*</span>
						</Label>
						<Input
							id="quick-asset-name"
							autoFocus
							placeholder="e.g. Dell Laptop 2024"
							className="h-10"
							{...form.register("assetName")}
						/>
					</div>

					{/* Company */}
					<div className="space-y-2">
						<Label
							htmlFor="quick-company"
							className="text-xs font-medium text-gray-500"
						>
							Company <span className="text-destructive">*</span>
						</Label>
						<Input
							id="quick-company"
							placeholder="e.g. My Company Ltd."
							className="h-10"
							{...form.register("company")}
						/>
					</div>

					{/* Asset Category */}
					<div className="space-y-2">
						<Label className="text-xs font-medium text-gray-500">
							Asset Category
						</Label>
						<Controller
							name="assetCategoryId"
							control={form.control}
							render={({ field }) => (
								<Popover open={categoryOpen} onOpenChange={setCategoryOpen}>
									<PopoverTrigger asChild>
										<Button
											type="button"
											variant="outline"
											className="h-10 w-full justify-between font-normal"
										>
											<span className="truncate">
												{selectedCategory?.name ?? "Select category…"}
											</span>
											<ChevronDown className="h-4 w-4 opacity-50" />
										</Button>
									</PopoverTrigger>
									<PopoverContent
										className="p-0 pointer-events-auto"
										style={{ width: "var(--radix-popover-trigger-width)" }}
									>
										<Command>
											<CommandInput placeholder="Search categories…" />
											<CommandList>
												<CommandEmpty>No categories found</CommandEmpty>
												<CommandGroup>
													{categories.map((cat) => (
														<CommandItem
															key={cat.id}
															onSelect={() => {
																field.onChange(cat.id);
																setCategoryOpen(false);
															}}
														>
															{cat.name}
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

					{/* Location */}
					<div className="space-y-2">
						<Label className="text-xs font-medium text-gray-500">
							Location
						</Label>
						<Controller
							name="locationId"
							control={form.control}
							render={({ field }) => (
								<Popover open={locationOpen} onOpenChange={setLocationOpen}>
									<PopoverTrigger asChild>
										<Button
											type="button"
											variant="outline"
											className="h-10 w-full justify-between font-normal"
										>
											<span className="truncate">
												{selectedLocation?.name ?? "Select location…"}
											</span>
											<ChevronDown className="h-4 w-4 opacity-50" />
										</Button>
									</PopoverTrigger>
									<PopoverContent
										className="p-0 pointer-events-auto"
										style={{ width: "var(--radix-popover-trigger-width)" }}
									>
										<Command>
											<CommandInput placeholder="Search locations…" />
											<CommandList>
												<CommandEmpty>No locations found</CommandEmpty>
												<CommandGroup>
													{locations.map((loc) => (
														<CommandItem
															key={loc.id}
															onSelect={() => {
																field.onChange(loc.id);
																setLocationOpen(false);
															}}
														>
															{loc.name}
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
				</form>

				<DialogFooter className="border-t px-5 py-4">
					<Link href={editFullFormHref} onClick={closeDialog}>
						<Button type="button" variant="outline" size="sm">
							Edit Full Form
						</Button>
					</Link>
					<Button
						type="submit"
						form="new-asset-quick-create-form"
						size="sm"
						disabled={createMutation.isPending}
					>
						{createMutation.isPending && (
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
						)}
						Create Asset
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
