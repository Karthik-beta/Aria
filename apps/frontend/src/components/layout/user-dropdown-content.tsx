"use client";
import {
	IconBell,
	IconKey,
	IconLogout,
	IconShield,
	IconUserCircle,
} from "@tabler/icons-react";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import {
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { UserAvatarProfile } from "@/components/user-avatar-profile";
import { useAuth } from "@/hooks/use-auth";
import { signOut, useSession } from "@/lib/auth/client";

/**
 * Type guard to check if value has a specific property
 */
function hasProperty<T extends string>(
	obj: unknown,
	prop: T,
): obj is Record<T, unknown> & Record<string, unknown> {
	return typeof obj === "object" && obj !== null && prop in obj;
}

type Props = {
	/** Optional explicit app route prefix (e.g. '/inventory'). If not provided the component will infer from pathname. */
	appRoute?: string;
	className?: string;
};

export default function UserDropdownContent({ appRoute, className }: Props) {
	const { data: session } = useSession();
	const { roles } = useAuth();
	const router = useRouter();
	const pathname = usePathname();

	const user = React.useMemo(() => {
		const su = session?.user;

		const fallback = {
			fullName: "User",
			emailAddresses: [{ emailAddress: "" }],
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

	const prefix = React.useMemo(() => {
		if (appRoute) return appRoute;
		if (!pathname) return "";
		const parts = pathname.split("/").filter(Boolean);
		return parts.length > 0 ? `/${parts[0]}` : "";
	}, [appRoute, pathname]);

	// Check if user has admin access based on roles from user authorization
	const hasAdminAccess = React.useMemo(() => {
		if (roles.length === 0) return false;

		// Check if any role key contains 'admin' or 'super_admin'
		return roles.some((roleKey) =>
			["admin", "super_admin"].includes(roleKey.toLowerCase()),
		);
	}, [roles]);

	return (
		<DropdownMenuContent
			className={className}
			side="bottom"
			align="end"
			sideOffset={4}
		>
			<DropdownMenuLabel className="p-0 font-normal">
				<div className="px-1 py-1.5">
					<UserAvatarProfile
						className="h-8 w-8 rounded-lg"
						showInfo
						user={user}
					/>
				</div>
			</DropdownMenuLabel>
			<DropdownMenuSeparator />

			<DropdownMenuGroup>
				<DropdownMenuItem
					onClick={() => router.push(`${prefix}/dashboard/profile`)}
				>
					<IconUserCircle className="mr-2 h-4 w-4" />
					Profile
				</DropdownMenuItem>
				<DropdownMenuItem onClick={() => router.push("/auth/change-password")}>
					<IconKey className="mr-2 h-4 w-4" />
					Change password
				</DropdownMenuItem>
				<DropdownMenuItem>
					<IconBell className="mr-2 h-4 w-4" />
					Notifications
				</DropdownMenuItem>
				{hasAdminAccess && (
					<>
						<DropdownMenuSeparator />
						<DropdownMenuItem onClick={() => router.push("/admin")}>
							<IconShield className="mr-2 h-4 w-4" />
							Admin Console
						</DropdownMenuItem>
					</>
				)}
			</DropdownMenuGroup>
			<DropdownMenuSeparator />

			<DropdownMenuItem
				onClick={async () => {
					try {
						await signOut();
						try {
							if (typeof toast?.success === "function")
								toast.success("Signed out successfully");
						} catch (_e) {
							/* swallow */
						}
						router.push("/auth/sign-in");
					} catch (_err) {
						try {
							if (typeof toast?.error === "function") {
								toast.error("Failed to sign out. Please try again.");
							}
						} catch (_e) {
							/* swallow */
						}
						router.push("/auth/sign-in");
					}
				}}
			>
				<IconLogout className="mr-2 h-4 w-4" />
				Sign out
			</DropdownMenuItem>
		</DropdownMenuContent>
	);
}
