'use client';

import { IconTrendingUp } from '@tabler/icons-react';
import { Area, AreaChart, CartesianGrid, XAxis } from 'recharts';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';

const chartData = [
  { month: 'January', revenue: 6800000, newLeads: 145 },
  { month: 'February', revenue: 7200000, newLeads: 168 },
  { month: 'March', revenue: 7800000, newLeads: 182 },
  { month: 'April', revenue: 8200000, newLeads: 156 },
  { month: 'May', revenue: 8600000, newLeads: 194 },
  { month: 'June', revenue: 8745600, newLeads: 210 },
];

const chartConfig = {
  visitors: {
    label: 'Metrics',
  },
  revenue: {
    label: 'Revenue',
    color: 'var(--primary)',
  },
  newLeads: {
    label: 'New Leads',
    color: 'var(--primary)',
  },
} satisfies ChartConfig;

export function RevenueTrendChart() {
  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Area Chart - Revenue Trends</CardTitle>
        <CardDescription>Showing revenue & lead generation for the last 6 months</CardDescription>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
          <AreaChart
            data={chartData}
            margin={{
              left: 12,
              right: 12,
            }}
          >
            <defs>
              <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-revenue)" stopOpacity={1.0} />
                <stop offset="95%" stopColor="var(--color-revenue)" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="fillNewLeads" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-newLeads)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--color-newLeads)" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value) => value.slice(0, 3)}
            />
            <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
            <Area
              dataKey="newLeads"
              type="natural"
              fill="url(#fillNewLeads)"
              stroke="var(--color-newLeads)"
              stackId="a"
            />
            <Area
              dataKey="revenue"
              type="natural"
              fill="url(#fillRevenue)"
              stroke="var(--color-revenue)"
              stackId="a"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
      <CardFooter>
        <div className="flex w-full items-start gap-2 text-sm">
          <div className="grid gap-2">
            <div className="flex items-center gap-2 leading-none font-medium">
              Revenue up by 28.6% over 6 months <IconTrendingUp className="h-4 w-4" />
            </div>
            <div className="text-muted-foreground flex items-center gap-2 leading-none">
              January - June 2024
            </div>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}
