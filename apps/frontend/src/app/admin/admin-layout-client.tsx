'use client';

import { ReactNode, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ProtectedContent } from '@/components/auth/protected-content';
import ThemeProvider from '@/components/layout/ThemeToggle/theme-provider';
import {
    DisplayModeProvider,
    useDisplayMode,
    type DisplayMode,
    type DisplayModeOption,
} from './display-mode-context';
import {
    SidebarProvider,
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarHeader,
    SidebarFooter,
    SidebarTrigger,
    SidebarInset,
} from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Users,
    Shield,
    FileText,
    LayoutDashboard,
    Settings,
    ChevronRight,
    Search,
    Moon,
    Sun,
    Monitor,
    Palette,
} from 'lucide-react';
import { useTheme } from 'next-themes';

const navItems = [
    {
        title: 'Overview',
        href: '/admin',
        icon: LayoutDashboard,
    },
    {
        title: 'Users',
        href: '/admin/users',
        icon: Users,
    },
    {
        title: 'Roles & Permissions',
        href: '/admin/roles',
        icon: Shield,
    },
    {
        title: 'Audit Logs',
        href: '/admin/audit',
        icon: FileText,
    },
];

export default function AdminLayoutClient({ children }: { children: ReactNode }) {
    return (
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <DisplayModeProvider>
                <ProtectedContent permission="system:user.read" fallback={<AdminAccessDenied />}>
                    <SidebarProvider>
                        <div className="flex min-h-screen w-full">
                            <AdminSidebar />
                            <SidebarInset className="flex-1">
                                <AdminHeader />
                                <main className="flex-1 p-6">{children}</main>
                            </SidebarInset>
                        </div>
                    </SidebarProvider>
                </ProtectedContent>
            </DisplayModeProvider>
        </ThemeProvider>
    );
}

function AdminHeader() {
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const { theme, setTheme } = useTheme();
    const { mode, setMode, options } = useDisplayMode();
    const displayModeEntries = useMemo(
        () => Object.entries(options) as Array<[DisplayMode, DisplayModeOption]>,
        [options]
    );
    const activeDisplayMode = options[mode];

    const handleDisplayModeChange = (value: string) => {
        if (value in options) {
            setMode(value as DisplayMode);
        }
    };

    // Handle search submission
    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (searchQuery.trim()) {
            // TODO: Implement actual search functionality
            // For now, just keep the search open
        }
    };

    // Close search when clicking outside
    const handleBlur = () => {
        if (!searchQuery) {
            setTimeout(() => setSearchOpen(false), 200);
        }
    };

    return (
        <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background px-6">
            <SidebarTrigger />
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-muted-foreground" />
                <h1 className="text-lg font-semibold">Admin Console</h1>
            </div>

            <div className="ml-auto flex items-center gap-2">
                {/* Search */}
                <form onSubmit={handleSearch} className="relative">
                    {searchOpen ? (
                        <div className="flex items-center gap-2">
                            <Input
                                placeholder="Search admin..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-64"
                                autoFocus
                                onBlur={handleBlur}
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                    setSearchOpen(false);
                                    setSearchQuery('');
                                }}
                            >
                                ✕
                            </Button>
                        </div>
                    ) : (
                        <Button type="button" variant="ghost" size="icon" onClick={() => setSearchOpen(true)}>
                            <Search className="h-4 w-4" />
                            <span className="sr-only">Search</span>
                        </Button>
                    )}
                </form>

                {/* Theme Toggle */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                            {theme === 'light' ? (
                                <Sun className="h-4 w-4" />
                            ) : theme === 'dark' ? (
                                <Moon className="h-4 w-4" />
                            ) : (
                                <Monitor className="h-4 w-4" />
                            )}
                            <span className="sr-only">Toggle theme</span>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Theme</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setTheme('light')}>
                            <Sun className="mr-2 h-4 w-4" />
                            Light
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setTheme('dark')}>
                            <Moon className="mr-2 h-4 w-4" />
                            Dark
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setTheme('system')}>
                            <Monitor className="mr-2 h-4 w-4" />
                            System
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

                {/* View Mode Selector */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-2">
                            <Palette className="mr-2 h-4 w-4" />
                            <span className="hidden sm:inline">
                                View{activeDisplayMode ? `: ${activeDisplayMode.label}` : ''}
                            </span>
                            <span className="sm:hidden">View</span>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Display Mode</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuRadioGroup value={mode} onValueChange={handleDisplayModeChange}>
                            {displayModeEntries.map(([key, option]) => (
                                <DropdownMenuRadioItem key={key} value={key} className="items-start gap-3 py-2">
                                    <option.icon className="mt-0.5 h-4 w-4" />
                                    <div className="flex flex-col gap-0.5">
                                        <span className="font-medium leading-none">{option.label}</span>
                                        <span className="text-xs text-muted-foreground">{option.description}</span>
                                    </div>
                                </DropdownMenuRadioItem>
                            ))}
                        </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </header>
    );
}

function AdminSidebar() {
    const pathname = usePathname();

    return (
        <Sidebar>
            <SidebarHeader className="border-b px-6 py-4">
                <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-primary to-primary/60 text-primary-foreground">
                        <Settings className="h-4 w-4" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold">Admin Panel</p>
                        <p className="text-xs text-muted-foreground">System Management</p>
                    </div>
                </div>
            </SidebarHeader>
            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel>Navigation</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {navItems.map((item) => {
                                const Icon = item.icon;
                                const isActive = pathname === item.href;
                                return (
                                    <SidebarMenuItem key={item.href}>
                                        <SidebarMenuButton asChild isActive={isActive}>
                                            <Link href={item.href}>
                                                <Icon className="h-4 w-4" />
                                                <span>{item.title}</span>
                                                {isActive && <ChevronRight className="ml-auto h-4 w-4" />}
                                            </Link>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                );
                            })}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>
            <SidebarFooter className="border-t p-4">
                <div className="text-xs text-muted-foreground">
                    <p className="font-medium">Aria ERP Admin</p>
                    <p className="mt-1">v1.0.0 • © 2025</p>
                </div>
            </SidebarFooter>
        </Sidebar>
    );
}

function AdminAccessDenied() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="text-center">
                <h1 className="text-4xl font-bold mb-4">Access Denied</h1>
                <p className="text-muted-foreground mb-8">
                    You don&apos;t have permission to access the admin dashboard.
                </p>
                <a
                    href="/"
                    className="inline-block px-6 py-3 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                >
                    Return to Home
                </a>
            </div>
        </div>
    );
}
