/**
 * Example tRPC Usage Component
 *
 * This demonstrates how to use tRPC with TanStack Query in a Next.js component.
 *
 * Usage:
 * ```tsx
 * import { ExampleTRPCUsage } from '@/lib/trpc/example';
 *
 * function MyPage() {
 *   return <ExampleTRPCUsage />;
 * }
 * ```
 */

"use client";

import { trpc } from ".";

export function ExampleTRPCUsage() {
	// Type-safe query hook - autocomplete works!
	const { data, isLoading, error } = trpc.inventory.listItems.useQuery();

	// Get tRPC utils for cache invalidation (official pattern)
	const utils = trpc.useUtils();

	// Type-safe mutation hook
	const createMutation = trpc.inventory.createItem.useMutation({
		onSuccess: () => {
			// Invalidate and refetch the list
			utils.inventory.listItems.invalidate();
		},
	});

	if (isLoading) {
		return <div>Loading inventory items...</div>;
	}

	if (error) {
		return <div>Error: {error.message}</div>;
	}

	return (
		<div>
			<h2>Inventory Items</h2>
			<ul>
				{data?.map((item) => (
					<li key={item.id}>
						{item.name} - Quantity: {item.quantity}
					</li>
				))}
			</ul>

			<button
				onClick={() =>
					createMutation.mutate({
						name: "New Item",
						quantity: 10,
						code: `ITM-${Date.now()}`,
					})
				}
			>
				Add Item
			</button>
		</div>
	);
}
