'use client';

import { Check, ChevronsUpDown, GalleryVerticalEnd } from 'lucide-react';
import * as React from 'react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';

interface App {
  id: string;
  name: string;
  logo: React.ComponentType<{ className?: string }>;
}

export function AppSwitcher({
  apps,
  defaultApp,
  onAppSwitch,
}: {
  apps: App[];
  defaultApp: App;
  onAppSwitch?: (appId: string) => void;
}) {
  const [selectedApp, setSelectedApp] = React.useState<App | undefined>(
    defaultApp || (apps.length > 0 ? apps[0] : undefined)
  );

  const handleAppSwitch = (app: App) => {
    setSelectedApp(app);
    if (onAppSwitch) {
      onAppSwitch(app.id);
    }
  };

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
            >
              <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                <selectedApp.logo className="size-4" />
              </div>
              <div className="grid flex-1 text-left gap-0.5 leading-none">
                <span className=" font-semibold">{selectedApp.name}</span>
                <span className=" text-xs">by Pivotr</span>
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
            <DropdownMenuLabel className="text-muted-foreground text-xs">
              Apps
            </DropdownMenuLabel>
            {apps.map((app, index) => (
              <DropdownMenuItem
                key={app.name}
                onClick={() => handleAppSwitch(app)}
                className="gap-2 p-2"
              >
                <div className="flex size-6 items-center justify-center rounded-md border">
                  <app.logo className="size-3.5 shrink-0" />
                </div>
                {app.name}
                <DropdownMenuShortcut>⌘{index + 1}</DropdownMenuShortcut>
              </DropdownMenuItem>
            ))}
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
