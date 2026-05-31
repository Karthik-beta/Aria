"use client";

import { IconAlertCircle } from "@tabler/icons-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function SalesError({ error }: { error: Error }) {
	return (
		<Alert variant="destructive">
			<IconAlertCircle className="h-4 w-4" />
			<AlertTitle>Error</AlertTitle>
			<AlertDescription>
				Failed to load sales data: {error.message}
			</AlertDescription>
		</Alert>
	);
}
