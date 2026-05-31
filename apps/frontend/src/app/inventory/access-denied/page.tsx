export default function AccessDeniedPage() {
	return (
		<div className="flex min-h-[60vh] items-center justify-center px-6">
			<div className="max-w-md text-center">
				<h2 className="text-xl font-semibold">Access restricted</h2>
				<p className="mt-2 text-sm text-muted-foreground">
					You do not have permission to open the INVENTORY workspace yet.
					Contact your administrator to request access.
				</p>
			</div>
		</div>
	);
}
