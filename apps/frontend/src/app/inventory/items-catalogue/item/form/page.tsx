'use client';

import { useEffect } from 'react';
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

  // Form setup with zod validation
  const form = useForm<Inventory.CreateInput>({
    resolver: zodResolver(Inventory.createSchema),
    defaultValues: {
      name: '',
      sku: '',
      quantity: 0,
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
        sku: item.sku,
        quantity: item.quantity,
      });
    }
  }, [item, isEditMode, form]);

  // Create mutation
  const createMutation = trpc.inventory.createItem.useMutation({
    onSuccess: (data) => {
      toast.success('Item created successfully!');
      router.push(`/inventory/items-catalogue/item/${data.id}`);
    },
    onError: (error) => {
      toast.error(`Failed to create item: ${error.message}`);
    },
  });

  // Update mutation
  const updateMutation = trpc.inventory.updateItem.useMutation({
    onSuccess: (data) => {
      toast.success('Item updated successfully!');
      router.push(`/inventory/items-catalogue/item/${data.id}`);
    },
    onError: (error) => {
      toast.error(`Failed to update item: ${error.message}`);
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

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

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
              The item you're trying to edit doesn't exist or has been deleted.
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
            {/* Item Name */}
            <div className="space-y-2">
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

            {/* SKU */}
            <div className="space-y-2">
              <Label htmlFor="sku">
                SKU <span className="text-destructive">*</span>
              </Label>
              <Input
                id="sku"
                placeholder="Enter SKU (e.g., ITM-001)"
                {...form.register('sku')}
                disabled={isSubmitting}
              />
              {form.formState.errors.sku && (
                <p className="text-sm text-destructive">{form.formState.errors.sku.message}</p>
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
              <p className="text-xs text-muted-foreground">Enter the current stock quantity</p>
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
