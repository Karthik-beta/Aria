"use client";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatarProfile } from "@/components/user-avatar-profile";
import { useSession } from "@/lib/auth/client";
import UserDropdownContent from "./user-dropdown-content";

/**
 * Type guard to check if value has a specific property
 */
function hasProperty<T extends string>(
	obj: unknown,
	prop: T,
): obj is Record<T, unknown> & Record<string, unknown> {
	return typeof obj === "object" && obj !== null && prop in obj;
}

export function UserNav() {
	const { data: session } = useSession();

	const user = React.useMemo(() => {
		const su = session?.user;

		const fallback = {
			fullName: "Inventory Admin",
			emailAddresses: [{ emailAddress: "inventory.admin@example.com" }],
			imageUrl: "",
		};

		if (!hasProperty(su, "name") && !hasProperty(su, "email")) return fallback;

		const getName = () => {
			if (hasProperty(su, "name") && typeof su.name === "string")
				return su.name;
			if (hasProperty(su, "fullName") && typeof su.fullName === "string")
				return su.fullName;
			if (hasProperty(su, "username") && typeof su.username === "string")
				return su.username;
			return "User";
		};

		const getEmail = () => {
			if (hasProperty(su, "email") && typeof su.email === "string")
				return su.email;
			if (
				hasProperty(su, "emails") &&
				Array.isArray(su.emails) &&
				su.emails[0]
			) {
				const firstEmail = su.emails[0] as Record<string, unknown>;
				if ("value" in firstEmail && typeof firstEmail.value === "string") {
					return firstEmail.value;
				}
			}
			return "";
		};

		const getImageUrl = () => {
			if (hasProperty(su, "avatar") && typeof su.avatar === "string")
				return su.avatar;
			if (hasProperty(su, "imageUrl") && typeof su.imageUrl === "string")
				return su.imageUrl;
			if (hasProperty(su, "image") && typeof su.image === "string")
				return su.image;
			return "";
		};

		return {
			fullName: getName(),
			emailAddresses: [{ emailAddress: getEmail() }],
			imageUrl: getImageUrl(),
		};
	}, [session]);
	const _router = useRouter();
	const pathname = usePathname();
	const _prefix = React.useMemo(() => {
		if (!pathname) return "";
		const parts = pathname.split("/").filter(Boolean);
		return parts.length > 0 ? `/${parts[0]}` : "";
	}, [pathname]);
	const [isMounted, setIsMounted] = React.useState(false);

	// Ensure component only renders after hydration to avoid ID mismatch
	React.useEffect(() => {
		setIsMounted(true);
	}, []);

	if (!isMounted) {
		return null;
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" className="relative h-8 w-8 rounded-full">
					<UserAvatarProfile user={user} />
				</Button>
			</DropdownMenuTrigger>
			{/* Reuse shared dropdown content which will infer prefix from pathname when appRoute is not provided */}
			<UserDropdownContent className="w-56" />
		</DropdownMenu>
	);
}
