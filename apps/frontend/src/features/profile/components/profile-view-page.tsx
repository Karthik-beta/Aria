"use client";

import * as React from 'react';
import { useSession } from '@/lib/auth/client';

// Utility to safely return a truncated string for places where CSS truncation isn't available.
function truncateText(value: string | undefined | null, max = 48) {
  if (!value) return '';
  if (value.length <= max) return value;
  return value.slice(0, max - 1) + '…';
}

export default function ProfileViewPage() {
  const { data: session, isPending } = useSession();

  const profile = React.useMemo(() => {
    const u = session?.user as any | undefined;
    if (!u) {
      return {
        name: 'Admin',
        email: 'admin@example.com',
        role: 'Operations Manager',
        phone: '+91 91104 49630',
      };
    }

    return {
      name: u.name || u.fullName || u.username || 'User',
      email: u.email || (u.emails && u.emails[0]?.value) || '',
      role: u.role || 'Member',
      phone: u.phone || u.mobile || '+91 91XXXX X1831',
    };
  }, [session]);

  return (
    <div className="flex w-full flex-col gap-6 p-4">
      <div>
        <h2 className="text-2xl font-semibold">Profile</h2>
        <p className="text-muted-foreground text-sm">
          Manage the details for the default inventory administrator account.
        </p>
      </div>

      <div className="grid gap-4 rounded-xl border border-muted bg-card p-6 shadow-sm">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Name</p>
          <p
            className="text-base truncate"
            title={profile.name}
          >
            {profile.name}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Email</p>
          <p
            className="text-base truncate"
            title={profile.email}
          >
            {profile.email}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Role</p>
          <p className="text-base truncate" title={profile.role}>{profile.role}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Phone</p>
          <p className="text-base truncate" title={profile.phone}>{profile.phone}</p>
        </div>
      </div>
    </div>
  );
}
