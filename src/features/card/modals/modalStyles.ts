import { StyleSheet, Platform } from 'react-native';
import type { ThemeColors } from '../../../shared/theme/theme';

/**
 * Theme-aware modal styles.
 *
 * Use `makeModalStyles(colors)` inside a component (memoized on `colors`).
 */
export function makeModalStyles(c: ThemeColors) {
  return StyleSheet.create({
    sheet: { flex: 1, backgroundColor: c.backgroundElevated, paddingHorizontal: 24, paddingBottom: 40 },
    handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: c.borderStrong, alignSelf: 'center', marginTop: 12, marginBottom: 20 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
    title: { color: c.text, fontSize: 20, fontWeight: '700' },
    closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: c.surfaceInput, alignItems: 'center', justifyContent: 'center' },
    subtitle: { color: c.textMuted, fontSize: 14, lineHeight: 20, marginBottom: 28 },

    // QR
    qrWrapper: { alignItems: 'center', marginBottom: 24 },
    qrBox: {
      backgroundColor: c.qrBackground,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: 'rgba(0,0,0,0.08)',
    },

    // Address
    addressBox: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      backgroundColor: c.surface, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 16,
      borderWidth: 1, borderColor: c.primarySoft,
    },
    scBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: c.primarySoft, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
    scBadgeText: { color: c.primary, fontSize: 10, fontWeight: '600' as const },
    addressFull: { color: c.textMuted, fontSize: 13, fontFamily: 'monospace', flex: 1 },

    // Primary button
    primaryBtn: { borderRadius: 14, overflow: 'hidden', marginBottom: 16 },
    primaryBtnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 8 },
    primaryBtnText: { color: c.textInverse, fontSize: 16, fontWeight: '700' as const },

    // Network note
    networkNote: { color: c.textFaint, fontSize: 12, textAlign: 'center', lineHeight: 18, marginTop: 4 },

    // Send fields
    fieldLabel: { color: c.textMuted, fontSize: 12, fontWeight: '600' as const, marginBottom: 8, textTransform: 'uppercase' as const, letterSpacing: 0.4 },
    input: {
      backgroundColor: c.surface, borderRadius: 12, borderWidth: 1, borderColor: c.borderStrong,
      color: c.text, fontSize: 15, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 20,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    amountHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
    maxBtn: { color: c.primary, fontSize: 12, fontWeight: '600' as const },
    errorText: { color: c.danger, fontSize: 13, marginBottom: 12, textAlign: 'center' as const },

    // Success
    successBox: { alignItems: 'center', paddingTop: 32 },
    successIcon: { marginBottom: 16 },
    successTitle: { color: c.text, fontSize: 24, fontWeight: '700' as const, marginBottom: 8 },
    successSub: { color: c.textMuted, fontSize: 14, marginBottom: 32, textAlign: 'center' as const },
    txHashBox: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: c.surface, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 24,
      width: '100%' as any, borderWidth: 1, borderColor: c.borderStrong,
    },
    txHashLabel: { color: c.textFaint, fontSize: 11, fontWeight: '600' as const },
    txHashValue: { color: c.textMuted, fontSize: 12, fontFamily: 'monospace', flex: 1 },

    // Crypto / Fiat segmented toggle
    segment: {
      flexDirection: 'row', backgroundColor: c.surface, borderRadius: 12, padding: 4,
      marginBottom: 24, borderWidth: 1, borderColor: c.border,
    },
    segmentItem: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      paddingVertical: 9, borderRadius: 9,
    },
    segmentItemActive: { backgroundColor: c.primary },
    segmentText: { fontSize: 14, fontWeight: '700' as const, color: c.textMuted },
    segmentTextActive: { color: c.textInverse },

    // Currency dropdown selector
    selectField: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      backgroundColor: c.surface, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
      marginBottom: 24, borderWidth: 1, borderColor: c.border,
    },
    selectFlag: { fontSize: 20, lineHeight: 26 },
    selectLabel: { flex: 1, color: c.text, fontSize: 15, fontWeight: '600' as const, lineHeight: 20 },

    // Dropdown menu (modal)
    menuBackdrop: { flex: 1, backgroundColor: c.overlay, justifyContent: 'center', paddingHorizontal: 32 },
    menuCard: {
      backgroundColor: c.surfaceAlt, borderRadius: 16, overflow: 'hidden',
      borderWidth: 1, borderColor: c.border,
    },
    menuTitle: {
      color: c.textMuted, fontSize: 12, fontWeight: '600' as const, textTransform: 'uppercase' as const,
      letterSpacing: 0.4, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 8,
    },
    menuItem: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingHorizontal: 18, paddingVertical: 14,
      borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border,
    },
    menuItemLabel: { color: c.text, fontSize: 15, fontWeight: '600' as const, lineHeight: 20, marginBottom: 2 },
    menuItemSub: { color: c.textFaint, fontSize: 12, lineHeight: 16 },

    // Fiat info / KYC card
    fiatCard: {
      backgroundColor: c.surface, borderRadius: 16, padding: 20, marginBottom: 16,
      borderWidth: 1, borderColor: c.border,
    },
    fiatCardIcon: {
      width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
      backgroundColor: c.primarySoft, alignSelf: 'center', marginBottom: 14,
    },
    fiatCardTitle: { color: c.text, fontSize: 17, fontWeight: '700' as const, textAlign: 'center' as const, marginBottom: 6 },
    fiatCardText: { color: c.textMuted, fontSize: 13, lineHeight: 20, textAlign: 'center' as const, marginBottom: 18 },

    // KYC status pill (background/foreground colors are set inline by the caller)
    statusPill: {
      flexDirection: 'row', alignItems: 'center', alignSelf: 'center', gap: 6,
      paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginBottom: 14,
    },
    statusPillText: { fontSize: 12, fontWeight: '600' as const },

    // Bank deposit instructions — stacked label/value rows with per-row copy
    dataCard: {
      backgroundColor: c.surface, borderRadius: 16, paddingHorizontal: 16, marginBottom: 16,
      borderWidth: 1, borderColor: c.border,
    },
    dataRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
    dataRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
    dataLabel: { color: c.textFaint, fontSize: 12, fontWeight: '500' as const, marginBottom: 4 },
    dataValue: { color: c.text, fontSize: 15, fontWeight: '600' as const, lineHeight: 21 },
    dataCopyBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
    depositNoteBelow: { color: c.textMuted, fontSize: 12, lineHeight: 18, marginBottom: 16, paddingHorizontal: 4 },

    // Amount + bank deposit instructions
    depositLabel: { color: c.textFaint, fontSize: 11, fontWeight: '600' as const, textTransform: 'uppercase' as const, letterSpacing: 0.4 },
    depositRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border,
    },
    depositRowValue: { color: c.text, fontSize: 14, fontWeight: '600' as const, flex: 1, textAlign: 'right' as const },
    memoBox: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 10,
      backgroundColor: 'rgba(251,191,36,0.08)', borderRadius: 12, padding: 14, marginTop: 16,
      borderWidth: 1, borderColor: 'rgba(251,191,36,0.25)',
    },
    memoText: { color: '#FCD34D', fontSize: 12, lineHeight: 18, flex: 1 },

    // Generic link button
    linkBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, marginTop: 4 },
    linkBtnText: { color: c.primary, fontSize: 14, fontWeight: '600' as const },
  });
}
