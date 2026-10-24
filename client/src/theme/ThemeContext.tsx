/**
 * Optical CRM — Dark / Light Mode Provider
 *
 * Provides application-wide theme switching with persistence,
 * system preference detection, and keyboard shortcut support (Ctrl+Shift+D).
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

import { getAppTheme } from "./theme";
import { ColorModeContext, type ColorModeContextValue, type ThemeMode } from "./colorMode";

const STORAGE_KEY = "optical_crm_theme_mode";

function getInitialMode(): ThemeMode {
  if (typeof window === "undefined") return "light";

  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === "light" || saved === "dark") {
    return saved;
  }

  // Fallback to system preference if available
  if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }

  return "light";
}

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(getInitialMode);

  // Apply theme attributes to <html> for native elements & scrollbars
  const applyThemeToHtml = useCallback((newMode: ThemeMode) => {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", newMode);
      document.documentElement.style.colorScheme = newMode;
    }
  }, []);

  const setColorMode = useCallback(
    (newMode: ThemeMode) => {
      setModeState(newMode);
      try {
        localStorage.setItem(STORAGE_KEY, newMode);
      } catch {
        // LocalStorage might be restricted in some browser settings
      }
      applyThemeToHtml(newMode);
    },
    [applyThemeToHtml],
  );

  const toggleColorMode = useCallback(() => {
    setColorMode(mode === "dark" ? "light" : "dark");
  }, [mode, setColorMode]);

  // Synchronize initial mode to HTML tag on mount
  useEffect(() => {
    applyThemeToHtml(mode);
  }, [mode, applyThemeToHtml]);

  // Support keyboard shortcut: Ctrl + Shift + D or Alt + D
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (
        (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "d") ||
        (event.altKey && event.key.toLowerCase() === "d")
      ) {
        event.preventDefault();
        toggleColorMode();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleColorMode]);

  const contextValue = useMemo<ColorModeContextValue>(
    () => ({
      mode,
      isDark: mode === "dark",
      toggleColorMode,
      setColorMode,
    }),
    [mode, toggleColorMode, setColorMode],
  );

  const theme = useMemo(() => getAppTheme(mode), [mode]);

  return (
    <ColorModeContext.Provider value={contextValue}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}

