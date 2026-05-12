import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform, StyleSheet,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChainOption, BASE_CHAIN, ALL_CHAINS, CryptoContact,
} from '../../hooks/useCryptoContacts';
import { useTheme } from '../../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../../shared/theme/theme';
import AddContactView from './AddContactView';
import QRScanner from './QRScanner';
import ChainLogo from '../../components/ChainLogo';

type Step = 'chain' | 'form' | 'scan-qr';

export interface AddWalletModalProps {
  visible: boolean;
  onClose: () => void;
  contacts: CryptoContact[];
  onComplete: (contact: CryptoContact) => void;
  addContact: (params: { name: string; address: string; chainKey: string }) => Promise<CryptoContact>;
}

export default function AddWalletModal({
  visible, onClose, contacts, onComplete, addContact,
}: AddWalletModalProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const st = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<Step>('chain');
  const [chain, setChain] = useState<ChainOption>(BASE_CHAIN);
  const [prefillAddress, setPrefillAddress] = useState('');

  const reset = useCallback(() => {
    setStep('chain');
    setChain(BASE_CHAIN);
    setPrefillAddress('');
  }, []);

  useEffect(() => {
    if (!visible) reset();
  }, [visible, reset]);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const handleSelectChain = useCallback((next: ChainOption) => {
    setChain(next);
    setStep('form');
  }, []);

  const handleContinue = useCallback(async (params: { name: string; address: string; chainKey: string }) => {
    const contact = await addContact(params);
    onComplete(contact);
    handleClose();
  }, [addContact, onComplete, handleClose]);

  const handleScanned = useCallback((address: string) => {
    setPrefillAddress(address);
    setStep('form');
  }, []);

  const headerTitle = step === 'chain'
    ? t('card.selectNetwork')
    : t('card.addWallet');

  if (step === 'scan-qr') {
    return (
      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setStep('form')}>
        <QRScanner
          onScanned={handleScanned}
          onCancel={() => setStep('form')}
        />
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[st.root, { paddingBottom: insets.bottom }]}
      >
        <View style={st.handle} />
        <View style={st.header}>
          <Text style={st.title}>{headerTitle}</Text>
          <TouchableOpacity onPress={handleClose} style={st.closeBtn} hitSlop={8} activeOpacity={0.7}>
            <Ionicons name="close" size={22} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {step === 'chain' ? (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={st.scroll}
            showsVerticalScrollIndicator={false}
          >
            <Text style={st.fieldLabel}>{t('card.selectNetwork')}</Text>
            <Text style={st.stepSub}>{t('card.selectNetworkSub')}</Text>
            {ALL_CHAINS.map((c) => {
              const isBridge = c.key !== 'BASE';
              return (
                <TouchableOpacity
                  key={c.key}
                  style={st.chainRow}
                  onPress={() => handleSelectChain(c)}
                  activeOpacity={0.8}
                >
                  <View style={[st.chainIcon, { backgroundColor: `${c.color}14` }]}>
                    <ChainLogo chain={c} size={28} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={st.chainName}>{c.name}</Text>
                    <Text style={st.chainSub}>
                      {isBridge ? t('card.bridgeViaLifi') : t('card.baseDirectSend')}
                    </Text>
                  </View>
                  {isBridge && <Text style={st.bridgeBadge}>{t('card.bridge')}</Text>}
                  <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        ) : (
          <AddContactView
            contacts={contacts}
            chain={chain}
            prefillAddress={prefillAddress}
            onScanQR={() => setStep('scan-qr')}
            onBackToChain={() => { setPrefillAddress(''); setStep('chain'); }}
            onContinue={handleContinue}
          />
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.backgroundElevated },
    handle: {
      width: 40, height: 4, borderRadius: 2, backgroundColor: c.borderStrong,
      alignSelf: 'center', marginTop: 12, marginBottom: 12,
    },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 24, marginBottom: 16,
    },
    title: { color: c.text, fontSize: 20, fontWeight: '700' },
    closeBtn: {
      width: 36, height: 36, borderRadius: 18, backgroundColor: c.surfaceInput,
      alignItems: 'center', justifyContent: 'center',
    },
    scroll: { paddingHorizontal: 24, paddingBottom: 32 },
    fieldLabel: {
      color: c.textMuted, fontSize: 12, fontWeight: '600', marginBottom: 8,
      textTransform: 'uppercase', letterSpacing: 0.4,
    },
    stepSub: { color: c.textMuted, fontSize: 13, lineHeight: 18, marginBottom: 16, marginTop: -2 },
    chainRow: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: c.surface, borderRadius: 12, padding: 14, marginBottom: 8,
      borderWidth: 1, borderColor: c.border,
    },
    chainIcon: {
      width: 36, height: 36, borderRadius: 18,
      alignItems: 'center', justifyContent: 'center',
    },
    chainName: { color: c.text, fontSize: 15, fontWeight: '600' },
    chainSub: { color: c.textMuted, fontSize: 12, marginTop: 1 },
    bridgeBadge: {
      fontSize: 11, fontWeight: '600', color: '#F59E0B',
      backgroundColor: 'rgba(245,158,11,0.12)', borderRadius: 6,
      paddingHorizontal: 7, paddingVertical: 2, overflow: 'hidden',
    },
  });
}
