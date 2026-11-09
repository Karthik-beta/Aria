"use client";

import { LoginForm } from "@/components/auth/login-form";
import { Icons } from "@/components/icons";

/**
 * LoginPageClient - Client-side login page component
 *
 * Revamped to a responsive split-screen layout:
 * - Left hero panel (visible ≥ lg) with brand, marketing points, and decorative
 * - Right panel hosts the actual <LoginForm /> card
 * Public auth pages are intentionally left outside the protected layout flow.
 */
export default function LoginPageClient({
	callbackUrl,
}: {
	callbackUrl?: string | null;
}) {
	return (
		<div className="min-h-screen flex flex-col lg:flex-row bg-background">
			{/* Hero / Marketing Panel */}
			<div className="relative hidden lg:flex w-1/2 flex-col justify-between overflow-hidden bg-linear-to-br from-primary/80 to-primary p-12 text-primary-foreground">
				{/* Glow / Decorative */}
				<span className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
				<span className="pointer-events-none absolute bottom-0 right-0 h-64 w-64 rounded-full bg-white/5 blur-2xl" />

				<div className="space-y-6">
					<div className="flex items-center gap-3">
						<div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
							<Icons.dashboard className="h-7 w-7" />
						</div>
						<h1 className="text-2xl font-bold tracking-tight">
							Aria ERP Platform
						</h1>
					</div>
					<p className="max-w-sm text-sm/relaxed text-white/90">
						Unified B2B operations hub. Secure authentication protects
						inventory, HR, CRM, and asset workflows across your organization.
					</p>
					<ul className="space-y-3 text-sm">
						<li className="flex items-start gap-2">
							<Icons.check className="mt-0.5 h-4 w-4 shrink-0" />
							<span>Granular role-based access control</span>
						</li>
						<li className="flex items-start gap-2">
							<Icons.check className="mt-0.5 h-4 w-4 shrink-0" />
							<span>Real-time data integrity across modules</span>
						</li>
						<li className="flex items-start gap-2">
							<Icons.check className="mt-0.5 h-4 w-4 shrink-0" />
							<span>Enterprise-grade security & auditability</span>
						</li>
					</ul>
				</div>

				<div className="text-xs text-white/60">
					© {new Date().getFullYear()} Aria. All rights reserved.
				</div>
			</div>

			{/* Auth Panel */}
			<main className="flex flex-1 items-center justify-center p-6 sm:p-10">
				<div className="w-full max-w-md space-y-6">
					<LoginForm callbackUrl={callbackUrl} />
					<p className="text-center text-xs text-muted-foreground">
						Authorized personnel only. All access attempts are logged.
					</p>
				</div>
			</main>
		</div>
	);
}
