import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
	title: "Select Workspace - Aria ERP",
	description: "Choose or create a workspace to get started.",
};

export default function OnboardingOrganizationPage() {
	return (
		<div className="flex min-h-screen flex-col items-center justify-center p-6">
			<div className="max-w-md w-full rounded-2xl border bg-card p-8 text-center shadow-sm space-y-6">
				<h1 className="text-2xl font-bold tracking-tight">No Workspace Found</h1>
				<p className="text-muted-foreground text-sm">
					Your account does not belong to any workspace yet. Please contact your
					administrator to be invited to an organization, or create one if you
					have permission.
				</p>
				<div className="flex flex-col gap-3">
					<Link
						href="/"
						className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
					>
						Return to Home
					</Link>
					<Link
						href="/auth/sign-in"
						className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
					>
						Sign Out
					</Link>
				</div>
			</div>
		</div>
	);
}
