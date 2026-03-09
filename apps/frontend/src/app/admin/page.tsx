"use client";

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
import {
	Area,
	AreaChart,
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
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc/client";

// Mock data for analytics (replace with real data when backend is ready)
const mockUserGrowthData = [
	{ month: "Jan", users: 120, active: 98 },
	{ month: "Feb", users: 145, active: 125 },
	{ month: "Mar", users: 178, active: 156 },
	{ month: "Apr", users: 203, active: 189 },
	{ month: "May", users: 234, active: 212 },
	{ month: "Jun", users: 267, active: 245 },
];

const mockRoleDistribution = [
	{ name: "Admin", value: 12, color: "#8b5cf6" },
	{ name: "Manager", value: 34, color: "#3b82f6" },
	{ name: "User", value: 156, color: "#10b981" },
	{ name: "Viewer", value: 65, color: "#f59e0b" },
];

const mockActivityData = [
	{ day: "Mon", logins: 45, actions: 234 },
	{ day: "Tue", logins: 52, actions: 289 },
	{ day: "Wed", logins: 48, actions: 256 },
	{ day: "Thu", logins: 61, actions: 312 },
	{ day: "Fri", logins: 55, actions: 278 },
	{ day: "Sat", logins: 23, actions: 98 },
	{ day: "Sun", logins: 18, actions: 76 },
];

const mockRecentActivity = [
	{
		id: "1",
		user: "John Doe",
		action: "Created user account",
		target: "jane.smith@example.com",
		time: "2 minutes ago",
		type: "create",
	},
	{
		id: "2",
		user: "Admin User",
		action: "Assigned role",
		target: "Manager role to Bob Johnson",
		time: "15 minutes ago",
		type: "update",
	},
	{
		id: "3",
		user: "System",
		action: "Removed permission",
		target: "Delete access from Guest role",
		time: "1 hour ago",
		type: "delete",
	},
	{
		id: "4",
		user: "Sarah Williams",
		action: "Updated user profile",
		target: "mike.brown@example.com",
		time: "2 hours ago",
		type: "update",
	},
	{
		id: "5",
		user: "Admin User",
		action: "Created new role",
		target: "Department Manager",
		time: "3 hours ago",
		type: "create",
	},
];

export default function AdminDashboard() {
	// Fetch real data
	const { data: usersData } = trpc.admin.listUsers.useQuery({
		page: 1,
		limit: 100,
	});
	const { data: rolesData } = trpc.admin.listRoles.useQuery();
	const { data: auditData } = trpc.admin.getAuditLogs.useQuery({ limit: 50 });

	// Calculate stats from real data or use mock data
	const totalUsers = usersData?.users.length || 267;
	const activeUsers = usersData?.users.filter((u) => u.isActive).length || 245;
	const totalRoles = rolesData?.length || 8;
	const recentActions = auditData?.logs.length || 127;

	return (
		<div className="space-y-6">
			<div>
				<h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
				<p className="text-muted-foreground">
					Overview of your system&apos;s users, roles, and authorization
					activity
				</p>
			</div>

			{/* Stats Cards */}
			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">Total Users</CardTitle>
						<Users className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">{totalUsers}</div>
						<p className="text-xs text-muted-foreground">
							<span className="text-green-500">+12.5%</span> from last month
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">Active Users</CardTitle>
						<UserCheck className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">{activeUsers}</div>
						<p className="text-xs text-muted-foreground">
							<span className="text-green-500">
								{((activeUsers / totalUsers) * 100).toFixed(1)}%
							</span>{" "}
							active rate
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
						<p className="text-xs text-muted-foreground">In the last 7 days</p>
					</CardContent>
				</Card>
			</div>

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
								<CardTitle>User Growth</CardTitle>
								<CardDescription>
									Total and active users over time
								</CardDescription>
							</CardHeader>
							<CardContent className="pl-2">
								<ResponsiveContainer width="100%" height={300}>
									<AreaChart data={mockUserGrowthData}>
										<CartesianGrid
											strokeDasharray="3 3"
											className="stroke-muted"
										/>
										<XAxis dataKey="month" className="text-xs" />
										<YAxis className="text-xs" />
										<Tooltip
											contentStyle={{
												backgroundColor: "hsl(var(--background))",
												border: "1px solid hsl(var(--border))",
												borderRadius: "6px",
											}}
										/>
										<Legend />
										<Area
											type="monotone"
											dataKey="users"
											stackId="1"
											stroke="hsl(var(--primary))"
											fill="hsl(var(--primary))"
											fillOpacity={0.6}
										/>
										<Area
											type="monotone"
											dataKey="active"
											stackId="2"
											stroke="hsl(var(--chart-2))"
											fill="hsl(var(--chart-2))"
											fillOpacity={0.6}
										/>
									</AreaChart>
								</ResponsiveContainer>
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle>Role Distribution</CardTitle>
								<CardDescription>Users by role assignment</CardDescription>
							</CardHeader>
							<CardContent>
								<ResponsiveContainer width="100%" height={300}>
									<PieChart>
										<Pie
											data={mockRoleDistribution}
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
											{mockRoleDistribution.map((entry) => (
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
							</CardContent>
						</Card>
					</div>
				</TabsContent>

				<TabsContent value="analytics" className="space-y-4">
					<Card>
						<CardHeader>
							<CardTitle>Weekly Activity</CardTitle>
							<CardDescription>Login sessions and user actions</CardDescription>
						</CardHeader>
						<CardContent className="pl-2">
							<ResponsiveContainer width="100%" height={350}>
								<BarChart data={mockActivityData}>
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
										dataKey="logins"
										fill="hsl(var(--primary))"
										radius={[4, 4, 0, 0]}
									/>
									<Bar
										dataKey="actions"
										fill="hsl(var(--chart-2))"
										radius={[4, 4, 0, 0]}
									/>
								</BarChart>
							</ResponsiveContainer>
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
							<div className="space-y-4">
								{mockRecentActivity.map((activity) => (
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
														: "bg-blue-500/10 text-blue-500"
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
											<p className="text-sm text-muted-foreground">
												{activity.target}
											</p>
											<div className="flex items-center gap-2 text-xs text-muted-foreground">
												<span>{activity.user}</span>
												<span>•</span>
												<span className="flex items-center gap-1">
													<Clock className="h-3 w-3" />
													{activity.time}
												</span>
											</div>
										</div>
										<Badge
											variant={
												activity.type === "create"
													? "default"
													: activity.type === "delete"
														? "destructive"
														: "secondary"
											}
										>
											{activity.type}
										</Badge>
									</div>
								))}
							</div>
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
						<a
							href="/admin/users"
							className="flex flex-col items-center justify-center p-6 border rounded-lg hover:bg-accent transition-colors group"
						>
							<Users className="h-8 w-8 mb-2 text-primary group-hover:scale-110 transition-transform" />
							<span className="font-medium">Manage Users</span>
							<span className="text-sm text-muted-foreground">
								Add, edit, or remove users
							</span>
						</a>
						<a
							href="/admin/roles"
							className="flex flex-col items-center justify-center p-6 border rounded-lg hover:bg-accent transition-colors group"
						>
							<Shield className="h-8 w-8 mb-2 text-primary group-hover:scale-110 transition-transform" />
							<span className="font-medium">Manage Roles</span>
							<span className="text-sm text-muted-foreground">
								Configure roles & permissions
							</span>
						</a>
						<a
							href="/admin/audit"
							className="flex flex-col items-center justify-center p-6 border rounded-lg hover:bg-accent transition-colors group"
						>
							<FileText className="h-8 w-8 mb-2 text-primary group-hover:scale-110 transition-transform" />
							<span className="font-medium">View Audit Logs</span>
							<span className="text-sm text-muted-foreground">
								Track system changes
							</span>
						</a>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
