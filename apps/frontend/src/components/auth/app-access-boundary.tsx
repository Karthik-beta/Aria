"use client";

import type { ReactNode } from "react";
import { AppGate } from "@/components/auth/protected-content";

interface AppAccessBoundaryProps {
	appKey: string;
	children: ReactNode;
}

export function AppAccessBoundary({
	appKey,
	children,
}: AppAccessBoundaryProps) {
	return (
		<AppGate
			appKey={appKey}
			fallback={
				<div className="flex min-h-[60vh] items-center justify-center px-6">
					<div className="max-w-md text-center">
						<h2 className="text-xl font-semibold">Access restricted</h2>
						<p className="mt-2 text-sm text-muted-foreground">
							<span>
								You do not have permission to open the {appKey.toUpperCase()}{" "}
								workspace yet.
							</span>{" "}
							<span>Contact your administrator to request access.</span>
						</p>
					</div>
				</div>
			}
		>
			{children}
		</AppGate>
	);
}
