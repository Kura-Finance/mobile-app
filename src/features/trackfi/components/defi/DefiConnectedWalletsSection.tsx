import React, { useMemo } from 'react';
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
import { useMoneyFormat } from '../../../../shared/hooks/useMoneyFormat';
import { useHideBalance } from '../../../../shared/hooks/useHideBalance';
import { HIDDEN_BALANCE_TEXT } from '../../../../shared/utils/privacyDisplay';
import LoadingDots from '../../../../shared/components/LoadingDots';
import type { WalletData } from '../../hooks/useDefiPortfolio';
import { walletPortfolioTotal } from '../../hooks/useDefiPortfolio';

function truncAddr(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

interface Props {
  wallets: WalletData[];
  kuraAddress?: string | null;
  onConnect: () => void;
  onConnectKura: () => void;
  onRemove?: (address: string) => void;
  isConnecting: boolean;
  isConnectingKura: boolean;
  showKuraConnect: boolean;
}

function WalletRow({
  data,
  isKura,
  onRemove,
}: {
  data: WalletData;
  isKura: boolean;
  onRemove?: (address: string) => void;
}) {
  const { colors } = useTheme();
  const money = useMoneyFormat();
  const hideBalance = useHideBalance();
  const st = useMemo(() => makeRowStyles(colors), [colors]);

  return (
    <View style={st.row}>
      <View style={st.iconWrap}>
        <Ionicons name="wallet-outline" size={18} color={colors.primary} />
      </View>
      <View style={st.body}>
        <Text style={st.name}>{data.label ?? truncAddr(data.address)}</Text>
        <Text style={st.addr}>{truncAddr(data.address)}</Text>
      </View>
      <Text style={st.valueText}>
        {data.isLoading
          ? '…'
          : hideBalance
            ? HIDDEN_BALANCE_TEXT
            : money.compact(walletPortfolioTotal(data))}
      </Text>
      {isKura ? (
        <Ionicons name="checkmark-circle" size={18} color={colors.success} />
      ) : onRemove ? (
        <TouchableOpacity onPress={() => onRemove(data.address)} hitSlop={8}>
          <Ionicons name="close-circle-outline" size={18} color={colors.textFaint} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export default function DefiConnectedWalletsSection({
  wallets,
  kuraAddress,
  onConnect,
  onConnectKura,
  onRemove,
  isConnecting,
  isConnectingKura,
  showKuraConnect,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const st = useMemo(() => makeStyles(colors), [colors]);
  const kuraLower = kuraAddress?.toLowerCase();

  return (
    <View style={st.wrap}>
      <Text style={st.eyebrow}>{t('trackfi.defi.connectedWallet')}</Text>
      <View style={st.card}>
        {wallets.length === 0 ? (
          <View style={st.empty}>
            <Ionicons name="wallet-outline" size={28} color={colors.textFaint} />
            <Text style={st.emptyText}>{t('trackfi.defiPortfolio.emptyTitle')}</Text>
          </View>
        ) : (
          wallets.map((w) => (
            <WalletRow
              key={w.address}
              data={w}
              isKura={!!kuraLower && w.address.toLowerCase() === kuraLower}
              onRemove={onRemove}
            />
          ))
        )}

        <TouchableOpacity
          style={st.connectBtn}
          onPress={onConnect}
          disabled={isConnecting || isConnectingKura}
          activeOpacity={0.85}
        >
          {isConnecting ? (
            <LoadingDots compact color={colors.primary} size={6} />
          ) : (
            <>
              <Ionicons name="add" size={16} color={colors.primary} />
              <Text style={st.connectText}>{t('trackfi.defi.connectAnotherWallet')}</Text>
            </>
          )}
        </TouchableOpacity>

        {showKuraConnect ? (
          <TouchableOpacity
            style={st.connectBtnSecondary}
            onPress={onConnectKura}
            disabled={isConnecting || isConnectingKura}
            activeOpacity={0.85}
          >
            {isConnectingKura ? (
              <LoadingDots compact color={colors.primary} size={6} />
            ) : (
              <Text style={st.connectText}>{t('trackfi.defiPortfolio.connectKuraWallet')}</Text>
            )}
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    wrap: { marginBottom: 16 },
    eyebrow: {
      color: c.textFaint,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1.1,
      marginBottom: 12,
    },
    card: {
      backgroundColor: c.surfaceAlt,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      overflow: 'hidden',
    },
    empty: {
      alignItems: 'center',
      paddingVertical: 28,
      gap: 8,
    },
    emptyText: {
      color: c.textMuted,
      fontSize: 13,
    },
    connectBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      margin: 12,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.primary,
      borderStyle: 'dashed',
    },
    connectBtnSecondary: {
      alignItems: 'center',
      paddingVertical: 10,
      paddingBottom: 14,
    },
    connectText: {
      color: c.primary,
      fontSize: 13,
      fontWeight: '600',
    },
  });
}

function makeRowStyles(c: ThemeColors) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 14,
      gap: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    iconWrap: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: c.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    body: { flex: 1, minWidth: 0 },
    name: {
      color: c.text,
      fontSize: 14,
      fontWeight: '700',
    },
    addr: {
      color: c.textMuted,
      fontSize: 11,
      fontFamily: 'monospace',
      marginTop: 2,
    },
    valueText: {
      color: c.text,
      fontSize: 13,
      fontWeight: '700',
    },
  });
}
