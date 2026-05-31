import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface DataTableSkeletonProps extends React.ComponentProps<"div"> {
	columnCount: number;
	rowCount?: number;
	filterCount?: number;
	cellWidths?: string[];
	withViewOptions?: boolean;
	withPagination?: boolean;
	shrinkZero?: boolean;
}

export function DataTableSkeleton({
	columnCount,
	rowCount = 10,
	filterCount = 0,
	cellWidths = ["auto"],
	withViewOptions = true,
	withPagination = true,
	shrinkZero = false,
	className,
	...props
}: DataTableSkeletonProps) {
	const cozyCellWidths = Array.from(
		{ length: columnCount },
		(_, index) => cellWidths[index % cellWidths.length] ?? "auto",
	);

	const filterKeys = Array.from(
		{ length: filterCount },
		(_, index) => `filter-${index + 1}`,
	);
	const columnDefs = Array.from({ length: columnCount }, (_, index) => ({
		key: `col-${index + 1}`,
		width: cozyCellWidths[index],
	}));
	const rowKeys = Array.from(
		{ length: rowCount },
		(_, index) => `row-${index + 1}`,
	);

	return (
		<div className={cn("flex flex-1 flex-col space-y-4", className)} {...props}>
			<div className="flex w-full items-center justify-between gap-2 overflow-auto p-1">
				<div className="flex flex-1 items-center gap-2">
					{filterCount > 0
						? filterKeys.map((filterKey) => (
								<Skeleton
									key={filterKey}
									className="h-7 w-[4.5rem] border-dashed"
								/>
							))
						: null}
				</div>
				{withViewOptions ? (
					<Skeleton className="ml-auto hidden h-7 w-[4.5rem] lg:flex" />
				) : null}
			</div>

			<div className="flex-1 rounded-md border">
				<Table>
					<TableHeader>
						<TableRow
							key="skeleton-header-row"
							className="hover:bg-transparent"
						>
							{columnDefs.map((columnDef) => (
								<TableHead
									key={columnDef.key}
									style={{
										width: columnDef.width,
										minWidth: shrinkZero ? columnDef.width : "auto",
									}}
								>
									<Skeleton className="h-6 w-full" />
								</TableHead>
							))}
						</TableRow>
					</TableHeader>
					<TableBody>
						{rowKeys.map((rowKey) => (
							<TableRow key={rowKey} className="hover:bg-transparent">
								{columnDefs.map((columnDef) => (
									<TableCell
										key={`${rowKey}-${columnDef.key}`}
										style={{
											width: columnDef.width,
											minWidth: shrinkZero ? columnDef.width : "auto",
										}}
									>
										<Skeleton className="h-6 w-full" />
									</TableCell>
								))}
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>
			{withPagination ? (
				<div className="flex w-full items-center justify-between gap-4 overflow-auto p-1 sm:gap-8">
					<Skeleton className="h-7 w-40 shrink-0" />
					<div className="flex items-center gap-4 sm:gap-6 lg:gap-8">
						<div className="flex items-center gap-2">
							<Skeleton className="h-7 w-24" />
							<Skeleton className="h-7 w-[4.5rem]" />
						</div>
						<div className="flex items-center justify-center text-sm font-medium">
							<Skeleton className="h-7 w-20" />
						</div>
						<div className="flex items-center gap-2">
							<Skeleton className="hidden size-7 lg:block" />
							<Skeleton className="size-7" />
							<Skeleton className="size-7" />
							<Skeleton className="hidden size-7 lg:block" />
						</div>
					</div>
				</div>
			) : null}
		</div>
	);
}
