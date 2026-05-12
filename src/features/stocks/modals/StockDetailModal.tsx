/**
 * StockDetailModal
 *
 * Revolut-style detail page for a Dinari dShare: header · price · balance ·
 * live quote (bid/ask/spread) · fixed Sell / Buy bar that opens a
 * {@link StockTradeSheet}.
 *
 * Dinari does not expose historical candles in the proxy spec, so this view
 * shows the live price and quote rather than a chart.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import StockTradeSheet, { TradeSide } from './StockTradeSheet';
import StockLogo from '../components/StockLogo';
import { StockItem } from '../hooks/useDinari';
import { getStockQuote, DinariStockQuote } from '../../../lib/api/dinari/client';
import type { UseKuraCardWalletReturn } from '../../card/hooks/useKuraCardWallet';
import { useTheme } from '../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../shared/theme/theme';
import { useHideBalance } from '../../../shared/hooks/useHideBalance';
import { formatSensitiveUsd } from '../../../shared/utils/privacyDisplay';

function useStyles() {
  const { colors } = useTheme();
  return useMemo(() => makeStyles(colors), [colors]);
}

function formatPrice(n: number): string {
  if (!Number.isFinite(n) || n === 0) return '—';
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface Props {
  visible: boolean;
  stock: StockItem | null;
  usdcBalance: number;
  scaAddress: string;
  signTypedData: UseKuraCardWalletReturn['signTypedData'];
  onClose: () => void;
  onTraded?: () => void;
}

export default function StockDetailModal({
  visible,
  stock,
  usdcBalance,
  scaAddress,
  signTypedData,
  onClose,
  onTraded,
}: Props) {
  const insets = useSafeAreaInsets();
  const st = useStyles();
  const { colors } = useTheme();
  const hideBalance = useHideBalance();
  const [starred, setStarred] = useState(false);
  const [tradeSide, setTradeSide] = useState<TradeSide | null>(null);
  const [quote, setQuote] = useState<DinariStockQuote | null>(null);

  useEffect(() => {
    if (!visible || !stock) { setQuote(null); return; }
    let active = true;
    getStockQuote(stock.id)
      .then((q) => { if (active) setQuote(q); })
      .catch(() => { /* quote is best-effort */ });
    return () => { active = false; };
  }, [visible, stock]);

  if (!stock) return null;

  const holdingValue = stock.holdings * stock.price;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={st.root}>
        <View style={[st.topBar, { paddingTop: insets.top + 6 }]}>
          <TouchableOpacity onPress={onClose} style={st.iconBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={st.topTitle}>{stock.symbol}</Text>
          <TouchableOpacity onPress={() => setStarred((s) => !s)} style={st.iconBtn} activeOpacity={0.7}>
            <Ionicons name={starred ? 'star' : 'star-outline'} size={18} color={starred ? '#F5AC37' : colors.textMuted} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
          {/* Header */}
          <View style={st.header}>
            <View style={st.logoWrap}>
              <StockLogo symbol={stock.symbol} size={52} />
            </View>
            <Text style={st.name}>{stock.name}</Text>
            <Text style={st.bigPrice}>{formatPrice(stock.price)}</Text>
            <View style={st.tokenizedPill}>
              <Ionicons name="link-outline" size={11} color={colors.primary} />
              <Text style={st.tokenizedText}>Tokenized stock · dShare on Base</Text>
            </View>
          </View>

          {/* Balance card */}
          {stock.holdings > 0 && (
            <View style={st.card}>
              <Text style={st.cardLabel}>Balance</Text>
              <Text style={st.cardValue}>{formatSensitiveUsd(holdingValue, hideBalance)}</Text>
              <Text style={st.cardSub}>
                {stock.holdings.toLocaleString('en-US', { maximumFractionDigits: 6 })} {stock.symbol}
              </Text>
            </View>
          )}

          {/* Quote */}
          <Text style={st.sectionTitle}>Quote</Text>
          <View style={st.statsCard}>
            <StatRow label="Last price" value={formatPrice(stock.price)} />
            <StatRow label="Bid" value={quote?.bid != null ? formatPrice(quote.bid) : '—'} />
            <StatRow label="Ask" value={quote?.ask != null ? formatPrice(quote.ask) : '—'} />
            <StatRow
              label="Spread"
              value={quote?.spread != null ? formatPrice(quote.spread) : '—'}
              last
            />
          </View>

          {/* About */}
          <Text style={st.sectionTitle}>About</Text>
          <Text style={st.about}>
            {stock.name} ({stock.symbol}) is available as a Dinari dShare — a tokenized
            stock backed 1:1 and settled on Base. Buy and sell fractional shares with your
            USDC balance. Market orders fill during US market hours; orders placed after
            hours or on weekends are queued or rejected by Dinari.
          </Text>
        </ScrollView>

        {/* Action bar */}
        <View style={[st.actionBar, { paddingBottom: insets.bottom + 10 }]}>
          <TouchableOpacity
            style={[st.sellBtn, stock.holdings <= 0 && st.sellDisabled]}
            onPress={() => setTradeSide('sell')}
            disabled={stock.holdings <= 0}
            activeOpacity={0.85}
          >
            <Ionicons name="remove-circle-outline" size={20} color={stock.holdings > 0 ? colors.text : colors.textFaint} />
            <Text style={[st.sellText, stock.holdings <= 0 && st.disabledText]}>Sell</Text>
          </TouchableOpacity>
          <TouchableOpacity style={st.buyBtn} onPress={() => setTradeSide('buy')} activeOpacity={0.85}>
            <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
            <Text style={st.buyText}>Buy</Text>
          </TouchableOpacity>
        </View>

        <StockTradeSheet
          visible={tradeSide !== null}
          side={tradeSide ?? 'buy'}
          stock={stock}
          usdcBalance={usdcBalance}
          scaAddress={scaAddress}
          signTypedData={signTypedData}
          onClose={() => setTradeSide(null)}
          onTraded={onTraded}
        />
      </View>
    </Modal>
  );
}

function StatRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  const st = useStyles();
  return (
    <View style={[st.statRow, last && st.statRowLast]}>
      <Text style={st.statLabel}>{label}</Text>
      <Text style={st.statValue}>{value}</Text>
    </View>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    topBar: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingBottom: 8,
    },
    topTitle: { color: c.text, fontSize: 17, fontWeight: '700' },
    iconBtn: {
      width: 38, height: 38, borderRadius: 19, backgroundColor: c.surface,
      borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center',
    },

    header: { paddingHorizontal: 20, paddingTop: 8, gap: 8 },
    logoWrap: { marginBottom: 4 },
    name: { color: c.textMuted, fontSize: 15, fontWeight: '600' },
    bigPrice: { color: c.text, fontSize: 34, fontWeight: '800', letterSpacing: -1 },
    tokenizedPill: {
      flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
      backgroundColor: c.primarySoft, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
      borderWidth: 1, borderColor: c.primarySoft,
    },
    tokenizedText: { color: c.primaryOnSoft, fontSize: 11, fontWeight: '600' },

    card: {
      marginHorizontal: 16, marginTop: 22, backgroundColor: c.surfaceAlt, borderRadius: 18,
      borderWidth: StyleSheet.hairlineWidth, borderColor: c.border, padding: 18,
    },
    cardLabel: { color: c.textMuted, fontSize: 13, fontWeight: '600', marginBottom: 6 },
    cardValue: { color: c.text, fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
    cardSub: { color: c.textMuted, fontSize: 14, marginTop: 2 },

    sectionTitle: {
      color: c.text, fontSize: 19, fontWeight: '700',
      paddingHorizontal: 20, marginTop: 28, marginBottom: 12,
    },
    statsCard: {
      marginHorizontal: 16, backgroundColor: c.surfaceAlt, borderRadius: 18,
      borderWidth: StyleSheet.hairlineWidth, borderColor: c.border, paddingHorizontal: 16,
    },
    statRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border,
    },
    statRowLast: { borderBottomWidth: 0 },
    statLabel: { color: c.textMuted, fontSize: 14, fontWeight: '500' },
    statValue: { color: c.text, fontSize: 15, fontWeight: '700' },

    about: { color: c.textMuted, fontSize: 14, lineHeight: 21, paddingHorizontal: 20 },

    actionBar: {
      flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingTop: 12,
      backgroundColor: c.background, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border,
    },
    sellBtn: {
      flex: 1, height: 54, borderRadius: 16, backgroundColor: c.surfaceInput,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    },
    sellDisabled: { backgroundColor: c.surface },
    sellText: { color: c.text, fontSize: 16, fontWeight: '700' },
    buyBtn: {
      flex: 1, height: 54, borderRadius: 16, backgroundColor: c.primary,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    },
    buyText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
    disabledText: { color: c.textFaint },
  });
}
