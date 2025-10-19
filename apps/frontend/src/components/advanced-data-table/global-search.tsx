/**
 * Advanced Data Table - Global Search Component
 * Provides autocomplete and comprehensive search across all columns
 */

'use client';

import * as React from 'react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { SearchIcon, XIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Table } from '@tanstack/react-table';

interface GlobalSearchProps<TData> {
  table: Table<TData>;
  placeholder?: string;
  debounceMs?: number;
  enableAutocomplete?: boolean;
}

export function GlobalSearch<TData>({
  table,
  placeholder = 'Search across all columns...',
  debounceMs = 300,
  enableAutocomplete = true,
}: GlobalSearchProps<TData>) {
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState('');
  const [suggestions, setSuggestions] = React.useState<string[]>([]);

  // Debounced search
  const debouncedSetGlobalFilter = React.useMemo(() => {
    let timeout: NodeJS.Timeout;
    return (value: string) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        table.setGlobalFilter(value);
      }, debounceMs);
    };
  }, [table, debounceMs]);

  // Generate autocomplete suggestions
  const generateSuggestions = React.useCallback(
    (searchValue: string) => {
      if (!searchValue || !enableAutocomplete) {
        setSuggestions([]);
        return;
      }

      const allValues = new Set<string>();
      const rows = table.getFilteredRowModel().rows;

      rows.forEach((row) => {
        Object.values(row.original as object).forEach((val) => {
          if (val && typeof val === 'string') {
            if (val.toLowerCase().includes(searchValue.toLowerCase())) {
              allValues.add(val);
            }
          }
        });
      });

      setSuggestions(Array.from(allValues).slice(0, 10));
    },
    [table, enableAutocomplete]
  );

  const handleValueChange = React.useCallback(
    (newValue: string) => {
      setValue(newValue);
      debouncedSetGlobalFilter(newValue);
      if (enableAutocomplete) {
        generateSuggestions(newValue);
        setOpen(newValue.length > 0);
      }
    },
    [debouncedSetGlobalFilter, generateSuggestions, enableAutocomplete]
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
    <div className="relative w-full max-w-sm">
      {enableAutocomplete ? (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <div className="relative">
              <SearchIcon className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder={placeholder}
                value={value}
                onChange={(e) => handleValueChange(e.target.value)}
                className={cn(
                  'flex h-9 w-full rounded-md border border-input bg-transparent px-8 py-1 text-sm shadow-sm transition-colors',
                  'file:border-0 file:bg-transparent file:text-sm file:font-medium',
                  'placeholder:text-muted-foreground',
                  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                  'disabled:cursor-not-allowed disabled:opacity-50'
                )}
              />
              {value && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-9 w-9 p-0"
                  onClick={handleClear}
                >
                  <XIcon className="h-4 w-4" />
                  <span className="sr-only">Clear search</span>
                </Button>
              )}
            </div>
          </PopoverTrigger>
          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
            <Command>
              <CommandInput placeholder="Search suggestions..." className="border-0 ring-0 focus:ring-0" />
              <CommandList>
                <CommandEmpty>No suggestions found.</CommandEmpty>
                <CommandGroup heading="Suggestions">
                  {suggestions.map((suggestion, index) => (
                    <CommandItem
                      key={`${suggestion}-${index}`}
                      value={suggestion}
                      onSelect={() => handleSelectSuggestion(suggestion)}
                    >
                      <SearchIcon className="mr-2 h-4 w-4" />
                      <span className="truncate">{suggestion}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      ) : (
        <div className="relative">
          <SearchIcon className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={placeholder}
            value={value}
            onChange={(e) => handleValueChange(e.target.value)}
            className={cn(
              'flex h-9 w-full rounded-md border border-input bg-transparent px-8 py-1 text-sm shadow-sm transition-colors',
              'file:border-0 file:bg-transparent file:text-sm file:font-medium',
              'placeholder:text-muted-foreground',
              'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
              'disabled:cursor-not-allowed disabled:opacity-50'
            )}
          />
          {value && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-9 w-9 p-0"
              onClick={handleClear}
            >
              <XIcon className="h-4 w-4" />
              <span className="sr-only">Clear search</span>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
