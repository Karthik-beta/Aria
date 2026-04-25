"use client";

import { Inventory } from "@aria/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Trash2 } from "lucide-react";
import * as React from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ErrorState } from "@/components/ui/error-display";
import { Label } from "@/components/ui/label";
import { getToastMessage } from "@/lib/errors";
import { trpc } from "@/lib/trpc";
import {
	type ItemVariantSettingsFormValues,
	itemVariantSettingsFormSchema,
} from "./item-variant-settings.schema";
import {
	buildItemVariantSettingsMutationInput,
	createItemVariantSettingsFormValues,
	getItemVariantCopyFieldLabel,
	getSelectableItemVariantCopyFieldOptions,
} from "./item-variant-settings.utils";

function SettingsCheckboxField(props: {
	id: string;
	label: string;
	description: string;
	checked: boolean;
	onCheckedChange: (checked: boolean) => void;
}) {
	return (
		<div className="space-y-2 rounded-lg border bg-card px-4 py-4">
			<div className="flex items-start gap-3">
				<Checkbox
					id={props.id}
					checked={props.checked}
					onCheckedChange={(checked) => props.onCheckedChange(Boolean(checked))}
				/>
				<div className="space-y-1">
					<Label
						htmlFor={props.id}
						className="cursor-pointer text-sm font-medium"
					>
						{props.label}
					</Label>
					<p className="text-sm text-muted-foreground">{props.description}</p>
				</div>
			</div>
		</div>
	);
}

