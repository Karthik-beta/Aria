"use client";

import { Building, UserCheck, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import PageContainer from "@/components/layout/page-container";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { authClient } from "@/lib/auth/client";

const SKELETON_KEYS = ["total", "active", "orgs"] as const;

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
	const [totalUsers, setTotalUsers] = useState(0);
	const [activeUsers, setActiveUsers] = useState(0);
	const [orgCount, setOrgCount] = useState(0);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		let cancelled = false;
		Promise.all([
			authClient.admin.listUsers({ query: { limit: 100 } }),
			authClient.organization.list(),
		])
			.then(([usersRes, orgsRes]) => {
				if (!cancelled) {
					if (usersRes.data) {
						setTotalUsers(usersRes.data.total);
						setActiveUsers(usersRes.data.users.filter((u) => !u.banned).length);
					}
					if (orgsRes.data) {
						setOrgCount((orgsRes.data as unknown[]).length);
					}
					setIsLoading(false);
				}
			})
			.catch(() => {
				if (!cancelled) setIsLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, []);

	const activeRate =
		totalUsers > 0 ? ((activeUsers / totalUsers) * 100).toFixed(1) : "0";

	return (
		<PageContainer>
			<div className="flex flex-1 flex-col gap-6">
				<div className="space-y-1">
					<h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
					<p className="text-muted-foreground">
						Overview of your system&apos;s users and authorization
					</p>
				</div>

				{isLoading ? (
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
								<CardTitle className="text-sm font-medium">
									Disabled Users
								</CardTitle>
								<UserCheck className="h-4 w-4 text-muted-foreground" />
							</CardHeader>
							<CardContent>
								<div className="text-2xl font-bold">
									{Math.max(totalUsers - activeUsers, 0)}
								</div>
								<p className="text-xs text-muted-foreground">
									Awaiting reactivation
								</p>
							</CardContent>
						</Card>

						<Card>
							<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
								<CardTitle className="text-sm font-medium">
									Organizations
								</CardTitle>
								<Building className="h-4 w-4 text-muted-foreground" />
							</CardHeader>
							<CardContent>
								<div className="text-2xl font-bold">{orgCount}</div>
								<p className="text-xs text-muted-foreground">App workspaces</p>
							</CardContent>
						</Card>
					</div>
				)}

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
								href="/admin/organizations"
								className="group flex flex-col items-center justify-center rounded-lg border p-6 transition-colors hover:bg-accent"
							>
								<Building className="mb-2 h-8 w-8 text-primary transition-transform group-hover:scale-110" />
								<span className="font-medium">Organizations</span>
								<span className="text-sm text-muted-foreground">
									Manage app workspaces &amp; members
								</span>
							</Link>
						</div>
					</CardContent>
				</Card>
			</div>
		</PageContainer>
	);
}
