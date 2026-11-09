"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function OrgSlugPage() {
	const router = useRouter();

	useEffect(() => {
		router.replace("/admin/organization/members");
	}, [router]);

	return null;
}
