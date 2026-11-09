import { ShieldAlert } from "lucide-react";
import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface AssetWriteAccessNoticeProps {
	backHref: string;
	backLabel: string;
}

export function AssetWriteAccessNotice({
	backHref,
	backLabel,
}: AssetWriteAccessNoticeProps) {
	return (
		<div className="mx-auto flex w-full max-w-xl flex-col gap-4 p-6">
			<Alert>
				<ShieldAlert />
				<AlertTitle>Read-only access</AlertTitle>
				<AlertDescription>
					You need the owner or admin role in this organization to change asset
					records.
				</AlertDescription>
			</Alert>
			<Button asChild variant="outline" className="self-start">
				<Link href={backHref}>{backLabel}</Link>
			</Button>
		</div>
	);
}
