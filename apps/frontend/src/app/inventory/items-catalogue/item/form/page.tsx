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
    Search,
    Bell,
    HelpCircle,
    User,
    ChevronRight,
    Bold,
    Italic,
    Underline,
    Strikethrough,
    Type,
    AlignCenter,
    List,
    ListOrdered,
    Link2,
    Image as ImageIcon,
    Quote,
    Code,
    Table as TableIcon,
    Trash2,
    Settings,
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

export default function ItemFormPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const itemId = searchParams.get('id');
    const isEditMode = Boolean(itemId);
    const [isPending, startTransition] = useTransition();
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(!isEditMode);
    const [isInitialized, setIsInitialized] = useState(!isEditMode);
    const [descriptionOpen, setDescriptionOpen] = useState(true);
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

    // Watch for form changes - only AFTER initialization
    useEffect(() => {
        if (!isInitialized) return;

        const subscription = form.watch(() => {
            setHasUnsavedChanges(true);
        });
        return () => subscription.unsubscribe();
    }, [form, isInitialized]);

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

    // Initialization and Pre-fill for Edit Mode
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
            setIsInitialized(true);
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

    return (
        <div className="flex min-h-screen flex-col bg-[#f8f9fa]">
            {/* Main Content Area */}
            <div className="flex-1 px-8 py-4">
                {/* Header with Actions */}
                <div className="mb-6 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Menu className="h-5 w-5 text-gray-400 cursor-pointer" />
                        <h1 className="text-2xl font-bold tracking-tight">{isEditMode ? item?.name : 'New Item'}</h1>
                        {hasUnsavedChanges && (
                            <Badge className="bg-[#fff3e0] text-[#fb8c00] border-none font-medium shadow-none hover:bg-[#fff3e0]">
                                Not Saved
                            </Badge>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" className="h-8">
                            View <ChevronDown className="ml-1.5 h-3 w-3" />
                        </Button>
                        <Button variant="outline" size="sm" className="h-8">
                            Actions <ChevronDown className="ml-1.5 h-3 w-3" />
                        </Button>
                        <Button variant="outline" size="sm" className="h-8">
                            Duplicate
                        </Button>
                        <Button variant="outline" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                        <Button
                            size="sm"
                            className="h-8 px-6"
                            onClick={form.handleSubmit(onSubmit)}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                        </Button>
                    </div>
                </div>

                {/* Form Container */}
                <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
                    <Tabs defaultValue="details" className="w-full">
                        {/* Tab List */}
                        <div className="border-b px-4 py-2">
                            <TabsList>
                                {['Details', 'Inventory', 'Accounting', 'Purchasing', 'Sales', 'Tax', 'Quality', 'Manufacturing'].map((tab) => (
                                    <TabsTrigger
                                        key={tab}
                                        value={tab.toLowerCase()}
                                    >
                                        {tab}
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                        </div>

                        {/* Tab Contents */}
                        <TabsContent value="details" className="m-0 focus-visible:outline-none">
                            <div className="grid grid-cols-2 gap-x-12 p-8">
                                {/* Left Column */}
                                <div className="space-y-6">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-medium text-gray-500">
                                            Item Code <span className="text-red-500">*</span>
                                        </Label>
                                        <Input
                                            {...form.register('code')}
                                            className="h-10"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-medium text-gray-500">Item Name</Label>
                                        <Input
                                            {...form.register('name')}
                                            className="h-10"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-medium text-gray-500">
                                            Item Group <span className="text-red-500">*</span>
                                        </Label>
                                        <Controller
                                            name="itemGroupId"
                                            control={form.control}
                                            render={({ field }) => (
                                                <Popover open={itemGroupOpen} onOpenChange={setItemGroupOpen}>
                                                    <PopoverTrigger asChild>
                                                        <Button
                                                            variant="outline"
                                                            className="h-10 w-full justify-between font-normal"
                                                        >
                                                            {selectedItemGroup?.groupName || ''}
                                                            <ChevronDown className="h-4 w-4 opacity-50" />
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="p-0 pointer-events-auto" style={{ width: 'var(--radix-popover-trigger-width)' }}>
                                                        <Command>
                                                            <CommandInput placeholder="Search item groups..." />
                                                            <CommandList>
                                                                <CommandEmpty>No results</CommandEmpty>
                                                                <CommandGroup>
                                                                    {itemGroups.map((g) => (
                                                                        <CommandItem
                                                                            key={g.id}
                                                                            onSelect={() => {
                                                                                field.onChange(g.id);
                                                                                setItemGroupOpen(false);
                                                                            }}
                                                                        >
                                                                            {g.groupName}
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
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-medium text-gray-500">Tax Code</Label>
                                        <Input
                                            {...form.register('taxCode')}
                                            className="h-10"
                                        />
                                    </div>
                                    <div className="pt-2 space-y-4">
                                        <div className="flex items-center gap-2">
                                            <Checkbox
                                                id="isZeroRated"
                                                onCheckedChange={(checked) => form.setValue('isZeroRated', !!checked)}
                                                checked={form.watch('isZeroRated')}
                                            />
                                            <Label htmlFor="isZeroRated" className="text-sm font-normal cursor-pointer">Is Zero Rated</Label>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <Checkbox
                                                id="isExempt"
                                                onCheckedChange={(checked) => form.setValue('isExempt', !!checked)}
                                                checked={form.watch('isExempt')}
                                            />
                                            <Label htmlFor="isExempt" className="text-sm font-normal cursor-pointer">Is Exempt</Label>
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-medium text-gray-500">
                                            Default Unit of Measure <span className="text-red-500">*</span>
                                        </Label>
                                        <Controller
                                            name="defaultUnitOfMeasureId"
                                            control={form.control}
                                            render={({ field }) => (
                                                <Popover open={unitOfMeasureOpen} onOpenChange={setUnitOfMeasureOpen}>
                                                    <PopoverTrigger asChild>
                                                        <Button
                                                            variant="outline"
                                                            className="h-10 w-full justify-between font-normal"
                                                        >
                                                            {selectedUnitOfMeasure?.name || 'Nos'}
                                                            <ChevronDown className="h-4 w-4 opacity-50" />
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="p-0 pointer-events-auto" style={{ width: 'var(--radix-popover-trigger-width)' }}>
                                                        <Command>
                                                            <CommandInput placeholder="Search units..." />
                                                            <CommandList>
                                                                <CommandEmpty>No results</CommandEmpty>
                                                                <CommandGroup>
                                                                    {unitsOfMeasure.map((u) => (
                                                                        <CommandItem
                                                                            key={u.id}
                                                                            onSelect={() => {
                                                                                field.onChange(u.id);
                                                                                setUnitOfMeasureOpen(false);
                                                                            }}
                                                                        >
                                                                            {u.name}
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
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-3">
                                            <Checkbox
                                                id="disabled"
                                                onCheckedChange={(checked) => form.setValue('disabled', !!checked)}
                                                checked={form.watch('disabled')}
                                            />
                                            <Label htmlFor="disabled" className="text-sm font-normal cursor-pointer">Disabled</Label>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <Checkbox
                                                id="allowAlt"
                                                onCheckedChange={(checked) => form.setValue('allowAlternateItem', !!checked)}
                                                checked={form.watch('allowAlternateItem')}
                                            />
                                            <Label htmlFor="allowAlt" className="text-sm font-normal cursor-pointer">Allow Alternative Item</Label>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <Checkbox
                                                id="maintainStock"
                                                onCheckedChange={(checked) => form.setValue('maintainStock', !!checked)}
                                                checked={form.watch('maintainStock')}
                                            />
                                            <Label htmlFor="maintainStock" className="text-sm font-normal cursor-pointer">Maintain Stock</Label>
                                        </div>
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-3">
                                                <Checkbox
                                                    id="hasVariants"
                                                    onCheckedChange={(checked) => form.setValue('hasVariants', !!checked)}
                                                    checked={form.watch('hasVariants')}
                                                />
                                                <Label htmlFor="hasVariants" className="text-sm font-normal cursor-pointer">Has Variants</Label>
                                            </div>
                                            <p className="pl-7.5 text-[11px] text-gray-500 leading-tight">
                                                If this item has variants, then it cannot be selected in sales orders etc.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-1.5 pt-2">
                                        <Label className="text-xs font-medium text-gray-500">Opening Stock</Label>
                                        <Input
                                            type="number"
                                            {...form.register('openingStock', { valueAsNumber: true })}
                                            className="h-10"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-medium text-gray-500">Valuation Rate</Label>
                                        <Input
                                            type="number"
                                            {...form.register('valuationRate', { valueAsNumber: true })}
                                            className="h-10"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-medium text-gray-500">Standard Selling Rate</Label>
                                        <Input
                                            type="number"
                                            {...form.register('standardSellingRate', { valueAsNumber: true })}
                                            className="h-10"
                                        />
                                    </div>
                                    <div className="flex items-center gap-3 pt-2">
                                        <Checkbox
                                            id="isFixedAsset"
                                            onCheckedChange={(checked) => form.setValue('isFixedAsset', !!checked)}
                                            checked={form.watch('isFixedAsset')}
                                        />
                                        <Label htmlFor="isFixedAsset" className="text-sm font-normal text-gray-700 cursor-pointer">Is Fixed Asset</Label>
                                    </div>
                                </div>
                            </div>

                            {/* Collapsible Sections (ERPNext style) */}
                            <div className="border-t">
                                <Collapsible open={descriptionOpen} onOpenChange={setDescriptionOpen}>
                                    <CollapsibleTrigger asChild>
                                        <div className="flex h-12 cursor-pointer items-center justify-between px-8 hover:bg-gray-50">
                                            <span className="text-sm font-medium text-gray-700 uppercase tracking-wider">Description</span>
                                            <ChevronDown className={cn("h-4 w-4 text-gray-400 transition-transform", descriptionOpen && "rotate-180")} />
                                        </div>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent className="px-8 pb-8 pt-2">
                                        {/* Rich Text Editor Mockup */}
                                        <div className="rounded border bg-[#fcfcfc] overflow-hidden">
                                            <div className="flex flex-wrap items-center gap-0.5 border-b bg-white p-1">
                                                <Button variant="ghost" size="icon" className="h-7 w-7"><Type className="h-3.5 w-3.5" /></Button>
                                                <div className="h-4 w-[1px] bg-gray-200 mx-1" />
                                                <Button variant="ghost" size="icon" className="h-7 w-7"><Bold className="h-3.5 w-3.5" /></Button>
                                                <Button variant="ghost" size="icon" className="h-7 w-7"><Italic className="h-3.5 w-3.5" /></Button>
                                                <Button variant="ghost" size="icon" className="h-7 w-7"><Underline className="h-3.5 w-3.5" /></Button>
                                                <Button variant="ghost" size="icon" className="h-7 w-7"><Strikethrough className="h-3.5 w-3.5" /></Button>
                                                <div className="h-4 w-[1px] bg-gray-200 mx-1" />
                                                <Button variant="ghost" size="icon" className="h-7 w-7"><AlignCenter className="h-3.5 w-3.5" /></Button>
                                                <Button variant="ghost" size="icon" className="h-7 w-7"><List className="h-3.5 w-3.5" /></Button>
                                                <Button variant="ghost" size="icon" className="h-7 w-7"><ListOrdered className="h-3.5 w-3.5" /></Button>
                                                <div className="h-4 w-[1px] bg-gray-200 mx-1" />
                                                <Button variant="ghost" size="icon" className="h-7 w-7"><Link2 className="h-3.5 w-3.5" /></Button>
                                                <Button variant="ghost" size="icon" className="h-7 w-7"><ImageIcon className="h-3.5 w-3.5" /></Button>
                                                <div className="h-4 w-[1px] bg-gray-200 mx-1" />
                                                <Button variant="ghost" size="icon" className="h-7 w-7"><Quote className="h-3.5 w-3.5" /></Button>
                                                <Button variant="ghost" size="icon" className="h-7 w-7"><Code className="h-3.5 w-3.5" /></Button>
                                                <Button variant="ghost" size="icon" className="h-7 w-7"><TableIcon className="h-3.5 w-3.5" /></Button>
                                            </div>
                                            <textarea
                                                className="w-full min-h-[160px] p-4 bg-transparent outline-none text-sm resize-none"
                                                placeholder="Enter detailed description..."
                                                value={form.watch('description')}
                                                onChange={(e) => form.setValue('description', e.target.value)}
                                            />
                                        </div>
                                    </CollapsibleContent>
                                </Collapsible>
                            </div>

                            <div className="border-t">
                                <div className="flex flex-col px-8 py-6 space-y-2">
                                    <Label className="text-xs font-medium text-gray-500">Brand</Label>
                                    <Input
                                        className="h-10 max-w-sm"
                                        placeholder=""
                                    />
                                </div>
                            </div>

                            <div className="border-t">
                                <Collapsible open={unitsOpen} onOpenChange={setUnitsOpen}>
                                    <CollapsibleTrigger asChild>
                                        <div className="flex h-12 cursor-pointer items-center justify-between px-8 hover:bg-gray-50">
                                            <span className="text-sm font-medium text-gray-700 uppercase tracking-wider">Units of Measure</span>
                                            <ChevronDown className={cn("h-4 w-4 text-gray-400 transition-transform", unitsOpen && "rotate-180")} />
                                        </div>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent className="px-8 pb-8 pt-4">
                                        <div className="space-y-4">
                                            <div className="text-[13px] text-gray-600 mb-2">UOMs</div>
                                            <div className="text-[11px] text-gray-500 mb-4">Will also apply for variants</div>

                                            <div className="rounded border overflow-hidden">
                                                <table className="w-full text-xs text-left">
                                                    <thead className="bg-[#f8f9fa] border-b uppercase text-[10px] tracking-wider text-gray-500">
                                                        <tr>
                                                            <th className="px-4 py-2 w-10"><Checkbox className="h-3 w-3 rounded" /></th>
                                                            <th className="px-4 py-2 w-16">No.</th>
                                                            <th className="px-4 py-2">UOM</th>
                                                            <th className="px-4 py-2">Conversion Factor</th>
                                                            <th className="px-4 py-2 w-10"><Settings className="h-3 w-3" /></th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        <tr>
                                                            <td colSpan={5} className="p-12 text-center bg-white">
                                                                <div className="flex flex-col items-center gap-2 opacity-50">
                                                                    <List className="h-6 w-6" />
                                                                    <span className="text-[11px]">No Data</span>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>
                                            <Button variant="outline" size="sm" className="h-8 px-4 text-xs font-medium border-gray-300 hover:bg-gray-50">
                                                Add Row
                                            </Button>
                                        </div>
                                    </CollapsibleContent>
                                </Collapsible>
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
        </div>
    );
}
