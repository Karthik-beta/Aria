"use client";

import type { Asset } from "@aria/types";
import { ChevronDown, Loader2 } from "lucide-react";
import * as React from "react";
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
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { useDebounce } from "@/hooks/use-debounce";
import { authClient } from "@/lib/auth/client";
import { trpc } from "@/lib/trpc";

const SELECTOR_PAGE_SIZE = 50;

type IdentifiedOption = { id: string };

export type AssetSelectorItem = Pick<
	Asset.AssetItem,
	| "id"
	| "series"
	| "assetName"
	| "companyId"
	| "company"
	| "status"
	| "locationId"
	| "locationName"
	| "custodian"
	| "valueAfterDepreciation"
	| "financeBooks"
>;

type ServerBackedSelectProps<T extends IdentifiedOption> = {
	id?: string;
	value: string | null | undefined;
	onValueChange: (value: string) => void;
	items: T[];
	totalCount: number;
	isLoading: boolean;
	isFetching?: boolean;
	search: string;
	onSearchChange: (value: string) => void;
	page: number;
	onPageChange: (page: number) => void;
	getLabel: (item: T) => string;
	selectedLabel?: string;
	placeholder: string;
	searchPlaceholder: string;
	emptyMessage: string;
	disabled?: boolean;
	onSelect?: (item: T) => void;
};

function ServerBackedSelect<T extends IdentifiedOption>({
	id,
	value,
	onValueChange,
	items,
	totalCount,
	isLoading,
	isFetching = false,
	search,
	onSearchChange,
	page,
	onPageChange,
	getLabel,
	selectedLabel,
	placeholder,
	searchPlaceholder,
	emptyMessage,
	disabled = false,
	onSelect,
}: ServerBackedSelectProps<T>) {
	const [open, setOpen] = React.useState(false);
	const [selectedItem, setSelectedItem] = React.useState<T | null>(null);

	React.useEffect(() => {
		if (!value) {
			setSelectedItem(null);
			return;
		}
		const current = items.find((item) => item.id === value);
		if (current) setSelectedItem(current);
	}, [items, value]);

	const currentItem =
		items.find((item) => item.id === value) ??
		(selectedItem?.id === value ? selectedItem : null);
	const displayValue = currentItem
		? getLabel(currentItem)
		: selectedLabel || placeholder;
	const hasNextPage = (page + 1) * SELECTOR_PAGE_SIZE < totalCount;

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					id={id}
					type="button"
					variant="outline"
					className="h-10 w-full justify-between font-normal"
					aria-label={placeholder}
					disabled={disabled}
				>
					<span className="truncate text-left">{displayValue}</span>
					<ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
				</Button>
			</PopoverTrigger>
			<PopoverContent
				className="pointer-events-auto w-[var(--radix-popover-trigger-width)] p-0"
				align="start"
			>
				<Command shouldFilter={false}>
					<CommandInput
						value={search}
						onValueChange={onSearchChange}
						placeholder={searchPlaceholder}
					/>
					<CommandList>
						{isLoading && items.length === 0 ? (
							<div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
								<Loader2 className="h-4 w-4 animate-spin" />
								Loading…
							</div>
						) : (
							<CommandEmpty>{emptyMessage}</CommandEmpty>
						)}
						<CommandGroup>
							{items.map((item) => (
								<CommandItem
									key={item.id}
									value={item.id}
									onSelect={() => {
										setSelectedItem(item);
										onValueChange(item.id);
										onSelect?.(item);
										setOpen(false);
									}}
								>
									{getLabel(item)}
								</CommandItem>
							))}
						</CommandGroup>
						{hasNextPage && (
							<div className="border-t p-2">
								<Button
									type="button"
									variant="ghost"
									size="sm"
									className="w-full"
									disabled={isFetching}
									onClick={() => onPageChange(page + 1)}
								>
									{isFetching ? "Loading…" : "Load more"}
								</Button>
							</div>
						)}
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}

function usePagedSearch(search: string) {
	const [page, setPage] = React.useState(0);
	const debouncedSearch = useDebounce(search.trim(), 250);

	return {
		page,
		setPage,
		search: debouncedSearch || undefined,
	};
}

function appendUniqueItems<T extends IdentifiedOption>(
	current: T[],
	next: T[],
): T[] {
	const additions = next.filter(
		(item) => !current.some((existing) => existing.id === item.id),
	);
	if (additions.length === 0) return current;

	return [...current, ...additions];
}