export default function ItemVariantSettingsPage() {
	const utils = trpc.useUtils();

	const form = useForm<ItemVariantSettingsFormValues>({
		resolver: zodResolver(itemVariantSettingsFormSchema),
		defaultValues: createItemVariantSettingsFormValues(),
	});
	const { fields, append, remove } = useFieldArray({
		control: form.control,
		name: "copyFields",
		keyName: "key",
	});

	const hasUnsavedChanges = form.formState.isDirty;
	const doNotUpdateVariantsOnSave = useWatch({
		control: form.control,
		name: "doNotUpdateVariantsOnSave",
	});
	const allowRenameAttributeValue = useWatch({
		control: form.control,
		name: "allowRenameAttributeValue",
	});
	const watchedCopyFields =
		useWatch({
			control: form.control,
			name: "copyFields",
		}) ?? [];

	const {
		data: settings,
		isLoading,
		error: queryError,
		refetch,
	} = trpc.inventory.getItemVariantSettings.useQuery(undefined, {
		refetchOnWindowFocus: false,
		retry: 2,
	});

	React.useEffect(() => {
		if (!settings) {
			return;
		}

		form.reset(createItemVariantSettingsFormValues(settings));
	}, [form, settings]);

	const updateMutation = trpc.inventory.updateItemVariantSettings.useMutation({
		onSuccess: async (updatedSettings) => {
			toast.success("Item variant settings saved successfully");
			form.reset(createItemVariantSettingsFormValues(updatedSettings));
			await utils.inventory.getItemVariantSettings.invalidate();
		},
		onError: (error) => {
			toast.error(getToastMessage(error, "update"));
		},
	});

	const onSubmit = (values: ItemVariantSettingsFormValues) => {
		const payload = buildItemVariantSettingsMutationInput(values);
		const parsed = Inventory.updateItemVariantSettingsSchema.safeParse(payload);

		if (!parsed.success) {
			toast.error(
				parsed.error.issues[0]?.message ?? "Invalid item variant settings",
			);
			return;
		}

		updateMutation.mutate(parsed.data);
	};

	const canAddMoreFields =
		watchedCopyFields.length < Inventory.ITEM_VARIANT_COPY_FIELD_OPTIONS.length;

	if (isLoading) {
		return (
			<div className="flex min-h-screen items-center justify-center">
				<Loader2 className="h-8 w-8 animate-spin text-primary" />
			</div>
		);
	}

	if (queryError) {
		return (
			<div className="flex flex-1 flex-col p-4 md:px-6">
				<ErrorState
					error={queryError}
					operation="load"
					title="Failed to load item variant settings"
					onRetry={() => void refetch()}
				/>
			</div>
		);
	}

	const isSubmitting = updateMutation.isPending;

	return (
		<div className="flex min-h-screen flex-col bg-[#f8f9fa] px-4 py-4 md:px-6">
			<div className="mb-4 flex items-center justify-between gap-4">
				<div className="space-y-1">
					<div className="flex items-center gap-3">
						<h1 className="text-3xl font-bold tracking-tight">
							Item Variant Settings
						</h1>
						{hasUnsavedChanges ? (
							<Badge className="border-none bg-orange-50 text-orange-600 hover:bg-orange-50 dark:bg-orange-950/30 dark:text-orange-400">
								Not Saved
							</Badge>
						) : null}
					</div>
					<p className="text-sm text-muted-foreground">
						Define how template item fields flow into generated variants and
						whether attribute values can be renamed after they are introduced.
					</p>
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
				<section className="space-y-4 border-b px-5 py-5">
					<div className="space-y-1">
						<h2 className="text-lg font-semibold">Variant Update Rules</h2>
						<p className="text-sm text-muted-foreground">
							Configure how variant records react when the source template item
							or attribute values change.
						</p>
					</div>
					<div className="grid gap-4 md:grid-cols-2">
						<SettingsCheckboxField
							id="doNotUpdateVariantsOnSave"
							label="Do not update variants on save"
							description="When enabled, template edits stop propagating copied field values into existing variants."
							checked={Boolean(doNotUpdateVariantsOnSave)}
							onCheckedChange={(checked) =>
								form.setValue("doNotUpdateVariantsOnSave", checked, {
									shouldDirty: true,
								})
							}
						/>
						<SettingsCheckboxField
							id="allowRenameAttributeValue"
							label="Allow Rename Attribute Value"
							description="Allow administrators to rename attribute values after they have already been used by variants."
							checked={Boolean(allowRenameAttributeValue)}
							onCheckedChange={(checked) =>
								form.setValue("allowRenameAttributeValue", checked, {
									shouldDirty: true,
								})
							}
						/>
					</div>
				</section>

				<section className="space-y-4 px-5 py-5">
					<div className="flex items-start justify-between gap-4">
						<div className="space-y-1">
							<h2 className="text-lg font-semibold">Copy Fields to Variant</h2>
							<p className="text-sm text-muted-foreground">
								Choose which item fields are automatically copied into each
								generated variant.
							</p>
						</div>
						<Button
							type="button"
							variant="outline"
							onClick={() => append({ fieldKey: "" })}
							disabled={!canAddMoreFields}
						>
							<Plus className="mr-2 h-4 w-4" />
							Add Row
						</Button>
					</div>

					<div className="overflow-hidden rounded-lg border">
						<table className="w-full border-collapse text-sm">
							<thead className="bg-muted/40">
								<tr>
									<th className="w-16 border-b px-3 py-2 text-left font-medium">
										No.
									</th>
									<th className="border-b px-3 py-2 text-left font-medium">
										Field Name
									</th>
									<th className="w-24 border-b px-3 py-2 text-right font-medium">
										Action
									</th>
								</tr>
							</thead>
							<tbody>
								{fields.length === 0 ? (
									<tr>
										<td
											colSpan={3}
											className="px-3 py-8 text-center text-muted-foreground"
										>
											No copy rules configured yet. Add the fields that every
											variant should inherit.
										</td>
									</tr>
								) : (
									fields.map((field, index) => {
										const currentFieldKey =
											watchedCopyFields[index]?.fieldKey ?? "";
										const rowOptions = getSelectableItemVariantCopyFieldOptions(
											watchedCopyFields.map((row) => row?.fieldKey ?? ""),
											currentFieldKey,
										);
										const selectedOption =
											Inventory.ITEM_VARIANT_COPY_FIELD_OPTIONS.find(
												(option) => option.value === currentFieldKey,
											);

										return (
											<tr key={field.key} className="align-top">
												<td className="border-b px-3 py-3 text-muted-foreground">
													{index + 1}
												</td>
												<td className="border-b px-3 py-3">
													<div className="space-y-2">
														<Label
															htmlFor={`copyFields.${index}.fieldKey`}
															className="sr-only"
														>
															Field Name
														</Label>
														<select
															id={`copyFields.${index}.fieldKey`}
															aria-label="Field Name"
															className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
															{...form.register(`copyFields.${index}.fieldKey`)}
														>
															<option value="">Select a field</option>
															{rowOptions.map((option) => (
																<option key={option.value} value={option.value}>
																	{option.value}
																</option>
															))}
														</select>
														{form.formState.errors.copyFields?.[index]
															?.fieldKey ? (
															<p className="text-xs text-destructive">
																{
																	form.formState.errors.copyFields[index]
																		?.fieldKey?.message
																}
															</p>
														) : null}
														{selectedOption ? (
															<p className="text-xs text-muted-foreground">
																{getItemVariantCopyFieldLabel(
																	selectedOption.value,
																)}{" "}
																· {selectedOption.category}
															</p>
														) : null}
													</div>
												</td>
												<td className="border-b px-3 py-3 text-right">
													<Button
														type="button"
														variant="ghost"
														size="icon"
														onClick={() => remove(index)}
														aria-label={`Remove copy field row ${index + 1}`}
													>
														<Trash2 className="h-4 w-4" />
													</Button>
												</td>
											</tr>
										);
									})
								)}
							</tbody>
						</table>
					</div>

					<p className="text-sm text-muted-foreground">
						Available fields: {Inventory.ITEM_VARIANT_COPY_FIELD_OPTIONS.length}
						. Copy rules remain ordered and keep their row identity during
						updates.
					</p>
				</section>
			</div>
		</div>
	);
}
