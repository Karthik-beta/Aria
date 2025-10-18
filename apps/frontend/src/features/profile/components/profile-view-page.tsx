export default function ProfileViewPage() {
  const profile = {
    name: 'Admin',
    email: 'admin@example.com',
    role: 'Operations Manager',
    phone: '+91 91104 49630',
  };

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
          <p className="text-base">{profile.name}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Email</p>
          <p className="text-base">{profile.email}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Role</p>
          <p className="text-base">{profile.role}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Phone</p>
          <p className="text-base">{profile.phone}</p>
        </div>
      </div>
    </div>
  );
}