function hasSameItems<T extends IdentifiedOption>(
	current: T[],
	next: T[],
): boolean {
	if (current.length !== next.length) return false;

	return current.every(
		(item, index) =>
			item.id === next[index]?.id &&
			JSON.stringify(item) === JSON.stringify(next[index]),
	);
}

function mergePageItems<T extends IdentifiedOption>(
	current: T[],
	next: T[],
	page: number,
): T[] {
	if (page === 0) {
		return hasSameItems(current, next) ? current : next;
	}

	return appendUniqueItems(current, next);
}

function usePagedSelectorItems<T extends IdentifiedOption>(
	fetchedItems: T[] | undefined,
	page: number,
	scopeKey: string,
	setPage: React.Dispatch<React.SetStateAction<number>>,
) {
	const [items, setItems] = React.useState<T[]>([]);
	const scopeRef = React.useRef(scopeKey);

	React.useEffect(() => {
		if (scopeRef.current !== scopeKey) {
			scopeRef.current = scopeKey;
			setItems(page === 0 ? (fetchedItems ?? []) : []);
			if (page !== 0) setPage(0);
			return;
		}

		setItems((current) => mergePageItems(current, fetchedItems ?? [], page));
	}, [fetchedItems, page, scopeKey, setPage]);

	return { items, setItems };
}

/** Selects an organization-scoped Asset through server search and pagination. */
export function AssetSearchSelect({
	value,
	onValueChange,
	onSelect,
	selectedLabel,
	placeholder = "Select asset",
	disabled,
	status,
}: {
	value: string | null | undefined;
	onValueChange: (value: string) => void;
	onSelect?: (asset: AssetSelectorItem) => void;
	selectedLabel?: string;
	placeholder?: string;
	disabled?: boolean;
	status?: Asset.AssetStatus;
}) {
	const [search, setSearch] = React.useState("");
	const { page, setPage, search: querySearch } = usePagedSearch(search);
	const { data, isLoading, isFetching } = trpc.asset.listAssets.useQuery(
		{
			skip: page * SELECTOR_PAGE_SIZE,
			take: SELECTOR_PAGE_SIZE,
			search: querySearch,
			status,
		},
		{ enabled: true, refetchOnWindowFocus: false, staleTime: 30_000 },
	);
	const { items, setItems } = usePagedSelectorItems(
		data?.items,
		page,
		JSON.stringify([querySearch ?? "", status ?? null]),
		setPage,
	);
	const handleSearchChange = React.useCallback(
		(value: string) => {
			setSearch(value);
			setPage(0);
			setItems([]);
		},
		[setItems, setPage],
	);

	return (
		<ServerBackedSelect
			value={value}
			onValueChange={onValueChange}
			items={items}
			totalCount={data?.totalCount ?? 0}
			isLoading={isLoading}
			isFetching={isFetching}
			search={search}
			onSearchChange={handleSearchChange}
			page={page}
			onPageChange={setPage}
			getLabel={(asset) => `${asset.series} — ${asset.assetName}`}
			selectedLabel={selectedLabel}
			placeholder={placeholder}
			searchPlaceholder="Search assets…"
			emptyMessage="No authorized assets found"
			disabled={disabled}
			onSelect={onSelect}
		/>
	);
}

/** Selects an organization-scoped Location through server search and pagination. */
export function LocationSearchSelect({
	value,
	onValueChange,
	selectedLabel,
	placeholder = "Select location",
	disabled,
	isGroup,
}: {
	value: string | null | undefined;
	onValueChange: (value: string) => void;
	selectedLabel?: string;
	placeholder?: string;
	disabled?: boolean;
	isGroup?: boolean;
}) {
	const [search, setSearch] = React.useState("");
	const { page, setPage, search: querySearch } = usePagedSearch(search);
	const { data, isLoading, isFetching } = trpc.asset.listLocations.useQuery(
		{
			skip: page * SELECTOR_PAGE_SIZE,
			take: SELECTOR_PAGE_SIZE,
			search: querySearch,
			isGroup,
		},
		{ refetchOnWindowFocus: false, staleTime: 30_000 },
	);
	const { items, setItems } = usePagedSelectorItems(
		data?.items,
		page,
		JSON.stringify([querySearch ?? "", isGroup ?? null]),
		setPage,
	);
	const handleSearchChange = React.useCallback(
		(value: string) => {
			setSearch(value);
			setPage(0);
			setItems([]);
		},
		[setItems, setPage],
	);

	return (
		<ServerBackedSelect
			value={value}
			onValueChange={onValueChange}
			items={items}
			totalCount={data?.totalCount ?? 0}
			isLoading={isLoading}
			isFetching={isFetching}
			search={search}
			onSearchChange={handleSearchChange}
			page={page}
			onPageChange={setPage}
			getLabel={(location) => location.name}
			selectedLabel={selectedLabel}
			placeholder={placeholder}
			searchPlaceholder="Search locations…"
			emptyMessage="No authorized locations found"
			disabled={disabled}
		/>
	);
}

