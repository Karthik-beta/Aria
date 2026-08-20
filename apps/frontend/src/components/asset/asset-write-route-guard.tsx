"use client";

import type * as React from "react";
import { useAssetWriteAccess } from "@/hooks/use-asset-write-access";

/**
 * Direct Asset form routes remain readable to members, but render no write
 * controls for roles that the backend will reject. Server procedures remain
 * authoritative; this component is only a route-level affordance guard.
 */
export function AssetWriteRouteGuard({
	children,
}: {
	children: React.ReactNode;
}) {
	const canWrite = useAssetWriteAccess();

	if (!canWrite) {
		return (
			<div className="flex min-h-[60vh] items-center justify-center px-6">
				<div className="max-w-md text-center">
					<h2 className="text-xl font-semibold">Write access required</h2>
					<p className="mt-2 text-sm text-muted-foreground">
						Only an organization owner, administrator, or super-admin can open
						this Asset form.
					</p>
				</div>
			</div>
		);
	}

	return <>{children}</>;
}
