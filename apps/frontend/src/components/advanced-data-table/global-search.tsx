/**
 * Advanced Data Table - Global Search Component
 * Provides autocomplete and comprehensive search across all columns
 */

"use client";

import { logger } from "@aria/utils";
import type { Table } from "@tanstack/react-table";
import { SearchIcon, XIcon } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface GlobalSearchProps<TData> {
	table: Table<TData>;
	placeholder?: string;
	debounceMs?: number;
	showSuggestions?: boolean;
}

export function GlobalSearch<TData>({
	table,
	placeholder = "Search across all columns...",
	debounceMs = 300,
	showSuggestions = true,
}: GlobalSearchProps<TData>) {
	const [inputValue, setInputValue] = React.useState("");
	const [open, setOpen] = React.useState(false);
	const [suggestions, setSuggestions] = React.useState<string[]>([]);
	const debounceTimerRef = React.useRef<NodeJS.Timeout | null>(null);
	const inputRef = React.useRef<HTMLInputElement>(null);

	// Sync input value with table's global filter state (external changes)
	const tableGlobalFilter = table.getState().globalFilter as string | undefined;

	React.useEffect(() => {
		const newValue = tableGlobalFilter ?? "";
		if (newValue !== inputValue) {
			setInputValue(newValue);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [tableGlobalFilter, inputValue]); // Intentionally omit inputValue to prevent infinite loop

	// Cleanup debounce timer on unmount
	React.useEffect(() => {
		return () => {
			if (debounceTimerRef.current) {
				clearTimeout(debounceTimerRef.current);
				debounceTimerRef.current = null;
			}
		};
	}, []);

	// Generate simple suggestions from visible data (memoized for performance)
	const generateSuggestions = React.useCallback(
		(searchValue: string) => {
			if (!searchValue || !showSuggestions || searchValue.length < 2) {
				setSuggestions([]);
				return;
			}

			try {
				const uniqueValues = new Set<string>();
				const rows = table.getPreFilteredRowModel().rows.slice(0, 100); // Limit for performance
				const lowerSearch = searchValue.toLowerCase();

				rows.forEach((row) => {
					if (uniqueValues.size >= 8) return; // Early exit when we have enough

					Object.values(row.original as Record<string, unknown>).forEach(
						(val) => {
							if (uniqueValues.size >= 8) return;

							if (val != null && typeof val === "string" && val.length < 50) {
								const lowerVal = val.toLowerCase();
								if (lowerVal.includes(lowerSearch)) {
									uniqueValues.add(val);
								}
							}
						},
					);
				});

				setSuggestions(Array.from(uniqueValues).slice(0, 8));
			} catch (error) {
				logger.error("[GlobalSearch] Error generating suggestions:", error);
				setSuggestions([]);
			}
		},
		[table, showSuggestions],
	);

	// Handle input change with debounced filter update
	const handleInputChange = React.useCallback(
		(newValue: string) => {
			setInputValue(newValue);

			// Clear existing timer
			if (debounceTimerRef.current) {
				clearTimeout(debounceTimerRef.current);
			}

			// Set new debounced timer to update table filter
			debounceTimerRef.current = setTimeout(() => {
				table.setGlobalFilter(newValue || undefined);
			}, debounceMs);

			// Generate suggestions immediately for better UX
			generateSuggestions(newValue);

			if (showSuggestions && newValue.length >= 2) {
				setOpen(true);
			} else {
				setOpen(false);
			}
		},
		[table, debounceMs, generateSuggestions, showSuggestions],
	);

	const handleClear = React.useCallback(() => {
		setInputValue("");
		table.setGlobalFilter(undefined);
		setSuggestions([]);
		setOpen(false);

		// Clear any pending debounce
		if (debounceTimerRef.current) {
			clearTimeout(debounceTimerRef.current);
			debounceTimerRef.current = null;
		}

		// Focus input after clearing
		inputRef.current?.focus();
	}, [table]);

	const handleSelectSuggestion = React.useCallback(
		(suggestion: string) => {
			setInputValue(suggestion);
			table.setGlobalFilter(suggestion);
			setOpen(false);

			// Clear any pending debounce
			if (debounceTimerRef.current) {
				clearTimeout(debounceTimerRef.current);
				debounceTimerRef.current = null;
			}

			// Focus input after selection
			inputRef.current?.focus();
		},
		[table],
	);

	return (
		<div className="relative w-full max-w-sm">
			<Popover open={open && suggestions.length > 0} onOpenChange={setOpen}>
				<SearchIcon className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
				<PopoverTrigger asChild>
					<div>
						<input
							ref={inputRef}
							type="text"
							placeholder={placeholder}
							value={inputValue}
							onChange={(e) => handleInputChange(e.target.value)}
							onFocus={() => {
								if (inputValue.length >= 2 && suggestions.length > 0) {
									setOpen(true);
								}
							}}
							className={cn(
								"flex h-9 w-full rounded-md border border-input bg-background px-8 py-1 text-sm shadow-sm transition-colors",
								"file:border-0 file:bg-transparent file:text-sm file:font-medium",
								"placeholder:text-muted-foreground",
								"focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
								"disabled:cursor-not-allowed disabled:opacity-50",
							)}
						/>
					</div>
				</PopoverTrigger>
				{inputValue && (
					<Button
						variant="ghost"
						size="sm"
						className="absolute right-0 top-0 h-9 w-9 p-0 z-10"
						onClick={handleClear}
						type="button"
					>
						<XIcon className="h-4 w-4" />
						<span className="sr-only">Clear search</span>
					</Button>
				)}
				<PopoverContent
					className="w-(--radix-popover-trigger-width) p-0"
					align="start"
				>
					<Command shouldFilter={false}>
						<CommandList>
							<CommandEmpty>No suggestions found.</CommandEmpty>
							<CommandGroup heading="Suggestions">
								{suggestions.map((suggestion, index) => (
									<CommandItem
										key={`${suggestion}-${index}`}
										value={suggestion}
										onMouseDown={(e) => {
											e.preventDefault();
											handleSelectSuggestion(suggestion);
										}}
										onSelect={() => {
											// CommandItem's onSelect also triggers, using the same handler
											handleSelectSuggestion(suggestion);
										}}
									>
										<SearchIcon className="mr-2 h-4 w-4" />
										{suggestion}
									</CommandItem>
								))}
							</CommandGroup>
						</CommandList>
					</Command>
				</PopoverContent>
			</Popover>
		</div>
	);
}
