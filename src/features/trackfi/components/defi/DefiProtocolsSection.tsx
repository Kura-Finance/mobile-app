import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../../shared/theme/theme';
import { useMoneyFormat } from '../../../../shared/hooks/useMoneyFormat';
import { useHideBalance } from '../../../../shared/hooks/useHideBalance';
import { HIDDEN_BALANCE_TEXT } from '../../../../shared/utils/privacyDisplay';
import { effectiveProtocolDisplayUsd } from '../../../../lib/api/debank/portfolioTotals';
import type { DefiProtocol, ProtocolPortfolioItem } from '../../hooks/useDefiPortfolio';

interface Props {
  protocols: DefiProtocol[];
}

function protocolKey(protocol: DefiProtocol): string {
  return `${protocol.chain}-${protocol.id}`;
}

function protocolTypeLabel(type: string, t: ReturnType<typeof useTranslation>['t']): string {
  const lower = type.toLowerCase();
  if (lower.includes('lend') || lower.includes('supply')) return t('trackfi.defi.protocolLending');
  if (lower.includes('stake')) return t('trackfi.defi.protocolStaking');
  if (lower.includes('liquidity')) return t('trackfi.defi.protocolLiquidity');
  return type;
}

function positionTypeLabel(type: string, t: ReturnType<typeof useTranslation>['t']): string {
  const lower = type.toLowerCase();
  if (lower.includes('borrow') || lower.includes('debt')) return t('trackfi.defi.positionBorrowed');
  if (lower.includes('reward')) return t('trackfi.defi.positionReward');
  if (lower.includes('stake')) return t('trackfi.defi.positionStaked');
  if (lower.includes('supply') || lower.includes('lend') || lower.includes('deposit')) {
    return t('trackfi.defi.positionSupplied');
  }
  if (lower.includes('liquidity')) return t('trackfi.defi.positionLiquidity');
  return type;
}

function isDebtPosition(type: string): boolean {
  return /borrow|debt/i.test(type);
}

function countPositions(protocol: DefiProtocol): number {
  return protocol.portfolioItems.reduce(
    (sum, item) => sum + Math.max(1, item.tokens.length),
    0,
  );
}

function formatAmount(amount: number): string {
  if (Math.abs(amount) < 0.001) return amount.toExponential(2);
  return amount.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function PositionRow({
  symbol,
  logoUrl,
  positionType,
  amount,
  usdValue,
  isDebt,
}: {
  symbol: string;
  logoUrl: string | null;
  positionType: string;
  amount: number | null;
  usdValue: number;
  isDebt: boolean;
}) {
  const { colors } = useTheme();
  const money = useMoneyFormat();
  const hideBalance = useHideBalance();
  const st = useMemo(() => makePositionStyles(colors), [colors]);
  const valueColor = isDebt ? colors.danger : colors.text;

  return (
    <View style={st.row}>
      {logoUrl ? (
        <Image source={{ uri: logoUrl }} style={st.logo} />
      ) : (
        <View style={[st.logo, st.logoFallback]}>
          <Text style={st.logoText}>{symbol.slice(0, 2)}</Text>
        </View>
      )}
      <View style={st.meta}>
        <Text style={st.symbol}>{symbol}</Text>
        <Text style={st.positionType} numberOfLines={1}>{positionType}</Text>
      </View>
      <View style={st.right}>
        {amount != null ? (
          <Text style={[st.amount, isDebt && { color: colors.danger }]}>
            {hideBalance ? HIDDEN_BALANCE_TEXT : formatAmount(amount)}
          </Text>
        ) : null}
        <Text style={[st.valueText, { color: hideBalance ? colors.text : valueColor }]}>
          {hideBalance ? HIDDEN_BALANCE_TEXT : money.compact(usdValue)}
        </Text>
      </View>
    </View>
  );
}

function ProtocolPositions({ items }: { items: ProtocolPortfolioItem[] }) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const rows = useMemo(() => {
    const out: Array<{
      key: string;
      symbol: string;
      logoUrl: string | null;
      positionType: string;
      amount: number | null;
      usdValue: number;
      isDebt: boolean;
    }> = [];

    for (const item of items) {
      const typeLabel = positionTypeLabel(item.type, t);
      const debt = isDebtPosition(item.type);

      if (item.tokens.length === 0) {
        out.push({
          key: `${item.type}-summary`,
          symbol: typeLabel,
          logoUrl: null,
          positionType: typeLabel,
          amount: null,
          usdValue: item.usdValue,
          isDebt: debt,
        });
        continue;
      }

      for (const token of item.tokens) {
        out.push({
          key: `${item.type}-${token.symbol}-${token.amount}`,
          symbol: token.symbol,
          logoUrl: token.logoUrl,
          positionType: typeLabel,
          amount: token.amount,
          usdValue: token.usdValue,
          isDebt: debt,
        });
      }
    }

    return out.sort((a, b) => Math.abs(b.usdValue) - Math.abs(a.usdValue));
  }, [items, t]);

  if (rows.length === 0) {
    return (
      <Text style={{ color: colors.textMuted, fontSize: 13, textAlign: 'center', paddingVertical: 16 }}>
        {t('trackfi.defi.noProtocolPositions')}
      </Text>
    );
  }

  return (
    <>
      {rows.map((row) => (
        <PositionRow
          key={row.key}
          symbol={row.symbol}
          logoUrl={row.logoUrl}
          positionType={row.positionType}
          amount={row.amount}
          usdValue={row.usdValue}
          isDebt={row.isDebt}
        />
      ))}
    </>
  );
}

