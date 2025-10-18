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
  name: string;
  logo: React.ComponentType<{ className?: string }>;
  route: string; // Add route property
}

export function AppSwitcher({ apps, defaultApp }: { apps: App[]; defaultApp: App }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isMounted, setIsMounted] = React.useState(false);
  const [isNavigating, setIsNavigating] = React.useState(false);

  // Determine active app based on current route - memoized for performance
  const activeApp = React.useMemo(() => {
    const currentApp = apps.find((app) => pathname.startsWith(app.route));
    return currentApp || defaultApp || apps[0];
  }, [apps, pathname, defaultApp]);

  const [selectedApp, setSelectedApp] = React.useState<App>(activeApp);

  // Ensure component only renders after hydration to avoid ID mismatch
  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  // Update selected app when active app changes and reset navigation state
  React.useEffect(() => {
    setSelectedApp(activeApp);
    setIsNavigating(false); // Reset loading state when navigation completes
  }, [activeApp]);

  const handleAppSwitch = React.useCallback(
    (app: App) => {
      // Don't navigate if already on the same app or currently navigating
      if (app.id === selectedApp.id || isNavigating) return;

      // Immediately show loading state for user feedback
      setIsNavigating(true);
      setSelectedApp(app); // Optimistically update UI

      // Navigate after a brief moment to show the selection
      setTimeout(() => {
        router.push(app.route);
      }, 150);
    },
    [router, selectedApp.id, isNavigating]
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

  if (!selectedApp) {
    return null;
  }
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
                  <selectedApp.logo className="size-4" />
                )}
              </div>
              <div className="grid flex-1 text-left gap-0.5 leading-none">
                <span className="font-semibold">
                  {isNavigating ? 'Switching...' : selectedApp.name}
                </span>
                <span className="text-xs">by Pivotr</span>
              </div>
              <ChevronsUpDown className="ml-auto" />
            </SidebarMenuButton>
            {/* <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="bg-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                <GalleryVerticalEnd className="size-4" />
              </div>
              <div className="flex flex-col gap-0.5 leading-none">
                <span className="font-semibold">Next Starter</span>
                <span className="">{selectedApp.name}</span>
              </div>
              <ChevronsUpDown className="ml-auto" />
            </SidebarMenuButton> */}
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            align="start"
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-muted-foreground text-xs">Apps</DropdownMenuLabel>
            {apps.map((app, index) => {
              const isActive = app.id === selectedApp.id;
              const isCurrentlyNavigating = isNavigating && app.id === selectedApp.id;

              return (
                <DropdownMenuItem
                  key={app.name}
                  onClick={() => handleAppSwitch(app)}
                  className="gap-2 p-2"
                  disabled={isNavigating || isActive}
                >
                  <div className="flex size-6 items-center justify-center rounded-md border">
                    {isCurrentlyNavigating ? (
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
          {/* <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]" align="start">
            {apps.map((app) => (
              <DropdownMenuItem key={app.id} onSelect={() => handleAppSwitch(app)}>
                {app.name} {app.id === selectedApp.id && <Check className="ml-auto" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent> */}
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
