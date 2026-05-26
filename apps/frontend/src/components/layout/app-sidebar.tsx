"use client";
import {
	IconBlocks,
	IconBox,
	IconBrandAsana,
	IconChevronRight,
	IconChevronsDown,
	IconPhotoUp,
	IconShield,
	IconUsers,
} from "@tabler/icons-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	DropdownMenu,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
	SidebarRail,
} from "@/components/ui/sidebar";
import { UserAvatarProfile } from "@/components/user-avatar-profile";
import { useAuth } from "@/hooks/use-auth";
import { getAppNavItems } from "../../constants/app-nav-data";
import { useMediaQuery } from "../../hooks/use-media-query";
import type { NavItem } from "../../types";
import { AppSwitcher } from "../app-switcher";
import { Icons } from "../icons";
import UserDropdownContent from "./user-dropdown-content";
export const company = {
	name: "by Pivotr",
	logo: IconPhotoUp,
	plan: "Enterprise",
};

const LONG_NAV_LABEL_THRESHOLD = 28;

type WorkspaceApp = {
	id: string;
	key: "admin" | "inventory" | "asset" | "crm" | "hrms";
	name: string;
	logo: React.ComponentType<{ className?: string }>;
	route: string;
};

const WORKSPACE_APPS: WorkspaceApp[] = [
	{
		id: "admin",
		key: "admin",
		name: "Admin",
		logo: IconShield,
		route: "/admin",
	},
	{
		id: "inventory",
		key: "inventory",
		name: "Inventory",
		logo: IconBox,
		route: "/inventory",
	},
	{
		id: "asset",
		key: "asset",
		name: "Asset",
		logo: IconBlocks,
		route: "/asset",
	},
	{ id: "crm", key: "crm", name: "CRM", logo: IconBrandAsana, route: "/crm" },
	{ id: "hrms", key: "hrms", name: "HRMS", logo: IconUsers, route: "/hrms" },
];

const fallbackUser = {
	fullName: "Admin",
	emailAddresses: [{ emailAddress: "admin@example.com" }],
	imageUrl: "",
};

/**
 * Type guard to check if value has a specific property
 */
function hasProperty<T extends string>(
	obj: unknown,
	prop: T,
): obj is Record<T, unknown> & Record<string, unknown> {
	return typeof obj === "object" && obj !== null && prop in obj;
}

function normalizePathname(pathname: string) {
	return pathname === "/" ? pathname : pathname.replace(/\/+$/, "");
}

function isPathActive(pathname: string, targetPath: string) {
	if (!targetPath || targetPath === "#") {
		return false;
	}

	const normalizedPathname = normalizePathname(pathname);
	const normalizedTargetPath = normalizePathname(targetPath);

	return (
		normalizedPathname === normalizedTargetPath ||
		normalizedPathname.startsWith(`${normalizedTargetPath}/`)
	);
}

function isNavItemActive(pathname: string, item: NavItem) {
	if (item.items?.length) {
		return item.items.some((subItem) => isPathActive(pathname, subItem.url));
	}

	return isPathActive(pathname, item.url);
}

function getActiveMenuClassName(isActive: boolean, isSubItem = false) {
	if (!isActive) {
		return undefined;
	}

	return isSubItem
		? "!bg-sidebar-foreground/10 !text-sidebar-foreground"
		: "!bg-sidebar-foreground/8 !text-sidebar-foreground";
}

/**
 * Memoized navigation sub-item component for better performance
 */
const NavSubItem = React.memo(
	({ subItem, pathname }: { subItem: NavItem; pathname: string }) => (
		<SidebarMenuSubItem>
			<SidebarMenuSubButton
				asChild
				isActive={isPathActive(pathname, subItem.url)}
				className={getActiveMenuClassName(
					isPathActive(pathname, subItem.url),
					true,
				)}
			>
				<Link
					href={subItem.url}
					title={
						subItem.title.length > LONG_NAV_LABEL_THRESHOLD
							? subItem.title
							: undefined
					}
				>
					<span>{subItem.title}</span>
				</Link>
			</SidebarMenuSubButton>
		</SidebarMenuSubItem>
	),
);
NavSubItem.displayName = "NavSubItem";

/**
 * Memoized navigation item component for better performance
 */
const NavItemComponent = React.memo(
	({ item, pathname }: { item: NavItem; pathname: string }) => {
		const Icon = item.icon
			? Icons[item.icon as keyof typeof Icons]
			: Icons.logo;
		const isItemActive = isNavItemActive(pathname, item);
		const [isOpen, setIsOpen] = React.useState(isItemActive);

		React.useEffect(() => {
			setIsOpen(isItemActive);
		}, [isItemActive]);

		if (item?.items && item?.items?.length > 0) {
			return (
				<Collapsible
					key={item.title}
					asChild
					open={isOpen}
					onOpenChange={setIsOpen}
					className="group/collapsible"
				>
					<SidebarMenuItem>
						<CollapsibleTrigger asChild>
							<SidebarMenuButton
								tooltip={item.title}
								isActive={isItemActive}
								className={getActiveMenuClassName(isItemActive)}
							>
								{item.icon && <Icon />}
								<span>{item.title}</span>
								<IconChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
							</SidebarMenuButton>
						</CollapsibleTrigger>
						<CollapsibleContent>
							<SidebarMenuSub>
								{item.items?.map((subItem: NavItem) => (
									<NavSubItem
										key={subItem.title}
										subItem={subItem}
										pathname={pathname}
									/>
								))}
							</SidebarMenuSub>
						</CollapsibleContent>
					</SidebarMenuItem>
				</Collapsible>
			);
		}

		return (
			<SidebarMenuItem key={item.title}>
				<SidebarMenuButton
					asChild
					tooltip={item.title}
					isActive={isItemActive}
					className={getActiveMenuClassName(isItemActive)}
				>
					<Link
						href={item.url}
						title={
							item.title.length > LONG_NAV_LABEL_THRESHOLD
								? item.title
								: undefined
						}
					>
						<Icon />
						<span>{item.title}</span>
					</Link>
				</SidebarMenuButton>
			</SidebarMenuItem>
		);
	},
);
NavItemComponent.displayName = "NavItemComponent";

