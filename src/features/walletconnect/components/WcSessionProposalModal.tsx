import React, { useMemo } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { WalletKitTypes } from '@reown/walletkit';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { requiredEip155ChainsSatisfied } from '../../../lib/walletconnect/constants';
import { useTheme } from '../../../shared/theme/ThemeContext';
import LegalDisclaimer from '../../../shared/components/LegalDisclaimer';

interface Props {
  visible: boolean;
  proposal: WalletKitTypes.SessionProposal | null;
  smartAddress: string;
  onApprove: () => void;
  onReject: () => void;
}

export default function WcSessionProposalModal({
  visible,
  proposal,
  smartAddress,
  onApprove,
  onReject,
}: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const dappName = proposal?.params.proposer.metadata.name ?? t('walletConnect.unknownDapp');
  const dappUrl = proposal?.params.proposer.metadata.url ?? '';
  const canApprove = useMemo(() => {
    const required = proposal?.params.requiredNamespaces.eip155?.chains ?? [];
    return requiredEip155ChainsSatisfied(required);
  }, [proposal]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      onRequestClose={onReject}
    >
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.iconWrap}>
            <Ionicons name="link-outline" size={28} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>{t('walletConnect.connectTitle')}</Text>
          <Text style={[styles.dappName, { color: colors.text }]}>{dappName}</Text>
          {!!dappUrl && (
            <Text style={[styles.url, { color: colors.textMuted }]} numberOfLines={1}>{dappUrl}</Text>
          )}

          <View style={[styles.infoBox, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
            <Text style={[styles.infoLabel, { color: colors.textMuted }]}>{t('walletConnect.walletAddress')}</Text>
            <Text style={[styles.infoValue, { color: colors.text }]} numberOfLines={1} ellipsizeMode="middle">
              {smartAddress}
            </Text>
            <Text style={[styles.infoHint, { color: colors.textFaint }]}>{t('walletConnect.scaHint')}</Text>
            <LegalDisclaimer variant="walletConnect" style={styles.dappDisclaimer} />
          </View>

          {!canApprove && (
            <Text style={[styles.warning, { color: colors.warning }]}>
              {t('walletConnect.baseOnlyWarning')}
            </Text>
          )}

          <View style={styles.actions}>
            <TouchableOpacity
              onPress={onReject}
              style={[styles.secondaryBtn, { borderColor: colors.border }]}
              activeOpacity={0.8}
            >
              <Text style={[styles.secondaryText, { color: colors.textMuted }]}>{t('walletConnect.reject')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onApprove}
              disabled={!canApprove || !smartAddress}
              style={[styles.primaryBtn, { backgroundColor: canApprove && smartAddress ? colors.text : colors.border }]}
              activeOpacity={0.8}
            >
              <Text style={[styles.primaryText, { color: colors.background }]}>{t('walletConnect.approve')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  card: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  iconWrap: { alignSelf: 'center', marginBottom: 12 },
  title: { fontSize: 13, fontWeight: '600', textAlign: 'center', marginBottom: 4 },
  dappName: { fontSize: 20, fontWeight: '800', textAlign: 'center', marginBottom: 4 },
  url: { fontSize: 12, textAlign: 'center', marginBottom: 16 },
  infoBox: {
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    marginBottom: 12,
    gap: 4,
  },
  infoLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  infoValue: { fontSize: 13, fontFamily: 'monospace' },
  infoHint: { fontSize: 12, lineHeight: 17, marginTop: 4 },
  dappDisclaimer: { marginTop: 8 },
  warning: { fontSize: 12, lineHeight: 17, marginBottom: 12, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  secondaryBtn: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryText: { fontSize: 15, fontWeight: '600' },
  primaryBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryText: { fontSize: 15, fontWeight: '700' },
});
