'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Inventory } from '@aria/types';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
    ArrowLeft,
    Check,
    ChevronDown,
    ChevronsUpDown,
    Copy,
    Loader2,
    Menu,
    MoreHorizontal,
    Save,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { getToastMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';

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
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(true);
    const [descriptionOpen, setDescriptionOpen] = useState(false);
    const [unitsOpen, setUnitsOpen] = useState(false);

    // Combobox states
    const [itemGroupOpen, setItemGroupOpen] = useState(false);
    const [unitOfMeasureOpen, setUnitOfMeasureOpen] = useState(false);
    const [itemGroupSearch, setItemGroupSearch] = useState('');
    const [unitOfMeasureSearch, setUnitOfMeasureSearch] = useState('');

    // Form setup with zod validation
    const form = useForm<Inventory.CreateInput>({
        resolver: zodResolver(Inventory.createSchema),
        defaultValues: {
            name: '',
            code: '',
            quantity: 0,
            description: '',
            disabled: false,
            maintainStock: true,
            allowAlternateItem: false,
            hasVariants: false,
            openingStock: 0,
            valuationRate: undefined,
            standardSellingRate: undefined,
            isZeroRated: false,
            isExempt: false,
            isFixedAsset: false,
            taxCode: '',
            itemGroupId: undefined,
            defaultUnitOfMeasureId: undefined,
        },
    });

    // Watch for form changes
    useEffect(() => {
        const subscription = form.watch(() => {
            setHasUnsavedChanges(true);
        });
        return () => subscription.unsubscribe();
    }, [form]);

    // Fetch item data for edit mode
    const { data: items, isLoading: isFetchingItem } = trpc.inventory.listItems.useQuery(undefined, {
        enabled: isEditMode,
    });

    // Fetch item groups
    const { data: itemGroups = [] } = trpc.inventory.listItemGroups.useQuery(
        { search: itemGroupSearch },
        { staleTime: 30000 }
    );

    // Fetch units of measure
    const { data: unitsOfMeasure = [] } = trpc.inventory.listUnitsOfMeasure.useQuery(
        { search: unitOfMeasureSearch },
        { staleTime: 30000 }
    );

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
                hasVariants: item.hasVariants,
                openingStock: item.openingStock,
                valuationRate: item.valuationRate ?? undefined,
                standardSellingRate: item.standardSellingRate ?? undefined,
                isZeroRated: item.isZeroRated,
                isExempt: item.isExempt,
                isFixedAsset: item.isFixedAsset,
                taxCode: item.taxCode || '',
                itemGroupId: item.itemGroupId || undefined,
                defaultUnitOfMeasureId: item.defaultUnitOfMeasureId || undefined,
            });
            setHasUnsavedChanges(false);
        }
    }, [item, isEditMode, form]);

    // tRPC utils for cache management
    const utils = trpc.useUtils();

    // Create mutation
    const createMutation = trpc.inventory.createItem.useMutation({
        onSuccess: async (data) => {
            toast.success('Item created successfully!');
            setHasUnsavedChanges(false);
            await utils.inventory.listItems.invalidate();
            startTransition(() => {
                router.push(`/inventory/items-catalogue/item/${data.id}`);
            });
        },
        onError: (error) => {
            toast.error(getToastMessage(error, 'create'));
        },
    });

    // Update mutation
    const updateMutation = trpc.inventory.updateItem.useMutation({
        onSuccess: async (data) => {
            toast.success('Item updated successfully!');
            setHasUnsavedChanges(false);
            await utils.inventory.listItems.invalidate();
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

    // Get selected item group and unit of measure names for display
    const selectedItemGroup = itemGroups.find((g) => g.id === form.watch('itemGroupId'));
    const selectedUnitOfMeasure = unitsOfMeasure.find(
        (u) => u.id === form.watch('defaultUnitOfMeasureId')
    );

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
    if (isEditMode && !isFetchingItem && !item) {
        return (
            <div className="container mx-auto max-w-4xl py-8">
                <div className="rounded-lg border border-destructive bg-destructive/10 p-6">
                    <h2 className="text-lg font-semibold text-destructive">Item Not Found</h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                        The item you&apos;re trying to edit doesn&apos;t exist or has been deleted.
                    </p>
                    <Link href="/inventory/items-catalogue/item" className="mt-4 inline-block">
                        <Button variant="outline">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Inventory
                        </Button>
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen flex-col bg-background">
            {/* Header */}
            <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="flex h-14 items-center justify-between px-4">
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Menu className="h-4 w-4" />
                        </Button>
                        <div className="flex items-center gap-2">
                            <h1 className="text-lg font-semibold">{isEditMode ? 'Edit Item' : 'New Item'}</h1>
                            {hasUnsavedChanges && (
                                <Badge variant="secondary" className="bg-orange-500/20 text-orange-500">
                                    Not Saved
                                </Badge>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm">
                                    View
                                    <ChevronDown className="ml-1 h-3 w-3" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem>Default View</DropdownMenuItem>
                                <DropdownMenuItem>Compact View</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm">
                                    Actions
                                    <ChevronDown className="ml-1 h-3 w-3" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem>Print</DropdownMenuItem>
                                <DropdownMenuItem>Export</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <Button variant="outline" size="sm" disabled={!isEditMode}>
                            <Copy className="mr-1 h-3 w-3" />
                            Duplicate
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                        <Button
                            size="sm"
                            onClick={form.handleSubmit(onSubmit)}
                            disabled={isSubmitting || !form.formState.isValid}
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                'Save'
                            )}
                        </Button>
                    </div>
                </div>
            </header>

            {/* Tabs Navigation */}
            <Tabs defaultValue="details" className="flex-1">
                <div className="border-b bg-muted/30">
                    <div className="px-4">
                        <TabsList className="h-auto bg-transparent p-0">
                            <TabsTrigger
                                value="details"
                                className="rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                            >
                                Details
                            </TabsTrigger>
                            <TabsTrigger
                                value="inventory"
                                className="rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                            >
                                Inventory
                            </TabsTrigger>
                        </TabsList>
                    </div>
                </div>

                <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1">
                    {/* Details Tab */}
                    <TabsContent value="details" className="mt-0 p-6">
                        <div className="grid gap-8 lg:grid-cols-[1fr,1fr]">
                            {/* Left Column */}
                            <div className="space-y-6">
                                {/* Item Code */}
                                <div className="space-y-2">
                                    <Label htmlFor="code">
                                        Item Code <span className="text-destructive">*</span>
                                    </Label>
                                    <Input
                                        id="code"
                                        placeholder="Enter item code"
                                        {...form.register('code')}
                                        disabled={isSubmitting}
                                        className={cn(
                                            'border-destructive/50 focus-visible:ring-destructive/30',
                                            form.formState.errors.code && 'border-destructive'
                                        )}
                                    />
                                    {form.formState.errors.code && (
                                        <p className="text-sm text-destructive">{form.formState.errors.code.message}</p>
                                    )}
                                </div>

                                {/* Item Name */}
                                <div className="space-y-2">
                                    <Label htmlFor="name">Item Name</Label>
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

                                {/* Item Group */}
                                <div className="space-y-2">
                                    <Label>
                                        Item Group <span className="text-destructive">*</span>
                                    </Label>
                                    <Controller
                                        name="itemGroupId"
                                        control={form.control}
                                        render={({ field }) => (
                                            <Popover open={itemGroupOpen} onOpenChange={setItemGroupOpen}>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        variant="outline"
                                                        role="combobox"
                                                        aria-expanded={itemGroupOpen}
                                                        className={cn(
                                                            'w-full justify-between font-normal',
                                                            'border-destructive/50 focus-visible:ring-destructive/30'
                                                        )}
                                                        disabled={isSubmitting}
                                                    >
                                                        {selectedItemGroup?.groupName || 'Select item group...'}
                                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                                    <Command>
                                                        <CommandInput
                                                            placeholder="Search item groups..."
                                                            value={itemGroupSearch}
                                                            onValueChange={setItemGroupSearch}
                                                        />
                                                        <CommandList>
                                                            <CommandEmpty>No item group found.</CommandEmpty>
                                                            <CommandGroup>
                                                                {itemGroups.map((group) => (
                                                                    <CommandItem
                                                                        key={group.id}
                                                                        value={group.groupName}
                                                                        onSelect={() => {
                                                                            field.onChange(
                                                                                group.id === field.value ? undefined : group.id
                                                                            );
                                                                            setItemGroupOpen(false);
                                                                        }}
                                                                    >
                                                                        <Check
                                                                            className={cn(
                                                                                'mr-2 h-4 w-4',
                                                                                field.value === group.id ? 'opacity-100' : 'opacity-0'
                                                                            )}
                                                                        />
                                                                        {group.groupName}
                                                                    </CommandItem>
                                                                ))}
                                                            </CommandGroup>
                                                        </CommandList>
                                                    </Command>
                                                </PopoverContent>
                                            </Popover>
                                        )}
                                    />
                                </div>

                                {/* Tax Code */}
                                <div className="space-y-2">
                                    <Label htmlFor="taxCode">Tax Code</Label>
                                    <Input
                                        id="taxCode"
                                        placeholder="Enter tax code"
                                        {...form.register('taxCode')}
                                        disabled={isSubmitting}
                                    />
                                </div>

                                {/* Tax Checkboxes */}
                                <div className="space-y-3">
                                    <Controller
                                        name="isZeroRated"
                                        control={form.control}
                                        render={({ field }) => (
                                            <div className="flex items-center space-x-2">
                                                <Checkbox
                                                    id="isZeroRated"
                                                    checked={field.value}
                                                    onCheckedChange={field.onChange}
                                                    disabled={isSubmitting}
                                                />
                                                <Label htmlFor="isZeroRated" className="cursor-pointer font-normal">
                                                    Is Zero Rated
                                                </Label>
                                            </div>
                                        )}
                                    />
                                    <Controller
                                        name="isExempt"
                                        control={form.control}
                                        render={({ field }) => (
                                            <div className="flex items-center space-x-2">
                                                <Checkbox
                                                    id="isExempt"
                                                    checked={field.value}
                                                    onCheckedChange={field.onChange}
                                                    disabled={isSubmitting}
                                                />
                                                <Label htmlFor="isExempt" className="cursor-pointer font-normal">
                                                    Is Exempt
                                                </Label>
                                            </div>
                                        )}
                                    />
                                </div>

                                {/* Default Unit of Measure */}
                                <div className="space-y-2">
                                    <Label>
                                        Default Unit of Measure <span className="text-destructive">*</span>
                                    </Label>
                                    <Controller
                                        name="defaultUnitOfMeasureId"
                                        control={form.control}
                                        render={({ field }) => (
                                            <Popover open={unitOfMeasureOpen} onOpenChange={setUnitOfMeasureOpen}>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        variant="outline"
                                                        role="combobox"
                                                        aria-expanded={unitOfMeasureOpen}
                                                        className={cn(
                                                            'w-full justify-between font-normal',
                                                            'border-destructive/50 focus-visible:ring-destructive/30'
                                                        )}
                                                        disabled={isSubmitting}
                                                    >
                                                        {selectedUnitOfMeasure?.name || 'Nos'}
                                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                                    <Command>
                                                        <CommandInput
                                                            placeholder="Search units..."
                                                            value={unitOfMeasureSearch}
                                                            onValueChange={setUnitOfMeasureSearch}
                                                        />
                                                        <CommandList>
                                                            <CommandEmpty>No unit found.</CommandEmpty>
                                                            <CommandGroup>
                                                                {unitsOfMeasure.map((unit) => (
                                                                    <CommandItem
                                                                        key={unit.id}
                                                                        value={unit.name}
                                                                        onSelect={() => {
                                                                            field.onChange(unit.id === field.value ? undefined : unit.id);
                                                                            setUnitOfMeasureOpen(false);
                                                                        }}
                                                                    >
                                                                        <Check
                                                                            className={cn(
                                                                                'mr-2 h-4 w-4',
                                                                                field.value === unit.id ? 'opacity-100' : 'opacity-0'
                                                                            )}
                                                                        />
                                                                        {unit.name}
                                                                    </CommandItem>
                                                                ))}
                                                            </CommandGroup>
                                                        </CommandList>
                                                    </Command>
                                                </PopoverContent>
                                            </Popover>
                                        )}
                                    />
                                </div>
                            </div>

                            {/* Right Column */}
                            <div className="space-y-6">
                                {/* Checkboxes */}
                                <div className="space-y-4">
                                    <Controller
                                        name="disabled"
                                        control={form.control}
                                        render={({ field }) => (
                                            <div className="flex items-center space-x-2">
                                                <Checkbox
                                                    id="disabled"
                                                    checked={field.value}
                                                    onCheckedChange={field.onChange}
                                                    disabled={isSubmitting}
                                                />
                                                <Label htmlFor="disabled" className="cursor-pointer font-normal">
                                                    Disabled
                                                </Label>
                                            </div>
                                        )}
                                    />
                                    <Controller
                                        name="allowAlternateItem"
                                        control={form.control}
                                        render={({ field }) => (
                                            <div className="flex items-center space-x-2">
                                                <Checkbox
                                                    id="allowAlternateItem"
                                                    checked={field.value}
                                                    onCheckedChange={field.onChange}
                                                    disabled={isSubmitting}
                                                />
                                                <Label htmlFor="allowAlternateItem" className="cursor-pointer font-normal">
                                                    Allow Alternative Item
                                                </Label>
                                            </div>
                                        )}
                                    />
                                    <Controller
                                        name="maintainStock"
                                        control={form.control}
                                        render={({ field }) => (
                                            <div className="flex items-center space-x-2">
                                                <Checkbox
                                                    id="maintainStock"
                                                    checked={field.value}
                                                    onCheckedChange={field.onChange}
                                                    disabled={isSubmitting}
                                                />
                                                <Label htmlFor="maintainStock" className="cursor-pointer font-normal">
                                                    Maintain Stock
                                                </Label>
                                            </div>
                                        )}
                                    />
                                    <div className="space-y-1">
                                        <Controller
                                            name="hasVariants"
                                            control={form.control}
                                            render={({ field }) => (
                                                <div className="flex items-center space-x-2">
                                                    <Checkbox
                                                        id="hasVariants"
                                                        checked={field.value}
                                                        onCheckedChange={field.onChange}
                                                        disabled={isSubmitting}
                                                    />
                                                    <Label htmlFor="hasVariants" className="cursor-pointer font-normal">
                                                        Has Variants
                                                    </Label>
                                                </div>
                                            )}
                                        />
                                        <p className="ml-6 text-xs text-muted-foreground">
                                            If this item has variants, then it cannot be selected in sales orders etc.
                                        </p>
                                    </div>
                                </div>

                                {/* Stock and Pricing Fields */}
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="openingStock">Opening Stock</Label>
                                        <Input
                                            id="openingStock"
                                            type="number"
                                            min="0"
                                            placeholder="0"
                                            {...form.register('openingStock', { valueAsNumber: true })}
                                            disabled={isSubmitting}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="valuationRate">Valuation Rate</Label>
                                        <Input
                                            id="valuationRate"
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            placeholder="0.00"
                                            {...form.register('valuationRate', { valueAsNumber: true })}
                                            disabled={isSubmitting}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="standardSellingRate">Standard Selling Rate</Label>
                                        <Input
                                            id="standardSellingRate"
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            placeholder="0.00"
                                            {...form.register('standardSellingRate', { valueAsNumber: true })}
                                            disabled={isSubmitting}
                                        />
                                    </div>
                                    <Controller
                                        name="isFixedAsset"
                                        control={form.control}
                                        render={({ field }) => (
                                            <div className="flex items-center space-x-2">
                                                <Checkbox
                                                    id="isFixedAsset"
                                                    checked={field.value}
                                                    onCheckedChange={field.onChange}
                                                    disabled={isSubmitting}
                                                />
                                                <Label htmlFor="isFixedAsset" className="cursor-pointer font-normal">
                                                    Is Fixed Asset
                                                </Label>
                                            </div>
                                        )}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Collapsible Sections */}
                        <div className="mt-8 space-y-4">
                            {/* Description */}
                            <Collapsible open={descriptionOpen} onOpenChange={setDescriptionOpen}>
                                <CollapsibleTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        className="flex w-full items-center justify-between px-0 hover:bg-transparent"
                                    >
                                        <span className="text-sm font-medium">Description</span>
                                        <ChevronDown
                                            className={cn(
                                                'h-4 w-4 transition-transform',
                                                descriptionOpen && 'rotate-180'
                                            )}
                                        />
                                    </Button>
                                </CollapsibleTrigger>
                                <CollapsibleContent className="pt-4">
                                    <textarea
                                        id="description"
                                        className="flex min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        placeholder="Enter item description..."
                                        {...form.register('description')}
                                        disabled={isSubmitting}
                                    />
                                </CollapsibleContent>
                            </Collapsible>

                            {/* Units of Measure */}
                            <Collapsible open={unitsOpen} onOpenChange={setUnitsOpen}>
                                <CollapsibleTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        className="flex w-full items-center justify-between px-0 hover:bg-transparent"
                                    >
                                        <span className="text-sm font-medium">Units of Measure</span>
                                        <ChevronDown
                                            className={cn('h-4 w-4 transition-transform', unitsOpen && 'rotate-180')}
                                        />
                                    </Button>
                                </CollapsibleTrigger>
                                <CollapsibleContent className="pt-4">
                                    <div className="rounded-md border p-4">
                                        <p className="text-sm text-muted-foreground">
                                            Configure additional units of measure for this item. You can set conversion
                                            rates between different units.
                                        </p>
                                        {/* Placeholder for unit conversions table */}
                                        <div className="mt-4">
                                            <Button variant="outline" size="sm" type="button">
                                                Add Unit Conversion
                                            </Button>
                                        </div>
                                    </div>
                                </CollapsibleContent>
                            </Collapsible>
                        </div>
                    </TabsContent>

                    {/* Inventory Tab */}
                    <TabsContent value="inventory" className="mt-0 p-6">
                        <div className="space-y-6">
                            <div className="grid gap-6 md:grid-cols-2">
                                {/* Quantity */}
                                <div className="space-y-2">
                                    <Label htmlFor="quantity">Current Quantity</Label>
                                    <Input
                                        id="quantity"
                                        type="number"
                                        min="0"
                                        placeholder="0"
                                        {...form.register('quantity', { valueAsNumber: true })}
                                        disabled={isSubmitting}
                                    />
                                    {form.formState.errors.quantity && (
                                        <p className="text-sm text-destructive">
                                            {form.formState.errors.quantity.message}
                                        </p>
                                    )}
                                </div>

                                {/* Opening Stock */}
                                <div className="space-y-2">
                                    <Label htmlFor="openingStockInventory">Opening Stock</Label>
                                    <Input
                                        id="openingStockInventory"
                                        type="number"
                                        min="0"
                                        placeholder="0"
                                        {...form.register('openingStock', { valueAsNumber: true })}
                                        disabled={isSubmitting}
                                    />
                                </div>
                            </div>

                            <div className="rounded-md border p-4">
                                <h3 className="mb-4 text-sm font-medium">Stock Settings</h3>
                                <div className="space-y-4">
                                    <Controller
                                        name="maintainStock"
                                        control={form.control}
                                        render={({ field }) => (
                                            <div className="flex items-center space-x-2">
                                                <Checkbox
                                                    id="maintainStockInventory"
                                                    checked={field.value}
                                                    onCheckedChange={field.onChange}
                                                    disabled={isSubmitting}
                                                />
                                                <div>
                                                    <Label
                                                        htmlFor="maintainStockInventory"
                                                        className="cursor-pointer font-normal"
                                                    >
                                                        Maintain Stock
                                                    </Label>
                                                    <p className="text-xs text-muted-foreground">
                                                        Enable stock tracking for this item
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    />
                                    <Controller
                                        name="hasVariants"
                                        control={form.control}
                                        render={({ field }) => (
                                            <div className="flex items-center space-x-2">
                                                <Checkbox
                                                    id="hasVariantsInventory"
                                                    checked={field.value}
                                                    onCheckedChange={field.onChange}
                                                    disabled={isSubmitting}
                                                />
                                                <div>
                                                    <Label
                                                        htmlFor="hasVariantsInventory"
                                                        className="cursor-pointer font-normal"
                                                    >
                                                        Has Variants
                                                    </Label>
                                                    <p className="text-xs text-muted-foreground">
                                                        This item has multiple variants (e.g., size, color)
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    />
                                </div>
                            </div>
                        </div>
                    </TabsContent>
                </form>
            </Tabs>
        </div>
    );
}
