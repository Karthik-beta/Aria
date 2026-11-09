"use client";

import { ErrorAlert } from "@/components/ui/error-display";

export default function SalesError({ error }: { error: Error }) {
	return <ErrorAlert error={error} operation="load" />;
}
