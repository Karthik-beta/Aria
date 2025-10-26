'use client';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { UserAvatarProfile } from '@/components/user-avatar-profile';
import { useRouter, usePathname } from 'next/navigation';
import { useSession } from '@/lib/auth/client';
import * as React from 'react';
import UserDropdownContent from './user-dropdown-content';

export function UserNav() {
  const { data: session } = useSession();

  const user = React.useMemo(() => {
    const su = session?.user as any | undefined;
    if (!su) {
      return {
        fullName: 'Inventory Admin',
        emailAddresses: [{ emailAddress: 'inventory.admin@example.com' }],
        imageUrl: '',
      };
    }

    return {
      fullName: su.name || su.fullName || su.username || 'User',
      emailAddresses: [
        { emailAddress: su.email || (su.emails && su.emails[0]?.value) || '' },
      ],
      imageUrl: su.avatar || su.imageUrl || su.image || '',
    };
  }, [session]);
  const router = useRouter();
  const pathname = usePathname();
  const prefix = React.useMemo(() => {
    if (!pathname) return '';
    const parts = pathname.split('/').filter(Boolean);
    return parts.length > 0 ? `/${parts[0]}` : '';
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
