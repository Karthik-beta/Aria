"use client";

import * as Sentry from "@sentry/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ErrorCard } from "@/components/ui/error-display";

interface StatsErrorProps {
	error: Error;
	reset: () => void;
}

export default function StatsError({ error, reset }: StatsErrorProps) {
	const router = useRouter();
	const [isPending, startTransition] = useTransition();

	useEffect(() => {
		Sentry.captureException(error);
	}, [error]);

	const reload = () => {
		startTransition(() => {
			router.refresh();
			reset();
		});
	};

	return (
		<Card className="border-destructive/50">
			<CardHeader className="flex flex-col items-stretch space-y-0 p-0">
				<div className="px-6 pt-6">
					<ErrorCard
						error={error}
						operation="load"
						onRetry={isPending ? undefined : reload}
					/>
				</div>
			</CardHeader>
			<CardContent className="flex h-[250px] items-center justify-center p-6">
				<p className="text-muted-foreground text-sm text-center">
					Statistics data will appear here once the issue is resolved.
				</p>
			</CardContent>
		</Card>
	);
}
