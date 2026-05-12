/**
 * StocksView
 *
 * Content for the Portfolio → "Stocks" tab. Renders the Dinari gating flow
 * (KYC → wallet connect) and, once ready, a stock portfolio list mirroring the
 * crypto view. Tapping a stock opens the Revolut-style {@link StockDetailModal}.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useDinariGate, useDinariStocks, StockItem } from '../hooks/useDinari';
import StockLogo from '../components/StockLogo';
import KycWebViewModal from '../modals/KycWebViewModal';
import StockDetailModal from '../modals/StockDetailModal';
import AssetClassToggle, { AssetClass } from '../../crypto/components/AssetClassToggle';
import type { UseKuraCardWalletReturn } from '../../card/hooks/useKuraCardWallet';
import { useTheme } from '../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../shared/theme/theme';
import { useMoneyFormat } from '../../../shared/hooks/useMoneyFormat';
import { useHideBalance } from '../../../shared/hooks/useHideBalance';
import { formatSensitiveUsd } from '../../../shared/utils/privacyDisplay';

function useStyles() {
  const { colors } = useTheme();
  return useMemo(() => makeStyles(colors), [colors]);
}

/** USDC balance is shown under an explicit "USDC" label, so keep it in USD. */

interface Props {
  assetClass: AssetClass;
  onChangeAssetClass: (v: AssetClass) => void;
  scaAddress: string;
  usdcBalance: number;
  signMessage: UseKuraCardWalletReturn['signMessage'];
  signTypedData: UseKuraCardWalletReturn['signTypedData'];
  headerAction?: React.ReactNode;
}

// ─────────────────────────────────────────────────────────────────────────────
// Row
// ─────────────────────────────────────────────────────────────────────────────