/** Selects an organization-scoped Company through server search and pagination. */
export function CompanySearchSelect({
	id,
	value,
	onValueChange,
	selectedLabel,
	placeholder = "Select company",
	disabled,
}: {
	id?: string;
	value: string | null | undefined;
	onValueChange: (value: string) => void;
	selectedLabel?: string;
	placeholder?: string;
	disabled?: boolean;
}) {
	const [search, setSearch] = React.useState("");
	const { page, setPage, search: querySearch } = usePagedSearch(search);
	const { data, isLoading, isFetching } = trpc.company.listCompanies.useQuery(
		{
			skip: page * SELECTOR_PAGE_SIZE,
			take: SELECTOR_PAGE_SIZE,
			search: querySearch,
		},
		{ refetchOnWindowFocus: false, staleTime: 30_000 },
	);
	const { items, setItems } = usePagedSelectorItems(
		data?.items,
		page,
		JSON.stringify([querySearch ?? ""]),
		setPage,
	);
	const handleSearchChange = React.useCallback(
		(value: string) => {
			setSearch(value);
			setPage(0);
			setItems([]);
		},
		[setItems, setPage],
	);

	return (
		<ServerBackedSelect
			id={id}
			value={value}
			onValueChange={onValueChange}
			items={items}
			totalCount={data?.totalCount ?? 0}
			isLoading={isLoading}
			isFetching={isFetching}
			search={search}
			onSearchChange={handleSearchChange}
			page={page}
			onPageChange={setPage}
			getLabel={(company) => company.name}
			selectedLabel={selectedLabel}
			placeholder={placeholder}
			searchPlaceholder="Search companies…"
			emptyMessage="No authorized companies found"
			disabled={disabled}
		/>
	);
}

/** Selects an organization-scoped maintenance team through server search/pagination. */
export function MaintenanceTeamSearchSelect({
	value,
	onValueChange,
	selectedLabel,
	placeholder = "Select maintenance team",
	disabled,
	company,
}: {
	value: string | null | undefined;
	onValueChange: (value: string) => void;
	selectedLabel?: string;
	placeholder?: string;
	disabled?: boolean;
	company?: string;
}) {
	const [search, setSearch] = React.useState("");
	const { page, setPage, search: querySearch } = usePagedSearch(search);
	const { data, isLoading, isFetching } =
		trpc.asset.listMaintenanceTeams.useQuery(
			{
				skip: page * SELECTOR_PAGE_SIZE,
				take: SELECTOR_PAGE_SIZE,
				search: querySearch,
				company,
			},
			{ refetchOnWindowFocus: false, staleTime: 30_000 },
		);
	const { items, setItems } = usePagedSelectorItems(
		data?.items,
		page,
		JSON.stringify([querySearch ?? "", company ?? null]),
		setPage,
	);
	const handleSearchChange = React.useCallback(
		(value: string) => {
			setSearch(value);
			setPage(0);
			setItems([]);
		},
		[setItems, setPage],
	);

	return (
		<ServerBackedSelect
			value={value}
			onValueChange={onValueChange}
			items={items}
			totalCount={data?.totalCount ?? 0}
			isLoading={isLoading}
			isFetching={isFetching}
			search={search}
			onSearchChange={handleSearchChange}
			page={page}
			onPageChange={setPage}
			getLabel={(team) => team.name}
			selectedLabel={selectedLabel}
			placeholder={placeholder}
			searchPlaceholder="Search maintenance teams…"
			emptyMessage="No authorized maintenance teams found"
			disabled={disabled}
		/>
	);
}

export type OrganizationMemberOption = {
	id: string;
	userId: string;
	role: string;
	user?: { id: string; name: string; email: string };
};

/**
 * Selects members from Better Auth's active organization. The endpoint owns
 * organization scope; the client only controls pagination and display search.
 */
