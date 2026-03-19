"use client";

import { Inventory } from "@aria/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import {
	Suspense,
	useEffect,
	useMemo,
	useRef,
	useState,
	useTransition,
} from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
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

type ShippingRuleFormValues = z.input<
	typeof Inventory.createShippingRuleSchema
>;

const editShippingRuleFormSchema = Inventory.updateShippingRuleSchema
	.omit({ id: true })
	.extend({
		shippingRuleLabel:
			Inventory.createShippingRuleSchema.shape.shippingRuleLabel,
		shippingRuleType: Inventory.createShippingRuleSchema.shape.shippingRuleType,
		disabled: Inventory.createShippingRuleSchema.shape.disabled,
		calculateBasedOn: Inventory.createShippingRuleSchema.shape.calculateBasedOn,
		shippingAmount: Inventory.createShippingRuleSchema.shape.shippingAmount,
	});

export default function ShippingRuleFormPage() {
	return (
		<Suspense fallback={<ShippingRuleFormFallback />}>
			<ShippingRuleFormContent />
		</Suspense>
	);
}

function ShippingRuleFormContent() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const id = searchParams.get("id");
	const isEditMode = Boolean(id);
	const [isPending, startTransition] = useTransition();
	const [isInitialized, setIsInitialized] = useState(!isEditMode);
	const [hasUnsavedChanges, setHasUnsavedChanges] = useState(!isEditMode);
	const hasHandledMissingRuleRef = useRef(false);
	const utils = trpc.useUtils();
	const formSchema = useMemo(
		() =>
			isEditMode
				? editShippingRuleFormSchema
				: Inventory.createShippingRuleSchema,
		[isEditMode],
	);

	const form = useForm<ShippingRuleFormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			shippingRuleLabel: "",
			shippingRuleType: "SELLING",
			disabled: false,
			calculateBasedOn: "FIXED",
			shippingAmount: 0,
		},
	});

	const { data: shippingRule, isLoading: isFetchingRule } =
		trpc.inventory.getShippingRuleById.useQuery(
			{ id: id ?? "" },
			{
				enabled: isEditMode,
			},
		);

	useEffect(() => {
		if (!isInitialized) return;
		const subscription = form.watch(() => {
			setHasUnsavedChanges(true);
		});
		return () => subscription.unsubscribe();
	}, [form, isInitialized]);

	useEffect(() => {
		if (isEditMode && shippingRule) {
			form.reset({
				shippingRuleLabel: shippingRule.shippingRuleLabel,
				shippingRuleType: shippingRule.shippingRuleType,
				disabled: shippingRule.disabled,
				calculateBasedOn: shippingRule.calculateBasedOn,
				shippingAmount: shippingRule.shippingAmount,
			});
			setHasUnsavedChanges(false);
			setIsInitialized(true);
		}
	}, [form, isEditMode, shippingRule]);

	useEffect(() => {
		if (
			isEditMode &&
			!isFetchingRule &&
			!shippingRule &&
			!hasHandledMissingRuleRef.current
		) {
			hasHandledMissingRuleRef.current = true;
			toast.error("Shipping rule not found");
			startTransition(() => {
				router.push("/inventory/shipping-rules");
			});
		}
	}, [isEditMode, isFetchingRule, router, shippingRule]);

	const createMutation = trpc.inventory.createShippingRule.useMutation({
		onSuccess: async () => {
			toast.success("Shipping rule created successfully");
			setHasUnsavedChanges(false);
			await utils.inventory.listShippingRules.invalidate();
			startTransition(() => {
				router.push("/inventory/shipping-rules");
			});
		},
		onError: (error) => {
			toast.error(getToastMessage(error, "create"));
		},
	});

	const updateMutation = trpc.inventory.updateShippingRule.useMutation({
		onSuccess: async () => {
			toast.success("Shipping rule updated successfully");
			setHasUnsavedChanges(false);
			await utils.inventory.listShippingRules.invalidate();
			startTransition(() => {
				router.push("/inventory/shipping-rules");
			});
		},
		onError: (error) => {
			toast.error(getToastMessage(error, "update"));
		},
	});

	const onSubmit = (values: ShippingRuleFormValues) => {
		const payload = {
			...values,
			shippingRuleLabel: values.shippingRuleLabel.trim(),
			disabled: values.disabled ?? false,
			shippingAmount: values.shippingAmount ?? 0,
		};

		if (isEditMode && id) {
			updateMutation.mutate({
				id,
				...payload,
			});
			return;
		}

		const parsedCreate = Inventory.createShippingRuleSchema.safeParse(payload);
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

	if (isEditMode && isFetchingRule) {
		return (
			<div className="flex min-h-screen items-center justify-center">
				<Loader2 className="h-8 w-8 animate-spin text-primary" />
			</div>
		);
	}

	return (
		<div className="flex min-h-screen flex-col bg-[#f8f9fa] px-4 py-4 md:px-6">
			<div className="mb-4 flex items-center justify-between">
				<div className="flex items-center gap-3">
					<h1 className="text-3xl font-bold tracking-tight">
						{isEditMode ? shippingRule?.shippingRuleLabel : "New Shipping Rule"}
					</h1>
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
				<div className="grid gap-6 px-5 py-5 md:grid-cols-2">
					<div className="space-y-2">
						<Label htmlFor="shippingRuleLabel">Shipping Rule Label *</Label>
						<Input
							id="shippingRuleLabel"
							{...form.register("shippingRuleLabel")}
							placeholder="example: Next Day Shipping"
						/>
						{form.formState.errors.shippingRuleLabel && (
							<p className="text-xs text-destructive">
								{form.formState.errors.shippingRuleLabel.message}
							</p>
						)}
					</div>

					<div className="space-y-2">
						<Label htmlFor="shippingRuleType">Shipping Rule Type</Label>
						<Select
							value={form.watch("shippingRuleType")}
							onValueChange={(value: "SELLING" | "BUYING") =>
								form.setValue("shippingRuleType", value, { shouldDirty: true })
							}
						>
							<SelectTrigger id="shippingRuleType">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="SELLING">Selling</SelectItem>
								<SelectItem value="BUYING">Buying</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2">
						<Label htmlFor="calculateBasedOn">Calculate Based On</Label>
						<Select
							value={form.watch("calculateBasedOn")}
							onValueChange={(value: "FIXED" | "NET_TOTAL" | "NET_WEIGHT") =>
								form.setValue("calculateBasedOn", value, { shouldDirty: true })
							}
						>
							<SelectTrigger id="calculateBasedOn">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="FIXED">Fixed</SelectItem>
								<SelectItem value="NET_TOTAL">Net Total</SelectItem>
								<SelectItem value="NET_WEIGHT">Net Weight</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2">
						<Label htmlFor="shippingAmount">Shipping Amount *</Label>
						<Input
							id="shippingAmount"
							type="number"
							min={0}
							step="0.01"
							value={form.watch("shippingAmount")}
							onChange={(event) =>
								form.setValue(
									"shippingAmount",
									Number(event.target.value || 0),
									{ shouldDirty: true },
								)
							}
						/>
						{form.formState.errors.shippingAmount && (
							<p className="text-xs text-destructive">
								{form.formState.errors.shippingAmount.message}
							</p>
						)}
					</div>
				</div>

				<div className="border-t px-5 py-4">
					<div className="flex items-center gap-2">
						<Checkbox
							id="disabled"
							checked={form.watch("disabled")}
							onCheckedChange={(checked) =>
								form.setValue("disabled", Boolean(checked), {
									shouldDirty: true,
								})
							}
						/>
						<Label htmlFor="disabled">Disabled</Label>
					</div>
				</div>
			</div>
		</div>
	);
}

function ShippingRuleFormFallback() {
	return (
		<div className="flex min-h-screen items-center justify-center">
			<Loader2 className="h-8 w-8 animate-spin text-primary" />
		</div>
	);
}
