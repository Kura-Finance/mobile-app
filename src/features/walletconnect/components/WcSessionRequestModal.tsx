import React, { useMemo } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { WalletKitTypes } from '@reown/walletkit';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../shared/theme/ThemeContext';

interface Props {
  visible: boolean;
  request: WalletKitTypes.SessionRequest | null;
  smartAddress: string;
  onApprove: () => void;
  onReject: () => void;
}

function summarizeRequest(request: WalletKitTypes.SessionRequest | null): string {
  if (!request) return '';
  const { method, params } = request.params.request;
  if (method === 'eth_sendTransaction' && Array.isArray(params) && params[0]) {
    const tx = params[0] as Record<string, unknown>;
    const to = typeof tx.to === 'string' ? tx.to : '?';
    const value = typeof tx.value === 'string' ? tx.value : '0x0';
    return `eth_sendTransaction → ${to}\nvalue: ${value}`;
  }
  if (method === 'personal_sign' || method === 'eth_sign') {
    return `${method}\n${JSON.stringify(params, null, 2)}`;
  }
  if (method.startsWith('eth_signTypedData')) {
    return `${method}\n${typeof params?.[1] === 'string' ? params[1] : JSON.stringify(params?.[1] ?? params, null, 2)}`;
  }
  return `${method}\n${JSON.stringify(params, null, 2)}`;
}

export default function WcSessionRequestModal({
  visible,
  request,
  smartAddress,
  onApprove,
  onReject,
}: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const method = request?.params.request.method ?? '';
  const summary = useMemo(() => summarizeRequest(request), [request]);
  const isTransaction = method === 'eth_sendTransaction';

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
            <Ionicons
              name={isTransaction ? 'swap-horizontal-outline' : 'create-outline'}
              size={28}
              color={isTransaction ? colors.warning : colors.primary}
            />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>
            {isTransaction ? t('walletConnect.signTransaction') : t('walletConnect.signMessage')}
          </Text>
          <Text style={[styles.method, { color: colors.textMuted }]}>{method}</Text>

          <ScrollView style={[styles.payloadBox, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
            <Text style={[styles.payload, { color: colors.text }]} selectable>
              {summary}
            </Text>
          </ScrollView>

          <Text style={[styles.walletHint, { color: colors.textFaint }]}>
            {t('walletConnect.signingAs', { address: smartAddress })}
          </Text>

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
              style={[styles.primaryBtn, { backgroundColor: colors.text }]}
              activeOpacity={0.8}
            >
              <Text style={[styles.primaryText, { color: colors.background }]}>
                {isTransaction ? t('walletConnect.confirmTx') : t('walletConnect.confirmSign')}
              </Text>
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
    maxHeight: '85%',
  },
  iconWrap: { alignSelf: 'center', marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '800', textAlign: 'center', marginBottom: 4 },
  method: { fontSize: 12, textAlign: 'center', marginBottom: 12, fontFamily: 'monospace' },
  payloadBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    maxHeight: 220,
    marginBottom: 10,
  },
  payload: { fontSize: 12, lineHeight: 18, fontFamily: 'monospace' },
  walletHint: { fontSize: 11, textAlign: 'center', marginBottom: 12 },
  actions: { flexDirection: 'row', gap: 10 },
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
