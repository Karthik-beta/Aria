'use client';

import { useEffect, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Inventory } from '@aria/types';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Loader2, Package, Save } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { getToastMessage } from '@/lib/errors';

/**
 * Unified Form Page - Handles both Create and Edit
 *
 * Usage:
 * - Create new item: /inventory/items-catalogue/item/form
 * - Edit existing item: /inventory/items-catalogue/item/form?id=cxxx
 *
 * Benefits:
 * - Single source of truth for form logic
 * - No code duplication
 * - Consistent validation and UX
 * - Simpler routing structure
 */
export default function ItemFormPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const itemId = searchParams.get('id');
  const isEditMode = Boolean(itemId);
  const [isPending, startTransition] = useTransition();

  // Form setup with zod validation
  const form = useForm<Inventory.CreateInput>({
    resolver: zodResolver(Inventory.createSchema),
    defaultValues: {
      name: '',
      code: '',
      quantity: 0,
      description: '',
      disabled: false,
      maintainStock: false,
      allowAlternateItem: false,
    },
  });

  // Fetch item data for edit mode
  const { data: items, isLoading: isFetchingItem } = trpc.inventory.listItems.useQuery(undefined, {
    enabled: isEditMode,
  });

  const item = items?.find((i) => i.id === itemId);

  // Pre-fill form when editing
  useEffect(() => {
    if (isEditMode && item) {
      form.reset({
        name: item.name,
        code: item.code,
        quantity: item.quantity,
        description: item.description || '',
        disabled: item.disabled,
        maintainStock: item.maintainStock,
        allowAlternateItem: item.allowAlternateItem,
        itemGroupId: item.itemGroupId || undefined,
        defaultUnitOfMeasureId: item.defaultUnitOfMeasureId || undefined,
      });
    }
  }, [item, isEditMode, form]);

  // tRPC utils for cache management
  const utils = trpc.useUtils();

  // Create mutation
  // Following official TanStack Query v5 pattern: no manual delays needed
  const createMutation = trpc.inventory.createItem.useMutation({
    onSuccess: async (data) => {
      toast.success('Item created successfully!');
      // Official pattern: Invalidate cache and navigate
      // Invalidate will trigger a re-render in the background
      await utils.inventory.listItems.invalidate();
      // Navigate immediately - TanStack Query handles cache updates async
      startTransition(() => {
        router.push(`/inventory/items-catalogue/item/${data.id}`);
      });
    },
    onError: (error) => {
      toast.error(getToastMessage(error, 'create'));
    },
  });

  // Update mutation
  // Following official TanStack Query v5 pattern: no manual delays needed
  const updateMutation = trpc.inventory.updateItem.useMutation({
    onSuccess: async (data) => {
      toast.success('Item updated successfully!');
      // Official pattern: Invalidate cache and navigate
      await utils.inventory.listItems.invalidate();
      // Navigate immediately - TanStack Query handles cache updates async
      startTransition(() => {
        router.push(`/inventory/items-catalogue/item/${data.id}`);
      });
    },
    onError: (error) => {
      toast.error(getToastMessage(error, 'update'));
    },
  });

  // Handle form submission
  const onSubmit = (data: Inventory.CreateInput) => {
    if (isEditMode && itemId) {
      updateMutation.mutate({
        id: itemId,
        ...data,
      });
    } else {
      createMutation.mutate(data);
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending || isPending;

  // Show loading state while fetching item for edit
  if (isEditMode && isFetchingItem) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-4 text-sm text-muted-foreground">Loading item...</p>
        </div>
      </div>
    );
  }

  // Show error if item not found in edit mode
  if (isEditMode && !item) {
    return (
      <div className="container mx-auto max-w-2xl py-8">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Item Not Found</CardTitle>
            <CardDescription>
              The item you&apos;re trying to edit doesn&apos;t exist or has been deleted.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/inventory/items-catalogue/item">
              <Button variant="outline">
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
    <div className="container mx-auto max-w-2xl py-8">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Package className="h-6 w-6 text-primary" />
              <div>
                <CardTitle>{isEditMode ? 'Edit Item' : 'Create New Item'}</CardTitle>
                <CardDescription>
                  {isEditMode
                    ? 'Update the details of your inventory item'
                    : 'Add a new item to your inventory catalogue'}
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Item Name */}
              <div className="space-y-2 col-span-2">
                <Label htmlFor="name">
                  Item Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  placeholder="Enter item name"
                  {...form.register('name')}
                  disabled={isSubmitting}
                />
                {form.formState.errors.name && (
                  <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
                )}
              </div>

              {/* Code */}
              <div className="space-y-2">
                <Label htmlFor="code">
                  Code <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="code"
                  placeholder="Enter code (e.g., ITM-001)"
                  {...form.register('code')}
                  disabled={isSubmitting}
                />
                {form.formState.errors.code && (
                  <p className="text-sm text-destructive">{form.formState.errors.code.message}</p>
                )}
              </div>

              {/* Quantity */}
              <div className="space-y-2">
                <Label htmlFor="quantity">
                  Quantity <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="quantity"
                  type="number"
                  min="0"
                  placeholder="0"
                  {...form.register('quantity', { valueAsNumber: true })}
                  disabled={isSubmitting}
                />
                {form.formState.errors.quantity && (
                  <p className="text-sm text-destructive">{form.formState.errors.quantity.message}</p>
                )}
              </div>

              {/* Description */}
              <div className="space-y-2 col-span-2">
                <Label htmlFor="description">Description</Label>
                <textarea
                  id="description"
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="Enter item description"
                  {...form.register('description')}
                  disabled={isSubmitting}
                />
                {form.formState.errors.description && (
                  <p className="text-sm text-destructive">{form.formState.errors.description.message}</p>
                )}
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
                      disabled={isSubmitting}
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
                      disabled={isSubmitting}
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
                      disabled={isSubmitting}
                    />
                    <Label htmlFor="allowAlternateItem" className="font-normal cursor-pointer">
                      Allow Alternate
                    </Label>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-4">
              <Link
                href={
                  isEditMode && itemId
                    ? `/inventory/items-catalogue/item/${itemId}`
                    : '/inventory/items-catalogue/item'
                }
                className="flex-1"
              >
                <Button type="button" variant="outline" className="w-full" disabled={isSubmitting}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
              </Link>
              <Button
                type="submit"
                className="flex-1"
                disabled={isSubmitting || !form.formState.isValid}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isEditMode ? 'Updating...' : 'Creating...'}
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    {isEditMode ? 'Update Item' : 'Create Item'}
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
