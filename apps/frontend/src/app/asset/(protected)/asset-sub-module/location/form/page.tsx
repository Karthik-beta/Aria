/**
 * Asset Location Form Page — create and edit locations.
 *
 * Reads ?id= param to switch between create/edit modes.
 * Parent location selector filters to group-type locations only
 * (mirroring ERPNext: parent_location is filtered to is_group = 1).
 *
 * Client component: uses hooks for form state and tRPC mutations.
 */
"use client";

import { Asset } from "@aria/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
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
import { getToastMessage } from "@/lib/errors";
import { trpc } from "@/lib/trpc";
import {
	getLocationFormDefaults,
	type LocationFormValues,
	locationFormSchema,
} from "../location.schema";
import { toLocationMutationInput } from "../location.utils";

export default function LocationFormPage() {
	return (
		<Suspense fallback={<LocationFormFallback />}>
			<LocationFormContent />
		</Suspense>
	);
}

function LocationFormFallback() {
	return (
		<div className="flex min-h-screen items-center justify-center">
			<Loader2 className="h-8 w-8 animate-spin text-primary" />
		</div>
	);
}

function LocationFormContent() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const id = searchParams.get("id");
	const isEditMode = Boolean(id);
	const [isPending, startTransition] = useTransition();
	const hasHandledMissingRef = useRef(false);
	const utils = trpc.useUtils();

	const form = useForm<LocationFormValues>({
		resolver: zodResolver(locationFormSchema),
		defaultValues: getLocationFormDefaults(),
	});

	// Fetch location details in edit mode
	const { data: location, isLoading: isFetchingLocation } =
		trpc.asset.getLocationById.useQuery(
			{ id: id ?? "" },
			{ enabled: isEditMode },
		);

	// Fetch all locations for parent selector (group-type only as per ERPNext logic)
	const { data: locationsData } = trpc.asset.listLocations.useQuery(
		{ isGroup: true, take: 250 },
		{ refetchOnWindowFocus: false, retry: 2, staleTime: 30_000 },
	);

	// Locations that can be selected as parent — exclude the current location itself
	const parentOptions = useMemo(
		() => (locationsData?.items ?? []).filter((l) => l.id !== id),
		[locationsData?.items, id],
	);

	// Hydrate form in edit mode
	useEffect(() => {
		if (!isEditMode || !location) return;
		if (form.formState.isDirty) return;

		form.reset({
			name: location.name,
			parentLocationId: location.parentLocationId ?? "",
			isGroup: location.isGroup,
		});
	}, [form, isEditMode, location]);

	// Redirect to list if location not found
	useEffect(() => {
		if (
			isEditMode &&
			!isFetchingLocation &&
			!location &&
			!hasHandledMissingRef.current
		) {
			hasHandledMissingRef.current = true;
			toast.error("Location not found");
			startTransition(() => {
				router.push("/asset/asset-sub-module/location");
			});
		}
	}, [isEditMode, isFetchingLocation, location, router]);

	const createMutation = trpc.asset.createLocation.useMutation({
		onSuccess: async (data) => {
			toast.success("Location created successfully");
			await utils.asset.listLocations.invalidate();
			startTransition(() => {
				router.push(`/asset/asset-sub-module/location/form?id=${data.id}`);
			});
		},
		onError: (error) => {
			toast.error(getToastMessage(error, "create"));
		},
	});

	const updateMutation = trpc.asset.updateLocation.useMutation({
		onSuccess: async () => {
			toast.success("Location updated successfully");
			await utils.asset.listLocations.invalidate();
			if (id) {
				await utils.asset.getLocationById.invalidate({ id });
			}
			form.reset(form.getValues()); // clear dirty state
		},
		onError: (error) => {
			toast.error(getToastMessage(error, "update"));
		},
	});

	const onSubmit = (values: LocationFormValues) => {
		const payload = toLocationMutationInput(values);

		if (isEditMode && id) {
			const parsed = Asset.updateLocationSchema.safeParse({ id, ...payload });
			if (!parsed.success) {
				toast.error(parsed.error.issues[0]?.message ?? "Invalid form values");
				return;
			}
			updateMutation.mutate(parsed.data);
			return;
		}

		const parsed = Asset.createLocationSchema.safeParse(payload);
		if (!parsed.success) {
			toast.error(parsed.error.issues[0]?.message ?? "Invalid form values");
			return;
		}
		createMutation.mutate(parsed.data);
	};

	const isSubmitting =
		createMutation.isPending || updateMutation.isPending || isPending;
	const hasUnsavedChanges = form.formState.isDirty;

	const isGroup = useWatch({ control: form.control, name: "isGroup" });
	const parentLocationId = useWatch({
		control: form.control,
		name: "parentLocationId",
	});

	if (isEditMode && isFetchingLocation) {
		return <LocationFormFallback />;
	}

	const title = isEditMode && location ? location.name : "New Location";

	return (
		<div className="flex min-h-screen flex-col bg-muted px-4 py-4 md:px-6">
			<div className="mb-4 flex items-center justify-between">
				<div className="flex items-center gap-3">
					<h1 className="text-3xl font-bold tracking-tight">{title}</h1>
					{hasUnsavedChanges && <Badge variant="secondary">Not Saved</Badge>}
				</div>
				<div className="flex items-center gap-2">
					<Button
						variant="outline"
						onClick={() => {
							startTransition(() => {
								router.push("/asset/asset-sub-module/location");
							});
						}}
						disabled={isSubmitting}
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

			<div className="rounded-xl border bg-background">
				<div className="border-b px-5 py-5">
					<h2 className="text-xl font-semibold">Location Details</h2>
				</div>

				<div className="grid gap-6 border-b px-5 py-5 md:grid-cols-2">
					{/* Location Name */}
					<div className="space-y-2 md:col-span-2">
						<Label htmlFor="name">
							Location Name <span className="text-destructive">*</span>
						</Label>
						<Input
							id="name"
							placeholder="Enter location name"
							{...form.register("name")}
						/>
						{form.formState.errors.name && (
							<p className="text-xs text-destructive">
								{form.formState.errors.name.message}
							</p>
						)}
					</div>

					{/* Is Group */}
					<div className="space-y-4">
						<div className="flex items-center gap-2">
							<Checkbox
								id="isGroup"
								checked={isGroup}
								onCheckedChange={(checked) =>
									form.setValue("isGroup", Boolean(checked), {
										shouldDirty: true,
									})
								}
							/>
							<div className="space-y-1">
								<Label htmlFor="isGroup">Is Group</Label>
								<p className="text-sm text-muted-foreground">
									Group locations can contain child locations.
								</p>
							</div>
						</div>
					</div>

					{/* Parent Location */}
					<div className="space-y-2">
						<Label htmlFor="parentLocationId">Parent Location</Label>
						<Select
							value={parentLocationId || "__none"}
							onValueChange={(value) =>
								form.setValue(
									"parentLocationId",
									value === "__none" ? "" : value,
									{ shouldDirty: true },
								)
							}
						>
							<SelectTrigger id="parentLocationId">
								<SelectValue placeholder="Select parent location" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="__none">No parent location</SelectItem>
								{parentOptions.map((loc) => (
									<SelectItem key={loc.id} value={loc.id}>
										{loc.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<p className="text-xs text-muted-foreground">
							Only group-type locations can be selected as a parent.
						</p>
					</div>
				</div>

				{/* Status summary */}
				<div className="px-5 py-4">
					<div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
						Location type:{" "}
						<span className="font-medium text-foreground">
							{isGroup
								? "Group (can have children)"
								: "Leaf (end-point location)"}
						</span>
					</div>
				</div>
			</div>
		</div>
	);
}
