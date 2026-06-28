import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../../shared/theme/theme';
import { useMoneyFormat } from '../../../../shared/hooks/useMoneyFormat';
import { useHideBalance } from '../../../../shared/hooks/useHideBalance';
import { HIDDEN_BALANCE_TEXT } from '../../../../shared/utils/privacyDisplay';
import ConnectAccountModal from '../../../../shared/components/ConnectAccountModal';
import PlaidLinkModal from '../../../../shared/components/PlaidLinkModal';
import ExchangeLinkModal from '../../../../shared/components/ExchangeLinkModal';
import { useAppStore } from '../../../../shared/store/useAppStore';
import type { Account } from '../../../../shared/store/useFinanceStore';

interface Props {
  accounts: Account[];
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

function accountDisplayName(account: Account): string {
  if (account.mask) return `${account.name} ${account.mask}`;
  return account.name;
}

function AccountRow({ account }: { account: Account }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const money = useMoneyFormat();
  const hideBalance = useHideBalance();
  const st = useMemo(() => makeRowStyles(colors), [colors]);

  const isCredit = account.type === 'credit';
  const isDepository = account.type === 'checking' || account.type === 'saving';

  const typeLabel = isCredit
    ? t('trackfi.banking.creditAccount')
    : isDepository
      ? t('trackfi.banking.depositoryAccount')
      : account.type === 'saving'
        ? t('accounts.savings')
        : t('accounts.checking');

  const amountLabel = isCredit
    ? t('trackfi.banking.currentBalance')
    : t('trackfi.banking.available');

  const displayAmount = isCredit ? -account.balance : account.balance;

  return (
    <View style={st.row}>
      <View style={[st.iconWrap, { backgroundColor: colors.primarySoft }]}>
        <Ionicons name="business-outline" size={18} color={colors.primary} />
      </View>
      <View style={st.body}>
        <Text style={st.name} numberOfLines={1}>{accountDisplayName(account)}</Text>
        <Text style={st.type}>{typeLabel}</Text>
      </View>
      <View style={st.right}>
        <Text style={st.amount}>
          {hideBalance ? HIDDEN_BALANCE_TEXT : money.value(displayAmount)}
        </Text>
        <Text style={st.amountLabel}>{amountLabel}</Text>
      </View>
    </View>
  );
}

export default function BankingAccountList({ accounts }: Props) {
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
      <View style={st.card}>
        <View style={st.empty}>
          <Ionicons name="wallet-outline" size={32} color={colors.textFaint} />
          <Text style={st.emptyText}>{t('trackfi.banking.noAccounts')}</Text>
          <TouchableOpacity
            style={st.connectBtn}
            onPress={openConnect}
            activeOpacity={0.85}
          >
            <Text style={st.connectBtnText}>{t('trackfi.banking.connectNewAccount')}</Text>
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
    <View style={st.card}>
      {accounts.map((account, index) => (
        <View key={account.id}>
          <AccountRow account={account} />
          {index < accounts.length - 1 ? <View style={st.divider} /> : null}
        </View>
      ))}

      <TouchableOpacity style={st.connectNewBtn} onPress={openConnect} activeOpacity={0.7}>
        <Ionicons name="add-circle-outline" size={16} color={colors.primary} />
        <Text style={st.connectNewText}>{t('trackfi.banking.connectNewAccount')}</Text>
      </TouchableOpacity>

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
    card: {
      backgroundColor: c.surfaceAlt,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      overflow: 'hidden',
      marginBottom: 20,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.border,
      marginHorizontal: 14,
    },
    connectNewBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
    },
    connectNewText: {
      color: c.primary,
      fontSize: 13,
      fontWeight: '600',
    },
    empty: {
      alignItems: 'center',
      paddingVertical: 32,
      paddingHorizontal: 20,
      gap: 10,
    },
    emptyText: {
      color: c.textMuted,
      fontSize: 14,
      textAlign: 'center',
    },
    connectBtn: {
      marginTop: 8,
      backgroundColor: c.primarySoft,
      borderRadius: 10,
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

function makeRowStyles(c: ThemeColors) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 14,
      gap: 12,
    },
    iconWrap: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    body: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    name: {
      color: c.text,
      fontSize: 15,
      fontWeight: '600',
    },
    type: {
      color: c.textFaint,
      fontSize: 12,
    },
    right: {
      alignItems: 'flex-end',
      gap: 2,
    },
    amount: {
      color: c.text,
      fontSize: 14,
      fontWeight: '700',
    },
    amountLabel: {
      color: c.textFaint,
      fontSize: 10,
      fontWeight: '500',
    },
  });
}
