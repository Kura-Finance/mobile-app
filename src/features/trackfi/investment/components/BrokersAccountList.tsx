import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../../shared/theme/theme';
import AccountCapsules from './AccountCapsules';
import ConnectAccountModal from '../../../../shared/components/ConnectAccountModal';
import PlaidLinkModal from '../../../../shared/components/PlaidLinkModal';
import ExchangeLinkModal from '../../../../shared/components/ExchangeLinkModal';
import { useAppStore } from '../../../../shared/store/useAppStore';

interface BrokerAccount {
  id: string;
  name: string;
  logo: string;
  type?: 'Broker' | 'Exchange' | 'Web3 Wallet';
}

interface Props {
  accounts: BrokerAccount[];
  selectedAccountId: string | null;
  onSelectAccount: (accountId: string | null) => void;
}

function ConnectModals({
  showConnectModal,
  setShowConnectModal,
  showPlaidModal,
  setShowPlaidModal,
  showExchangeModal,
  setShowExchangeModal,
  plaidLinkToken,
}: {
  showConnectModal: boolean;
  setShowConnectModal: (v: boolean) => void;
  showPlaidModal: boolean;
  setShowPlaidModal: (v: boolean) => void;
  showExchangeModal: boolean;
  setShowExchangeModal: (v: boolean) => void;
  plaidLinkToken: string | null;
}) {
  return (
    <>
      <ConnectAccountModal
        isOpen={showConnectModal}
        onClose={() => setShowConnectModal(false)}
        onPlaidPress={() => setShowPlaidModal(true)}
        onWeb3Press={() => {}}
        onExchangePress={() => setShowExchangeModal(true)}
      />
      <PlaidLinkModal
        isVisible={showPlaidModal}
        linkToken={plaidLinkToken}
        onClose={() => setShowPlaidModal(false)}
        onSuccess={() => setShowPlaidModal(false)}
      />
      <ExchangeLinkModal
        isOpen={showExchangeModal}
        onClose={() => setShowExchangeModal(false)}
        onSuccess={() => {}}
      />
    </>
  );
}

export default function BrokersAccountList({
  accounts,
  selectedAccountId,
  onSelectAccount,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const st = useMemo(() => makeStyles(colors), [colors]);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showPlaidModal, setShowPlaidModal] = useState(false);
  const [showExchangeModal, setShowExchangeModal] = useState(false);
  const plaidLinkToken = useAppStore((state) => state.plaidLinkToken);

  const openConnect = () => setShowConnectModal(true);

  if (accounts.length === 0) {
    return (
      <View style={st.wrap}>
        <Text style={st.sectionTitle}>{t('trackfi.brokers.connectedAccounts')}</Text>
        <View style={st.empty}>
          <Ionicons name="briefcase-outline" size={28} color={colors.textFaint} />
          <Text style={st.emptyText}>{t('trackfi.brokers.noAccounts')}</Text>
          <TouchableOpacity style={st.connectBtn} onPress={openConnect} activeOpacity={0.85}>
            <Text style={st.connectBtnText}>{t('investments.connectAccount')}</Text>
          </TouchableOpacity>
        </View>
        <ConnectModals
          showConnectModal={showConnectModal}
          setShowConnectModal={setShowConnectModal}
          showPlaidModal={showPlaidModal}
          setShowPlaidModal={setShowPlaidModal}
          showExchangeModal={showExchangeModal}
          setShowExchangeModal={setShowExchangeModal}
          plaidLinkToken={plaidLinkToken}
        />
      </View>
    );
  }

  return (
    <View style={st.wrap}>
      <Text style={st.sectionTitle}>{t('trackfi.brokers.connectedAccounts')}</Text>
      <AccountCapsules
        accounts={accounts}
        selectedAccountId={selectedAccountId}
        onSelectAccount={(id) => {
          if (id !== null && id === selectedAccountId) {
            onSelectAccount(null);
          } else {
            onSelectAccount(id);
          }
        }}
        onAddAccount={openConnect}
        horizontalPadding={0}
      />
      <ConnectModals
        showConnectModal={showConnectModal}
        setShowConnectModal={setShowConnectModal}
        showPlaidModal={showPlaidModal}
        setShowPlaidModal={setShowPlaidModal}
        showExchangeModal={showExchangeModal}
        setShowExchangeModal={setShowExchangeModal}
        plaidLinkToken={plaidLinkToken}
      />
    </View>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    wrap: {
      marginBottom: 20,
    },
    sectionTitle: {
      color: c.text,
      fontSize: 15,
      fontWeight: '700',
      marginBottom: 10,
    },
    empty: {
      alignItems: 'center',
      backgroundColor: c.surfaceAlt,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      paddingVertical: 28,
      paddingHorizontal: 20,
      gap: 10,
    },
    emptyText: {
      color: c.textMuted,
      fontSize: 14,
      textAlign: 'center',
    },
    connectBtn: {
      marginTop: 4,
      backgroundColor: c.primarySoft,
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    connectBtnText: {
      color: c.primary,
      fontSize: 14,
      fontWeight: '600',
    },
  });
}
