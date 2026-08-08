/**
 * Asset Maintenance Team Form Page — create and edit maintenance teams.
 *
 * Reads ?id= param to switch between create/edit modes.
 *
 * Business logic mirrors ERPNext Asset Maintenance Team:
 * - Team name is required and must be unique across all teams.
 * - Maintenance manager is optional (a reference to a user/email).
 * - Company is required.
 * - At least one team member is required; each member needs a team member
 *   identifier, full name, and maintenance role.
 * - Members are managed inline as an editable table (add/remove rows).
 *
 * Client component: uses hooks for form state and tRPC mutations.
 */
"use client";

import { Asset } from "@aria/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDown, Loader2, Plus, Trash2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState, useTransition } from "react";
import {
	Controller,
	type Resolver,
	useFieldArray,
	useForm,
} from "react-hook-form";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
	getMaintenanceTeamFormDefaults,
	type MaintenanceTeamFormValues,
	maintenanceTeamFormSchema,
} from "../maintenance-team.schema";
import {
	toCreateMaintenanceTeamInput,
	toUpdateMaintenanceTeamInput,
} from "../maintenance-team.utils";

export default function MaintenanceTeamFormPage() {
	return (
		<Suspense fallback={<MaintenanceTeamFormFallback />}>
			<MaintenanceTeamFormContent />
		</Suspense>
	);
}

function MaintenanceTeamFormFallback() {
	return (
		<div className="flex min-h-screen items-center justify-center">
			<Loader2 className="h-8 w-8 animate-spin text-primary" />
		</div>
	);
}

