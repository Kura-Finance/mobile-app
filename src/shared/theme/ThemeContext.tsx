/**
 * Theme provider + hook.
 *
 * Resolves the user's preferred theme mode ('system' | 'light' | 'dark') against
 * the device color scheme and exposes the concrete color tokens to the tree.
 *
 * Usage:
 *   const { colors, scheme } = useTheme();
 *   ...style={{ backgroundColor: colors.background }}
 *
 * For StyleSheets, build them from colors inside the component, e.g.:
 *   const styles = useMemo(() => makeStyles(colors), [colors]);
 */
import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { useAppStore } from '../store/useAppStore';
import { getColors, type ColorScheme, type ThemeColors } from './theme';

interface ThemeContextValue {
  colors: ThemeColors;
  scheme: ColorScheme;
}

const ThemeContext = createContext<ThemeContextValue>({
  colors: getColors('light'),
  scheme: 'light',
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const mode = useAppStore((s) => s.preferences.themeMode);
  const systemScheme = useColorScheme();

  const scheme: ColorScheme =
    mode === 'system' ? (systemScheme === 'light' ? 'light' : 'dark') : mode;

  const value = useMemo<ThemeContextValue>(
    () => ({ colors: getColors(scheme), scheme }),
    [scheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
