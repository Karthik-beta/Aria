/**
 * Edit Inventory Item Page
 * Full-page form for editing existing inventory items
 */

'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { Inventory } from '@aria/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Package, Save } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

export default function EditItemPage() {
  const params = useParams();
  const router = useRouter();
  const utils = trpc.useUtils();
  const itemId = params.itemId as string;

  // Fetch all items to find the current one
  const { data: rawItems = [], isLoading } = trpc.inventory.listItems.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const item = rawItems.find((i) => i.id === itemId);

  // Form setup
  const form = useForm<Inventory.UpdateInput>({
    resolver: zodResolver(Inventory.updateSchema),
    defaultValues: {
      id: itemId,
      name: '',
      code: '',
      quantity: 0,
      description: '',
      disabled: false,
      maintainStock: false,
      allowAlternateItem: false,
    },
  });

  // Set form values when item is loaded
  React.useEffect(() => {
    if (item) {
      form.reset({
        id: item.id,
        name: item.name,
        code: item.code,
        quantity: item.quantity,
        description: item.description || '',
        disabled: item.disabled,
        maintainStock: item.maintainStock,
        allowAlternateItem: item.allowAlternateItem,
      });
    }
  }, [item, form]);

  // Update mutation
  const updateMutation = trpc.inventory.updateItem.useMutation({
    onSuccess: () => {
      utils.inventory.listItems.invalidate();
      toast.success('Item updated successfully');
      // Wrap router.push in startTransition to prevent React state update errors
      React.startTransition(() => {
        router.push(`/inventory/items-catalogue/item/${itemId}`);
      });
    },
    onError: (error) => {
      toast.error(`Failed to update item: ${error.message}`);
    },
  });

  // Handlers
  const onSubmit = form.handleSubmit((data) => {
    updateMutation.mutate(data);
  });

  // Loading state
  if (isLoading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96" />
          </div>
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  // Not found state
  if (!item) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardHeader>
            <CardTitle>Item Not Found</CardTitle>
            <CardDescription>
              The inventory item you&apos;re trying to edit doesn&apos;t exist or has been deleted.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/inventory/items-catalogue/item">
              <Button>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Inventory
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/inventory/items-catalogue/item/${itemId}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Edit Item</h1>
          <p className="text-muted-foreground">Update details for {item.name}</p>
        </div>
      </div>

      {/* Form Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Package className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Item Details</CardTitle>
              <CardDescription>
                Modify the item information. Fields left empty will remain unchanged.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-6">
            {/* Hidden ID field */}
            <input type="hidden" {...form.register('id')} />

            <div className="grid gap-6 md:grid-cols-2">
              {/* Item Name */}
              <div className="space-y-2 col-span-2">
                <Label htmlFor="name">Item Name</Label>
                <Input
                  id="name"
                  {...form.register('name')}
                  placeholder="Enter item name"
                  disabled={updateMutation.isPending}
                />
                {form.formState.errors.name && (
                  <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Current: <strong>{item.name}</strong>
                </p>
              </div>

              {/* Code */}
              <div className="space-y-2">
                <Label htmlFor="code">Code</Label>
                <Input
                  id="code"
                  {...form.register('code')}
                  placeholder="Enter code"
                  disabled={updateMutation.isPending}
                  className="font-mono"
                />
                {form.formState.errors.code && (
                  <p className="text-sm text-destructive">{form.formState.errors.code.message}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Current: <code className="rounded bg-muted px-2 py-1">{item.code}</code>
                </p>
              </div>

              {/* Quantity */}
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  {...form.register('quantity', { valueAsNumber: true })}
                  placeholder="Enter quantity"
                  disabled={updateMutation.isPending}
                  min={0}
                  step={1}
                />
                {form.formState.errors.quantity && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.quantity.message}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Current: <strong>{item.quantity} units</strong>
                </p>
              </div>

              {/* Description */}
              <div className="space-y-2 col-span-2">
                <Label htmlFor="description">Description</Label>
                <textarea
                  id="description"
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  {...form.register('description')}
                  placeholder="Enter item description"
                  disabled={updateMutation.isPending}
                />
              </div>

              {/* Settings */}
              <div className="space-y-4 col-span-2">
                <Label>Settings</Label>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="disabled"
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      {...form.register('disabled')}
                      disabled={updateMutation.isPending}
                    />
                    <Label htmlFor="disabled" className="font-normal cursor-pointer">
                      Disabled
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="maintainStock"
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      {...form.register('maintainStock')}
                      disabled={updateMutation.isPending}
                    />
                    <Label htmlFor="maintainStock" className="font-normal cursor-pointer">
                      Maintain Stock
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="allowAlternateItem"
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      {...form.register('allowAlternateItem')}
                      disabled={updateMutation.isPending}
                    />
                    <Label htmlFor="allowAlternateItem" className="font-normal cursor-pointer">
                      Allow Alternate
                    </Label>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-4 pt-4 border-t">
              <Link href={`/inventory/items-catalogue/item/${itemId}`}>
                <Button type="button" variant="outline" disabled={updateMutation.isPending}>
                  Cancel
                </Button>
              </Link>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? (
                  <>
                    <span className="mr-2">Updating...</span>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Editing Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            • <strong>Name:</strong> Update to change how this item appears in lists and reports
          </p>
          <p>
            • <strong>Code:</strong> Unique identifier for this item.
          </p>
          <p>
            • <strong>Quantity:</strong> Adjust current stock level.
          </p>
          <p>• All changes are saved immediately and logged for audit purposes.</p>
        </CardContent>
      </Card>
    </div>
  );
}
