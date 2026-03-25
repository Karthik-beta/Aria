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
	name: z.string().min(1, "Brand name is required").max(255).trim(),
});

type QuickCreateValues = z.infer<typeof quickCreateSchema>;

/**
 * NewBrandDialog renders the compact quick-create dialog from the Brand list page.
 *
 * Client component: uses react-hook-form and tRPC to create a new brand while also
 * exposing a handoff link to the full form when the user needs more than the quick entry flow.
 */
export function NewBrandDialog() {
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
		return query
			? `/inventory/inventory-settings/brand/form?${query}`
			: "/inventory/inventory-settings/brand/form";
	}, [quickName]);

	const resetQuickForm = React.useCallback(() => {
		quickForm.reset({ name: "" });
	}, [quickForm]);

	const closeDialog = React.useCallback(() => {
		setIsOpen(false);
		resetQuickForm();
	}, [resetQuickForm]);

	const createMutation = trpc.inventory.createBrand.useMutation({
		onSuccess: async () => {
			toast.success("Brand created successfully");
			closeDialog();
			await utils.inventory.listBrands.invalidate();
		},
		onError: (error) => {
			toast.error(getToastMessage(error, "create"));
		},
	});

	const submitQuickCreate = quickForm.handleSubmit((values) => {
		const parsed = Inventory.createBrandSchema.safeParse({
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
					Add Brand
				</Button>
			</DialogTrigger>

			<DialogContent className="max-w-143.75 gap-0 overflow-hidden p-0">
				<DialogHeader className="border-b px-5 py-4">
					<DialogTitle>New Brand</DialogTitle>
				</DialogHeader>

				<form
					id="new-brand-quick-create-form"
					onSubmit={submitQuickCreate}
					className="space-y-5 px-5 py-5"
				>
					<div className="space-y-2">
						<Label
							htmlFor="quick-brand-name"
							className="text-xs font-medium text-gray-500"
						>
							Brand Name <span className="text-destructive">*</span>
						</Label>
						<Input
							id="quick-brand-name"
							autoFocus
							placeholder="Enter brand name"
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
							form="new-brand-quick-create-form"
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