function MaintenanceTeamFormContent() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const id = searchParams.get("id");
	const isEditMode = Boolean(id);
	const [isPending, startTransition] = useTransition();
	const hasHandledMissingRef = useRef(false);
	const utils = trpc.useUtils();

	const [companyOpen, setCompanyOpen] = useState(false);
	const { data: companiesData } = trpc.company.listCompanies.useQuery(
		undefined,
		{
			staleTime: 30_000,
		},
	);
	const companies = companiesData?.items ?? [];

	const form = useForm<MaintenanceTeamFormValues>({
		resolver: zodResolver(
			maintenanceTeamFormSchema,
		) as Resolver<MaintenanceTeamFormValues>,
		defaultValues: getMaintenanceTeamFormDefaults(),
	});

	const {
		fields: memberFields,
		append: appendMember,
		remove: removeMember,
	} = useFieldArray({ control: form.control, name: "members" });

	const { data: team, isLoading: isFetchingTeam } =
		trpc.asset.getMaintenanceTeamById.useQuery(
			{ id: id ?? "" },
			{ enabled: isEditMode },
		);

	// Hydrate form in edit mode
	useEffect(() => {
		if (!isEditMode || !team) return;
		if (form.formState.isDirty) return;

		form.reset({
			name: team.name,
			maintenanceManager: team.maintenanceManager ?? "",
			maintenanceManagerName: team.maintenanceManagerName ?? "",
			company: team.company,
			members: team.members.map((m) => ({
				id: m.id,
				teamMember: m.teamMember,
				fullName: m.fullName,
				maintenanceRole: m.maintenanceRole,
			})),
		});
	}, [form, isEditMode, team]);

	// Redirect to list if team not found
	useEffect(() => {
		if (
			isEditMode &&
			!isFetchingTeam &&
			!team &&
			!hasHandledMissingRef.current
		) {
			hasHandledMissingRef.current = true;
			toast.error("Maintenance team not found");
			startTransition(() => {
				router.push("/asset/maintenance-teams");
			});
		}
	}, [isEditMode, isFetchingTeam, team, router]);

	const createMutation = trpc.asset.createMaintenanceTeam.useMutation({
		onSuccess: async (data) => {
			toast.success("Maintenance team created successfully");
			await utils.asset.listMaintenanceTeams.invalidate();
			startTransition(() => {
				router.push(`/asset/maintenance-teams/form?id=${data.id}`);
			});
		},
		onError: (error) => {
			toast.error(getToastMessage(error, "create"));
		},
	});

	const updateMutation = trpc.asset.updateMaintenanceTeam.useMutation({
		onSuccess: async () => {
			toast.success("Maintenance team updated successfully");
			await utils.asset.listMaintenanceTeams.invalidate();
			if (id) {
				await utils.asset.getMaintenanceTeamById.invalidate({ id });
			}
			form.reset(form.getValues());
		},
		onError: (error) => {
			toast.error(getToastMessage(error, "update"));
		},
	});

	const onSubmit = (values: MaintenanceTeamFormValues) => {
		if (isEditMode && id) {
			const payload = toUpdateMaintenanceTeamInput(id, values);
			const parsed = Asset.updateMaintenanceTeamSchema.safeParse(payload);
			if (!parsed.success) {
				toast.error(parsed.error.issues[0]?.message ?? "Invalid form values");
				return;
			}
			updateMutation.mutate(parsed.data);
			return;
		}

		const payload = toCreateMaintenanceTeamInput(values);
		const parsed = Asset.createMaintenanceTeamSchema.safeParse(payload);
		if (!parsed.success) {
			toast.error(parsed.error.issues[0]?.message ?? "Invalid form values");
			return;
		}
		createMutation.mutate(parsed.data);
	};

	const isSubmitting =
		createMutation.isPending || updateMutation.isPending || isPending;
	const hasUnsavedChanges = form.formState.isDirty;

	if (isEditMode && isFetchingTeam) {
		return <MaintenanceTeamFormFallback />;
	}

	const title = isEditMode && team ? team.name : "New Maintenance Team";

	return (
		<div className="flex min-h-screen flex-col bg-muted/20 px-4 py-4 md:px-6">
			<div className="mb-4 flex items-center justify-between">
				<div className="flex items-center gap-3">
					<h1 className="text-3xl font-bold tracking-tight">{title}</h1>
					{hasUnsavedChanges && (
						<Badge className="border-none bg-orange-100 text-orange-700 hover:bg-orange-100 dark:bg-orange-900 dark:text-orange-300">
							Not Saved
						</Badge>
					)}
				</div>
				<div className="flex items-center gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={() =>
							startTransition(() => router.push("/asset/maintenance-teams"))
						}
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

			<div className="space-y-4 overflow-hidden rounded-lg border bg-background shadow-sm">
				{/* ── Team Information ── */}
				<div className="border-b px-5 py-5">
					<h2 className="mb-4 text-lg font-semibold">Team Information</h2>
					<div className="grid gap-6 md:grid-cols-2">
						<div className="space-y-2">
							<Label htmlFor="name">
								Team Name <span className="text-destructive">*</span>
							</Label>
							<Input
								id="name"
								placeholder="Team name"
								{...form.register("name")}
							/>
							{form.formState.errors.name && (
								<p className="text-xs text-destructive">
									{form.formState.errors.name.message}
								</p>
							)}
						</div>

						<div className="space-y-2">
							<Label htmlFor="company">
								Company <span className="text-destructive">*</span>
							</Label>
							<Controller
								name="company"
								control={form.control}
								render={({ field }) => (
									<Popover open={companyOpen} onOpenChange={setCompanyOpen}>
										<PopoverTrigger asChild>
											<Button
												id="company"
												type="button"
												variant="outline"
												className={`h-10 w-full justify-between font-normal ${form.formState.errors.company ? "border-destructive" : ""}`}
											>
												<span className="truncate">
													{field.value || "Select company…"}
												</span>
												<ChevronDown className="h-4 w-4 opacity-50" />
											</Button>
										</PopoverTrigger>
										<PopoverContent
											className="p-0 pointer-events-auto"
											style={{ width: "var(--radix-popover-trigger-width)" }}
										>
											<Command>
												<CommandInput placeholder="Search companies…" />
												<CommandList>
													<CommandEmpty>No companies found</CommandEmpty>
													<CommandGroup>
														{companies.map((comp) => (
															<CommandItem
																key={comp.id}
																onSelect={() => {
																	field.onChange(comp.name);
																	setCompanyOpen(false);
																}}
															>
																{comp.name}
															</CommandItem>
														))}
													</CommandGroup>
												</CommandList>
											</Command>
										</PopoverContent>
									</Popover>
								)}
							/>
							{form.formState.errors.company && (
								<p className="text-xs text-destructive">
									{form.formState.errors.company.message}
								</p>
							)}
						</div>
					</div>
				</div>

				{/* ── Manager Information ── */}
				<div className="border-b px-5 py-5">
					<h2 className="mb-4 text-lg font-semibold">Manager Information</h2>
					<div className="grid gap-6 md:grid-cols-2">
						<div className="space-y-2">
							<Label htmlFor="maintenanceManager">Maintenance Manager</Label>
							<Input
								id="maintenanceManager"
								placeholder="Email or username (optional)"
								{...form.register("maintenanceManager")}
							/>
							{form.formState.errors.maintenanceManager && (
								<p className="text-xs text-destructive">
									{form.formState.errors.maintenanceManager.message}
								</p>
							)}
						</div>

						<div className="space-y-2">
							<Label htmlFor="maintenanceManagerName">
								Manager Display Name
							</Label>
							<Input
								id="maintenanceManagerName"
								placeholder="Full name (optional)"
								{...form.register("maintenanceManagerName")}
							/>
							{form.formState.errors.maintenanceManagerName && (
								<p className="text-xs text-destructive">
									{form.formState.errors.maintenanceManagerName.message}
								</p>
							)}
						</div>
					</div>
				</div>

				{/* ── Team Members ── */}
				<div className="px-5 py-5">
					<div className="mb-4 flex items-center justify-between">
						<div>
							<h2 className="text-lg font-semibold">
								Team Members <span className="text-destructive">*</span>
							</h2>
							{form.formState.errors.members?.root && (
								<p className="text-xs text-destructive">
									{form.formState.errors.members.root.message}
								</p>
							)}
							{typeof form.formState.errors.members?.message === "string" && (
								<p className="text-xs text-destructive">
									{form.formState.errors.members.message}
								</p>
							)}
						</div>
					</div>

					<div className="overflow-x-auto rounded-md border">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead className="w-10" />
									<TableHead>
										Team Member <span className="text-destructive">*</span>
									</TableHead>
									<TableHead>
										Full Name <span className="text-destructive">*</span>
									</TableHead>
									<TableHead>
										Maintenance Role <span className="text-destructive">*</span>
									</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{memberFields.length === 0 && (
									<TableRow>
										<TableCell
											colSpan={4}
											className="py-8 text-center text-sm text-muted-foreground"
										>
											No members added. Click &ldquo;Add Member&rdquo; to get
											started.
										</TableCell>
									</TableRow>
								)}
								{memberFields.map((field, index) => (
									<TableRow key={field.id}>
										<TableCell>
											<Button
												type="button"
												variant="ghost"
												size="icon"
												className="h-7 w-7"
												onClick={() => removeMember(index)}
												aria-label={`Remove member ${index + 1}`}
											>
												<Trash2 className="h-4 w-4" />
											</Button>
										</TableCell>
										<TableCell>
											<Controller
												name={`members.${index}.teamMember`}
												control={form.control}
												render={({ field: f }) => (
													<Input
														className="h-9"
														placeholder="Member ID or email"
														value={f.value}
														onChange={f.onChange}
														onBlur={f.onBlur}
													/>
												)}
											/>
											{form.formState.errors.members?.[index]?.teamMember && (
												<p className="mt-1 text-xs text-destructive">
													{
														form.formState.errors.members[index].teamMember
															?.message
													}
												</p>
											)}
										</TableCell>
										<TableCell>
											<Controller
												name={`members.${index}.fullName`}
												control={form.control}
												render={({ field: f }) => (
													<Input
														className="h-9"
														placeholder="Full name"
														value={f.value}
														onChange={f.onChange}
														onBlur={f.onBlur}
													/>
												)}
											/>
											{form.formState.errors.members?.[index]?.fullName && (
												<p className="mt-1 text-xs text-destructive">
													{
														form.formState.errors.members[index].fullName
															?.message
													}
												</p>
											)}
										</TableCell>
										<TableCell>
											<Controller
												name={`members.${index}.maintenanceRole`}
												control={form.control}
												render={({ field: f }) => (
													<Input
														className="h-9"
														placeholder="Role name"
														value={f.value}
														onChange={f.onChange}
														onBlur={f.onBlur}
													/>
												)}
											/>
											{form.formState.errors.members?.[index]
												?.maintenanceRole && (
												<p className="mt-1 text-xs text-destructive">
													{
														form.formState.errors.members[index].maintenanceRole
															?.message
													}
												</p>
											)}
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
							appendMember({
								teamMember: "",
								fullName: "",
								maintenanceRole: "",
							})
						}
					>
						<Plus className="mr-2 h-4 w-4" />
						Add Member
					</Button>
				</div>
			</div>
		</div>
	);
}
