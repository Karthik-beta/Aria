"use client";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
} from '@/components/ui/sidebar';
import { UserAvatarProfile } from '@/components/user-avatar-profile';
import type { NavItem } from '../../types';
import { getAppNavItems } from '../../constants/app-nav-data';
import { useMediaQuery } from '../../hooks/use-media-query';
import {
  IconBell,
  IconChevronRight,
  IconChevronsDown,
  IconCreditCard,
  IconLogout,
  IconPhotoUp,
  IconUserCircle,
  IconBox,
  IconBlocks,
  IconBrandAsana,
  IconUsers,
} from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import * as React from 'react';
import { signOut, useSession } from '@/lib/auth/client';
import { toast } from 'sonner';
import { Icons } from '../icons';
import { AppSwitcher } from '../app-switcher';
import UserDropdownContent from './user-dropdown-content';
export const company = {
  name: 'by Pivotr',
  logo: IconPhotoUp,
  plan: 'Enterprise',
};

const LONG_NAV_LABEL_THRESHOLD = 28;

const apps = [
  { id: '1', name: 'Inventory', logo: IconBox, route: '/inventory' },
  { id: '2', name: 'Asset', logo: IconBlocks, route: '/asset' },
  { id: '3', name: 'CRM', logo: IconBrandAsana, route: '/crm' },
  { id: '4', name: 'HRMS', logo: IconUsers, route: '/hrms' },
];

const fallbackUser = {
  fullName: 'Admin',
  emailAddresses: [{ emailAddress: 'admin@example.com' }],
  imageUrl: '',
};

/**
 * Memoized navigation sub-item component for better performance
 */
const NavSubItem = React.memo(({ subItem, pathname }: { subItem: NavItem; pathname: string }) => (
  <SidebarMenuSubItem>
    <SidebarMenuSubButton asChild isActive={pathname === subItem.url}>
      <Link
        href={subItem.url}
        title={subItem.title.length > LONG_NAV_LABEL_THRESHOLD ? subItem.title : undefined}
      >
        <span>{subItem.title}</span>
      </Link>
    </SidebarMenuSubButton>
  </SidebarMenuSubItem>
));
NavSubItem.displayName = 'NavSubItem';

/**
 * Memoized navigation item component for better performance
 */
const NavItemComponent = React.memo(({ item, pathname }: { item: NavItem; pathname: string }) => {
  const Icon = item.icon ? Icons[item.icon as keyof typeof Icons] : Icons.logo;

  if (item?.items && item?.items?.length > 0) {
    return (
      <Collapsible
        key={item.title}
        asChild
        defaultOpen={item.isActive}
        className="group/collapsible"
      >
        <SidebarMenuItem>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton tooltip={item.title} isActive={pathname === item.url}>
              {item.icon && <Icon />}
              <span>{item.title}</span>
              <IconChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenuSub>
              {item.items?.map((subItem: NavItem) => (
                <NavSubItem key={subItem.title} subItem={subItem} pathname={pathname} />
              ))}
            </SidebarMenuSub>
          </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>
    );
  }

  return (
    <SidebarMenuItem key={item.title}>
      <SidebarMenuButton asChild tooltip={item.title} isActive={pathname === item.url}>
        <Link
          href={item.url}
          title={item.title.length > LONG_NAV_LABEL_THRESHOLD ? item.title : undefined}
        >
          <Icon />
          <span>{item.title}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
});
NavItemComponent.displayName = 'NavItemComponent';

export default function AppSidebar() {
  const pathname = usePathname();
  const { isOpen } = useMediaQuery();
  const { data: session } = useSession();

  // Map auth session user shape to the local user shape expected by UserAvatarProfile
  const user = React.useMemo(() => {
    const su = session?.user as any | undefined;
    if (!su) return fallbackUser;

    return {
      fullName: su.name || su.fullName || su.username || fallbackUser.fullName,
      emailAddresses: [
        { emailAddress: su.email || (su.emails && su.emails[0]?.value) || fallbackUser.emailAddresses[0].emailAddress },
      ],
      imageUrl: su.avatar || su.imageUrl || su.image || '',
    };
  }, [session]);
  const router = useRouter();
  const [isMounted, setIsMounted] = React.useState(false);

  // Memoize active app calculation to avoid recalculation on every render
  const activeApp = React.useMemo(
    () => apps.find((app) => pathname.startsWith(app.route)) || apps[0],
    [pathname]
  );

  const activeAppId = React.useMemo(() => activeApp.name.toLowerCase(), [activeApp.name]);

  // Memoize navigation items to prevent unnecessary recalculations
  const appNavItems = React.useMemo(() => getAppNavItems(activeAppId), [activeAppId]);

  // Ensure component only renders after hydration to avoid ID mismatch
  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  React.useEffect(() => {
    // Side effects based on sidebar state changes
  }, [isOpen]);

  if (!isMounted) {
    return null;
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <AppSwitcher apps={apps} defaultApp={activeApp} />
      </SidebarHeader>
      <SidebarContent className="overflow-x-hidden">
        <SidebarGroup>
          {/* <SidebarGroupLabel>Overview</SidebarGroupLabel> */}
          <SidebarMenu>
            {appNavItems.map((item: NavItem) => (
              <NavItemComponent key={item.title} item={item} pathname={pathname} />
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
                  <UserAvatarProfile className="h-8 w-8 rounded-lg" showInfo user={user} />
                  <IconChevronsDown className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              {/* Reuse shared dropdown content so sidebar and top nav stay consistent */}
              <UserDropdownContent appRoute={activeApp.route} className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg" />
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
