# Item Activity Timeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a reusable Activity Timeline feature to the Inventory Item detail page showing all stock movements and transactions for an item.

**Architecture:** Activity data is derived from existing stock transactions (DeliveryNote, PurchaseReceipt, StockEntry, SerialNo) and logged to a new `ItemActivityLog` table for efficient querying. The frontend displays a chronological timeline grouped by date, similar to ERPNext's item activity view.

**Tech Stack:** NestJS backend, tRPC, Prisma, Next.js 15, shadcn/ui, Tailwind CSS

---

## Task 1: Add Prisma Schema for ItemActivityLog

**Files:**
- Modify: `apps/backend/prisma/schema.prisma:2018-2019` (append after AssetDepreciationScheduleStatus enum)

- [ ] **Step 1: Add ItemActivityLog model to Prisma schema**

After line 2019 (end of enum AssetDepreciationScheduleStatus), add:

```prisma
model ItemActivityLog {
  id            String                @id @default(cuid())
  itemId        String                @db.VarChar(100)
  activityType  String                @db.VarChar(50)
  description   String                @db.VarChar(500)
  quantity      Float?
  value         Float?
  company       String?               @db.VarChar(255)
  warehouse     String?               @db.VarChar(255)
  referenceType String?               @db.VarChar(50)
  referenceId   String?               @db.VarChar(100)
  referenceName String?               @db.VarChar(255)
  metadata      Json?
  createdAt     DateTime              @default(now())

  @@index([itemId])
  @@index([createdAt])
  @@index([itemId, createdAt])
  @@map("item_activity_logs")
}
```

- [ ] **Step 2: Run Prisma generate**

Run: `cd /home/dmin/Aria/apps/backend && bun prisma generate`
Expected: Client generated successfully

- [ ] **Step 3: Commit**

Run:
```bash
cd /home/dmin/Aria
git add apps/backend/prisma/schema.prisma
git commit -m "feat(inventory): add ItemActivityLog model for activity timeline

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 2: Add TypeScript Types for ItemActivityLog

**Files:**
- Modify: `packages/types/src/index.ts` (add to Inventory namespace around line 200)

- [ ] **Step 1: Add ItemActivityLog type and related types to packages/types/src/index.ts**

After the existing Inventory types (around line 200), add:

```typescript
/**
 * Activity types for item timeline
 */
export const ITEM_ACTIVITY_TYPES = [
  "STOCK_IN",
  "STOCK_OUT",
  "TRANSFER",
  "ADJUSTMENT",
  "DELIVERY",
  "PURCHASE_RECEIPT",
  "STOCK_ENTRY",
  "SERIAL_NUMBER",
  "BATCH",
  "CREATED",
  "UPDATED",
  "STATUS_CHANGE",
] as const;

export type ItemActivityType =
  (typeof ITEM_ACTIVITY_TYPES)[number];

/**
 * Activity log entry for item timeline display
 */
