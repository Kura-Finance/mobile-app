import React, { useMemo } from 'react';
import { ScrollView, View, Image, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { logoDevImageSource } from '../../../../config/logodev';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../../shared/theme/theme';

interface Account {
  id: string;
  name: string;
  logo: string;
  type?: 'Broker' | 'Exchange' | 'Web3 Wallet';
}

interface AccountCapsulesProps {
  accounts: Account[];
  selectedAccountId: string | null;
  onSelectAccount: (accountId: string | null) => void;
  onAddAccount?: () => void;
  horizontalPadding?: number;
}

export default function AccountCapsules({
  accounts,
  selectedAccountId,
  onSelectAccount,
  onAddAccount,
  horizontalPadding = 16,
}: AccountCapsulesProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const st = useMemo(() => makeStyles(colors), [colors]);

  const capsuleStyle = (selected: boolean) => [
    st.capsule,
    selected ? st.capsuleSelected : st.capsuleUnselected,
  ];

  const labelStyle = (selected: boolean) => [
    st.label,
    selected ? st.labelSelected : st.labelUnselected,
  ];

  return (
    <ScrollView
      horizontal
      nestedScrollEnabled
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[st.scrollContent, { paddingHorizontal: horizontalPadding }]}
    >
      <TouchableOpacity
        onPress={() => onSelectAccount(null)}
        activeOpacity={0.85}
        style={[capsuleStyle(selectedAccountId === null), st.chip]}
      >
        <Text style={labelStyle(selectedAccountId === null)}>{t('investments.all')}</Text>
      </TouchableOpacity>

      {accounts.map((account) => {
        const selected = selectedAccountId === account.id;
        return (
          <TouchableOpacity
            key={account.id}
            onPress={() => onSelectAccount(account.id)}
            activeOpacity={0.85}
            style={[capsuleStyle(selected), st.chip, st.accountCapsule]}
          >
            {account.logo ? (
              <Image
                source={logoDevImageSource(account.logo) ?? { uri: account.logo }}
                style={st.logo}
                resizeMode="contain"
              />
            ) : (
              <View style={[st.logoPlaceholder, selected && st.logoPlaceholderSelected]} />
            )}
            <Text style={[labelStyle(selected), st.accountLabel]}>
              {account.name}
            </Text>
          </TouchableOpacity>
        );
      })}

      {onAddAccount ? (
        <TouchableOpacity
          onPress={onAddAccount}
          activeOpacity={0.85}
          style={[st.capsule, st.capsuleUnselected, st.chip, st.addCapsule]}
        >
          <Text style={st.addLabel}>+</Text>
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    scrollContent: {
      paddingBottom: 4,
      gap: 8,
    },
    chip: {
      flexShrink: 0,
      flexGrow: 0,
    },
    capsule: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: StyleSheet.hairlineWidth,
    },
    capsuleSelected: {
      backgroundColor: c.primary,
      borderColor: c.primary,
    },
    capsuleUnselected: {
      backgroundColor: c.surface,
      borderColor: c.border,
    },
    accountCapsule: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    accountLabel: {
      flexShrink: 0,
    },
    label: {
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 18,
    },
    labelSelected: {
      color: c.textInverse,
    },
    labelUnselected: {
      color: c.text,
    },
    logo: {
      width: 20,
      height: 20,
      borderRadius: 10,
    },
    logoPlaceholder: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: c.surfaceInput,
    },
    logoPlaceholderSelected: {
      backgroundColor: 'rgba(255,255,255,0.25)',
    },
    addCapsule: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 16,
    },
    addLabel: {
      color: c.primary,
      fontSize: 18,
      fontWeight: '600',
      lineHeight: 20,
    },
  });
}
