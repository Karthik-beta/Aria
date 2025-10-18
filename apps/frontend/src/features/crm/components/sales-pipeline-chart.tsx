'use client';

import { IconTrendingUp } from '@tabler/icons-react';
import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts';

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
  { stage: 'Prospecting', deals: 45, value: 2800000 },
  { stage: 'Qualification', deals: 32, value: 3200000 },
  { stage: 'Proposal', deals: 28, value: 4100000 },
  { stage: 'Negotiation', deals: 18, value: 3800000 },
  { stage: 'Closed-Won', deals: 24, value: 5200000 },
];

const chartConfig = {
  deals: {
    label: 'Deal Count',
    color: 'var(--primary)',
  },
  value: {
    label: 'Deal Value',
    color: 'var(--primary)',
  },
} satisfies ChartConfig;

export function SalesPipelineChart() {
  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Bar Chart - Sales Pipeline</CardTitle>
        <CardDescription>
          <span className="hidden @[540px]/card:block">
            Deal count and value by pipeline stage for the last 6 months
          </span>
          <span className="@[540px]/card:hidden">Pipeline by stage</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
          <BarChart data={chartData}>
            <defs>
              <linearGradient id="fillDeals" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--primary)" stopOpacity={1.0} />
                <stop offset="95%" stopColor="var(--primary)" stopOpacity={0.8} />
              </linearGradient>
              <linearGradient id="fillValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.6} />
                <stop offset="95%" stopColor="var(--primary)" stopOpacity={0.4} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="stage"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              tickFormatter={(value) => value.slice(0, 12)}
            />
            <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dashed" />} />
            <Bar dataKey="deals" fill="url(#fillDeals)" radius={4} />
            <Bar dataKey="value" fill="url(#fillValue)" radius={4} />
          </BarChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 font-medium leading-none">
          Closed-Won stage has highest value <IconTrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Total pipeline value: ₹19.1 Cr across 147 deals
        </div>
      </CardFooter>
    </Card>
  );
}
