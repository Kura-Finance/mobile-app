import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet,
  Animated, Dimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LiFiBridgeQuote } from '../../../../lib/api/bridge/lifiClient';
import { useTheme } from '../../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../../shared/theme/theme';
import { useCryptoContacts, CryptoContact, ChainOption, BASE_CHAIN } from '../../hooks/useCryptoContacts';
import PickerView from './PickerView';
import SendMethodPicker from './SendMethodPicker';
import SendView from './SendView';
import ConfirmView, { ConfirmParams } from './ConfirmView';
import { FiatWithdrawPanel, type WithdrawNavState } from './FiatWithdrawModal';
import AddWalletChainPicker from './AddWalletChainPicker';
import AddContactView from './AddContactView';
import QRScanner from './QRScanner';

const SW = Dimensions.get('window').width;

const ADD_WALLET_SCREENS = new Set(['addWalletChain', 'addWalletForm', 'addWalletScan']);

type Screen =
  | 'method'
  | 'bankPick'
  | 'cryptoPick'
  | 'addWalletChain'
  | 'addWalletForm'
  | 'addWalletScan'
  | 'send'
  | 'confirm'
  | 'withdraw';

const DEFAULT_WITHDRAW_NAV: WithdrawNavState = {
  titleKey: 'card.enterAmount',
  showBack: true,
  onBack: () => {},
};

const NAV: Record<Exclude<Screen, 'withdraw'>, { titleKey: string; showBack: boolean }> = {
  method:          { titleKey: 'card.send',              showBack: false },
  bankPick:        { titleKey: 'card.recipients',      showBack: true  },
  cryptoPick:      { titleKey: 'card.sendMoneyCrypto', showBack: true  },
  addWalletChain:  { titleKey: 'card.selectNetwork',   showBack: true  },
  addWalletForm:   { titleKey: 'card.addWallet',       showBack: true  },
  addWalletScan:   { titleKey: 'card.scanQrToAdd',     showBack: true  },
  send:            { titleKey: 'card.enterAmount',     showBack: true  },
  confirm:         { titleKey: 'card.confirm',         showBack: true  },
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
  estimateGasReserve: () => Promise<number>;
  estimateBridgeGasUsdc: (quote: LiFiBridgeQuote) => Promise<number>;
}

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

  const [screen, setScreen] = useState<Screen>('method');
  const [selectedContact, setSelectedContact] = useState<CryptoContact | null>(null);
  const [selectedChain, setSelectedChain] = useState<ChainOption>(BASE_CHAIN);
  const [confirmParams, setConfirmParams] = useState<ConfirmParams | null>(null);
  const [addWalletChain, setAddWalletChain] = useState<ChainOption>(BASE_CHAIN);
  const [addWalletPrefill, setAddWalletPrefill] = useState('');
  const [withdrawInit, setWithdrawInit] = useState<{ accountId?: string; addNew?: boolean }>({});
  const [withdrawNav, setWithdrawNav] = useState<WithdrawNavState>(DEFAULT_WITHDRAW_NAV);
  const [bankRefreshKey, setBankRefreshKey] = useState(0);

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

  const goToScreen = useCallback((next: Screen) => {
    slideAnim.setValue(SW);
    setScreen(next);
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 120,
      friction: 16,
    }).start();
  }, [slideAnim]);

  const resetAddWalletState = useCallback(() => {
    setAddWalletChain(BASE_CHAIN);
    setAddWalletPrefill('');
  }, []);

  const goBack = useCallback(() => {
    if (screen === 'withdraw') {
      withdrawNav.onBack();
      return;
    }
    const prev = historyRef.current.pop() ?? 'method';
    navigate(prev, 'back');
  }, [navigate, screen, withdrawNav]);

  const reset = useCallback(() => {
    historyRef.current = [];
    setScreen('method');
    setSelectedContact(null);
    setSelectedChain(BASE_CHAIN);
    setConfirmParams(null);
    resetAddWalletState();
    setWithdrawInit({});
    setWithdrawNav(DEFAULT_WITHDRAW_NAV);
    slideAnim.setValue(0);
  }, [resetAddWalletState, slideAnim]);

  const handleClose = useCallback(() => { reset(); onClose(); }, [reset, onClose]);

  const dismissWithdraw = useCallback(() => {
    setBankRefreshKey((k) => k + 1);
    const prev = historyRef.current.pop() ?? 'method';
    navigate(prev, 'back');
  }, [navigate]);

  const handleAddNew = useCallback(() => {
    resetAddWalletState();
    navigate('addWalletChain');
  }, [navigate, resetAddWalletState]);

  const handleSelectAddWalletChain = useCallback((chain: ChainOption) => {
    setAddWalletChain(chain);
    navigate('addWalletForm');
  }, [navigate]);

  const handleAddWalletContinue = useCallback(async (params: { name: string; address: string; chainKey: string }) => {
    const contact = await addContact(params);
    setSelectedContact(contact);
    setSelectedChain(getChain(contact.chainKey));
    resetAddWalletState();
    historyRef.current = historyRef.current.filter((s) => !ADD_WALLET_SCREENS.has(s));
    goToScreen('send');
  }, [addContact, getChain, goToScreen, resetAddWalletState]);

  const handleAddWalletScanned = useCallback((address: string) => {
    setAddWalletPrefill(address);
    if (historyRef.current[historyRef.current.length - 1] === 'addWalletScan') {
      historyRef.current.pop();
    }
    slideAnim.setValue(-SW);
    setScreen('addWalletForm');
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 120,
      friction: 16,
    }).start();
  }, [slideAnim]);

  const handleSelectContact = useCallback((contact: CryptoContact) => {
    setSelectedContact(contact);
    setSelectedChain(getChain(contact.chainKey));
    navigate('send');
  }, [getChain, navigate]);

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
      <SafeAreaView style={st.root} edges={['top', 'bottom']}>
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
            <Text style={st.title} numberOfLines={1}>{nav.titleKey ? t(nav.titleKey) : ''}</Text>
            <TouchableOpacity onPress={handleClose} style={st.navBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        <Animated.View style={[st.screenWrap, { transform: [{ translateX: slideAnim }] }]}>
          {screen === 'method' && (
            <SendMethodPicker
              onSelectBank={() => navigate('bankPick')}
              onSelectCrypto={() => navigate('cryptoPick')}
            />
          )}

          {screen === 'bankPick' && (
            <PickerView
              variant="bank"
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

          {screen === 'cryptoPick' && (
            <PickerView
              variant="crypto"
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

          {screen === 'addWalletChain' && (
            <AddWalletChainPicker onSelectChain={handleSelectAddWalletChain} />
          )}

          {screen === 'addWalletForm' && (
            <AddContactView
              contacts={contacts}
              chain={addWalletChain}
              prefillAddress={addWalletPrefill}
              onScanQR={() => navigate('addWalletScan')}
              onBackToChain={() => {
                setAddWalletPrefill('');
                goBack();
              }}
              onContinue={handleAddWalletContinue}
            />
          )}

          {screen === 'addWalletScan' && (
            <QRScanner
              onScanned={handleAddWalletScanned}
              onCancel={goBack}
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
      </SafeAreaView>
    </Modal>
  );
}

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
      flex: 1,
      textAlign: 'center',
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