function ExpandableProtocol({
  protocol,
  expanded,
  onToggle,
}: {
  protocol: DefiProtocol;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const money = useMoneyFormat();
  const hideBalance = useHideBalance();
  const st = useMemo(() => makeProtocolStyles(colors), [colors]);

  const primaryType = protocol.portfolioItems[0]?.type ?? 'DeFi';
  const displayUsd = effectiveProtocolDisplayUsd(protocol);
  const positionCount = countPositions(protocol);

  return (
    <View style={st.card}>
      <TouchableOpacity style={st.header} onPress={onToggle} activeOpacity={0.7}>
        <View style={st.headerLeft}>
          {protocol.logoUrl ? (
            <Image source={{ uri: protocol.logoUrl }} style={st.logo} />
          ) : (
            <View style={[st.logo, st.logoFallback]}>
              <Text style={st.logoText}>{protocol.name.slice(0, 2)}</Text>
            </View>
          )}
          <View style={st.meta}>
            <View style={st.nameRow}>
              <Text style={st.name} numberOfLines={1}>{protocol.name}</Text>
              <View style={st.chainTag}>
                <Text style={st.chainText}>
                  {t(`trackfi.defiPortfolio.chains.${protocol.chain}`, { defaultValue: protocol.chain.toUpperCase() })}
                </Text>
              </View>
            </View>
            <Text style={st.sub}>
              {protocolTypeLabel(primaryType, t)}
              {' · '}
              {t('trackfi.defi.positionCount', { count: positionCount })}
            </Text>
          </View>
        </View>
        <View style={st.headerRight}>
          <Text style={st.valueText}>
            {hideBalance ? HIDDEN_BALANCE_TEXT : money.compact(displayUsd)}
          </Text>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={colors.textFaint}
          />
        </View>
      </TouchableOpacity>

      {expanded ? (
        <View style={st.body}>
          <ProtocolPositions items={protocol.portfolioItems} />
        </View>
      ) : null}
    </View>
  );
}

export default function DefiProtocolsSection({ protocols }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const st = useMemo(() => makeStyles(colors), [colors]);
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});

  const toggle = (key: string) => {
    setExpandedKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const isEmpty = protocols.length === 0;

  return (
    <View style={st.wrap}>
      <Text style={st.title}>{t('trackfi.defi.protocolsTitle')}</Text>
      {isEmpty ? (
        <View style={st.emptyCard}>
          <Text style={st.emptyText}>{t('trackfi.defi.noProtocols')}</Text>
        </View>
      ) : (
        protocols.map((protocol) => {
          const key = protocolKey(protocol);
          return (
            <ExpandableProtocol
              key={key}
              protocol={protocol}
              expanded={expandedKeys[key] ?? false}
              onToggle={() => toggle(key)}
            />
          );
        })
      )}
    </View>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    wrap: { marginBottom: 16 },
    title: {
      color: c.text,
      fontSize: 18,
      fontWeight: '700',
      marginBottom: 12,
    },
    emptyCard: {
      backgroundColor: c.surfaceAlt,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    emptyText: {
      color: c.textMuted,
      fontSize: 13,
      textAlign: 'center',
      paddingVertical: 20,
      paddingHorizontal: 14,
    },
  });
}

function makeProtocolStyles(c: ThemeColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: c.surfaceAlt,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      marginBottom: 10,
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
      paddingVertical: 14,
      gap: 10,
    },
    headerLeft: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      minWidth: 0,
    },
    logo: {
      width: 36,
      height: 36,
      borderRadius: 10,
    },
    logoFallback: {
      backgroundColor: c.surfaceInput,
      alignItems: 'center',
      justifyContent: 'center',
    },
    logoText: {
      color: c.textMuted,
      fontSize: 9,
      fontWeight: '700',
    },
    meta: { flex: 1, minWidth: 0 },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    name: {
      color: c.text,
      fontSize: 15,
      fontWeight: '700',
      flexShrink: 1,
    },
    chainTag: {
      backgroundColor: c.surfaceInput,
      borderRadius: 4,
      paddingHorizontal: 5,
      paddingVertical: 1,
    },
    chainText: {
      color: c.textFaint,
      fontSize: 9,
      fontWeight: '700',
    },
    sub: {
      color: c.textMuted,
      fontSize: 11,
      marginTop: 2,
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    valueText: {
      color: c.text,
      fontSize: 14,
      fontWeight: '700',
    },
    body: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
      paddingBottom: 4,
    },
  });
}

function makePositionStyles(c: ThemeColors) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 14,
      gap: 10,
    },
    logo: {
      width: 32,
      height: 32,
      borderRadius: 16,
    },
    logoFallback: {
      backgroundColor: c.surfaceInput,
      alignItems: 'center',
      justifyContent: 'center',
    },
    logoText: {
      color: c.textMuted,
      fontSize: 10,
      fontWeight: '700',
    },
    meta: {
      flex: 1,
      minWidth: 0,
    },
    symbol: {
      color: c.text,
      fontSize: 14,
      fontWeight: '600',
    },
    positionType: {
      color: c.textFaint,
      fontSize: 11,
      marginTop: 2,
    },
    right: {
      alignItems: 'flex-end',
      gap: 2,
    },
    amount: {
      color: c.textMuted,
      fontSize: 12,
      fontWeight: '500',
    },
    valueText: {
      fontSize: 13,
      fontWeight: '700',
    },
  });
}