export function OrganizationMemberSearchSelect({
	value,
	onValueChange,
	onSelect,
	selectedLabel,
	placeholder = "Select organization member",
	disabled,
}: {
	value: string | null | undefined;
	onValueChange: (value: string) => void;
	onSelect?: (member: OrganizationMemberOption) => void;
	selectedLabel?: string;
	placeholder?: string;
	disabled?: boolean;
}) {
	const [open, setOpen] = React.useState(false);
	const [search, setSearch] = React.useState("");
	const [page, setPage] = React.useState(0);
	const [items, setItems] = React.useState<OrganizationMemberOption[]>([]);
	const [totalCount, setTotalCount] = React.useState(0);
	const [isLoading, setIsLoading] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);
	const [selectedItem, setSelectedItem] =
		React.useState<OrganizationMemberOption | null>(null);
	const debouncedSearch = useDebounce(search.trim(), 250);

	React.useEffect(() => {
		if (!open) return;
		let active = true;
		setIsLoading(true);
		setError(null);
		void authClient.organization
			.listMembers({
				query: {
					limit: SELECTOR_PAGE_SIZE,
					offset: page * SELECTOR_PAGE_SIZE,
				},
			})
			.then(({ data, error: responseError }) => {
				if (!active) return;
				if (responseError) {
					setError(responseError.message ?? "Unable to load members");
					return;
				}
				const nextItems = (data?.members ?? []) as OrganizationMemberOption[];
				setItems((current) =>
					page === 0
						? nextItems
						: [
								...current,
								...nextItems.filter(
									(next) => !current.some((item) => item.id === next.id),
								),
							],
				);
				setTotalCount(data?.total ?? 0);
			})
			.catch(() => {
				if (active) setError("Unable to load members");
			})
			.finally(() => {
				if (active) setIsLoading(false);
			});

		return () => {
			active = false;
		};
	}, [open, page]);

	const visibleItems = React.useMemo(() => {
		const needle = debouncedSearch.toLocaleLowerCase();
		if (!needle) return items;
		return items.filter((member) => {
			const name = member.user?.name ?? "";
			const email = member.user?.email ?? "";
			return `${name} ${email} ${member.userId}`
				.toLocaleLowerCase()
				.includes(needle);
		});
	}, [debouncedSearch, items]);

	const currentItem =
		visibleItems.find((item) => item.userId === value) ??
		items.find((item) => item.userId === value) ??
		(selectedItem?.userId === value ? selectedItem : null);
	const displayValue = currentItem
		? memberLabel(currentItem)
		: selectedLabel || placeholder;
	const hasNextPage = (page + 1) * SELECTOR_PAGE_SIZE < totalCount;

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					type="button"
					variant="outline"
					className="h-10 w-full justify-between font-normal"
					aria-label={placeholder}
					disabled={disabled}
				>
					<span className="truncate text-left">{displayValue}</span>
					<ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
				</Button>
			</PopoverTrigger>
			<PopoverContent
				className="pointer-events-auto w-[var(--radix-popover-trigger-width)] p-0"
				align="start"
			>
				<Command shouldFilter={false}>
					<CommandInput
						value={search}
						onValueChange={setSearch}
						placeholder="Search loaded members…"
					/>
					<CommandList>
						{isLoading && items.length === 0 ? (
							<div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
								<Loader2 className="h-4 w-4 animate-spin" />
								Loading…
							</div>
						) : error ? (
							<CommandEmpty>{error}</CommandEmpty>
						) : (
							<CommandEmpty>No loaded members match</CommandEmpty>
						)}
						<CommandGroup>
							{visibleItems.map((member) => (
								<CommandItem
									key={member.id}
									value={member.id}
									onSelect={() => {
										setSelectedItem(member);
										onValueChange(member.userId);
										onSelect?.(member);
										setOpen(false);
									}}
								>
									{memberLabel(member)}
								</CommandItem>
							))}
						</CommandGroup>
						{hasNextPage && (
							<div className="border-t p-2">
								<Button
									type="button"
									variant="ghost"
									size="sm"
									className="w-full"
									disabled={isLoading}
									onClick={() => setPage((current) => current + 1)}
								>
									{isLoading ? "Loading…" : "Load more members"}
								</Button>
							</div>
						)}
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}

function memberLabel(member: OrganizationMemberOption): string {
	const name = member.user?.name?.trim();
	const email = member.user?.email?.trim();
	if (name && email) return `${name} — ${email}`;
	return name || email || member.userId;
}
