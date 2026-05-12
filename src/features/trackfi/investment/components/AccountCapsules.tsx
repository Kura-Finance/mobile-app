import React from 'react';
import { ScrollView, View, Image, TouchableOpacity, Text } from 'react-native';
import { logoDevImageSource } from '../../../../config/logodev';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../../shared/theme/ThemeContext';

interface Account {
  id: string;
  name: string;
  logo: string;
  type?: 'Broker' | 'Exchange' | 'Web3 Wallet'; // 可選的帳戶類型標籤
}

interface AccountCapsulesProps {
  accounts: Account[];
  selectedAccountId: string | null;
  onSelectAccount: (accountId: string | null) => void;
  onAddAccount?: () => void;
}

export default function AccountCapsules({ accounts, selectedAccountId, onSelectAccount, onAddAccount }: AccountCapsulesProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16, gap: 12 }}
    >
      <TouchableOpacity
        onPress={() => onSelectAccount(null)}
        style={{
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderRadius: 20,
          backgroundColor: selectedAccountId === null ? colors.primary : colors.surface,
          borderWidth: 1,
          borderColor: selectedAccountId === null ? colors.primary : colors.border,
        }}
      >
        <Text style={{ color: selectedAccountId === null ? colors.textInverse : colors.text, fontSize: 13, fontWeight: '600' }}>{t('investments.all')}</Text>
      </TouchableOpacity>

      {accounts.map((account) => (
        <TouchableOpacity
          key={account.id}
          onPress={() => onSelectAccount(account.id)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 16,
            backgroundColor: selectedAccountId === account.id ? colors.primary : colors.surface,
            borderWidth: 1,
            borderColor: selectedAccountId === account.id ? colors.primary : colors.border,
            gap: 8,
          }}
        >
          {account.logo ? (
            <Image
              source={logoDevImageSource(account.logo) ?? { uri: account.logo }}
              style={{ width: 20, height: 20, borderRadius: 10 }}
              resizeMode="contain"
            />
          ) : (
            <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: selectedAccountId === account.id ? 'rgba(255,255,255,0.25)' : colors.surfaceInput }} />
          )}
          <Text style={{ color: selectedAccountId === account.id ? colors.textInverse : colors.text, fontSize: 12, fontWeight: '600' }}>
            {account.name}
          </Text>
        </TouchableOpacity>
      ))}

      <TouchableOpacity
        onPress={onAddAccount}
        style={{
          paddingHorizontal: 16,
          paddingVertical: 8,
          borderRadius: 16,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: colors.primary, fontSize: 16, fontWeight: '600' }}>+</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