export default function AppSidebar({
	activeAppKey,
}: {
	/**
	 * Server-validated active app key. When provided by the layout, this
	 * takes precedence over client-side URL matching, ensuring the sidebar
	 * nav items are always correct for the current route group.
	 */
	activeAppKey?: WorkspaceApp["key"];
}) {
	const pathname = usePathname();
	useMediaQuery();
	const {
		hasAnyRole,
		isActive,
		isLoading: authLoading,
		user: sessionUser,
		memberRole,
		role,
	} = useAuth();

	const hasAdminAccess = React.useMemo(
		() => isActive && hasAnyRole("admin", "super_admin"),
		[hasAnyRole, isActive],
	);

	const hasOrgMembership = React.useMemo(
		() => Boolean(memberRole) && memberRole !== null,
		[memberRole],
	);

	const accessibleApps = React.useMemo(() => {
		if (authLoading) {
			return WORKSPACE_APPS;
		}

		if (!hasOrgMembership) {
			// Super admins have unrestricted access to all workspace apps
			// regardless of organization membership.
			if (role === "super_admin") {
				return WORKSPACE_APPS;
			}
			// Regular admins retain access to the admin app only.
			if (hasAdminAccess) {
				return WORKSPACE_APPS.filter((app) => app.key === "admin");
			}
			return [];
		}

		const allowed = WORKSPACE_APPS.filter((app) =>
			app.key === "admin" ? hasAdminAccess : true,
		);
		return allowed.length > 0 ? allowed : WORKSPACE_APPS;
	}, [authLoading, hasAdminAccess, hasOrgMembership, role]);

	// Map auth session user shape to the local user shape expected by UserAvatarProfile
	const user = React.useMemo(() => {
		const su = sessionUser;
		if (!hasProperty(su, "name") && !hasProperty(su, "email"))
			return fallbackUser;

		const getName = () => {
			if (hasProperty(su, "name") && typeof su.name === "string")
				return su.name;
			if (hasProperty(su, "fullName") && typeof su.fullName === "string")
				return su.fullName;
			if (hasProperty(su, "username") && typeof su.username === "string")
				return su.username;
			return fallbackUser.fullName;
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
			return fallbackUser.emailAddresses[0].emailAddress;
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
	}, [sessionUser]);

	// Determine the active app. When the layout supplies a server-validated
	// app key, use it directly. Otherwise fall back to client-side URL matching.
	const activeApp = React.useMemo(() => {
		if (activeAppKey) {
			return (
				WORKSPACE_APPS.find((app) => app.key === activeAppKey) ||
				WORKSPACE_APPS[0]
			);
		}
		return (
			WORKSPACE_APPS.find((app) => pathname.startsWith(app.route)) ||
			accessibleApps[0] ||
			WORKSPACE_APPS[0]
		);
	}, [activeAppKey, accessibleApps, pathname]);

	const activeAppId = React.useMemo(
		() => activeApp?.key ?? WORKSPACE_APPS[0].key,
		[activeApp?.key],
	);

	const appNavItems = React.useMemo(
		() => getAppNavItems(activeAppId),
		[activeAppId],
	);

	return (
		<Sidebar collapsible="icon">
			<SidebarHeader>
				<AppSwitcher apps={accessibleApps} defaultApp={activeApp} />
			</SidebarHeader>
			<SidebarContent className="overflow-x-hidden">
				<SidebarGroup>
					{/* <SidebarGroupLabel>Overview</SidebarGroupLabel> */}
					<SidebarMenu>
						{appNavItems.map((item: NavItem) => (
							<NavItemComponent
								key={item.title}
								item={item}
								pathname={pathname}
							/>
						))}
					</SidebarMenu>
				</SidebarGroup>
			</SidebarContent>
			<SidebarFooter>
				<SidebarMenu>
					<SidebarMenuItem>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<SidebarMenuButton
									size="lg"
									className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
								>
									<UserAvatarProfile
										className="h-8 w-8 rounded-lg"
										showInfo
										user={user}
									/>
									<IconChevronsDown className="ml-auto size-4" />
								</SidebarMenuButton>
							</DropdownMenuTrigger>
							{/* Reuse shared dropdown content so sidebar and top nav stay consistent */}
							<UserDropdownContent className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-56 rounded-lg" />
						</DropdownMenu>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	);
}
