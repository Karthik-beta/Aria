"use client";

import { formatDistanceToNow } from "date-fns";
import {
	Activity,
	AlertCircle,
	Clock,
	FileText,
	Shield,
	TrendingUp,
	UserCheck,
	Users,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";
import {
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	Legend,
	Pie,
	PieChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import PageContainer from "@/components/layout/page-container";
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc/client";

const ROLE_COLORS = [
	"hsl(var(--chart-1))",
	"hsl(var(--chart-2))",
	"hsl(var(--chart-3))",
	"hsl(var(--chart-4))",
	"hsl(var(--chart-5))",
	"hsl(var(--primary))",
];

function getActivityType(
	action: string,
): "create" | "delete" | "update" | "other" {
	const lower = action.toLowerCase();
	if (lower.includes("create") || lower.includes("assign")) return "create";
	if (lower.includes("delete") || lower.includes("remove")) return "delete";
	if (lower.includes("update") || lower.includes("change")) return "update";
	return "other";
}

function getActionBadgeVariant(
	type: string,
): "default" | "destructive" | "secondary" | "outline" {
	if (type === "create") return "default";
	if (type === "delete") return "destructive";
	if (type === "update") return "secondary";
	return "outline";
}

const SKELETON_KEYS = ["total", "active", "roles", "recent"] as const;

function StatsLoadingSkeleton() {
	return (
		<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
			{SKELETON_KEYS.map((id) => (
				<Card key={id}>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<Skeleton className="h-4 w-24" />
						<Skeleton className="h-4 w-4" />
					</CardHeader>
					<CardContent>
						<Skeleton className="h-8 w-16 mb-1" />
						<Skeleton className="h-3 w-32" />
					</CardContent>
				</Card>
			))}
		</div>
	);
}

export default function AdminDashboard() {
	const [isClient, setIsClient] = React.useState(false);

	React.useEffect(() => {
		setIsClient(true);
	}, []);

	const { data: usersData, isLoading: usersLoading } =
		trpc.admin.listUsers.useQuery({
			page: 1,
			limit: 100,
		});
	const { data: rolesData, isLoading: rolesLoading } =
		trpc.admin.listRoles.useQuery();
	const { data: auditData, isLoading: auditLoading } =
		trpc.admin.getAuditLogs.useQuery({ limit: 50 });

	const statsLoading = usersLoading || rolesLoading || auditLoading;

	const totalUsers = usersData?.users.length ?? 0;
	const activeUsers = usersData?.users.filter((u) => u.isActive).length ?? 0;
	const totalRoles = rolesData?.length ?? 0;
	const recentActions = auditData?.logs.length ?? 0;
	const activeRate =
		totalUsers > 0 ? ((activeUsers / totalUsers) * 100).toFixed(1) : "0";

	// Compute role distribution from real data
	const roleDistribution = React.useMemo(() => {
		if (!usersData?.users) return [];
		const roleCounts = new Map<string, number>();
		for (const user of usersData.users) {
			for (const ur of user.userRoles) {
				const name = ur.role.name ?? ur.role.key;
				roleCounts.set(name, (roleCounts.get(name) ?? 0) + 1);
			}
		}
		return Array.from(roleCounts.entries())
			.sort((a, b) => b[1] - a[1])
			.map(([name, value], index) => ({
				name,
				value,
				color: ROLE_COLORS[index % ROLE_COLORS.length],
			}));
	}, [usersData?.users]);

	// Compute weekly activity from audit logs
	const weeklyActivity = React.useMemo(() => {
		if (!auditData?.logs) return [];
		const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
		const counts = new Map<string, number>();
		for (const day of dayNames) counts.set(day, 0);

		for (const log of auditData.logs) {
			const day = dayNames[new Date(log.createdAt).getDay()];
			counts.set(day, (counts.get(day) ?? 0) + 1);
		}
		return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => ({
			day,
			actions: counts.get(day) ?? 0,
		}));
	}, [auditData?.logs]);

	// Recent activity from audit logs
	const recentActivity = React.useMemo(() => {
		if (!auditData?.logs) return [];
		return auditData.logs.slice(0, 8).map((log) => ({
			id: log.id,
			action: log.action,
			actor: log.actorUserId ?? "System",
			subjectId: log.subjectId ?? undefined,
			time: formatDistanceToNow(new Date(log.createdAt), { addSuffix: true }),
			type: getActivityType(log.action),
		}));
	}, [auditData?.logs]);

	return (
		<PageContainer>
			<div className="flex flex-1 flex-col gap-6">
				<div className="space-y-1">
					<h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
					<p className="text-muted-foreground">
						Overview of your system&apos;s users, roles, and authorization
						activity
					</p>
				</div>

				{/* Stats Cards */}
				{statsLoading ? (
					<StatsLoadingSkeleton />
				) : (
					<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
						<Card>
							<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
								<CardTitle className="text-sm font-medium">
									Total Users
								</CardTitle>
								<Users className="h-4 w-4 text-muted-foreground" />
							</CardHeader>
							<CardContent>
								<div className="text-2xl font-bold">{totalUsers}</div>
								<p className="text-xs text-muted-foreground">
									Registered accounts
								</p>
							</CardContent>
						</Card>

						<Card>
							<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
								<CardTitle className="text-sm font-medium">
									Active Users
								</CardTitle>
								<UserCheck className="h-4 w-4 text-muted-foreground" />
							</CardHeader>
							<CardContent>
								<div className="text-2xl font-bold">{activeUsers}</div>
								<p className="text-xs text-muted-foreground">
									<span className="text-green-500">{activeRate}%</span> active
									rate
								</p>
							</CardContent>
						</Card>

						<Card>
							<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
								<CardTitle className="text-sm font-medium">Roles</CardTitle>
								<Shield className="h-4 w-4 text-muted-foreground" />
							</CardHeader>
							<CardContent>
								<div className="text-2xl font-bold">{totalRoles}</div>
								<p className="text-xs text-muted-foreground">
									Across all applications
								</p>
							</CardContent>
						</Card>

						<Card>
							<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
								<CardTitle className="text-sm font-medium">
									Recent Actions
								</CardTitle>
								<Activity className="h-4 w-4 text-muted-foreground" />
							</CardHeader>
							<CardContent>
								<div className="text-2xl font-bold">{recentActions}</div>
								<p className="text-xs text-muted-foreground">
									Logged in the latest query
								</p>
							</CardContent>
						</Card>
					</div>
				)}

				{/* Charts Section */}
				<Tabs defaultValue="overview" className="space-y-4">
					<TabsList>
						<TabsTrigger value="overview">Overview</TabsTrigger>
						<TabsTrigger value="analytics">Analytics</TabsTrigger>
						<TabsTrigger value="activity">Recent Activity</TabsTrigger>
					</TabsList>

					<TabsContent value="overview" className="space-y-4">
						<div className="grid gap-4 md:grid-cols-2">
							<Card>
								<CardHeader>
									<CardTitle>Role Distribution</CardTitle>
									<CardDescription>Users by role assignment</CardDescription>
								</CardHeader>
								<CardContent>
									<div className="h-[300px] w-full min-w-0">
										{isClient && roleDistribution.length > 0 ? (
											<ResponsiveContainer
												width="100%"
												height="100%"
												minWidth={0}
												minHeight={300}
											>
												<PieChart>
													<Pie
														data={roleDistribution}
														cx="50%"
														cy="50%"
														labelLine={false}
														label={({ name, percent }) =>
															`${name}: ${((percent ?? 0) * 100).toFixed(0)}%`
														}
														outerRadius={80}
														fill="#8884d8"
														dataKey="value"
													>
														{roleDistribution.map((entry) => (
															<Cell key={entry.name} fill={entry.color} />
														))}
													</Pie>
													<Tooltip
														contentStyle={{
															backgroundColor: "hsl(var(--background))",
															border: "1px solid hsl(var(--border))",
															borderRadius: "6px",
														}}
													/>
												</PieChart>
											</ResponsiveContainer>
										) : roleDistribution.length === 0 && !usersLoading ? (
											<div className="flex items-center justify-center h-full text-muted-foreground">
												No role assignments to display
											</div>
										) : null}
									</div>
								</CardContent>
							</Card>

							<Card>
								<CardHeader>
									<CardTitle>Weekly Activity</CardTitle>
									<CardDescription>
										Actions by day of week from recent logs
									</CardDescription>
								</CardHeader>
								<CardContent className="pl-2">
									<div className="h-[300px] w-full min-w-0">
										{isClient && weeklyActivity.length > 0 ? (
											<ResponsiveContainer
												width="100%"
												height="100%"
												minWidth={0}
												minHeight={300}
											>
												<BarChart data={weeklyActivity}>
													<CartesianGrid
														strokeDasharray="3 3"
														className="stroke-muted"
													/>
													<XAxis dataKey="day" className="text-xs" />
													<YAxis className="text-xs" />
													<Tooltip
														contentStyle={{
															backgroundColor: "hsl(var(--background))",
															border: "1px solid hsl(var(--border))",
															borderRadius: "6px",
														}}
													/>
													<Legend />
													<Bar
														dataKey="actions"
														fill="hsl(var(--primary))"
														radius={[4, 4, 0, 0]}
													/>
												</BarChart>
											</ResponsiveContainer>
										) : weeklyActivity.length === 0 && !auditLoading ? (
											<div className="flex items-center justify-center h-full text-muted-foreground">
												No activity data available
											</div>
										) : null}
									</div>
								</CardContent>
							</Card>
						</div>
					</TabsContent>

					<TabsContent value="analytics" className="space-y-4">
						<Card>
							<CardHeader>
								<CardTitle>System Overview</CardTitle>
								<CardDescription>
									Key system metrics at a glance
								</CardDescription>
							</CardHeader>
							<CardContent>
								<div className="grid gap-4 md:grid-cols-3">
									<div className="rounded-lg border p-4">
										<p className="text-sm font-medium text-muted-foreground">
											Users per role
										</p>
										<p className="text-2xl font-bold mt-1">
											{totalRoles > 0
												? (totalUsers / totalRoles).toFixed(1)
												: "—"}
										</p>
										<p className="text-xs text-muted-foreground mt-1">
											Average users per role
										</p>
									</div>
									<div className="rounded-lg border p-4">
										<p className="text-sm font-medium text-muted-foreground">
											Inactive accounts
										</p>
										<p className="text-2xl font-bold mt-1">
											{Math.max(totalUsers - activeUsers, 0)}
										</p>
										<p className="text-xs text-muted-foreground mt-1">
											Disabled or deactivated
										</p>
									</div>
									<div className="rounded-lg border p-4">
										<p className="text-sm font-medium text-muted-foreground">
											System roles
										</p>
										<p className="text-2xl font-bold mt-1">
											{rolesData?.filter((r) => r.isSystem).length ?? 0}
										</p>
										<p className="text-xs text-muted-foreground mt-1">
											Protected from editing
										</p>
									</div>
								</div>
							</CardContent>
						</Card>
					</TabsContent>

					<TabsContent value="activity" className="space-y-4">
						<Card>
							<CardHeader>
								<CardTitle>Recent Activity</CardTitle>
								<CardDescription>
									Latest authorization and user management actions
								</CardDescription>
							</CardHeader>
							<CardContent>
								{recentActivity.length === 0 ? (
									<div className="text-center py-8 text-muted-foreground">
										No recent activity
									</div>
								) : (
									<div className="space-y-4">
										{recentActivity.map((activity) => (
											<div
												key={activity.id}
												className="flex items-start gap-4 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
											>
												<div
													className={`p-2 rounded-full ${
														activity.type === "create"
															? "bg-green-500/10 text-green-500"
															: activity.type === "delete"
																? "bg-red-500/10 text-red-500"
																: activity.type === "update"
																	? "bg-blue-500/10 text-blue-500"
																	: "bg-muted text-muted-foreground"
													}`}
												>
													{activity.type === "create" ? (
														<TrendingUp className="h-4 w-4" />
													) : activity.type === "delete" ? (
														<AlertCircle className="h-4 w-4" />
													) : (
														<Activity className="h-4 w-4" />
													)}
												</div>
												<div className="flex-1 space-y-1">
													<p className="text-sm font-medium leading-none">
														{activity.action}
													</p>
													{activity.subjectId && (
														<p className="text-sm text-muted-foreground">
															Target: {activity.subjectId}
														</p>
													)}
													<div className="flex items-center gap-2 text-xs text-muted-foreground">
														<span>{activity.actor}</span>
														<span>•</span>
														<span className="flex items-center gap-1">
															<Clock className="h-3 w-3" />
															{activity.time}
														</span>
													</div>
												</div>
												<Badge variant={getActionBadgeVariant(activity.type)}>
													{activity.type}
												</Badge>
											</div>
										))}
									</div>
								)}
							</CardContent>
						</Card>
					</TabsContent>
				</Tabs>

				{/* Quick Actions */}
				<Card>
					<CardHeader>
						<CardTitle>Quick Actions</CardTitle>
						<CardDescription>Frequently used management tasks</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="grid gap-4 md:grid-cols-3">
							<Link
								href="/admin/users"
								className="group flex flex-col items-center justify-center rounded-lg border p-6 transition-colors hover:bg-accent"
							>
								<Users className="mb-2 h-8 w-8 text-primary transition-transform group-hover:scale-110" />
								<span className="font-medium">Manage Users</span>
								<span className="text-sm text-muted-foreground">
									Add, edit, or remove users
								</span>
							</Link>
							<Link
								href="/admin/roles"
								className="group flex flex-col items-center justify-center rounded-lg border p-6 transition-colors hover:bg-accent"
							>
								<Shield className="mb-2 h-8 w-8 text-primary transition-transform group-hover:scale-110" />
								<span className="font-medium">Manage Roles</span>
								<span className="text-sm text-muted-foreground">
									Configure roles & permissions
								</span>
							</Link>
							<Link
								href="/admin/audit"
								className="group flex flex-col items-center justify-center rounded-lg border p-6 transition-colors hover:bg-accent"
							>
								<FileText className="mb-2 h-8 w-8 text-primary transition-transform group-hover:scale-110" />
								<span className="font-medium">View Audit Logs</span>
								<span className="text-sm text-muted-foreground">
									Track system changes
								</span>
							</Link>
						</div>
					</CardContent>
				</Card>
			</div>
		</PageContainer>
	);
}
