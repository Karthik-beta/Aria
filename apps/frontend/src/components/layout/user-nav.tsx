'use client';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UserAvatarProfile } from '@/components/user-avatar-profile';
import { useRouter } from 'next/navigation';
import { signOut } from '@/lib/auth/client';
import * as React from 'react';
import { toast } from 'sonner';

export function UserNav() {
  const user = {
    fullName: 'Inventory Admin',
    emailAddresses: [{ emailAddress: 'inventory.admin@example.com' }],
    imageUrl: '',
  };
  const router = useRouter();
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
      <DropdownMenuContent className="w-56" align="end" sideOffset={10} forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm leading-none font-medium">{user.fullName}</p>
            <p className="text-muted-foreground text-xs leading-none">
              {user.emailAddresses[0].emailAddress}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => router.push('/dashboard/profile')}>
            Profile
          </DropdownMenuItem>
          <DropdownMenuItem>Billing</DropdownMenuItem>
          <DropdownMenuItem>Settings</DropdownMenuItem>
          <DropdownMenuItem>New Team</DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={async () => {
            try {
              await signOut();
              // toast may be mocked in tests; guard calls to avoid runtime errors
              try {
                if (typeof toast?.success === 'function') {
                  toast.success('Signed out successfully');
                }
              } catch (e) {
                /* swallow toast errors in test/runtime */
              }
              router.push('/login');
            } catch (err) {
              console.error('Sign out failed:', err);
              try {
                if (typeof toast?.error === 'function') {
                  toast.error('Failed to sign out. Please try again.');
                }
              } catch (e) {
                /* swallow toast errors in test/runtime */
              }
              // Fallback to redirect to login even if signOut fails
              router.push('/login');
            }
          }}
        >
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
