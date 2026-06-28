import LoadingDots from '../../../shared/components/LoadingDots';
/**
 * TokenWithdrawModal
 *
 * On-chain withdraw (ERC-20 transfer) for a specific token on Base.
 * Distinct from the card Send flow (USDC / contacts / bridge).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { isAddress } from 'viem';

import { userFacingTransactionError } from '../../../lib/wallet/userFacingTransactionError';
import TokenLogo from '../components/TokenLogo';
import type { BluechipToken } from '../config/blueChips';
import { makeModalStyles } from '../../card/modals/modalStyles';
import { useTheme } from '../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../shared/theme/theme';

type Screen = 'form' | 'success';

interface Props {
  visible: boolean;
  token: BluechipToken | null;
  tokenHoldings: number;
  isSending: boolean;
  onClose: () => void;
  onWithdraw: (toAddress: string, amount: number) => Promise<string>;
  onWithdrawn?: () => void;
}

function formatHoldings(n: number, symbol: string): string {
  if (n === 0) return `0 ${symbol}`;
  if (n < 0.0001) return `${n.toExponential(2)} ${symbol}`;
  if (n < 1) return `${n.toFixed(6)} ${symbol}`;
  return `${n.toLocaleString('en-US', { maximumFractionDigits: 4 })} ${symbol}`;
}

export default function TokenWithdrawModal({
  visible,
  token,
  tokenHoldings,
  isSending,
  onClose,
  onWithdraw,
  onWithdrawn,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const s = useMemo(() => makeModalStyles(colors), [colors]);
  const st = useMemo(() => makeStyles(colors), [colors]);

  const [screen, setScreen] = useState<Screen>('form');
  const [toAddress, setToAddress] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [error, setError] = useState('');
  const [txHash, setTxHash] = useState('');

  const reset = useCallback(() => {
    setScreen('form');
    setToAddress('');
    setAmountStr('');
    setError('');
    setTxHash('');
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  useEffect(() => {
    if (!visible) reset();
  }, [visible, reset]);

  const handleMax = useCallback(() => {
    if (!token) return;
    setAmountStr(tokenHoldings.toString());
    setError('');
  }, [token, tokenHoldings]);

  const handleSubmit = useCallback(async () => {
    if (!token) return;
    if (token.baseAddress === null && token.symbol !== 'ETH') return;

    const trimmedAddr = toAddress.trim();
    if (!isAddress(trimmedAddr)) {
      setError(t('crypto.invalidAddress'));
      return;
    }

    const amount = parseFloat(amountStr);
    if (Number.isNaN(amount) || amount <= 0) {
      setError(t('card.enterValidAmount'));
      return;
    }
    if (amount > tokenHoldings) {
      setError(t('crypto.insufficientBalance', { symbol: token.displayName }));
      return;
    }

    setError('');
    try {
      const hash = await onWithdraw(trimmedAddr, amount);
      setTxHash(hash);
      setScreen('success');
      onWithdrawn?.();
    } catch (err) {
      setError(userFacingTransactionError(err));
    }
  }, [token, toAddress, amountStr, tokenHoldings, onWithdraw, onWithdrawn, t]);

  if (!token) return null;

  const navTitle =
    screen === 'success'
      ? t('crypto.withdrawSubmitted')
      : t('crypto.withdrawToken', { symbol: token.displayName });

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={st.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={st.navBar}>
          <View style={st.handle} />
          <View style={st.titleRow}>
            <View style={st.navBtn} />
            <Text style={st.title} numberOfLines={1}>{navTitle}</Text>
            <TouchableOpacity onPress={handleClose} style={st.navBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        {screen === 'form' ? (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={st.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={st.tokenHero}>
              <TokenLogo token={token} size={44} />
              <View style={{ flex: 1 }}>
                <Text style={st.tokenName}>{token.displayName}</Text>
                <Text style={st.available}>
                  {t('crypto.available', {
                    amount: formatHoldings(tokenHoldings, token.displayName),
                  })}
                </Text>
              </View>
            </View>

            <Text style={s.fieldLabel}>{t('crypto.recipientAddress')}</Text>
            <TextInput
              style={s.input}
              placeholder="0x…"
              placeholderTextColor={colors.textFaint}
              value={toAddress}
              onChangeText={(v) => { setToAddress(v); setError(''); }}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={s.amountHeader}>
              <Text style={s.fieldLabel}>{t('crypto.amountToken', { symbol: token.displayName })}</Text>
              <TouchableOpacity onPress={handleMax}>
                <Text style={s.maxBtn}>{t('crypto.max')}</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={s.input}
              placeholder="0.00"
              placeholderTextColor={colors.textFaint}
              value={amountStr}
              onChangeText={(v) => { setAmountStr(v); setError(''); }}
              keyboardType="decimal-pad"
            />

            {error ? <Text style={s.errorText}>{error}</Text> : null}

            <TouchableOpacity
              style={[st.submitBtn, (isSending || tokenHoldings <= 0) && st.submitBtnDisabled]}
              onPress={() => void handleSubmit()}
              disabled={isSending || tokenHoldings <= 0}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#7C3AED', '#4F46E5']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={st.submitGradient}
              >
                {isSending ? (
                  <LoadingDots color="#FFF" size={8}   />
                ) : (
                  <>
                    <Ionicons name="arrow-up-circle-outline" size={18} color="#FFF" />
                    <Text style={st.submitText}>
                      {t('crypto.withdrawToken', { symbol: token.displayName })}
                    </Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <Text style={s.networkNote}>{t('crypto.withdrawNetworkNote')}</Text>
          </ScrollView>
        ) : (
          <View style={st.successWrap}>
            <View style={s.successBox}>
              <Ionicons name="checkmark-circle" size={64} color={colors.success} style={s.successIcon} />
              <Text style={s.successTitle}>{t('crypto.withdrawSubmitted')}</Text>
              <Text style={s.successSub}>
                {t('crypto.withdrawSuccessSub', {
                  amount: amountStr,
                  symbol: token.displayName,
                })}
              </Text>
              {txHash ? (
                <View style={s.txHashBox}>
                  <Text style={s.txHashLabel}>{t('card.txHash')}</Text>
                  <Text style={s.txHashValue} numberOfLines={1} ellipsizeMode="middle">
                    {txHash}
                  </Text>
                </View>
              ) : null}
              <TouchableOpacity style={st.doneBtn} onPress={handleClose} activeOpacity={0.85}>
                <Text style={st.doneBtnText}>{t('crypto.done')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
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
      borderWidth: 1, borderColor: c.border, marginBottom: 24,
    },
    tokenName: { color: c.text, fontSize: 16, fontWeight: '700', marginBottom: 4 },
    available: { color: c.textMuted, fontSize: 13 },

    submitBtn: { borderRadius: 14, overflow: 'hidden', marginTop: 8 },
    submitBtnDisabled: { opacity: 0.5 },
    submitGradient: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      paddingVertical: 16, gap: 8,
    },
    submitText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

    successWrap: { flex: 1, paddingHorizontal: 24 },
    doneBtn: {
      marginTop: 8, backgroundColor: c.primary, borderRadius: 14,
      paddingVertical: 16, alignItems: 'center', width: '100%',
    },
    doneBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  });
}
