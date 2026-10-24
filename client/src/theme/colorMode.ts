/**
 * Optical CRM — Color Mode Types & Hook
 */

import { createContext, useContext } from "react";

export type ThemeMode = "light" | "dark";

export interface ColorModeContextValue {
  mode: ThemeMode;
  isDark: boolean;
  toggleColorMode: () => void;
  setColorMode: (mode: ThemeMode) => void;
}

export const ColorModeContext = createContext<ColorModeContextValue>({
  mode: "light",
  isDark: false,
  toggleColorMode: () => {},
  setColorMode: () => {},
});

export function useColorMode(): ColorModeContextValue {
  return useContext(ColorModeContext);
}
