"use client";

import { format } from "date-fns";
import { Calendar, Download, Eye, Filter, Search } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { trpc } from "@/lib/trpc/client";

type AuditLog = {
	id: string;
	action: string;
	actorUserId: string | null;
	subjectId: string | null;
	metadata: unknown;
	createdAt: string;
};

export default function AuditPage() {
	const [limit, setLimit] = useState(50);
	const [search, setSearch] = useState("");
	const [actionFilter, setActionFilter] = useState<string>("");
	const [showFilters, setShowFilters] = useState(false);
	const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
	const [detailsOpen, setDetailsOpen] = useState(false);

	const { data: auditData, isLoading } = trpc.admin.getAuditLogs.useQuery({
		limit,
	});

	const openDetails = (log: AuditLog) => {
		setSelectedLog(log);
		setDetailsOpen(true);
	};

	const logs = (auditData?.logs || []) as AuditLog[];

	const filteredLogs = logs.filter((log) => {
		const matchesSearch =
			!search ||
			log.action.toLowerCase().includes(search.toLowerCase()) ||
			log.actorUserId?.toLowerCase().includes(search.toLowerCase()) ||
			log.subjectId?.toLowerCase().includes(search.toLowerCase());

		const matchesAction = !actionFilter || log.action === actionFilter;

		return matchesSearch && matchesAction;
	});

	const uniqueActions = Array.from(new Set(logs.map((log) => log.action)));

	const exportToCsv = () => {
		if (!filteredLogs || filteredLogs.length === 0) return;
		const headers = ["Timestamp", "Action", "Actor", "Subject", "Metadata"];
		const rows = filteredLogs.map((log) => [
			format(new Date(log.createdAt), "yyyy-MM-dd HH:mm:ss"),
			log.action,
			log.actorUserId || "System",
			log.subjectId || "",
			log.metadata && typeof log.metadata === "object"
				? JSON.stringify(log.metadata)
				: "",
		]);
		const csvContent = [
			headers.join(","),
			...rows.map((row) =>
				row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
			),
		].join("\n");
		const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;
		link.download = `audit-logs-${format(new Date(), "yyyy-MM-dd")}.csv`;
		link.click();
		URL.revokeObjectURL(url);
	};

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-3xl font-bold tracking-tight">Audit Logs</h2>
					<p className="text-muted-foreground">
						Authorization change history and activity log
					</p>
				</div>
				<div className="flex gap-2">
					<Button
						variant="outline"
						onClick={() => setShowFilters(!showFilters)}
					>
						<Filter className="mr-2 h-4 w-4" />
						{showFilters ? "Hide Filters" : "Show Filters"}
					</Button>
					<Button
						variant="outline"
						onClick={exportToCsv}
						disabled={filteredLogs.length === 0}
					>
						<Download className="mr-2 h-4 w-4" />
						Export
					</Button>
				</div>
			</div>

			{showFilters && (
				<div className="grid gap-4 md:grid-cols-3 p-4 border rounded-lg bg-muted/50">
					<div className="space-y-2">
						<Label htmlFor="search">Search</Label>
						<div className="relative">
							<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
							<Input
								id="search"
								placeholder="Search logs..."
								value={search}
								onChange={(e) => setSearch(e.target.value)}
								className="pl-10"
							/>
						</div>
					</div>
					<div className="space-y-2">
						<Label htmlFor="action-filter">Action Type</Label>
						<Select value={actionFilter} onValueChange={setActionFilter}>
							<SelectTrigger id="action-filter">
								<SelectValue placeholder="All actions" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="">All actions</SelectItem>
								{uniqueActions.map((action) => (
									<SelectItem key={action} value={action}>
										{action}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="space-y-2">
						<Label htmlFor="limit">Results per page</Label>
						<Select
							value={limit.toString()}
							onValueChange={(val) => setLimit(parseInt(val, 10))}
						>
							<SelectTrigger id="limit">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="25">25</SelectItem>
								<SelectItem value="50">50</SelectItem>
								<SelectItem value="100">100</SelectItem>
								<SelectItem value="200">200</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</div>
			)}

			{isLoading ? (
				<div className="flex items-center justify-center py-12">
					<div className="text-center">
						<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
						<p className="text-muted-foreground">Loading audit logs...</p>
					</div>
				</div>
			) : (
				<>
					<div className="border rounded-lg">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead className="w-[180px]">Timestamp</TableHead>
									<TableHead>Action</TableHead>
									<TableHead>Actor</TableHead>
									<TableHead>Subject</TableHead>
									<TableHead>Details</TableHead>
									<TableHead className="w-[50px]"></TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{filteredLogs?.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={6}
											className="text-center py-8 text-muted-foreground"
										>
											No audit logs found
										</TableCell>
									</TableRow>
								) : (
									filteredLogs?.map((log) => (
										<TableRow key={log.id}>
											<TableCell className="font-mono text-xs">
												<div className="flex items-center gap-2">
													<Calendar className="h-3 w-3 text-muted-foreground" />
													{format(new Date(log.createdAt), "MMM dd, yyyy")}
												</div>
												<div className="text-muted-foreground ml-5">
													{format(new Date(log.createdAt), "HH:mm:ss")}
												</div>
											</TableCell>
											<TableCell>
												<Badge variant={getActionVariant(log.action)}>
													{log.action}
												</Badge>
											</TableCell>
											<TableCell className="text-sm font-medium">
												{log.actorUserId || "System"}
											</TableCell>
											<TableCell className="text-sm">
												{log.subjectId || "-"}
											</TableCell>
											<TableCell>
												<div className="text-xs text-muted-foreground max-w-md truncate">
													{log.metadata && typeof log.metadata === "object"
														? Object.entries(
																log.metadata as Record<string, unknown>,
															)
																.slice(0, 2)
																.map(([key, value]) => `${key}: ${value}`)
																.join(", ")
														: "-"}
												</div>
											</TableCell>
											<TableCell>
												<Button
													variant="ghost"
													size="icon"
													onClick={() => openDetails(log)}
												>
													<Eye className="h-4 w-4" />
												</Button>
											</TableCell>
										</TableRow>
									))
								)}
							</TableBody>
						</Table>
					</div>

					{filteredLogs && filteredLogs.length > 0 && (
						<div className="flex items-center justify-between text-sm text-muted-foreground">
							<p>
								Showing {filteredLogs.length} of {auditData?.logs.length || 0}{" "}
								logs
							</p>
							{search || actionFilter ? (
								<Button
									variant="outline"
									size="sm"
									onClick={() => {
										setSearch("");
										setActionFilter("");
									}}
								>
									Clear Filters
								</Button>
							) : null}
						</div>
					)}
				</>
			)}

			{/* Log Details Dialog */}
			<Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
				<DialogContent className="sm:max-w-[600px]">
					<DialogHeader>
						<DialogTitle>Audit Log Details</DialogTitle>
						<DialogDescription>
							{selectedLog && format(new Date(selectedLog.createdAt), "PPpp")}
						</DialogDescription>
					</DialogHeader>
					{selectedLog && (
						<div className="space-y-4">
							<div className="grid grid-cols-2 gap-4">
								<div>
									<Label className="text-xs text-muted-foreground">
										Action
									</Label>
									<Badge
										variant={getActionVariant(selectedLog.action)}
										className="mt-1"
									>
										{selectedLog.action}
									</Badge>
								</div>
								<div>
									<Label className="text-xs text-muted-foreground">
										Timestamp
									</Label>
									<p className="font-mono text-sm mt-1">
										{format(
											new Date(selectedLog.createdAt),
											"MMM dd, yyyy HH:mm:ss",
										)}
									</p>
								</div>
								<div>
									<Label className="text-xs text-muted-foreground">Actor</Label>
									<p className="text-sm font-medium mt-1">
										{selectedLog.actorUserId || "System"}
									</p>
								</div>
								<div>
									<Label className="text-xs text-muted-foreground">
										Subject ID
									</Label>
									<p className="text-sm font-medium mt-1">
										{selectedLog.subjectId || "N/A"}
									</p>
								</div>
							</div>

							<div>
								<Label className="text-xs text-muted-foreground">
									Metadata
								</Label>
								<ScrollArea className="h-[200px] mt-2">
									<pre className="text-xs bg-muted p-4 rounded-lg overflow-x-auto">
										{JSON.stringify(selectedLog.metadata, null, 2)}
									</pre>
								</ScrollArea>
							</div>

							<div className="grid grid-cols-2 gap-4 pt-4 border-t">
								<div>
									<Label className="text-xs text-muted-foreground">
										Log ID
									</Label>
									<p className="font-mono text-xs mt-1">{selectedLog.id}</p>
								</div>
								<div>
									<Label className="text-xs text-muted-foreground">
										Created At
									</Label>
									<p className="font-mono text-xs mt-1">
										{format(
											new Date(selectedLog.createdAt),
											"MMM dd, yyyy HH:mm:ss",
										)}
									</p>
								</div>
							</div>
						</div>
					)}
				</DialogContent>
			</Dialog>
		</div>
	);
}

function getActionVariant(
	action: string,
): "default" | "secondary" | "destructive" | "outline" {
	const actionLower = action.toLowerCase();
	if (actionLower.includes("delete") || actionLower.includes("remove")) {
		return "destructive";
	}
	if (actionLower.includes("create") || actionLower.includes("add")) {
		return "default";
	}
	if (actionLower.includes("update") || actionLower.includes("edit")) {
		return "secondary";
	}
	return "outline";
}
