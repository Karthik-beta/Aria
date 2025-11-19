'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Command, LayoutDashboard, Monitor } from 'lucide-react';

export type DisplayMode = 'compact' | 'comfortable' | 'detailed';

export type DisplayModeOption = {
  label: string;
  description: string;
  icon: LucideIcon;
};

type DisplayModeContextValue = {
  mode: DisplayMode;
  setMode: (mode: DisplayMode) => void;
  options: Record<DisplayMode, DisplayModeOption>;
};

const DISPLAY_MODE_STORAGE_KEY = 'aria-admin-display-mode';

const DisplayModeContext = createContext<DisplayModeContextValue | null>(null);

const isDisplayMode = (value: unknown): value is DisplayMode =>
  typeof value === 'string' && ['compact', 'comfortable', 'detailed'].includes(value);

const DISPLAY_MODE_OPTIONS: Record<DisplayMode, DisplayModeOption> = {
  compact: {
    label: 'Compact',
    description: 'Tighter spacing with condensed controls',
    icon: LayoutDashboard,
  },
  comfortable: {
    label: 'Comfortable',
    description: 'Balanced spacing for most dashboards',
    icon: Monitor,
  },
  detailed: {
    label: 'Detailed',
    description: 'Roomier layout with extra context',
    icon: Command,
  },
};

export function DisplayModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<DisplayMode>('comfortable');

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const storedValue = window.localStorage.getItem(DISPLAY_MODE_STORAGE_KEY);
    if (isDisplayMode(storedValue)) {
      setModeState(storedValue);
    }
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }
    document.body.dataset.adminSurface = 'true';
    return () => {
      delete document.body.dataset.adminSurface;
      delete document.body.dataset.displayMode;
    };
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }
    document.body.dataset.displayMode = mode;
  }, [mode]);

  const setMode = useCallback((value: DisplayMode) => {
    setModeState(value);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(DISPLAY_MODE_STORAGE_KEY, value);
    }
  }, []);

  const contextValue = useMemo<DisplayModeContextValue>(
    () => ({
      mode,
      setMode,
      options: DISPLAY_MODE_OPTIONS,
    }),
    [mode, setMode]
  );

  return <DisplayModeContext.Provider value={contextValue}>{children}</DisplayModeContext.Provider>;
}

export function useDisplayMode() {
  const context = useContext(DisplayModeContext);
  if (!context) {
    throw new Error('useDisplayMode must be used within a DisplayModeProvider');
  }
  return context;
}