function StockRow({ item, onPress }: { item: StockItem; onPress: (s: StockItem) => void }) {
  const st = useStyles();
  const money = useMoneyFormat();
  const hasHoldings = item.holdings > 0;
  return (
    <TouchableOpacity style={st.row} onPress={() => onPress(item)} activeOpacity={0.65}>
      <StockLogo symbol={item.symbol} size={44} />
      <View style={st.mid}>
        <View style={st.nameRow}>
          <Text style={st.symbol}>{item.symbol}</Text>
          <View style={st.tradePill}><Text style={st.tradePillText}>Trade</Text></View>
        </View>
        <Text style={st.name} numberOfLines={1}>{item.name}</Text>
      </View>
      <View style={st.right}>
        {hasHoldings ? (
          <>
            <Text style={st.value}>{money.compact(item.value)}</Text>
            <Text style={st.holdings}>{item.holdings.toLocaleString('en-US', { maximumFractionDigits: 4 })}</Text>
          </>
        ) : (
          <Text style={st.price}>{item.price > 0 ? money.price(item.price) : '—'}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Gating panels
// ─────────────────────────────────────────────────────────────────────────────

function CenterPanel({
  icon,
  title,
  subtitle,
  cta,
  onPress,
  busy,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  cta?: string;
  onPress?: () => void;
  busy?: boolean;
}) {
  const st = useStyles();
  const { colors } = useTheme();
  return (
    <View style={st.panel}>
      <View style={st.panelIcon}>
        <Ionicons name={icon} size={26} color={colors.primary} />
      </View>
      <Text style={st.panelTitle}>{title}</Text>
      <Text style={st.panelSub}>{subtitle}</Text>
      {cta && onPress && (
        <TouchableOpacity style={st.panelBtn} onPress={onPress} disabled={busy} activeOpacity={0.85}>
          {busy ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={st.panelBtnText}>{cta}</Text>}
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// StocksView
// ─────────────────────────────────────────────────────────────────────────────

export default function StocksView({
  assetClass,
  onChangeAssetClass,
  scaAddress,
  usdcBalance,
  signMessage,
  signTypedData,
  headerAction,
}: Props) {
  const st = useStyles();
  const { colors } = useTheme();
  const money = useMoneyFormat();
  const hideBalance = useHideBalance();
  const gate = useDinariGate(scaAddress, signMessage);
  const ready = gate.state === 'ready';
  const { stocks, totalValue, loading, refreshing, error, refresh } = useDinariStocks(ready);

  const [showKyc, setShowKyc] = useState(false);
  const [selected, setSelected] = useState<StockItem | null>(null);

  const handleStartKyc = useCallback(() => setShowKyc(true), []);

  // ── Gating states ──────────────────────────────────────────────────────────
  // Each gating state still renders the Crypto/Stock toggle on top so the user
  // can switch back to crypto without being stranded.
  let gateNode: React.ReactNode = null;

  if (gate.state === 'checking') {
    gateNode = (
      <View style={st.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={st.loadingText}>Loading stocks…</Text>
      </View>
    );
  } else if (gate.state === 'unsupported') {
    gateNode = (
      <CenterPanel
        icon="time-outline"
        title="US Stocks — coming soon"
        subtitle={
          gate.error
            ? `Stock trading isn't available yet. ${gate.error}`
            : 'Tokenized US stocks (dShares) powered by Dinari will be available here soon.'
        }
        cta="Retry"
        onPress={gate.resolve}
      />
    );
  } else if (gate.state === 'kyc') {
    gateNode = (
      <>
        <CenterPanel
          icon="shield-checkmark-outline"
          title="Verify your identity"
          subtitle="To trade tokenized US stocks, Dinari requires a one-time identity verification (separate from your fiat KYC)."
          cta="Start verification"
          onPress={handleStartKyc}
        />
        <KycWebViewModal
          visible={showKyc}
          getUrl={() => gate.startKyc()}
          onCheck={async () => {
            const ent = await gate.refreshEntity();
            return !!ent?.canTransact;
          }}
          onClose={() => setShowKyc(false)}
        />
      </>
    );
  } else if (gate.state === 'connect') {
    gateNode = (
      <CenterPanel
        icon="link-outline"
        title="Connect your wallet"
        subtitle="Link your Kura smart account to Dinari to fund stock trades with your USDC balance. You'll sign a quick message — no transaction."
        cta="Connect wallet"
        onPress={() => { gate.connectWallet().catch(() => undefined); }}
        busy={gate.connecting}
      />
    );
  }

  if (gateNode) {
    return (
      <View style={st.flex}>
        <View style={[st.card, { marginTop: 16 }]}>
          <View style={st.colHeader}>
            <Text style={[st.colLabel, { flex: 1 }]}>Stock</Text>
            <AssetClassToggle value={assetClass} onChange={onChangeAssetClass} />
            <Text style={[st.colLabel, { flex: 1, textAlign: 'right' }]}>Holdings</Text>
          </View>
          {gateNode}
        </View>
      </View>
    );
  }

  // ── Ready: portfolio list ────────────────────────────────────────────────
  return (
    <View style={st.flex}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        <View style={st.header}>
          <View>
            <Text style={st.headerLabel}>Stocks value</Text>
            <Text style={st.headerValue}>{money.compact(totalValue)}</Text>
          </View>
          <View style={st.headerRight}>
            {headerAction}
            <View style={st.cashPill}>
              <Text style={st.cashLabel}>USDC</Text>
              <Text style={st.cashValue}>{formatSensitiveUsd(usdcBalance, hideBalance)}</Text>
            </View>
          </View>
        </View>

        {error && (
          <View style={st.errorBox}>
            <Ionicons name="alert-circle-outline" size={15} color={colors.danger} />
            <Text style={st.errorText}>{error}</Text>
          </View>
        )}

        {loading && stocks.length === 0 ? (
          <View style={st.centered}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={st.loadingText}>Loading stocks…</Text>
          </View>
        ) : (
          <View style={st.card}>
            <View style={st.colHeader}>
              <Text style={[st.colLabel, { flex: 1 }]}>Stock</Text>
              <AssetClassToggle value={assetClass} onChange={onChangeAssetClass} />
              <Text style={[st.colLabel, { flex: 1, textAlign: 'right' }]}>Holdings</Text>
            </View>
            {stocks.map((item) => (
              <StockRow key={item.id} item={item} onPress={setSelected} />
            ))}
          </View>
        )}

        <Text style={st.sourceNote}>Tokenized stocks (dShares) · powered by Dinari</Text>
      </ScrollView>

      <StockDetailModal
        visible={!!selected}
        stock={selected}
        usdcBalance={usdcBalance}
        scaAddress={scaAddress}
        signTypedData={signTypedData}
        onClose={() => setSelected(null)}
        onTraded={refresh}
      />
    </View>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    flex: { flex: 1 },
    centered: { alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 48 },
    loadingText: { color: c.textMuted, fontSize: 13 },

    // Gating panel (rendered inside the asset card)
    panel: { alignItems: 'center', paddingHorizontal: 28, paddingVertical: 32, gap: 14 },
    panelIcon: {
      width: 64, height: 64, borderRadius: 32, backgroundColor: c.primarySoft,
      borderWidth: 1, borderColor: c.primarySoft, alignItems: 'center', justifyContent: 'center',
    },
    panelTitle: { color: c.text, fontSize: 18, fontWeight: '700', textAlign: 'center' },
    panelSub: { color: c.textMuted, fontSize: 14, lineHeight: 21, textAlign: 'center' },
    panelBtn: {
      marginTop: 8, height: 52, borderRadius: 14, backgroundColor: c.primary,
      paddingHorizontal: 32, minWidth: 200, alignItems: 'center', justifyContent: 'center',
    },
    panelBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

    // Header
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 20, paddingTop: 20, paddingBottom: 20,
    },
    headerLabel: { color: c.textMuted, fontSize: 13, marginBottom: 4 },
    headerValue: { color: c.text, fontSize: 36, fontWeight: '700', letterSpacing: -1 },
    headerRight: { alignItems: 'flex-end', gap: 8 },
    cashPill: {
      alignItems: 'flex-end', backgroundColor: c.surfaceAlt, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8,
      borderWidth: StyleSheet.hairlineWidth, borderColor: c.border,
    },
    cashLabel: { color: c.textMuted, fontSize: 10, fontWeight: '600', letterSpacing: 0.5 },
    cashValue: { color: c.text, fontSize: 15, fontWeight: '700' },

    errorBox: {
      flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 20, marginBottom: 12,
      backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)',
      paddingHorizontal: 12, paddingVertical: 10,
    },
    errorText: { color: c.danger, fontSize: 12, flex: 1 },

    card: {
      marginHorizontal: 16, backgroundColor: c.surfaceAlt, borderRadius: 20, overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth, borderColor: c.border,
    },
    colHeader: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border,
    },
    colLabel: { color: c.textFaint, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },

    row: {
      flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border, gap: 12,
    },
    mid: { flex: 1, gap: 4 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    symbol: { color: c.text, fontSize: 15, fontWeight: '700' },
    tradePill: {
      backgroundColor: c.primarySoft, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
      borderWidth: 1, borderColor: c.primarySoft,
    },
    tradePillText: { color: c.primary, fontSize: 9, fontWeight: '700', letterSpacing: 0.3 },
    name: { color: c.textMuted, fontSize: 12, fontWeight: '500' },
    right: { alignItems: 'flex-end', gap: 3 },
    value: { color: c.text, fontSize: 15, fontWeight: '700' },
    holdings: { color: c.textMuted, fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
    price: { color: c.textMuted, fontSize: 14, fontWeight: '600' },

    sourceNote: { color: c.textFaint, fontSize: 11, textAlign: 'center', marginTop: 16 },
  });
}
