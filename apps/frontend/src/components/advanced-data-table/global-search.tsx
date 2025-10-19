/**
 * Advanced Data Table - Global Search Component
 * Provides autocomplete and comprehensive search across all columns
 */

'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SearchIcon, XIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Table } from '@tanstack/react-table';

interface GlobalSearchProps<TData> {
  table: Table<TData>;
  placeholder?: string;
  debounceMs?: number;
  showSuggestions?: boolean;
}

export function GlobalSearch<TData>({
  table,
  placeholder = 'Search across all columns...',
  debounceMs = 300,
  showSuggestions = true,
}: GlobalSearchProps<TData>) {
  const [value, setValue] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [suggestions, setSuggestions] = React.useState<string[]>([]);
  const timeoutRef = React.useRef<NodeJS.Timeout | undefined>(undefined);

  // Debounced search
  const debouncedSetGlobalFilter = React.useMemo(() => {
    return (value: string) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        table.setGlobalFilter(value);
      }, debounceMs);
    };
  }, [table, debounceMs]);

  // Generate simple suggestions from visible data
  const generateSuggestions = React.useCallback(
    (searchValue: string) => {
      if (!searchValue || !showSuggestions || searchValue.length < 2) {
        setSuggestions([]);
        return;
      }

      const uniqueValues = new Set<string>();
      const rows = table.getPreFilteredRowModel().rows.slice(0, 100); // Limit to first 100 rows for performance

      rows.forEach((row) => {
        Object.values(row.original as Record<string, unknown>).forEach((val) => {
          if (val != null && typeof val === 'string') {
            const lowerVal = val.toLowerCase();
            const lowerSearch = searchValue.toLowerCase();
            if (lowerVal.includes(lowerSearch) && val.length < 50) {
              // Limit suggestion length
              uniqueValues.add(val);
            }
          }
        });
      });

      setSuggestions(Array.from(uniqueValues).slice(0, 8)); // Limit to 8 suggestions
    },
    [table, showSuggestions]
  );

  const handleValueChange = React.useCallback(
    (newValue: string) => {
      setValue(newValue);
      debouncedSetGlobalFilter(newValue);
      generateSuggestions(newValue);
      if (showSuggestions && newValue.length >= 2) {
        setOpen(true);
      } else {
        setOpen(false);
      }
    },
    [debouncedSetGlobalFilter, generateSuggestions, showSuggestions]
  );

  const handleClear = React.useCallback(() => {
    setValue('');
    table.setGlobalFilter('');
    setSuggestions([]);
    setOpen(false);
  }, [table]);

  const handleSelectSuggestion = React.useCallback(
    (suggestion: string) => {
      setValue(suggestion);
      table.setGlobalFilter(suggestion);
      setOpen(false);
    },
    [table]
  );

  return (
    <Popover open={open && suggestions.length > 0} onOpenChange={setOpen}>
      <div className="relative w-full max-w-sm">
        <SearchIcon className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
        <PopoverTrigger asChild>
          <input
            type="text"
            placeholder={placeholder}
            value={value}
            onChange={(e) => handleValueChange(e.target.value)}
            onFocus={() => {
              if (value.length >= 2 && suggestions.length > 0) {
                setOpen(true);
              }
            }}
            className={cn(
              'flex h-9 w-full rounded-md border border-input bg-background px-8 py-1 text-sm shadow-sm transition-colors',
              'file:border-0 file:bg-transparent file:text-sm file:font-medium',
              'placeholder:text-muted-foreground',
              'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
              'disabled:cursor-not-allowed disabled:opacity-50'
            )}
          />
        </PopoverTrigger>
        {value && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-0 top-0 h-9 w-9 p-0 z-10"
            onClick={handleClear}
          >
            <XIcon className="h-4 w-4" />
            <span className="sr-only">Clear search</span>
          </Button>
        )}
      </div>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandList>
            <CommandEmpty>No suggestions found.</CommandEmpty>
            <CommandGroup heading="Suggestions">
              {suggestions.map((suggestion, index) => (
                <CommandItem
                  key={index}
                  value={suggestion}
                  onSelect={() => handleSelectSuggestion(suggestion)}
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
  );
}
