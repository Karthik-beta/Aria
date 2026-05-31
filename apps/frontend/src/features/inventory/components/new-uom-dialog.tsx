"use client";

import { Inventory } from "@aria/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";
import { Button } from "@/components/ui/button";
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
import { getToastMessage } from "@/lib/errors";
import { trpc } from "@/lib/trpc";

const quickCreateSchema = z.object({
	name: z.string().min(1, "UOM name is required").max(255).trim(),
});

type QuickCreateValues = z.infer<typeof quickCreateSchema>;

/**
 * NewUomDialog renders the compact quick-create dialog from the UOM list page.
 *
 * Client component: uses react-hook-form and tRPC to create a new unit of measure while also
 * exposing a handoff link to the full form when the user needs more than the quick entry flow.
 */
export function NewUomDialog() {
	const utils = trpc.useUtils();
	const [isOpen, setIsOpen] = React.useState(false);

	const quickForm = useForm<QuickCreateValues>({
		resolver: zodResolver(quickCreateSchema),
		defaultValues: {
			name: "",
		},
	});

	const quickName = quickForm.watch("name");

	const editFullFormHref = React.useMemo(() => {
		const params = new URLSearchParams();
		const normalizedName = quickName.trim();

		if (normalizedName) {
			params.set("name", normalizedName);
		}

		const query = params.toString();
		return query ? `/inventory/uom/form?${query}` : "/inventory/uom/form";
	}, [quickName]);

	const resetQuickForm = React.useCallback(() => {
		quickForm.reset({ name: "" });
	}, [quickForm]);

	const closeDialog = React.useCallback(() => {
		setIsOpen(false);
		resetQuickForm();
	}, [resetQuickForm]);

	const createMutation = trpc.inventory.createUnitOfMeasure.useMutation({
		onSuccess: async () => {
			toast.success("Unit of measure created successfully");
			closeDialog();
			await utils.inventory.listUnitsOfMeasure.invalidate();
		},
		onError: (error) => {
			toast.error(getToastMessage(error, "create"));
		},
	});

	const submitQuickCreate = quickForm.handleSubmit((values) => {
		const parsed = Inventory.createUnitOfMeasureSchema.safeParse({
			name: values.name.trim(),
		});

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
					Add UOM
				</Button>
			</DialogTrigger>

			<DialogContent className="max-w-143.75 gap-0 overflow-hidden p-0">
				<DialogHeader className="border-b px-5 py-4">
					<DialogTitle>New UOM</DialogTitle>
					<DialogDescription>
						Create a new unit of measure for item quantities.
					</DialogDescription>
				</DialogHeader>

				<form
					id="new-uom-quick-create-form"
					onSubmit={submitQuickCreate}
					className="space-y-5 px-5 py-5"
				>
					<div className="space-y-2">
						<Label
							htmlFor="quick-uom-name"
							className="text-xs font-medium text-gray-500"
						>
							UOM Name <span className="text-destructive">*</span>
						</Label>
						<Input
							id="quick-uom-name"
							autoFocus
							placeholder="Enter UOM name"
							className="h-10"
							{...quickForm.register("name")}
						/>
						{quickForm.formState.errors.name && (
							<p className="text-xs text-destructive">
								{quickForm.formState.errors.name.message}
							</p>
						)}
					</div>
				</form>

				<DialogFooter className="border-t px-5 py-4">
					<div className="flex w-full items-center justify-between gap-3">
						<Button asChild variant="outline" className="h-9">
							<Link href={editFullFormHref}>Edit Full Form</Link>
						</Button>
						<Button
							type="submit"
							form="new-uom-quick-create-form"
							className="h-9 px-4"
							disabled={createMutation.isPending}
						>
							{createMutation.isPending ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								"Save"
							)}
						</Button>
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
