"use client";

import { Inventory } from "@aria/types";
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
	DELIVERY_TRIP_STATUS_OPTIONS,
	toDateTimeLocalInputValue,
} from "../delivery-trip.utils";

/**
 * Explicit form state type — uses Date (not unknown) for date fields so that
 * react-hook-form's generics and useFieldArray stay well-typed.
 */
type DeliveryTripFormValues = {
	company: string;
	driver?: string;
	driverAddress?: string;
	vehicle?: string;
	departureTime?: Date | null;
	status?: Inventory.DeliveryTripStatus;
	initialEmailNotificationSent?: boolean;
	stops: Array<{
		id?: string;
		stopNumber: number;
		customer?: string;
		addressName: string;
		locked?: boolean;
		deliveryNote?: string;
		estimatedArrival?: Date | null;
	}>;
};

export default function DeliveryTripFormPage() {
	return (
		<Suspense fallback={<DeliveryTripFormFallback />}>
			<DeliveryTripFormContent />
		</Suspense>
	);
}

function DeliveryTripFormFallback() {
	return (
		<div className="flex min-h-screen items-center justify-center">
			<Loader2 className="h-8 w-8 animate-spin text-primary" />
		</div>
	);
}

function DeliveryTripFormContent() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const id = searchParams.get("id");
	const isEditMode = Boolean(id);
	const [isPending, startTransition] = useTransition();
	const hasHandledMissingRef = useRef(false);
	const utils = trpc.useUtils();

	const form = useForm<DeliveryTripFormValues>({
		resolver: zodResolver(
			Inventory.createDeliveryTripSchema,
		) as Resolver<DeliveryTripFormValues>,
		defaultValues: {
			company: "",
			driver: "",
			driverAddress: "",
			vehicle: "",
			departureTime: undefined,
			status: "DRAFT",
			initialEmailNotificationSent: false,
			stops: [],
		},
	});

	const {
		fields: stopFields,
		append: appendStop,
		remove: removeStop,
	} = useFieldArray({ control: form.control, name: "stops" });

	const { data: deliveryTrip, isLoading: isFetchingDeliveryTrip } =
		trpc.inventory.getDeliveryTripById.useQuery(
			{ id: id ?? "" },
			{ enabled: isEditMode },
		);

	useEffect(() => {
		if (!isEditMode || !deliveryTrip) return;
		form.reset({
			company: deliveryTrip.company,
			driver: deliveryTrip.driver ?? "",
			driverAddress: deliveryTrip.driverAddress ?? "",
			vehicle: deliveryTrip.vehicle ?? "",
			departureTime: deliveryTrip.departureTime
				? new Date(deliveryTrip.departureTime)
				: undefined,
			status: deliveryTrip.status,
			initialEmailNotificationSent: deliveryTrip.initialEmailNotificationSent,
			stops: deliveryTrip.stops.map((stop) => ({
				id: stop.id,
				stopNumber: stop.stopNumber,
				customer: stop.customer ?? "",
				addressName: stop.addressName,
				locked: stop.locked,
				deliveryNote: stop.deliveryNote ?? "",
				estimatedArrival: stop.estimatedArrival
					? new Date(stop.estimatedArrival)
					: undefined,
			})),
		});
	}, [form, isEditMode, deliveryTrip]);

	useEffect(() => {
		if (
			isEditMode &&
			!isFetchingDeliveryTrip &&
			!deliveryTrip &&
			!hasHandledMissingRef.current
		) {
			hasHandledMissingRef.current = true;
			toast.error("Delivery trip not found");
			startTransition(() => {
				router.push("/inventory/stock-transaction/delivery-trip");
			});
		}
	}, [isEditMode, isFetchingDeliveryTrip, deliveryTrip, router]);

	const createMutation = trpc.inventory.createDeliveryTrip.useMutation({
		onSuccess: async () => {
			toast.success("Delivery trip created successfully");
			await utils.inventory.listDeliveryTrips.invalidate();
			startTransition(() => {
				router.push("/inventory/stock-transaction/delivery-trip");
			});
		},
		onError: (error) => {
			toast.error(getToastMessage(error, "create"));
		},
	});

	const updateMutation = trpc.inventory.updateDeliveryTrip.useMutation({
		onSuccess: async () => {
			toast.success("Delivery trip updated successfully");
			await utils.inventory.listDeliveryTrips.invalidate();
			startTransition(() => {
				router.push("/inventory/stock-transaction/delivery-trip");
			});
		},
		onError: (error) => {
			toast.error(getToastMessage(error, "update"));
		},
	});

	const onSubmit = (values: DeliveryTripFormValues) => {
		const normalizedStops = values.stops.map((stop, idx) => ({
			id: isEditMode ? stop.id : undefined,
			stopNumber: stop.stopNumber ?? idx + 1,
			customer: stop.customer?.trim() || undefined,
			addressName: stop.addressName.trim(),
			locked: stop.locked,
			deliveryNote: stop.deliveryNote?.trim() || undefined,
			estimatedArrival: stop.estimatedArrival,
		}));

		if (isEditMode && id) {
			updateMutation.mutate({
				id,
				company: values.company.trim() || undefined,
				driver: values.driver?.trim() || null,
				driverAddress: values.driverAddress?.trim() || null,
				vehicle: values.vehicle?.trim() || null,
				departureTime: values.departureTime ?? null,
				status: values.status,
				initialEmailNotificationSent: values.initialEmailNotificationSent,
				stops: normalizedStops,
			});
			return;
		}

		const parsedCreate = Inventory.createDeliveryTripSchema.safeParse({
			...values,
			company: values.company.trim(),
			driver: values.driver?.trim() || undefined,
			driverAddress: values.driverAddress?.trim() || undefined,
			vehicle: values.vehicle?.trim() || undefined,
			stops: normalizedStops,
		});

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

	if (isEditMode && isFetchingDeliveryTrip) {
		return (
			<div className="flex min-h-screen items-center justify-center">
				<Loader2 className="h-8 w-8 animate-spin text-primary" />
			</div>
		);
	}

	return (
		<div className="flex min-h-screen flex-col bg-muted/20 px-4 py-4 md:px-6">
			<div className="mb-4 flex items-center justify-between">
				<div className="flex items-center gap-3">
					<h1 className="text-3xl font-bold tracking-tight">
						{isEditMode
							? (deliveryTrip?.series ?? "Edit Delivery Trip")
							: "New Delivery Trip"}
					</h1>
					{form.formState.isDirty && (
						<Badge className="border-none bg-orange-100 text-orange-700 hover:bg-orange-100 dark:bg-orange-900 dark:text-orange-300">
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

			<div className="space-y-4 overflow-hidden rounded-lg border bg-background shadow-sm">
				{/* ── Header card ── */}
				<div className="border-b px-5 py-5">
					<h2 className="mb-4 text-lg font-semibold">Trip Information</h2>
					<div className="grid gap-6 md:grid-cols-3">
						{isEditMode && (
							<div className="space-y-2">
								<Label>Series</Label>
								<Input
									value={deliveryTrip?.series ?? ""}
									readOnly
									className="bg-muted"
								/>
							</div>
						)}

						<div className="space-y-2">
							<Label htmlFor="company">Company *</Label>
							<Input id="company" {...form.register("company")} />
							{form.formState.errors.company && (
								<p className="text-xs text-destructive">
									{form.formState.errors.company.message}
								</p>
							)}
						</div>

						<div className="space-y-2">
							<Label htmlFor="status">Status</Label>
							<Controller
								name="status"
								control={form.control}
								render={({ field }) => (
									<Select
										value={field.value ?? "DRAFT"}
										onValueChange={field.onChange}
									>
										<SelectTrigger id="status">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{DELIVERY_TRIP_STATUS_OPTIONS.map((opt) => (
												<SelectItem key={opt.value} value={opt.value}>
													{opt.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								)}
							/>
						</div>

						<div className="flex items-center gap-2">
							<Controller
								name="initialEmailNotificationSent"
								control={form.control}
								render={({ field }) => (
									<Checkbox
										id="initialEmailNotificationSent"
										checked={field.value}
										onCheckedChange={(checked) =>
											field.onChange(checked === true)
										}
									/>
								)}
							/>
							<Label htmlFor="initialEmailNotificationSent">
								Initial Email Notification Sent
							</Label>
						</div>
					</div>
				</div>

				{/* ── Delivery Details card ── */}
				<div className="border-b px-5 py-5">
					<h2 className="mb-4 text-lg font-semibold">Delivery Details</h2>
					<div className="grid gap-6 md:grid-cols-3">
						<div className="space-y-2">
							<Label htmlFor="driver">Driver</Label>
							<Input
								id="driver"
								placeholder="Optional"
								{...form.register("driver")}
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor="vehicle">Vehicle</Label>
							<Input
								id="vehicle"
								placeholder="Optional"
								{...form.register("vehicle")}
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor="driverAddress">Driver Address</Label>
							<Input
								id="driverAddress"
								placeholder="Optional"
								{...form.register("driverAddress")}
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor="departureTime">Departure Time</Label>
							<Controller
								name="departureTime"
								control={form.control}
								render={({ field }) => (
									<Input
										id="departureTime"
										type="datetime-local"
										value={toDateTimeLocalInputValue(
											field.value as Date | null | undefined,
										)}
										onChange={(e) =>
											field.onChange(
												e.target.value ? new Date(e.target.value) : undefined,
											)
										}
									/>
								)}
							/>
						</div>
					</div>
				</div>

				{/* ── Delivery Stops card ── */}
				<div className="px-5 py-5">
					<div className="mb-4 flex items-center justify-between">
						<h2 className="text-lg font-semibold">Delivery Stops</h2>
					</div>

					<div className="overflow-x-auto rounded-md border">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead className="w-10" />
									<TableHead className="w-12">No.</TableHead>
									<TableHead>Customer</TableHead>
									<TableHead>
										Address Name <span className="text-destructive">*</span>
									</TableHead>
									<TableHead className="w-20">Locked</TableHead>
									<TableHead>Delivery Note</TableHead>
									<TableHead>Est. Arrival</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{stopFields.length === 0 && (
									<TableRow>
										<TableCell
											colSpan={7}
											className="py-8 text-center text-sm text-muted-foreground"
										>
											No stops added. Click &ldquo;Add Stop&rdquo; to get
											started.
										</TableCell>
									</TableRow>
								)}
								{stopFields.map((field, index) => (
									<TableRow key={field.id}>
										<TableCell>
											<Button
												type="button"
												variant="ghost"
												size="icon"
												className="h-7 w-7"
												onClick={() => removeStop(index)}
											>
												<Trash2 className="h-4 w-4" />
											</Button>
										</TableCell>
										<TableCell>{index + 1}</TableCell>
										<TableCell>
											<Input
												className="h-9"
												placeholder="Customer"
												{...form.register(`stops.${index}.customer`)}
											/>
										</TableCell>
										<TableCell>
											<Input
												className="h-9"
												placeholder="Address Name"
												{...form.register(`stops.${index}.addressName`)}
											/>
											{form.formState.errors.stops?.[index]?.addressName && (
												<p className="mt-1 text-xs text-destructive">
													{
														form.formState.errors.stops[index].addressName
															?.message
													}
												</p>
											)}
										</TableCell>
										<TableCell>
											<Controller
												name={`stops.${index}.locked`}
												control={form.control}
												render={({ field: f }) => (
													<Checkbox
														checked={f.value}
														onCheckedChange={(checked) =>
															f.onChange(checked === true)
														}
													/>
												)}
											/>
										</TableCell>
										<TableCell>
											<Input
												className="h-9"
												placeholder="Note"
												{...form.register(`stops.${index}.deliveryNote`)}
											/>
										</TableCell>
										<TableCell>
											<Controller
												name={`stops.${index}.estimatedArrival`}
												control={form.control}
												render={({ field: f }) => (
													<Input
														type="datetime-local"
														className="h-9"
														value={toDateTimeLocalInputValue(
															f.value as Date | null | undefined,
														)}
														onChange={(e) =>
															f.onChange(
																e.target.value
																	? new Date(e.target.value)
																	: undefined,
															)
														}
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
							appendStop({
								stopNumber: stopFields.length + 1,
								customer: "",
								addressName: "",
								locked: false,
								deliveryNote: "",
								estimatedArrival: undefined,
							})
						}
					>
						<Plus className="mr-2 h-4 w-4" />
						Add Stop
					</Button>
				</div>
			</div>
		</div>
	);
}
