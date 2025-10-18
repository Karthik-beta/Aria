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
  { month: 'January', sickLeave: 28, casualLeave: 42, earnedLeave: 35 },
  { month: 'February', sickLeave: 32, casualLeave: 38, earnedLeave: 40 },
  { month: 'March', sickLeave: 24, casualLeave: 45, earnedLeave: 38 },
  { month: 'April', sickLeave: 30, casualLeave: 40, earnedLeave: 42 },
  { month: 'May', sickLeave: 26, casualLeave: 48, earnedLeave: 45 },
  { month: 'June', sickLeave: 22, casualLeave: 50, earnedLeave: 48 },
];

const chartConfig = {
  sickLeave: {
    label: 'Sick Leave',
    color: 'hsl(var(--chart-1))',
  },
  casualLeave: {
    label: 'Casual Leave',
    color: 'hsl(var(--chart-2))',
  },
  earnedLeave: {
    label: 'Earned Leave',
    color: 'hsl(var(--chart-3))',
  },
} satisfies ChartConfig;

export function LeaveTrendChart() {
  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Area Chart - Leave Trends</CardTitle>
        <CardDescription>
          <span className="hidden @[540px]/card:block">
            Leave utilization by category over the last 6 months
          </span>
          <span className="@[540px]/card:hidden">Leave trends (Jan - Jun 2024)</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="fillSickLeave" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-sickLeave)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--color-sickLeave)" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="fillCasualLeave" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-casualLeave)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--color-casualLeave)" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="fillEarnedLeave" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-earnedLeave)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--color-earnedLeave)" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => value.slice(0, 3)}
            />
            <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
            <Area
              dataKey="earnedLeave"
              type="natural"
              fill="url(#fillEarnedLeave)"
              fillOpacity={0.4}
              stroke="var(--color-earnedLeave)"
              stackId="a"
            />
            <Area
              dataKey="casualLeave"
              type="natural"
              fill="url(#fillCasualLeave)"
              fillOpacity={0.4}
              stroke="var(--color-casualLeave)"
              stackId="a"
            />
            <Area
              dataKey="sickLeave"
              type="natural"
              fill="url(#fillSickLeave)"
              fillOpacity={0.4}
              stroke="var(--color-sickLeave)"
              stackId="a"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 font-medium leading-none">
          Casual leave usage up by 19% this month <IconTrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Total leaves taken: 1,535 days in last 6 months
        </div>
      </CardFooter>
    </Card>
  );
}
