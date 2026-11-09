"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function NotFoundClient() {
	const router = useRouter();

	return (
		<div className="mt-8 flex justify-center gap-2">
			<Button onClick={() => router.back()} variant="default" size="lg">
				Go back
			</Button>
			<Button
				onClick={() => router.push("/dashboard")}
				variant="ghost"
				size="lg"
			>
				Back to Home
			</Button>
		</div>
	);
}
