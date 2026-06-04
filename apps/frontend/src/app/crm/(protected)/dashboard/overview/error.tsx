"use client";

import { ErrorAlert } from "@/components/ui/error-display";

export default function OverviewError({ error }: { error: Error }) {
	return <ErrorAlert error={error} operation="load" />;
}
