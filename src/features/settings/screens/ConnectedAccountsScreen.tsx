import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFinanceStore } from '../../../shared/store/useFinanceStore';
import { useAppStore } from '../../../shared/store/useAppStore';
import { useAppTranslation } from '../../../shared/hooks/useAppTranslation';
import { useTheme } from '../../../shared/theme/ThemeContext';
import Logger from '../../../shared/utils/Logger';
import ConnectAccountModal from '../../../shared/components/ConnectAccountModal';
import PlaidLinkModal from '../../../shared/components/PlaidLinkModal';
import ExchangeLinkModal from '../../../shared/components/ExchangeLinkModal';

interface ConnectedAccountsScreenProps {
  onClose: () => void;
}

const getAccountTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    'checking': 'Checking Account',
    'saving': 'Savings Account',
    'credit': 'Credit Card',
    'crypto': 'Crypto Wallet',
    'Broker': 'Brokerage',
    'Exchange': 'Exchange',
    'Web3 Wallet': 'Web3 Wallet',
  };
  return labels[type] || type;
};

const getAccountIcon = (type: string): string => {
  const icons: Record<string, string> = {
    'checking': 'card-outline',
    'saving': 'wallet-outline',
    'credit': 'card-outline',
    'crypto': 'logo-bitcoin',
    'Broker': 'trending-up',
    'Exchange': 'swap-horizontal',
    'Web3 Wallet': 'logo-ethereum',
  };
  return icons[type] || 'wallet-outline';
};

