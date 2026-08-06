"use client";

import type { Asset } from "@aria/types";
import {
	BookOpen,
	Calculator,
	CheckCircle2,
	HelpCircle,
	Sliders,
	Sparkles,
	TrendingDown,
} from "lucide-react";
import React, { useState } from "react";
import {
	CartesianGrid,
	Legend,
	Line,
	LineChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export interface MethodDocMetadata {
	id: Asset.DepreciationMethod;
	label: string;
	subtitle: string;
	badge: string;
	badgeClass: string;
	concept: string;
	formula: string;
	formulaExplained: string;
	requiredFields: string[];
	recommendedFor: string[];
	exampleScenario: string;
}

export const DEPRECIATION_METHOD_DOCS: Record<
	Asset.DepreciationMethod,
	MethodDocMetadata
> = {
	STRAIGHT_LINE: {
		id: "STRAIGHT_LINE",
		label: "Straight Line",
		subtitle: "Equal expense allocated per period",
		badge: "Linear Decay",
		badgeClass:
			"bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-800",
		concept:
			"Spreads the net depreciable cost evenly over the useful life of the asset. The asset value decreases by an identical amount every period.",
		formula: "(Gross Purchase Value - Salvage Value) / Total Depreciations",
		formulaExplained:
			"Takes original value minus salvage value, divided by the total number of depreciation cycles.",
		requiredFields: [
			"Total Depreciations",
			"Frequency of Depreciation (Months)",
		],
		recommendedFor: [
			"Office Furniture & Fixtures",
			"Buildings & Real Estate",
			"Leasehold Improvements",
			"General Equipment",
		],
		exampleScenario:
			"A ₹10,000 machine with ₹0 salvage value over 5 years (60 months) depreciates by ₹2,000 every year (₹166.67/month).",
	},
	DOUBLE_DECLINING_BALANCE: {
		id: "DOUBLE_DECLINING_BALANCE",
		label: "Double Declining Balance",
		subtitle: "Accelerated 2x early-year value reduction",
		badge: "Accelerated Decay",
		badgeClass:
			"bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border-purple-200 dark:border-purple-800",
		concept:
			"An accelerated depreciation method that applies twice (2x) the straight-line percentage rate to the remaining net book value each period. Depreciation is highest in Year 1.",
		formula: "Rate = 2 / Total Periods; Expense = Net Book Value × Rate",
		formulaExplained:
			"Calculates a doubled rate based on total asset life, then applies it to the remaining asset balance at the start of each period.",
		requiredFields: [
			"Total Depreciations",
			"Frequency of Depreciation (Months)",
		],
		recommendedFor: [
			"Laptops & Tech Hardware",
			"High-Tech Manufacturing Gear",
			"Company Motor Vehicles",
			"Fast-Evolving Assets",
		],
		exampleScenario:
			"A ₹10,000 server over 5 years has a 40% annual rate (2 × 20%). Year 1 depreciation is ₹4,000, Year 2 is ₹2,400 (40% of ₹6,000), declining rapidly.",
	},
	WRITTEN_DOWN_VALUE: {
		id: "WRITTEN_DOWN_VALUE",
		label: "Written Down Value",
		subtitle: "Fixed percentage rate on remaining book value",
		badge: "Diminishing Value",
		badgeClass:
			"bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200 dark:border-amber-800",
		concept:
			"Applies a fixed user-specified percentage rate to the diminishing net book value (WDV) at the beginning of each period.",
		formula: "Expense = Current Net Book Value × (Rate % / 100)",
		formulaExplained:
			"Depreciation expense decreases every period as the remaining net book value shrinks.",
		requiredFields: [
			"Rate of Depreciation (%)",
			"Total Depreciations",
			"Frequency of Depreciation (Months)",
		],
		recommendedFor: [
			"Tax & Statutory Asset Compliance",
			"Industrial Machinery",
			"Fleet Vehicles",
			"Heavy Electronics",
		],
		exampleScenario:
			"A ₹10,000 asset with a 20% WDV rate depreciates by ₹2,000 in Year 1 (leaving ₹8,000), ₹1,600 in Year 2 (leaving ₹6,400), and ₹1,280 in Year 3.",
	},
	MANUAL: {
		id: "MANUAL",
		label: "Manual",
		subtitle: "User-specified custom schedule amounts",
		badge: "Custom Schedule",
		badgeClass:
			"bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
		concept:
			"Allows accounting teams to manually define custom depreciation amounts and dates for each individual period, bypassing automated formulas.",
		formula: "Depreciation Amount = User-Defined Row Input",
		formulaExplained:
			"Each entry date and amount is explicitly provided in the depreciation schedule sub-table.",
		requiredFields: [
			"Total Depreciations",
			"Manual Schedule Entries (Dates & Amounts)",
		],
		recommendedFor: [
			"Seasonal Equipment",
			"Project-Based Capital Assets",
			"Non-Standard Financial Contracts",
			"Unique Tax Settlements",
		],
		exampleScenario:
			"A seasonal harvesting machine is depreciated only in Q3 of each year (₹4,000 in Year 1 Q3, ₹3,000 in Year 2 Q3, ₹0 in other quarters).",
	},
};

/**
 * DepreciationMethodLabel — Renders field label with an interactive documentation trigger icon.
 */
export function DepreciationMethodLabel({
	htmlFor = "depreciationMethod",
	required = true,
	onOpenDocs,
}: {
	htmlFor?: string;
	required?: boolean;
	onOpenDocs?: () => void;
}) {
	const [dialogOpen, setDialogOpen] = useState(false);

	const handleOpen = () => {
		setDialogOpen(true);
		if (onOpenDocs) onOpenDocs();
	};

	return (
		<>
			<div className="flex items-center gap-1.5">
				<Label
					htmlFor={htmlFor}
					className="flex items-center gap-1 font-medium"
				>
					Depreciation Method
					{required && <span className="text-destructive">*</span>}
				</Label>
				<Button
					type="button"
					variant="ghost"
					size="icon"
					className="h-6 w-6 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
					onClick={handleOpen}
					title="View Depreciation Methods Guide & Comparison"
				>
					<HelpCircle className="h-3.5 w-3.5" />
					<span className="sr-only">Depreciation methods help</span>
				</Button>
			</div>

			<DepreciationMethodDocModal
				open={dialogOpen}
				onOpenChange={setDialogOpen}
			/>
		</>
	);
}

/**
 * DepreciationMethodInlineCard — Contextual summary card displayed below the method selector.
 */
export function DepreciationMethodInlineCard({
	selectedMethod,
}: {
	selectedMethod?: string | null;
}) {
	if (!selectedMethod || !(selectedMethod in DEPRECIATION_METHOD_DOCS)) {
		return null;
	}

	const doc =
		DEPRECIATION_METHOD_DOCS[selectedMethod as Asset.DepreciationMethod];

	return (
		<div className="mt-2.5 rounded-lg border bg-muted/40 p-3.5 text-xs shadow-xs space-y-2.5 transition-all">
			<div className="flex items-center justify-between gap-2">
				<div className="flex items-center gap-2">
					<Sparkles className="h-4 w-4 text-primary shrink-0" />
					<span className="font-semibold text-foreground">{doc.label}</span>
				</div>
				<Badge
					variant="outline"
					className={`px-2 py-0.5 text-[10px] ${doc.badgeClass}`}
				>
					{doc.badge}
				</Badge>
			</div>

			<p className="text-muted-foreground leading-relaxed">{doc.concept}</p>

			<div className="rounded border bg-background/80 p-2 font-mono text-[11px] text-foreground/90">
				<span className="font-semibold text-muted-foreground">Formula: </span>
				{doc.formula}
			</div>

			<div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t">
				<div>
					<span className="font-medium text-foreground block mb-1">
						Recommended For:
					</span>
					<div className="flex flex-wrap gap-1">
						{doc.recommendedFor.slice(0, 3).map((item) => (
							<Badge
								key={item}
								variant="secondary"
								className="text-[10px] font-normal"
							>
								{item}
							</Badge>
						))}
					</div>
				</div>

				<div>
					<span className="font-medium text-foreground block mb-1">
						Required Inputs:
					</span>
					<ul className="space-y-0.5 text-muted-foreground">
						{doc.requiredFields.map((field) => (
							<li key={field} className="flex items-center gap-1">
								<CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
								<span>{field}</span>
							</li>
						))}
					</ul>
				</div>
			</div>
		</div>
	);
}

/**
 * DepreciationMethodDocModal — Full interactive documentation dialog with live Recharts curve simulator.
 */
export function DepreciationMethodDocModal({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const [simValue, setSimValue] = useState<number>(100000);
	const [simYears, setSimYears] = useState<number>(5);
	const [simWdvRate, setSimWdvRate] = useState<number>(20);

	// Generate simulation dataset for Recharts chart
	const simData = React.useMemo(() => {
		const data = [];
		const cost = Math.max(100, simValue || 100000);
		const periods = Math.max(1, simYears || 5);
		const wdvRate = (simWdvRate || 20) / 100;
		const ddbRate = 2 / periods;

		let straightLineRem = cost;
		let wdvRem = cost;
		let ddbRem = cost;

		const slmStep = cost / periods;

		data.push({
			year: "Year 0 (Cost)",
			"Straight Line": Math.round(cost),
			"Written Down Value": Math.round(cost),
			"Double Declining Balance": Math.round(cost),
		});

		for (let i = 1; i <= periods; i++) {
			straightLineRem = Math.max(0, straightLineRem - slmStep);
			wdvRem = Math.max(0, wdvRem * (1 - wdvRate));
			ddbRem = Math.max(0, ddbRem * (1 - ddbRate));

			data.push({
				year: `Year ${i}`,
				"Straight Line": Math.round(straightLineRem),
				"Written Down Value": Math.round(wdvRem),
				"Double Declining Balance": Math.round(ddbRem),
			});
		}

		return data;
	}, [simValue, simYears, simWdvRate]);

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent
				side="right"
				className="w-full sm:max-w-xl md:max-w-2xl overflow-y-auto p-6"
			>
				<SheetHeader>
					<SheetTitle className="flex items-center gap-2 text-xl font-bold">
						<BookOpen className="h-5 w-5 text-primary" />
						Depreciation Methods Documentation & Guide
					</SheetTitle>
					<SheetDescription>
						Learn how each depreciation method calculates asset value over time
						and choose the right option for your asset classification.
					</SheetDescription>
				</SheetHeader>

				<Tabs defaultValue="methods" className="mt-4 space-y-4">
					<TabsList className="grid w-full grid-cols-3">
						<TabsTrigger value="methods" className="flex items-center gap-1.5">
							<BookOpen className="h-4 w-4" />
							Method Cards
						</TabsTrigger>
						<TabsTrigger
							value="simulator"
							className="flex items-center gap-1.5"
						>
							<TrendingDown className="h-4 w-4" />
							Live Simulator
						</TabsTrigger>
						<TabsTrigger
							value="comparison"
							className="flex items-center gap-1.5"
						>
							<Calculator className="h-4 w-4" />
							Comparison Matrix
						</TabsTrigger>
					</TabsList>

					{/* Tab 1: Method Deep-Dives */}
					<TabsContent value="methods" className="space-y-4">
						<div className="grid grid-cols-1 gap-4">
							{Object.values(DEPRECIATION_METHOD_DOCS).map((doc) => (
								<Card key={doc.id} className="border shadow-xs">
									<CardHeader className="pb-2">
										<div className="flex items-center justify-between">
											<CardTitle className="text-base font-semibold flex items-center gap-2">
												{doc.label}
											</CardTitle>
											<Badge variant="outline" className={doc.badgeClass}>
												{doc.badge}
											</Badge>
										</div>
										<p className="text-xs text-muted-foreground italic">
											{doc.subtitle}
										</p>
									</CardHeader>
									<CardContent className="space-y-3 text-xs">
										<p className="text-foreground leading-relaxed">
											{doc.concept}
										</p>

										<div className="rounded border bg-muted/50 p-2.5 font-mono text-[11px]">
											<div className="font-semibold text-primary mb-1">
												Formula
											</div>
											<code>{doc.formula}</code>
											<div className="mt-1 text-[10px] text-muted-foreground">
												{doc.formulaExplained}
											</div>
										</div>

										<div className="rounded border bg-blue-50/50 dark:bg-blue-950/30 p-2.5 text-blue-900 dark:text-blue-200">
											<span className="font-semibold block mb-0.5">
												Example:
											</span>
											{doc.exampleScenario}
										</div>

										<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
											<div>
												<span className="font-semibold text-foreground block mb-1">
													Best Suited For:
												</span>
												<div className="flex flex-wrap gap-1">
													{doc.recommendedFor.map((item) => (
														<Badge
															key={item}
															variant="secondary"
															className="text-[10px]"
														>
															{item}
														</Badge>
													))}
												</div>
											</div>
											<div>
												<span className="font-semibold text-foreground block mb-1">
													Required Inputs:
												</span>
												<ul className="space-y-0.5 text-muted-foreground">
													{doc.requiredFields.map((f) => (
														<li key={f} className="flex items-center gap-1">
															<CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
															{f}
														</li>
													))}
												</ul>
											</div>
										</div>
									</CardContent>
								</Card>
							))}
						</div>
					</TabsContent>

					{/* Tab 2: Live Curve Simulator */}
					<TabsContent value="simulator" className="space-y-4">
						<Card className="border">
							<CardHeader className="pb-2">
								<CardTitle className="text-base font-semibold flex items-center gap-2">
									<Sliders className="h-4 w-4 text-primary" />
									Depreciation Schedule Visual Simulator
								</CardTitle>
								<p className="text-xs text-muted-foreground">
									Adjust asset parameters below to see how net book value
									diminishes over time under each method.
								</p>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
									<div className="space-y-1">
										<Label htmlFor="simValue" className="text-xs">
											Initial Asset Value (₹)
										</Label>
										<Input
											id="simValue"
											type="number"
											min={100}
											step={5000}
											value={simValue}
											onChange={(e) => setSimValue(Number(e.target.value))}
											className="h-8 text-xs"
										/>
									</div>
									<div className="space-y-1">
										<Label htmlFor="simYears" className="text-xs">
											Useful Life (Years)
										</Label>
										<Input
											id="simYears"
											type="number"
											min={1}
											max={30}
											value={simYears}
											onChange={(e) => setSimYears(Number(e.target.value))}
											className="h-8 text-xs"
										/>
									</div>
									<div className="space-y-1">
										<Label htmlFor="simWdvRate" className="text-xs">
											WDV Rate (%)
										</Label>
										<Input
											id="simWdvRate"
											type="number"
											min={1}
											max={99}
											value={simWdvRate}
											onChange={(e) => setSimWdvRate(Number(e.target.value))}
											className="h-8 text-xs"
										/>
									</div>
								</div>

								<div className="h-[300px] w-full pt-2">
									<ResponsiveContainer width="100%" height="100%">
										<LineChart
											data={simData}
											margin={{ top: 10, right: 20, left: 10, bottom: 10 }}
										>
											<CartesianGrid strokeDasharray="3 3" opacity={0.3} />
											<XAxis dataKey="year" tick={{ fontSize: 11 }} />
											<YAxis
												tick={{ fontSize: 11 }}
												tickFormatter={(val) => `₹${val.toLocaleString()}`}
											/>
											<Tooltip
												formatter={(val) => [
													`₹${Number(val ?? 0).toLocaleString()}`,
													"",
												]}
												contentStyle={{ borderRadius: "8px", fontSize: "12px" }}
											/>
											<Legend
												wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }}
											/>
											<Line
												type="monotone"
												dataKey="Straight Line"
												stroke="#2563eb"
												strokeWidth={2.5}
												dot={{ r: 4 }}
											/>
											<Line
												type="monotone"
												dataKey="Written Down Value"
												stroke="#d97706"
												strokeWidth={2.5}
												dot={{ r: 4 }}
											/>
											<Line
												type="monotone"
												dataKey="Double Declining Balance"
												stroke="#9333ea"
												strokeWidth={2.5}
												dot={{ r: 4 }}
											/>
										</LineChart>
									</ResponsiveContainer>
								</div>
							</CardContent>
						</Card>
					</TabsContent>

					{/* Tab 3: Comparison Matrix */}
					<TabsContent value="comparison">
						<Card className="border">
							<CardContent className="p-0 overflow-x-auto">
								<table className="w-full text-left text-xs">
									<thead className="bg-muted text-muted-foreground border-b font-medium">
										<tr>
											<th className="p-3">Method</th>
											<th className="p-3">Depreciation Pace</th>
											<th className="p-3">Main Advantage</th>
											<th className="p-3">Required Parameters</th>
										</tr>
									</thead>
									<tbody className="divide-y text-foreground">
										<tr>
											<td className="p-3 font-semibold text-blue-600 dark:text-blue-400">
												Straight Line
											</td>
											<td className="p-3">Uniform / Equal</td>
											<td className="p-3">
												Simple, predictable, consistent expense
											</td>
											<td className="p-3">Total Depreciations, Frequency</td>
										</tr>
										<tr>
											<td className="p-3 font-semibold text-purple-600 dark:text-purple-400">
												Double Declining Balance
											</td>
											<td className="p-3">Heavy Early Decay (2x)</td>
											<td className="p-3">
												Maximizes tax deductions in early years
											</td>
											<td className="p-3">Total Depreciations, Frequency</td>
										</tr>
										<tr>
											<td className="p-3 font-semibold text-amber-600 dark:text-amber-400">
												Written Down Value
											</td>
											<td className="p-3">Gradual Decreasing</td>
											<td className="p-3">
												Matches asset repair/efficiency curve
											</td>
											<td className="p-3">
												Depreciation Rate %, Periods, Frequency
											</td>
										</tr>
										<tr>
											<td className="p-3 font-semibold text-emerald-600 dark:text-emerald-400">
												Manual
											</td>
											<td className="p-3">User-defined</td>
											<td className="p-3">
												Full flexibility for seasonal/custom assets
											</td>
											<td className="p-3">Manual Schedule Table Rows</td>
										</tr>
									</tbody>
								</table>
							</CardContent>
						</Card>
					</TabsContent>
				</Tabs>
			</SheetContent>
		</Sheet>
	);
}
