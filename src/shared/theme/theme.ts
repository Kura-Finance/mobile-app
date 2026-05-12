/**
 * App theme tokens.
 *
 * Semantic color tokens that map to concrete values per color scheme. Components
 * should consume these via `useTheme()` (see ./ThemeContext) instead of using
 * hardcoded hex literals, so the whole app can switch between light and dark.
 *
 * The dark palette intentionally mirrors the original hardcoded values so the
 * existing dark look is preserved exactly while screens are migrated.
 */

export type ThemeMode = 'system' | 'light' | 'dark';
export type ColorScheme = 'light' | 'dark';

export interface ThemeColors {
  scheme: ColorScheme;

  // Backgrounds
  background: string; // app / screen background
  backgroundElevated: string; // modal sheets, drawers
  surface: string; // cards
  surfaceAlt: string; // nested cards, menus, popovers
  surfaceInput: string; // inputs, pills, segmented controls

  // Text
  text: string; // primary text
  textMuted: string; // secondary text
  textFaint: string; // tertiary / hints
  textInverse: string; // text on a primary-colored surface

  // Lines
  border: string; // subtle separators / card borders
  borderStrong: string; // emphasized borders

  // Brand
  primary: string;
  primaryDark: string; // gradient end / pressed
  primarySoft: string; // tinted background (e.g. badges)
  primaryOnSoft: string; // text/icon over a soft-tinted background

  // Status
  success: string;
  warning: string;
  danger: string;

  // Misc
  overlay: string; // modal backdrop
  qrBackground: string; // QR codes must stay light
  white: string; // constant (does not change with scheme)
  black: string; // constant
}

export const darkColors: ThemeColors = {
  scheme: 'dark',

  background: '#0B0B0F',
  backgroundElevated: '#111118',
  surface: '#1A1A24',
  surfaceAlt: '#15151D',
  surfaceInput: '#1F2937',

  text: '#FFFFFF',
  textMuted: '#9CA3AF',
  textFaint: '#6B7280',
  textInverse: '#FFFFFF',

  border: 'rgba(255,255,255,0.07)',
  borderStrong: '#374151',

  primary: '#8B5CF6',
  primaryDark: '#4F46E5',
  primarySoft: 'rgba(139,92,246,0.15)',
  primaryOnSoft: '#C4B5FD',

  success: '#10B981',
  warning: '#FBBF24',
  danger: '#EF4444',

  overlay: 'rgba(0,0,0,0.6)',
  qrBackground: '#FFFFFF',
  white: '#FFFFFF',
  black: '#000000',
};

export const lightColors: ThemeColors = {
  scheme: 'light',

  background: '#F2F2F7',
  backgroundElevated: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceAlt: '#F5F5F7',
  surfaceInput: '#EFEFF4',

  text: '#0B0B0F',
  textMuted: '#6B7280',
  textFaint: '#9CA3AF',
  textInverse: '#FFFFFF',

  border: 'rgba(0,0,0,0.08)',
  borderStrong: 'rgba(0,0,0,0.15)',

  primary: '#7C3AED',
  primaryDark: '#6D28D9',
  primarySoft: 'rgba(124,58,237,0.10)',
  primaryOnSoft: '#6D28D9',

  success: '#059669',
  warning: '#D97706',
  danger: '#DC2626',

  overlay: 'rgba(0,0,0,0.4)',
  qrBackground: '#FFFFFF',
  white: '#FFFFFF',
  black: '#000000',
};

export function getColors(scheme: ColorScheme): ThemeColors {
  return scheme === 'light' ? lightColors : darkColors;
}
