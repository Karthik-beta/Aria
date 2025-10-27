'use client';
import * as React from 'react';
import {
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { UserAvatarProfile } from '@/components/user-avatar-profile';
import { usePathname, useRouter } from 'next/navigation';
import { signOut, useSession } from '@/lib/auth/client';
import { toast } from 'sonner';
import { IconCreditCard, IconBell, IconLogout, IconUserCircle } from '@tabler/icons-react';

type Props = {
  /** Optional explicit app route prefix (e.g. '/inventory'). If not provided the component will infer from pathname. */
  appRoute?: string;
  className?: string;
};

export default function UserDropdownContent({ appRoute, className }: Props) {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const user = React.useMemo(() => {
    const su = session?.user as any | undefined;
    if (!su) {
      return {
        fullName: 'User',
        emailAddresses: [{ emailAddress: '' }],
        imageUrl: '',
      };
    }

    return {
      fullName: su.name || su.fullName || su.username || 'User',
      emailAddresses: [{ emailAddress: su.email || (su.emails && su.emails[0]?.value) || '' }],
      imageUrl: su.avatar || su.imageUrl || su.image || '',
    };
  }, [session]);

  const prefix = React.useMemo(() => {
    if (appRoute) return appRoute;
    if (!pathname) return '';
    const parts = pathname.split('/').filter(Boolean);
    return parts.length > 0 ? `/${parts[0]}` : '';
  }, [appRoute, pathname]);

  return (
    <DropdownMenuContent className={className} side="bottom" align="end" sideOffset={4}>
      <DropdownMenuLabel className="p-0 font-normal">
        <div className="px-1 py-1.5">
          <UserAvatarProfile className="h-8 w-8 rounded-lg" showInfo user={user} />
        </div>
      </DropdownMenuLabel>
      <DropdownMenuSeparator />

      <DropdownMenuGroup>
        <DropdownMenuItem onClick={() => router.push(`${prefix}/dashboard/profile`)}>
          <IconUserCircle className="mr-2 h-4 w-4" />
          Profile
        </DropdownMenuItem>
        <DropdownMenuItem>
          <IconBell className="mr-2 h-4 w-4" />
          Notifications
        </DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />

      <DropdownMenuItem
        onClick={async () => {
          try {
            await signOut();
            try {
              if (typeof toast?.success === 'function') toast.success('Signed out successfully');
            } catch (e) {
              /* swallow */
            }
            router.push('/auth/sign-in');
          } catch (err) {
            try {
              if (typeof toast?.error === 'function')
                toast.error('Failed to sign out. Please try again.');
            } catch (e) {
              /* swallow */
            }
            router.push('/auth/sign-in');
          }
        }}
      >
        <IconLogout className="mr-2 h-4 w-4" />
        Sign out
      </DropdownMenuItem>
    </DropdownMenuContent>
  );
}