export default function ConnectedAccountsScreen({ onClose }: ConnectedAccountsScreenProps) {
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showPlaidModal, setShowPlaidModal] = useState(false);
  const [showExchangeModal, setShowExchangeModal] = useState(false);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const { t } = useAppTranslation();
  const { colors } = useTheme();
  const accounts = useFinanceStore((state) => state.accounts);
  const investmentAccounts = useFinanceStore((state) => state.investmentAccounts);
  const exchangeAccounts = useFinanceStore((state) => state.exchangeAccounts);
  const plaidLinkToken = useAppStore((state: any) => state.plaidLinkToken);
  const disconnectPlaidAccount = useAppStore((state) => state.disconnectPlaidAccount);
  const disconnectExchangeAccount = useAppStore((state) => state.disconnectExchangeAccount);
  const disconnectInvestmentAccount = useFinanceStore((state) => state.disconnectInvestmentAccount);

  const handleDisconnect = (accountId: string, category: 'Banking' | 'Investment' | 'Exchange', name: string) => {
    Alert.alert(
      'Disconnect Account?',
      `Are you sure you want to disconnect "${name}"?`,
      [
        {
          text: 'Cancel',
          onPress: () => {},
          style: 'cancel',
        },
        {
          text: 'Disconnect',
          onPress: async () => {
            await performDisconnect(accountId, category);
          },
          style: 'destructive',
        },
      ]
    );
  };

  const performDisconnect = async (accountId: string, category: 'Banking' | 'Investment' | 'Exchange') => {
    setDisconnectingId(accountId);
    try {
      Logger.debug('ConnectedAccountsScreen', 'Disconnecting account', { accountId, category });

      if (category === 'Banking') {
        await disconnectPlaidAccount(accountId);
      } else if (category === 'Investment') {
        disconnectInvestmentAccount(accountId);
      } else if (category === 'Exchange') {
        await disconnectExchangeAccount(accountId);
      }

      Logger.info('ConnectedAccountsScreen', 'Account disconnected successfully', { accountId, category });
      Alert.alert('Success', 'Account disconnected successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to disconnect account';
      Logger.error('ConnectedAccountsScreen', 'Failed to disconnect account', { error: errorMessage });
      Alert.alert('Error', errorMessage);
    } finally {
      setDisconnectingId(null);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleConnectPlaid = async () => {
    setShowConnectModal(true);
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleConnectWalletConnect = async () => {
    setShowConnectModal(true);
  };

  // 合并所有账户（银行账户 + 投资账户 + 交易所账户）
  const allConnectedAccounts = [
    ...accounts.map((acc) => ({
      ...acc,
      category: 'Banking',
      typeLabel: getAccountTypeLabel(acc.type),
      icon: getAccountIcon(acc.type),
    })),
    ...investmentAccounts.map((acc) => ({
      ...acc,
      category: 'Investment',
      typeLabel: getAccountTypeLabel(acc.type),
      icon: getAccountIcon(acc.type),
    })),
    ...exchangeAccounts.map((acc) => ({
      ...acc,
      name: acc.exchangeDisplayName,
      category: 'Exchange',
      typeLabel: 'Exchange',
      icon: getAccountIcon('Exchange'), // Fallback icon (will use logo instead)
      logo: acc.icon, // Use the icon URL from API directly
    })),
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView style={{ flex: 1, paddingTop: 64, paddingHorizontal: 24 }} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: 'bold' }}>{t('settings.connectedAccounts')}</Text>
          <TouchableOpacity onPress={onClose} style={{ width: 32, height: 32, backgroundColor: colors.surface, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="close" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Connected Accounts List */}
        {allConnectedAccounts.length > 0 ? (
          <View>
            {allConnectedAccounts.map((account) => (
              <View
                key={account.id}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: colors.surface, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: colors.primarySoft }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginRight: 16, overflow: 'hidden' }}>
                    {account.logo && account.logo.startsWith('http') ? (
                      <Image source={{ uri: account.logo }} style={{ width: 48, height: 48, borderRadius: 24 }} resizeMode="cover" />
                    ) : (
                      <Ionicons name={account.icon as any} size={24} color={colors.primary} />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: '500', fontSize: 16 }}>{account.name}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>{account.typeLabel}</Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={() => handleDisconnect(account.id, account.category as 'Banking' | 'Investment' | 'Exchange', account.name)}
                  disabled={disconnectingId === account.id}
                  style={{ padding: 8 }}
                >
                  {disconnectingId === account.id ? (
                    <ActivityIndicator size={24} color={colors.danger} />
                  ) : (
                    <Ionicons name="close-circle" size={24} color={colors.danger} />
                  )}
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ) : (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <Ionicons name="wallet-outline" size={48} color={colors.textFaint} />
            <Text style={{ color: colors.textMuted, fontSize: 16, marginTop: 16 }}>{t('settings.noConnectedAccounts')}</Text>
          </View>
        )}

        {/* Add Account Section */}
        <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.3, marginTop: 32, marginBottom: 16 }}>{t('settings.connectNewAccount')}</Text>

        <TouchableOpacity
          onPress={() => setShowConnectModal(true)}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.primary }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
              <Ionicons name="add" size={24} color={colors.primary} />
            </View>
            <View>
              <Text style={{ color: colors.primary, fontWeight: '500', fontSize: 16 }}>{t('settings.connectAccount')}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>{t('settings.plaidOrWeb3')}</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.primary} />
        </TouchableOpacity>

        {/* Connect Account Modal */}
        <ConnectAccountModal
          isOpen={showConnectModal}
          onClose={() => setShowConnectModal(false)}
          onPlaidPress={() => setShowPlaidModal(true)}
          onWeb3Press={() => {
            // Web3 wallet connection is handled directly by AppKit modal
            // No additional modal needed
          }}
          onExchangePress={() => setShowExchangeModal(true)}
        />

        {/* Plaid Link Modal */}
        <PlaidLinkModal
          isVisible={showPlaidModal}
          linkToken={plaidLinkToken}
          onClose={() => setShowPlaidModal(false)}
          onSuccess={() => setShowPlaidModal(false)}
        />

        {/* Exchange Link Modal */}
        <ExchangeLinkModal
          isOpen={showExchangeModal}
          onClose={() => setShowExchangeModal(false)}
          onSuccess={() => {
            // Exchange account connected successfully
            // You can add additional logic here if needed
          }}
        />
      </ScrollView>
    </View>
  );
}
