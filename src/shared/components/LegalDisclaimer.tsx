import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';

export type LegalDisclaimerVariant =
  | 'portfolio'
  | 'earn'
  | 'borrow'
  | 'swap'
  | 'exchangeReadOnly'
  | 'securities'
  | 'moonpay'
  | 'bridge'
  | 'cardWaitlist'
  | 'fiatRamp'
  | 'walletConnect'
  | 'riskSummary'
  | 'deposit'
  | 'trackfi';

const I18N_KEYS: Record<LegalDisclaimerVariant, string> = {
  portfolio: 'legal.portfolioFooter',
  earn: 'legal.earnVault',
  borrow: 'legal.borrow',
  swap: 'legal.swapTrade',
  exchangeReadOnly: 'legal.exchangeReadOnly',
  securities: 'legal.securitiesTrade',
  moonpay: 'legal.moonpay',
  bridge: 'legal.bridge',
  cardWaitlist: 'legal.cardWaitlist',
  fiatRamp: 'legal.fiatRamp',
  walletConnect: 'legal.walletConnect',
  riskSummary: 'legal.riskSummary',
  deposit: 'legal.tokenDeposit',
  trackfi: 'legal.trackfi',
};

interface Props {
  variant: LegalDisclaimerVariant;
  style?: StyleProp<TextStyle>;
  centered?: boolean;
}

export default function LegalDisclaimer({ variant, style, centered = true }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const textStyle = useMemo(
    () => [styles.base, { color: colors.textFaint }, centered && styles.centered, style],
    [colors.textFaint, centered, style],
  );
  return <Text style={textStyle}>{t(I18N_KEYS[variant])}</Text>;
}

interface InfoButtonProps {
  variant: LegalDisclaimerVariant;
  size?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

/** Compact (i) control — opens full disclaimer in a sheet. */
export function LegalDisclaimerInfoButton({
  variant,
  size = 20,
  style,
  accessibilityLabel,
}: InfoButtonProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const st = useMemo(() => infoStyles(colors), [colors]);

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        style={[st.hit, style]}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? t('legal.infoAccessibility')}
      >
        <Ionicons name="information-circle-outline" size={size} color={colors.textMuted} />
      </TouchableOpacity>

      <Modal visible={open} animationType="fade" transparent onRequestClose={() => setOpen(false)}>
        <Pressable style={st.backdrop} onPress={() => setOpen(false)} />
        <View style={[st.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={st.sheetHeader}>
            <Text style={st.sheetTitle}>{t('legal.disclaimerTitle')}</Text>
            <TouchableOpacity onPress={() => setOpen(false)} style={st.closeBtn} hitSlop={8}>
              <Ionicons name="close" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={st.sheetBody}>
            <Text style={st.body}>{t(I18N_KEYS[variant])}</Text>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  base: { fontSize: 11, lineHeight: 16 },
  centered: { textAlign: 'center' },
});

function infoStyles(c: { text: string; textMuted: string; surfaceAlt: string; border: string }) {
  return StyleSheet.create({
    hit: { alignItems: 'center', justifyContent: 'center' },
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
    sheet: {
      position: 'absolute',
      left: 16,
      right: 16,
      bottom: 0,
      maxHeight: '70%',
      backgroundColor: c.surfaceAlt,
      borderRadius: 20,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      overflow: 'hidden',
    },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 18,
      paddingTop: 16,
      paddingBottom: 8,
    },
    sheetTitle: { color: c.text, fontSize: 16, fontWeight: '700' },
    closeBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
    sheetBody: { paddingHorizontal: 18, paddingBottom: 8 },
    body: { color: c.textMuted, fontSize: 13, lineHeight: 20 },
  });
}
