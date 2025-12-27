'use client';

import {
  ReactNode,
  createContext,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  useCallback,
} from 'react';

const COOKIE_NAME = 'active_theme';
const DEFAULT_THEME = 'default';

function setThemeCookie(theme: string) {
  if (typeof window === 'undefined') return;

  document.cookie = `${COOKIE_NAME}=${theme}; path=/; max-age=31536000; SameSite=Lax; ${window.location.protocol === 'https:' ? 'Secure;' : ''}`;
}

/**
 * Get the current theme from the body's classList
 */
function getCurrentThemeFromDOM(): string {
  if (typeof document === 'undefined') return DEFAULT_THEME;

  const themeClasses = Array.from(document.body.classList).filter(
    (c) => c.startsWith('theme-') && c !== 'theme-scaled'
  );

  if (themeClasses.length > 0) {
    // Extract theme name from "theme-xyz" -> "xyz"
    return themeClasses[0].replace('theme-', '');
  }

  return DEFAULT_THEME;
}

type ThemeContextType = {
  activeTheme: string;
  setActiveTheme: (theme: string) => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ActiveThemeProvider({
  children,
  initialTheme,
}: {
  children: ReactNode;
  initialTheme?: string;
}) {
  // Initialize with the server-provided theme, or read from DOM if available
  const [activeTheme, setActiveThemeState] = useState<string>(() => initialTheme || DEFAULT_THEME);
  const isFirstRender = useRef(true);

  // Memoized setter that updates state and handles DOM/cookie
  const setActiveTheme = useCallback((newTheme: string) => {
    setActiveThemeState(newTheme);
  }, []);

  // useLayoutEffect runs synchronously before paint
  // This ensures theme changes don't cause flash
  useLayoutEffect(() => {
    const themeClass = `theme-${activeTheme}`;
    const scaledClass = 'theme-scaled';
    const shouldBeScaled = activeTheme.endsWith('-scaled');

    // Check current DOM state
    const currentThemeClasses = Array.from(document.body.classList).filter(
      (c) => c.startsWith('theme-') && c !== 'theme-scaled'
    );
    const hasCorrectTheme = currentThemeClasses.includes(themeClass);
    const hasOnlyCorrectTheme = currentThemeClasses.length === 1 && hasCorrectTheme;
    const hasScaledClass = document.body.classList.contains(scaledClass);
    const scaledIsCorrect = shouldBeScaled === hasScaledClass;

    // On first render, if DOM already matches SSR, just sync the cookie
    if (isFirstRender.current) {
      isFirstRender.current = false;

      if (hasOnlyCorrectTheme && scaledIsCorrect) {
        // DOM is already correct from SSR, just ensure cookie is set
        setThemeCookie(activeTheme);
        return;
      }
    }

    // Update cookie
    setThemeCookie(activeTheme);

    // Update DOM only if needed
    if (!hasOnlyCorrectTheme) {
      // Remove incorrect theme classes
      currentThemeClasses.forEach((className) => {
        if (className !== themeClass) {
          document.body.classList.remove(className);
        }
      });

      // Add correct theme class if missing
      if (!hasCorrectTheme) {
        document.body.classList.add(themeClass);
      }
    }

    // Handle scaled class
    if (shouldBeScaled && !hasScaledClass) {
      document.body.classList.add(scaledClass);
    } else if (!shouldBeScaled && hasScaledClass) {
      document.body.classList.remove(scaledClass);
    }
  }, [activeTheme]);

  return (
    <ThemeContext.Provider value={{ activeTheme, setActiveTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemeConfig() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useThemeConfig must be used within an ActiveThemeProvider');
  }
  return context;
}
