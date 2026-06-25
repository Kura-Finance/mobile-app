import { StyleSheet } from 'react-native';
import type { ThemeColors } from '../../../shared/theme/theme';

export const PORTFOLIO_TOOLBAR_BTN = {
  width: 82,
  height: 36,
  borderRadius: 10,
} as const;

export function makePortfolioToolbarBtnStyles(c: ThemeColors) {
  return StyleSheet.create({
    btn: {
      width: PORTFOLIO_TOOLBAR_BTN.width,
      height: PORTFOLIO_TOOLBAR_BTN.height,
      borderRadius: PORTFOLIO_TOOLBAR_BTN.borderRadius,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surfaceAlt,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    tabBtn: {
      height: PORTFOLIO_TOOLBAR_BTN.height,
      paddingHorizontal: 14,
      borderRadius: PORTFOLIO_TOOLBAR_BTN.borderRadius,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surfaceAlt,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    btnActive: {
      backgroundColor: c.primary,
      borderColor: c.primary,
    },
    btnText: {
      color: c.textMuted,
      fontSize: 12,
      fontWeight: '700',
      textAlign: 'center',
    },
    btnTextActive: {
      color: '#FFFFFF',
    },
  });
}