export interface ItemActivityLogEntry {
  id: string;
  itemId: string;
  activityType: ItemActivityType;
  description: string;
  quantity: number | null;
  value: number | null;
  company: string | null;
  warehouse: string | null;
  referenceType: string | null;
  referenceId: string | null;
  referenceName: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

/**
 * Query filters for fetching item activity
 */
export interface ListItemActivityInput {
  itemId: string;
  fromDate?: Date;
  toDate?: Date;
  activityType?: ItemActivityType;
  limit?: number;
  offset?: number;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/types/src/index.ts
git commit -m "feat(types): add ItemActivityLogEntry type and activity types

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 3: Create Backend ItemActivityService

**Files:**
- Create: `apps/backend/src/apps/inventory/services/item-activity.service.ts`
- Test: `apps/backend/src/apps/inventory/__tests__/item-activity.spec.ts`

- [ ] **Step 1: Write failing test for ItemActivityService**

Create `apps/backend/src/apps/inventory/__tests__/item-activity.spec.ts`:

```typescript
import { ItemActivityService } from "../services/item-activity.service";
import type { PrismaService } from "../../../shared/prisma.service";

describe("ItemActivityService", () => {
  let service: ItemActivityService;
  let mockPrisma: jest.Mocked<PrismaService>;

  beforeEach(() => {
    mockPrisma = {
      itemActivityLog: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        deleteMany: jest.fn(),
      },
    } as unknown as jest.Mocked<PrismaService>;
    service = new ItemActivityService(mockPrisma);
  });

  describe("logActivity", () => {
    it("should create an activity log entry", async () => {
      const input = {
        itemId: "item-123",
        activityType: "STOCK_IN" as const,
        description: "Received 100 units via Purchase Receipt",
        quantity: 100,
        company: "Test Company",
      };

      const expected = {
        id: "log-1",
        ...input,
        value: null,
        warehouse: null,
        referenceType: null,
        referenceId: null,
        referenceName: null,
        metadata: null,
        createdAt: new Date(),
      };

      mockPrisma.itemActivityLog.create.mockResolvedValue(expected);

      const result = await service.logActivity(input);

      expect(result).toEqual(expected);
      expect(mockPrisma.itemActivityLog.create).toHaveBeenCalledWith({
        data: {
          itemId: input.itemId,
          activityType: input.activityType,
          description: input.description,
          quantity: input.quantity,
          value: null,
          company: input.company,
          warehouse: null,
          referenceType: null,
          referenceId: null,
          referenceName: null,
          metadata: null,
        },
      });
    });
  });

  describe("getActivityForItem", () => {
    it("should return activity entries for an item", async () => {
      const itemId = "item-123";
      const entries = [
        {
          id: "log-1",
          itemId,
          activityType: "STOCK_IN",
          description: "Received 100 units",
          quantity: 100,
          value: null,
          company: "Test Company",
          warehouse: null,
          referenceType: "PurchaseReceipt",
          referenceId: "pr-1",
          referenceName: "MAT-PRE-2026-00001",
          metadata: null,
          createdAt: new Date(),
        },
      ];

      mockPrisma.itemActivityLog.findMany.mockResolvedValue(entries);

      const result = await service.getActivityForItem({ itemId });

      expect(result).toEqual(entries);
      expect(mockPrisma.itemActivityLog.findMany).toHaveBeenCalledWith({
        where: { itemId },
        orderBy: { createdAt: "desc" },
        take: 50,
        skip: 0,
      });
    });
  });
});
```

Run: `cd /home/dmin/Aria && bun --filter backend test apps/backend/src/apps/inventory/__tests__/item-activity.spec.ts`
Expected: FAIL - ItemActivityService not found

- [ ] **Step 2: Write minimal implementation**

Create `apps/backend/src/apps/inventory/services/item-activity.service.ts`:

```typescript
import { Inventory } from "@aria/types";
import type { PrismaService } from "../../../shared/prisma.service";

export class ItemActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async logActivity(
    input: Omit<Inventory.ItemActivityLogEntry, "id" | "createdAt">,
  ): Promise<Inventory.ItemActivityLogEntry> {
    const created = await this.prisma.itemActivityLog.create({
      data: {
        itemId: input.itemId,
        activityType: input.activityType,
        description: input.description,
        quantity: input.quantity ?? null,
        value: input.value ?? null,
        company: input.company ?? null,
        warehouse: input.warehouse ?? null,
        referenceType: input.referenceType ?? null,
        referenceId: input.referenceId ?? null,
        referenceName: input.referenceName ?? null,
        metadata: input.metadata ?? null,
      },
    });

    return {
      id: created.id,
      itemId: created.itemId,
      activityType: created.activityType as Inventory.ItemActivityType,
      description: created.description,
      quantity: created.quantity,
      value: created.value,
      company: created.company,
      warehouse: created.warehouse,
      referenceType: created.referenceType,
      referenceId: created.referenceId,
      referenceName: created.referenceName,
      metadata: created.metadata as Record<string, unknown> | null,
      createdAt: created.createdAt,
    };
  }

  async getActivityForItem(params: Inventory.ListItemActivityInput): Promise<Inventory.ItemActivityLogEntry[]> {
    const take = params.limit ?? 50;
    const skip = params.offset ?? 0;

    const where: Record<string, unknown> = { itemId: params.itemId };

    if (params.fromDate || params.toDate) {
      where.createdAt = {};
      if (params.fromDate) {
        (where.createdAt as Record<string, Date>).gte = params.fromDate;
      }
      if (params.toDate) {
        (where.createdAt as Record<string, Date>).lte = params.toDate;
      }
    }

    if (params.activityType) {
      where.activityType = params.activityType;
    }

    const entries = await this.prisma.itemActivityLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      skip,
    });

    return entries.map((entry) => ({
      id: entry.id,
      itemId: entry.itemId,
      activityType: entry.activityType as Inventory.ItemActivityType,
      description: entry.description,
      quantity: entry.quantity,
      value: entry.value,
      company: entry.company,
      warehouse: entry.warehouse,
      referenceType: entry.referenceType,
      referenceId: entry.referenceId,
      referenceName: entry.referenceName,
      metadata: entry.metadata as Record<string, unknown> | null,
      createdAt: entry.createdAt,
    }));
  }

  async deleteActivityForItem(itemId: string): Promise<{ success: boolean; count: number }> {
    const result = await this.prisma.itemActivityLog.deleteMany({
      where: { itemId },
    });
    return { success: true, count: result.count };
  }
}
```

Run: `cd /home/dmin/Aria && bun --filter backend test apps/backend/src/apps/inventory/__tests__/item-activity.spec.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/apps/inventory/services/item-activity.service.ts
git add apps/backend/src/apps/inventory/__tests__/item-activity.spec.ts
git commit -m "feat(inventory): add ItemActivityService for activity logging

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 4: Create tRPC Router Procedures for Item Activity

**Files:**
- Modify: `apps/backend/src/apps/inventory/trpc/inventory.router.ts` (add procedures)
- Test: `apps/backend/src/apps/inventory/trpc/inventory.router.spec.ts`

- [ ] **Step 1: Add listItemActivity procedure to inventory.router.ts**

First, read the current router file to understand where to add:

```typescript
// Add these import and procedures to inventory.router.ts
// Import ItemActivityService:
// At top with other imports, add:
import { ItemActivityService } from "../services/item-activity.service";

// In the router definition, add these procedures:
// After the existing listItems procedure, add:

listItemActivity: protectedProcedure
  .input(
    z.object({
      itemId: z.string(),
      fromDate: z.date().optional(),
      toDate: z.date().optional(),
      activityType: z.string().optional(),
      limit: z.number().min(1).max(100).optional(),
      offset: z.number().min(0).optional(),
    }),
  )
  .query(async ({ input }) => {
    const service = new ItemActivityService(prisma);
    return service.getActivityForItem({
      itemId: input.itemId,
      fromDate: input.fromDate,
      toDate: input.toDate,
      activityType: input.activityType as Inventory.ItemActivityType | undefined,
      limit: input.limit,
      offset: input.offset,
    });
  }),
```

- [ ] **Step 2: Add to services index**

Verify `services/index.ts` exports the service, or add if missing.

- [ ] **Step 3: Run typecheck and lint**

Run: `cd /home/dmin/Aria && bun run typecheck 2>&1 | head -50`
Expected: No errors for inventory router

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/apps/inventory/trpc/inventory.router.ts
git add apps/backend/src/apps/inventory/services/index.ts
git commit -m "feat(trpc): add listItemActivity procedure to inventory router

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 5: Create Frontend ActivityTimeline Component

**Files:**
- Create: `apps/frontend/src/features/inventory/components/activity-timeline.tsx`

- [ ] **Step 1: Create ActivityTimeline component**

Create `apps/frontend/src/features/inventory/components/activity-timeline.tsx`:

```typescript
"use client";

import { Inventory } from "@aria/types";
import { format } from "date-fns";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Box,
  Calendar,
  ChevronRight,
  GitCompare,
  Package,
  RefreshCcw,
  Settings,
  Truck,
} from "lucide-react";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";

type ActivityType = Inventory.ItemActivityType;

const ACTIVITY_ICONS: Record<ActivityType, React.ComponentType<{ className?: string }>> = {
  STOCK_IN: ArrowDownLeft,
  STOCK_OUT: ArrowUpRight,
  TRANSFER: GitCompare,
  ADJUSTMENT: RefreshCcw,
  DELIVERY: Truck,
  PURCHASE_RECEIPT: Package,
  STOCK_ENTRY: Box,
  SERIAL_NUMBER: Settings,
  BATCH: Settings,
  CREATED: Package,
  UPDATED: Settings,
  STATUS_CHANGE: RefreshCcw,
};

const ACTIVITY_COLORS: Record<ActivityType, string> = {
  STOCK_IN: "text-green-600 bg-green-50",
  STOCK_OUT: "text-red-600 bg-red-50",
  TRANSFER: "text-blue-600 bg-blue-50",
  ADJUSTMENT: "text-orange-600 bg-orange-50",
  DELIVERY: "text-purple-600 bg-purple-50",
  PURCHASE_RECEIPT: "text-emerald-600 bg-emerald-50",
  STOCK_ENTRY: "text-cyan-600 bg-cyan-50",
  SERIAL_NUMBER: "text-gray-600 bg-gray-50",
  BATCH: "text-amber-600 bg-amber-50",
  CREATED: "text-green-600 bg-green-50",
  UPDATED: "text-blue-600 bg-blue-50",
  STATUS_CHANGE: "text-orange-600 bg-orange-50",
};

const ACTIVITY_LABELS: Record<ActivityType, string> = {
  STOCK_IN: "Stock In",
  STOCK_OUT: "Stock Out",
  TRANSFER: "Transfer",
  ADJUSTMENT: "Adjustment",
  DELIVERY: "Delivery",
  PURCHASE_RECEIPT: "Purchase Receipt",
  STOCK_ENTRY: "Stock Entry",
  SERIAL_NUMBER: "Serial No",
  BATCH: "Batch",
  CREATED: "Created",
  UPDATED: "Updated",
  STATUS_CHANGE: "Status Change",
};

interface ActivityTimelineProps {
  itemId: string;
  limit?: number;
}

export function ActivityTimeline({ itemId, limit = 50 }: ActivityTimelineProps) {
  const { data, isLoading, error } = trpc.inventory.listItemActivity.useQuery(
    { itemId, limit },
    {
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Activity Timeline
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-start gap-4">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Activity Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">
            Failed to load activity: {error.message}
          </p>
        </CardContent>
      </Card>
    );
  }

  const activities = data ?? [];

  if (activities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Activity Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No activity recorded for this item yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Group activities by date
  const groupedByDate = activities.reduce<Record<string, Inventory.ItemActivityLogEntry[]>>(
    (acc, activity) => {
      const dateKey = format(activity.createdAt, "yyyy-MM-dd");
      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }
      acc[dateKey].push(activity);
      return acc;
    },
    {},
  );

  const sortedDates = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Activity Timeline
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {sortedDates.map((dateKey) => {
          const dayActivities = groupedByDate[dateKey];
          const date = new Date(dateKey);
          const isToday = format(date, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");
          const isYesterday =
            format(date, "yyyy-MM-dd") ===
            format(new Date(Date.now() - 86400000), "yyyy-MM-dd");

          let dateLabel = format(date, "MMMM d, yyyy");
          if (isToday) dateLabel = "Today";
          else if (isYesterday) dateLabel = "Yesterday";

          return (
            <div key={dateKey}>
              <div className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                <Calendar className="h-3 w-3" />
                {dateLabel}
              </div>
              <div className="relative space-y-4 pl-4 border-l-2 border-muted">
                {dayActivities.map((activity) => {
                  const IconComponent = ACTIVITY_ICONS[activity.activityType] ?? Box;
                  const colorClass = ACTIVITY_COLORS[activity.activityType] ?? "text-gray-600 bg-gray-50";
                  const label = ACTIVITY_LABELS[activity.activityType] ?? activity.activityType;

                  return (
                    <div
                      key={activity.id}
                      className="relative flex items-start gap-4 pl-4"
                    >
                      {/* Icon */}
                      <div
                        className={cn(
                          "absolute -left-[21px] flex h-8 w-8 items-center justify-center rounded-full border-2 border-background",
                          colorClass,
                        )}
                      >
                        <IconComponent className="h-4 w-4" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-xs">
                            {label}
                          </Badge>
                          {activity.referenceName && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <ChevronRight className="h-3 w-3" />
                              {activity.referenceName}
                            </span>
                          )}
                        </div>
                        <p className="text-sm mt-1">{activity.description}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          {activity.quantity !== null && (
                            <span className={cn(
                              "font-medium",
                              activity.activityType === "STOCK_IN" && "text-green-600",
                              activity.activityType === "STOCK_OUT" && "text-red-600",
                            )}>
                              {activity.activityType === "STOCK_IN" ? "+" : activity.activityType === "STOCK_OUT" ? "-" : ""}
                              {activity.quantity} units
                            </span>
                          )}
                          <span>{format(activity.createdAt, "h:mm a")}</span>
                          {activity.warehouse && <span>{activity.warehouse}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Check date-fns is available**

Run: `cd /home/dmin/Aria && grep "date-fns" apps/frontend/package.json`
Expected: date-fns in dependencies

If missing, install:
```bash
cd /home/dmin/Aria && bun add date-fns
```

- [ ] **Step 3: Run typecheck**

Run: `cd /home/dmin/Aria && bun run typecheck 2>&1 | head -30`
Expected: No errors for the new component

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/features/inventory/components/activity-timeline.tsx
git add apps/frontend/package.json
git commit -m "feat(frontend): add ActivityTimeline component

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 6: Integrate ActivityTimeline into Item Detail Page

**Files:**
- Modify: `apps/frontend/src/app/inventory/items-catalogue/item/[itemId]/page.tsx`

- [ ] **Step 1: Add ActivityTimeline to item detail page**

Add import:
```typescript
import { ActivityTimeline } from "@/features/inventory/components/activity-timeline";
```

Add the timeline component after the Stock Alert section (around line 327):

```typescript
{/* Activity Timeline */}
<ActivityTimeline itemId={itemId} />
```

- [ ] **Step 2: Run typecheck and verify page compiles**

Run: `cd /home/dmin/Aria && bun run typecheck 2>&1 | head -30`
Expected: No errors

- [ ] **Step 3: Run build to verify no issues**

Run: `cd /home/dmin/Aria && bun run build --filter frontend 2>&1 | tail -30`
Expected: Build successful

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/app/inventory/items-catalogue/item/[itemId]/page.tsx
git commit -m "feat(frontend): integrate ActivityTimeline into item detail page

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 7: Connect Stock Services to Log Activity

**Files:**
- Modify: `apps/backend/src/apps/inventory/services/delivery.service.ts`
- Modify: `apps/backend/src/apps/inventory/services/purchase-receipt.service.ts`
- Modify: `apps/backend/src/apps/inventory/services/stock-transaction.service.ts`

- [ ] **Step 1: Add activity logging to DeliveryService**

Read `delivery.service.ts` to find the submit/complete method and add activity logging:

In `submit` or after successful delivery note creation, add:
```typescript
// Log activity for each item
for (const item of items) {
  await this.itemActivityService.logActivity({
    itemId: item.itemId,
    activityType: "DELIVERY",
    description: `Delivered ${item.quantity} units to ${customer}`,
    quantity: item.quantity,
    company,
    referenceType: "DeliveryNote",
    referenceId: deliveryNote.id,
    referenceName: deliveryNote.series,
  });
}
```

- [ ] **Step 2: Add activity logging to PurchaseReceiptService**

Similarly add logging for purchase receipt submissions.

- [ ] **Step 3: Add activity logging to StockTransactionService**

Add logging for stock entries (MATERIAL_RECEIPT, MATERIAL_ISSUE, etc.)

- [ ] **Step 4: Ensure services inject ItemActivityService**

Ensure all services use dependency injection properly. If ItemActivityService is injected via constructor, ensure it's available.

- [ ] **Step 5: Run tests**

Run: `cd /home/dmin/Aria && bun --filter backend test apps/backend/src/apps/inventory/__tests__/delivery.spec.ts`
Expected: All tests pass (or relevant tests)

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/apps/inventory/services/delivery.service.ts
git add apps/backend/src/apps/inventory/services/purchase-receipt.service.ts
git add apps/backend/src/apps/inventory/services/stock-transaction.service.ts
git commit -m "feat(inventory): connect stock services to log activity entries

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Verification Steps

After all tasks, run the following to validate:

```bash
# 1. Type check
bun run typecheck

# 2. Lint
bun run lint

# 3. Format
bun format

# 4. Backend tests
bun --filter backend test

# 5. Build
bun run build

# 6. Validate local
bun run validate:local
```

All should pass with zero errors.