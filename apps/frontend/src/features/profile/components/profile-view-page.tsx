'use client';

import * as React from 'react';
import { useSession } from '@/lib/auth/client';

/**
 * Type guard to check if value has a specific property
 */
function hasProperty<T extends string>(
  obj: unknown,
  prop: T
): obj is Record<T, unknown> & Record<string, unknown> {
  return typeof obj === 'object' && obj !== null && prop in obj;
}

export default function ProfileViewPage() {
  const { data: session } = useSession();

  const profile = React.useMemo(() => {
    const u = session?.user;

    const fallback = {
      name: 'Admin',
      email: 'admin@example.com',
      role: 'Operations Manager',
      phone: '+91 91104 49630',
    };

    if (!hasProperty(u, 'name') && !hasProperty(u, 'email')) return fallback;

    const getName = () => {
      if (hasProperty(u, 'name') && typeof u.name === 'string') return u.name;
      if (hasProperty(u, 'fullName') && typeof u.fullName === 'string') return u.fullName;
      if (hasProperty(u, 'username') && typeof u.username === 'string') return u.username;
      return 'User';
    };

    const getEmail = () => {
      if (hasProperty(u, 'email') && typeof u.email === 'string') return u.email;
      if (hasProperty(u, 'emails') && Array.isArray(u.emails) && u.emails[0]) {
        const firstEmail = u.emails[0] as Record<string, unknown>;
        if ('value' in firstEmail && typeof firstEmail.value === 'string') {
          return firstEmail.value;
        }
      }
      return '';
    };

    const getRole = () => {
      if (hasProperty(u, 'role') && typeof u.role === 'string') return u.role;
      return 'Member';
    };

    const getPhone = () => {
      if (hasProperty(u, 'phone') && typeof u.phone === 'string') return u.phone;
      if (hasProperty(u, 'mobile') && typeof u.mobile === 'string') return u.mobile;
      return '+91 91XXXX X1831';
    };

    return {
      name: getName(),
      email: getEmail(),
      role: getRole(),
      phone: getPhone(),
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
          <p className="text-base truncate" title={profile.name}>
            {profile.name}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Email</p>
          <p className="text-base truncate" title={profile.email}>
            {profile.email}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Role</p>
          <p className="text-base truncate" title={profile.role}>
            {profile.role}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Phone</p>
          <p className="text-base truncate" title={profile.phone}>
            {profile.phone}
          </p>
        </div>
      </div>
    </div>
  );
}
