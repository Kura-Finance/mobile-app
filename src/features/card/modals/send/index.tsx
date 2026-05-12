import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet,
  Animated, Dimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { LiFiBridgeQuote } from '../../../../lib/api/bridge/lifiClient';
import { useTheme } from '../../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../../shared/theme/theme';
import { useCryptoContacts, CryptoContact, ChainOption, BASE_CHAIN } from '../../hooks/useCryptoContacts';
import PickerView from './PickerView';
import SendView from './SendView';
import ConfirmView, { ConfirmParams } from './ConfirmView';
import FiatWithdrawPanel, { type WithdrawNavState } from './FiatWithdrawModal';
import AddWalletModal from './AddWalletModal';

const SW = Dimensions.get('window').width;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type Screen = 'picker' | 'send' | 'confirm' | 'withdraw';

const DEFAULT_WITHDRAW_NAV: WithdrawNavState = {
  titleKey: 'card.enterAmount',
  showBack: true,
  onBack: () => {},
};

export interface SendModalProps {
  visible: boolean;
  onClose: () => void;
  smartAddress: string;
  usdcBalance: number;
  isSending: boolean;
  isBridging: boolean;
  onSend: (toAddress: string, amount: number) => Promise<string>;
  onBridge: (quote: LiFiBridgeQuote) => Promise<string>;
  /** Estimate USDC to reserve for network fees (0 when gas is sponsored). */
  estimateGasReserve: () => Promise<number>;
  /** Estimate the actual USDC gas cost for a bridge route (0 when sponsored). */
  estimateBridgeGasUsdc: (quote: LiFiBridgeQuote) => Promise<number>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Nav bar title + back visibility per screen
// ─────────────────────────────────────────────────────────────────────────────

const NAV: Record<Exclude<Screen, 'withdraw'>, { titleKey: string; showBack: boolean }> = {
  picker:  { titleKey: 'card.send',        showBack: false },
  send:    { titleKey: 'card.enterAmount', showBack: true  },
  confirm: { titleKey: 'card.confirm',     showBack: true  },
};

// ─────────────────────────────────────────────────────────────────────────────
// SendModal
// ─────────────────────────────────────────────────────────────────────────────

export default function SendModal({
  visible, onClose,
  smartAddress, usdcBalance,
  isSending, isBridging,
  onSend, onBridge,
  estimateGasReserve,
  estimateBridgeGasUsdc,
}: SendModalProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const st = useMemo(() => makeStyles(colors), [colors]);
  const { contacts, isLoading, addContact, removeContact, getChain } = useCryptoContacts();

  const [screen, setScreen] = useState<Screen>('picker');
  const [selectedContact, setSelectedContact] = useState<CryptoContact | null>(null);
  const [selectedChain, setSelectedChain] = useState<ChainOption>(BASE_CHAIN);
  const [confirmParams, setConfirmParams] = useState<ConfirmParams | null>(null);
  const [showAddWallet, setShowAddWallet] = useState(false);
  const [withdrawInit, setWithdrawInit] = useState<{ accountId?: string; addNew?: boolean }>({});
  const [withdrawNav, setWithdrawNav] = useState<WithdrawNavState>(DEFAULT_WITHDRAW_NAV);
  const [bankRefreshKey, setBankRefreshKey] = useState(0);

  // Screen history stack for back navigation
  const historyRef = useRef<Screen[]>([]);

  const slideAnim = useRef(new Animated.Value(0)).current;

  const navigate = useCallback((next: Screen, dir: 'forward' | 'back' = 'forward') => {
    if (dir === 'forward') historyRef.current.push(screen);
    slideAnim.setValue(dir === 'forward' ? SW : -SW);
    setScreen(next);
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 120,
      friction: 16,
    }).start();
  }, [screen, slideAnim]);

  const goBack = useCallback(() => {
    if (screen === 'withdraw') {
      withdrawNav.onBack();
      return;
    }
    const prev = historyRef.current.pop() ?? 'picker';
    navigate(prev, 'back');
  }, [navigate, screen, withdrawNav]);

  const reset = useCallback(() => {
    historyRef.current = [];
    setScreen('picker');
    setSelectedContact(null);
    setSelectedChain(BASE_CHAIN);
    setConfirmParams(null);
    setShowAddWallet(false);
    setWithdrawInit({});
    setWithdrawNav(DEFAULT_WITHDRAW_NAV);
    slideAnim.setValue(0);
  }, [slideAnim]);

  const handleClose = useCallback(() => { reset(); onClose(); }, [reset, onClose]);

  const dismissWithdraw = useCallback(() => {
    setBankRefreshKey((k) => k + 1);
    const prev = historyRef.current.pop() ?? 'picker';
    navigate(prev, 'back');
  }, [navigate]);

  // ── Picker ────────────────────────────────────────────────────────────────
  const handleAddNew = useCallback(() => {
    setShowAddWallet(true);
  }, []);

  const handleAddComplete = useCallback((contact: CryptoContact) => {
    setSelectedContact(contact);
    setSelectedChain(getChain(contact.chainKey));
    navigate('send');
  }, [getChain, navigate]);

  const handleSelectContact = useCallback((contact: CryptoContact) => {
    setSelectedContact(contact);
    setSelectedChain(getChain(contact.chainKey));
    navigate('send');
  }, [getChain, navigate]);

  // ── Send → Confirm ────────────────────────────────────────────────────────
  const handleSendContinue = useCallback((amount: number, chain: ChainOption) => {
    if (!selectedContact) return;
    setConfirmParams({ contact: selectedContact, chain, amount, smartAddress });
    navigate('confirm');
  }, [selectedContact, smartAddress, navigate]);

  const handleWithdrawBank = useCallback((opts?: { accountId?: string; addNew?: boolean }) => {
    setWithdrawInit(opts ?? {});
    navigate('withdraw');
  }, [navigate]);

  const nav = screen === 'withdraw'
    ? { titleKey: withdrawNav.titleKey, showBack: withdrawNav.showBack }
    : NAV[screen];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <View style={st.root}>

        {/* ── Unified nav bar ── */}
        <View style={st.navBar}>
          <View style={st.handle} />
          <View style={st.titleRow}>
            {nav.showBack ? (
              <TouchableOpacity onPress={goBack} style={st.navBtn} activeOpacity={0.7}>
                <Ionicons name="chevron-back" size={24} color={colors.text} />
              </TouchableOpacity>
            ) : (
              <View style={st.navBtn} />
            )}
            <Text style={st.title}>{nav.titleKey ? t(nav.titleKey) : ''}</Text>
            <TouchableOpacity onPress={handleClose} style={st.navBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Sliding content ── */}
        <Animated.View style={[st.screenWrap, { transform: [{ translateX: slideAnim }] }]}>
          {screen === 'picker' && (
            <PickerView
              contacts={contacts}
              isLoading={isLoading}
              getChain={getChain}
              removeContact={removeContact}
              onSelectContact={handleSelectContact}
              onAddNew={handleAddNew}
              onWithdrawBank={handleWithdrawBank}
              bankRefreshKey={bankRefreshKey}
              onBankAccountsChanged={() => setBankRefreshKey((k) => k + 1)}
              onClose={handleClose}
            />
          )}

          {screen === 'send' && selectedContact && (
            <SendView
              contact={selectedContact}
              initialChain={selectedChain}
              smartAddress={smartAddress}
              usdcBalance={usdcBalance}
              onContinue={handleSendContinue}
              estimateGasReserve={estimateGasReserve}
              estimateBridgeGasUsdc={estimateBridgeGasUsdc}
            />
          )}

          {screen === 'confirm' && confirmParams && (
            <ConfirmView
              {...confirmParams}
              isSending={isSending}
              isBridging={isBridging}
              onSend={onSend}
              onBridge={onBridge}
              estimateBridgeGasUsdc={estimateBridgeGasUsdc}
              estimateGasReserve={estimateGasReserve}
            />
          )}

          {screen === 'withdraw' && (
            <FiatWithdrawPanel
              embedded
              active
              onClose={dismissWithdraw}
              onNavStateChange={setWithdrawNav}
              smartAddress={smartAddress}
              usdcBalance={usdcBalance}
              isSending={isSending}
              onSend={onSend}
              estimateGasReserve={estimateGasReserve}
              initialAccountId={withdrawInit.accountId}
              startInAddBank={withdrawInit.addNew}
            />
          )}
        </Animated.View>

        <AddWalletModal
          visible={showAddWallet}
          onClose={() => setShowAddWallet(false)}
          contacts={contacts}
          addContact={addContact}
          onComplete={handleAddComplete}
        />

      </View>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: c.backgroundElevated,
    },
    navBar: {
      paddingHorizontal: 16,
      paddingBottom: 4,
      backgroundColor: c.backgroundElevated,
    },
    handle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: c.borderStrong,
      alignSelf: 'center',
      marginTop: 12,
      marginBottom: 14,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 4,
    },
    title: {
      color: c.text,
      fontSize: 18,
      fontWeight: '700',
    },
    navBtn: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
    screenWrap: {
      flex: 1,
    },
  });
}
