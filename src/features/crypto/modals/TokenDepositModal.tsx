/**
 * TokenDepositModal
 *
 * On-chain deposit instructions for a specific ERC-20 on Base.
 * Distinct from the card Receive flow (USDC / fiat top-up).
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Clipboard,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';

import TokenLogo from '../components/TokenLogo';
import type { BluechipToken } from '../config/blueChips';
import { makeModalStyles } from '../../card/modals/modalStyles';
import { useTheme } from '../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../shared/theme/theme';

interface Props {
  visible: boolean;
  token: BluechipToken | null;
  scaAddress: string;
  onClose: () => void;
}

export default function TokenDepositModal({ visible, token, scaAddress, onClose }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const s = useMemo(() => makeModalStyles(colors), [colors]);
  const st = useMemo(() => makeStyles(colors), [colors]);
  const [copied, setCopied] = useState(false);

  const handleClose = useCallback(() => {
    setCopied(false);
    onClose();
  }, [onClose]);

  const copy = useCallback(() => {
    Clipboard.setString(scaAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [scaAddress]);

  if (!token) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={st.root}>
        <View style={st.navBar}>
          <View style={st.handle} />
          <View style={st.titleRow}>
            <View style={st.navBtn} />
            <Text style={st.title} numberOfLines={1}>
              {t('crypto.depositToken', { symbol: token.displayName })}
            </Text>
            <TouchableOpacity onPress={handleClose} style={st.navBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={st.content} showsVerticalScrollIndicator={false}>
          <View style={st.tokenHero}>
            <TokenLogo token={token} size={48} />
            <View style={{ flex: 1 }}>
              <Text style={st.tokenName}>{token.name}</Text>
              <View style={st.chipRow}>
                <View style={st.chip}>
                  <Text style={st.chipText}>Base</Text>
                </View>
                <View style={st.chip}>
                  <Text style={st.chipText}>{token.displayName}</Text>
                </View>
              </View>
            </View>
          </View>

          <Text style={s.subtitle}>
            {t('crypto.depositSubtitle', { symbol: token.displayName })}
          </Text>

          <View style={s.qrWrapper}>
            <View style={s.qrBox}>
              <QRCode
                value={scaAddress || ' '}
                size={180}
                color="#0B0B0F"
                backgroundColor={colors.qrBackground}
              />
            </View>
          </View>

          <TouchableOpacity onPress={copy} style={s.addressBox} activeOpacity={0.7}>
            <View style={s.scBadge}>
              <Ionicons name="cube-outline" size={11} color={colors.primary} />
              <Text style={s.scBadgeText}>Base</Text>
            </View>
            <Text style={s.addressFull} numberOfLines={1} ellipsizeMode="middle">
              {scaAddress}
            </Text>
            <Ionicons
              name={copied ? 'checkmark-circle' : 'copy-outline'}
              size={18}
              color={copied ? colors.success : colors.textFaint}
            />
          </TouchableOpacity>

          <TouchableOpacity onPress={copy} style={s.primaryBtn} activeOpacity={0.85}>
            <LinearGradient
              colors={copied ? ['#065F46', '#047857'] : ['#7C3AED', '#4F46E5']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.primaryBtnGradient}
            >
              <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={17} color="#FFF" />
              <Text style={s.primaryBtnText}>
                {copied ? t('card.copied') : t('card.copyAddress')}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          <View style={st.warningBox}>
            <Ionicons name="alert-circle-outline" size={18} color="#F59E0B" />
            <Text style={st.warningText}>
              {t('crypto.depositNetworkWarning', { symbol: token.displayName })}
            </Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.backgroundElevated },
    navBar: { paddingHorizontal: 16, paddingBottom: 4, backgroundColor: c.backgroundElevated },
    handle: {
      width: 40, height: 4, borderRadius: 2, backgroundColor: c.borderStrong,
      alignSelf: 'center', marginTop: 12, marginBottom: 14,
    },
    titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
    title: { flex: 1, textAlign: 'center', color: c.text, fontSize: 18, fontWeight: '700' },
    navBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    content: { paddingHorizontal: 24, paddingBottom: 32 },

    tokenHero: {
      flexDirection: 'row', alignItems: 'center', gap: 14,
      backgroundColor: c.surface, borderRadius: 16, padding: 16,
      borderWidth: 1, borderColor: c.border, marginBottom: 20,
    },
    tokenName: { color: c.text, fontSize: 16, fontWeight: '700', marginBottom: 8 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    chip: { backgroundColor: c.surfaceInput, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
    chipText: { color: c.textMuted, fontSize: 11, fontWeight: '600' },

    warningBox: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 10,
      backgroundColor: 'rgba(245,158,11,0.08)', borderRadius: 12,
      padding: 14, borderWidth: 1, borderColor: 'rgba(245,158,11,0.25)',
    },
    warningText: { flex: 1, color: c.textMuted, fontSize: 12, lineHeight: 18 },
  });
}
