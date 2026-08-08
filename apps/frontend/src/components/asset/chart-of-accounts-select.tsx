"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type AccountOption = {
	code: string;
	name: string;
	type: "Asset" | "Expense" | "Liability" | "Income";
};

const DEFAULT_ACCOUNTS: AccountOption[] = [
	{ code: "1200", name: "1200 - Fixed Assets", type: "Asset" },
	{ code: "1210", name: "1210 - Accumulated Depreciation", type: "Asset" },
	{
		code: "1250",
		name: "1250 - Capital Work In Progress (CWIP)",
		type: "Asset",
	},
	{ code: "5100", name: "5100 - Depreciation Expense", type: "Expense" },
	{ code: "5200", name: "5200 - Loss on Scrapped Assets", type: "Expense" },
	{
		code: "5300",
		name: "5300 - Repair & Maintenance Expense",
		type: "Expense",
	},
	{ code: "1100", name: "1100 - Cash & Bank Account", type: "Asset" },
];

type ChartOfAccountsSelectProps = {
	value?: string;
	onChange: (value: string) => void;
	placeholder?: string;
	disabled?: boolean;
	className?: string;
};

/**
 * Searchable Popover Combobox component for selecting Chart of Accounts GL codes.
 */
export function ChartOfAccountsSelect({
	value,
	onChange,
	placeholder = "Select GL Account...",
	disabled = false,
	className,
}: ChartOfAccountsSelectProps) {
	const [open, setOpen] = React.useState(false);

	const selectedAccount = DEFAULT_ACCOUNTS.find(
		(acc) => acc.code === value || acc.name === value,
	);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					role="combobox"
					aria-expanded={open}
					disabled={disabled}
					className={cn("w-full justify-between font-normal", className)}
				>
					{selectedAccount ? selectedAccount.name : value || placeholder}
					<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-[300px] p-0" align="start">
				<Command>
					<CommandInput placeholder="Search GL accounts..." />
					<CommandList>
						<CommandEmpty>No GL account found.</CommandEmpty>
						<CommandGroup heading="Chart of Accounts">
							{DEFAULT_ACCOUNTS.map((acc) => (
								<CommandItem
									key={acc.code}
									value={acc.name}
									onSelect={() => {
										onChange(acc.name);
										setOpen(false);
									}}
								>
									<Check
										className={cn(
											"mr-2 h-4 w-4",
											value === acc.name ? "opacity-100" : "opacity-0",
										)}
									/>
									{acc.name}
								</CommandItem>
							))}
						</CommandGroup>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
