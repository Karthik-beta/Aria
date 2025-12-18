'use client';

import { Check, ChevronsUpDown } from 'lucide-react';
import * as React from 'react';
import { useRouter, usePathname } from 'next/navigation';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';

interface App {
  id: string;
  key?: string;
  name: string;
  logo: React.ComponentType<{ className?: string }>;
  route: string;
}

export function AppSwitcher({ apps, defaultApp }: { apps: App[]; defaultApp: App }) {
  const safeApps = React.useMemo(() => {
    if (apps.length > 0) {
      return apps;
    }
    if (defaultApp) {
      return [defaultApp];
    }
    return [];
  }, [apps, defaultApp]);

  const router = useRouter();
  const pathname = usePathname();
  const [isMounted, setIsMounted] = React.useState(false);
  const [isNavigating, setIsNavigating] = React.useState(false);

  // Track the target app ID during navigation to prevent loops
  const navigationTargetRef = React.useRef<string | null>(null);

  // Determine active app based on current route - memoized for performance
  // This is the source of truth for which app is currently active
  const activeApp = React.useMemo(() => {
    const currentApp = safeApps.find((app) => pathname.startsWith(app.route));
    return currentApp || defaultApp || safeApps[0];
  }, [safeApps, pathname, defaultApp]);

  // Ensure component only renders after hydration to avoid ID mismatch
  React.useEffect(() => {
    setIsMounted(true);
  }, [])

  // Reset navigation state when we've arrived at the target app
  React.useEffect(() => {
    // If we're navigating and we've reached the target app, reset the navigation state
    if (isNavigating && navigationTargetRef.current) {
      // Check if current pathname matches the navigation target
      if (pathname.startsWith(navigationTargetRef.current)) {
        setIsNavigating(false);
        navigationTargetRef.current = null;
      }
    }
  }, [pathname, isNavigating]);

  const handleAppSwitch = React.useCallback(
    (app: App) => {
      // Don't navigate if already on the same app or already navigating
      if (pathname.startsWith(app.route) || isNavigating) {
        return;
      }

      // Set navigation state
      setIsNavigating(true);
      navigationTargetRef.current = app.route;

      // Navigate immediately without timeout
      router.push(app.route);
    },
    [router, pathname, isNavigating]
  );

  // Show a loading skeleton while hydrating to improve perceived performance
  if (!isMounted) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" disabled>
            <div className="bg-sidebar-primary/50 text-sidebar-primary-foreground/50 flex aspect-square size-8 items-center justify-center rounded-lg">
              <div className="size-4 bg-current rounded animate-pulse" />
            </div>
            <div className="grid flex-1 text-left gap-0.5 leading-none">
              <div className="h-4 bg-sidebar-primary/20 rounded animate-pulse" />
              <div className="h-3 bg-sidebar-primary/10 rounded animate-pulse w-2/3" />
            </div>
            <ChevronsUpDown className="ml-auto opacity-50" />
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  if (!activeApp) {
    return null;
  }

  // Use activeApp directly instead of separate selectedApp state
  // This avoids state synchronization issues that caused the infinite loop
  const displayApp = isNavigating
    ? safeApps.find(app => app.route === navigationTargetRef.current) || activeApp
    : activeApp;

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              disabled={isNavigating}
            >
              <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                {isNavigating ? (
                  <div className="size-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <displayApp.logo className="size-4" />
                )}
              </div>
              <div className="grid flex-1 text-left gap-0.5 leading-none">
                <span className="font-semibold">
                  {isNavigating ? 'Switching...' : displayApp.name}
                </span>
                <span className="text-xs">by Pivotr</span>
              </div>
              <ChevronsUpDown className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            align="start"
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-muted-foreground text-xs">Apps</DropdownMenuLabel>
            {safeApps.map((app, index) => {
              const isActive = pathname.startsWith(app.route);
              const isTarget = isNavigating && navigationTargetRef.current === app.route;

              return (
                <DropdownMenuItem
                  key={app.id}
                  onClick={() => handleAppSwitch(app)}
                  className="gap-2 p-2"
                  disabled={isNavigating || isActive}
                >
                  <div className="flex size-6 items-center justify-center rounded-md border">
                    {isTarget ? (
                      <div className="size-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <app.logo className="size-3.5 shrink-0" />
                    )}
                  </div>
                  <span className={isActive ? 'font-semibold' : ''}>{app.name}</span>
                  {isActive && <Check className="ml-auto size-4" />}
                  <DropdownMenuShortcut>⌘{index + 1}</DropdownMenuShortcut>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
