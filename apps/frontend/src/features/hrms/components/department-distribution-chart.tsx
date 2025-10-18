'use client';

import * as React from 'react';
import { IconTrendingUp } from '@tabler/icons-react';
import { Label, Pie, PieChart } from 'recharts';

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
  { department: 'Engineering', employees: 145, fill: 'var(--color-engineering)' },
  { department: 'Sales', employees: 98, fill: 'var(--color-sales)' },
  { department: 'Operations', employees: 87, fill: 'var(--color-operations)' },
  { department: 'HR', employees: 34, fill: 'var(--color-hr)' },
  { department: 'Finance', employees: 42, fill: 'var(--color-finance)' },
  { department: 'Marketing', employees: 56, fill: 'var(--color-marketing)' },
];

const chartConfig = {
  employees: {
    label: 'Employees',
  },
  engineering: {
    label: 'Engineering',
    color: 'hsl(var(--chart-1))',
  },
  sales: {
    label: 'Sales',
    color: 'hsl(var(--chart-2))',
  },
  operations: {
    label: 'Operations',
    color: 'hsl(var(--chart-3))',
  },
  hr: {
    label: 'HR',
    color: 'hsl(var(--chart-4))',
  },
  finance: {
    label: 'Finance',
    color: 'hsl(var(--chart-5))',
  },
  marketing: {
    label: 'Marketing',
    color: 'hsl(var(--chart-6))',
  },
} satisfies ChartConfig;

export function DepartmentDistributionChart() {
  const totalEmployees = React.useMemo(() => {
    return chartData.reduce((acc, curr) => acc + curr.employees, 0);
  }, []);

  return (
    <Card className="@container/card flex flex-col">
      <CardHeader className="items-center pb-0">
        <CardTitle>Pie Chart - Department Distribution</CardTitle>
        <CardDescription>
          <span className="hidden @[540px]/card:block">
            Employee headcount distribution across departments
          </span>
          <span className="@[540px]/card:hidden">Employee distribution</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[250px]">
          <PieChart>
            <defs>
              <linearGradient id="fillEngineering" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-engineering)" stopOpacity={1.0} />
                <stop offset="95%" stopColor="var(--color-engineering)" stopOpacity={0.8} />
              </linearGradient>
              <linearGradient id="fillSales" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-sales)" stopOpacity={1.0} />
                <stop offset="95%" stopColor="var(--color-sales)" stopOpacity={0.8} />
              </linearGradient>
              <linearGradient id="fillOperations" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-operations)" stopOpacity={1.0} />
                <stop offset="95%" stopColor="var(--color-operations)" stopOpacity={0.8} />
              </linearGradient>
              <linearGradient id="fillHr" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-hr)" stopOpacity={1.0} />
                <stop offset="95%" stopColor="var(--color-hr)" stopOpacity={0.8} />
              </linearGradient>
              <linearGradient id="fillFinance" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-finance)" stopOpacity={1.0} />
                <stop offset="95%" stopColor="var(--color-finance)" stopOpacity={0.8} />
              </linearGradient>
              <linearGradient id="fillMarketing" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-marketing)" stopOpacity={1.0} />
                <stop offset="95%" stopColor="var(--color-marketing)" stopOpacity={0.8} />
              </linearGradient>
            </defs>
            <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
            <Pie
              data={chartData.map((item) => ({
                ...item,
                fill: `url(#fill${item.department})`,
              }))}
              dataKey="employees"
              nameKey="department"
              innerRadius={60}
              strokeWidth={5}
            >
              <Label
                content={({ viewBox }) => {
                  if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                    return (
                      <text
                        x={viewBox.cx}
                        y={viewBox.cy}
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        <tspan
                          x={viewBox.cx}
                          y={viewBox.cy}
                          className="fill-foreground text-3xl font-bold"
                        >
                          {totalEmployees.toLocaleString()}
                        </tspan>
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy || 0) + 24}
                          className="fill-muted-foreground"
                        >
                          Employees
                        </tspan>
                      </text>
                    );
                  }
                }}
              />
            </Pie>
          </PieChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col gap-2 text-sm">
        <div className="flex items-center gap-2 font-medium leading-none">
          Engineering team is largest at 31.3% <IconTrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Total workforce across 6 departments: {totalEmployees} employees
        </div>
      </CardFooter>
    </Card>
  );
}
