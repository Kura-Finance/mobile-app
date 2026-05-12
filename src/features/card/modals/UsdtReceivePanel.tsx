import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Clipboard,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { makeModalStyles } from './modalStyles';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { useAppStore } from '../../../shared/store/useAppStore';
import { hasVerifiedEmail, needsEmailLink } from '../../../lib/api/auth/userProfileHelpers';
import { KuraApiError } from '../../../lib/api/errors';
import {
  getBridgeCustomer,
  getOrCreateCryptoDepositAddress,
  formatDepositFeeLabel,
  isCryptoTransferComplete,
  isCryptoTransferTerminal,
  listCryptoTransfers,
  listTransfers,
  type BridgeCustomer,
  type KycLinkRequest,
  type LiquidationAddressResult,
  type TransferResult,
} from '../../../lib/api/ramp/client';
import { openBridgeHostedKycFlow } from '../../../lib/api/ramp/hostedFlow';
import KycVerificationCard from '../components/KycVerificationCard';
import DepositBulletList from '../components/DepositBulletList';
import { buildUsdtDepositBullets } from '../config/receiveDepositBullets';

interface UsdtReceivePanelProps {
  smartAddress: string;
}

const CRYPTO_TRANSFER_STATUS: Record<string, { labelKey: string; color: string }> = {
  awaiting_funds: { labelKey: 'card.cryptoStatusAwaitingFunds', color: '#9CA3AF' },
  funds_received: { labelKey: 'card.cryptoStatusFundsReceived', color: '#FBBF24' },
  payment_submitted: { labelKey: 'card.cryptoStatusConverting', color: '#60A5FA' },
  payment_processed: { labelKey: 'card.statusCompleted', color: '#10B981' },
  returned: { labelKey: 'card.cryptoStatusReturned', color: '#EF4444' },
  refunded: { labelKey: 'card.statusRefunded', color: '#EF4444' },
  error: { labelKey: 'card.cryptoStatusFailed', color: '#EF4444' },
  canceled: { labelKey: 'card.cryptoStatusFailed', color: '#EF4444' },
};

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong. Please try again.';
}

function isScaMissingError(error: unknown): boolean {
  if (!(error instanceof KuraApiError)) return false;
  if (error.status !== 400) return false;
  const haystack = `${error.message} ${JSON.stringify(error.details ?? '')}`.toLowerCase();
  return haystack.includes('sca');
}

export default function UsdtReceivePanel({ smartAddress }: UsdtReceivePanelProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const s = useMemo(() => makeModalStyles(colors), [colors]);
  const userProfile = useAppStore((st) => st.userProfile);

  const [customer, setCustomer] = useState<BridgeCustomer | null>(null);
  const [loadingCustomer, setLoadingCustomer] = useState(true);
  const [creatingKyc, setCreatingKyc] = useState(false);

  const [depositAddress, setDepositAddress] = useState<LiquidationAddressResult | null>(null);
  const [loadingAddress, setLoadingAddress] = useState(false);

  const [transfers, setTransfers] = useState<TransferResult[]>([]);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [error, setError] = useState('');

  const refreshCustomer = useCallback(async () => {
    setLoadingCustomer(true);
    setError('');
    try {
      setCustomer(await getBridgeCustomer());
    } catch (e) {
      setError(errMessage(e));
    } finally {
      setLoadingCustomer(false);
    }
  }, []);

  const loadDepositAddress = useCallback(async () => {
    if (!smartAddress) {
      setError(t('card.usdtScaRequired'));
      return;
    }
    setError('');
    setLoadingAddress(true);
    try {
      const addr = await getOrCreateCryptoDepositAddress({ toAddress: smartAddress });
      setDepositAddress(addr);
    } catch (e) {
      if (isScaMissingError(e)) {
        setError(t('card.usdtScaRequired'));
        return;
      }
      if (e instanceof KuraApiError && e.status === 409) {
        setError(t('card.usdtKycRequired'));
        return;
      }
      if (e instanceof KuraApiError && e.status === 502) {
        setError(t('card.usdtBridgeUnavailable'));
        return;
      }
      setError(errMessage(e));
    } finally {
      setLoadingAddress(false);
    }
  }, [smartAddress, t]);

  const refreshTransfers = useCallback(async () => {
    try {
      const all = await listTransfers();
      setTransfers(
        listCryptoTransfers(all).sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ),
      );
    } catch {
      // Non-fatal: deposit history is best-effort.
    }
  }, []);

  useEffect(() => {
    void refreshCustomer();
  }, [refreshCustomer]);

  useEffect(() => {
    if (!customer?.canTransact) return;
    if (depositAddress || loadingAddress) return;
    void loadDepositAddress();
  }, [customer?.canTransact, depositAddress, loadingAddress, loadDepositAddress]);

  useEffect(() => {
    if (!customer?.canTransact) return;
    void refreshTransfers();
  }, [customer?.canTransact, refreshTransfers]);

  useEffect(() => {
    if (!customer?.canTransact) return;
    if (!transfers.some((tr) => !isCryptoTransferTerminal(tr))) return;
    const id = setInterval(() => void refreshTransfers(), 8000);
    return () => clearInterval(id);
  }, [customer?.canTransact, transfers, refreshTransfers]);

  const startKyc = useCallback(async (req: KycLinkRequest) => {
    if (req.type === 'individual' && !hasVerifiedEmail(userProfile)) {
      setError(t('card.linkEmailBeforeKyc'));
      return;
    }
    if (req.type === 'individual' && !req.email?.trim()) {
      setError(t('card.linkEmailBeforeKyc'));
      return;
    }
    setError('');
    setCreatingKyc(true);
    try {
      await openBridgeHostedKycFlow(req);
      await refreshCustomer();
    } catch (e) {
      setError(errMessage(e));
    } finally {
      setCreatingKyc(false);
    }
  }, [refreshCustomer, userProfile, t]);

  const copy = useCallback((key: string, value: string) => {
    Clipboard.setString(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 2000);
  }, []);

  const renderDepositInstructions = () => {
    if (!depositAddress) return null;

    const feeLabel = formatDepositFeeLabel(depositAddress.depositFee);
    const depositBullets = buildUsdtDepositBullets(t, {
      minDeposit: depositAddress.minDeposit,
      feeLabel,
    });

    const rows: { key: string; label: string; value: string }[] = [
      { key: 'network', label: t('card.usdtNetwork'), value: t('card.usdtNetworkTron') },
      { key: 'currency', label: t('card.usdtAsset'), value: 'USDT (TRC20)' },
      {
        key: 'depositAddress',
        label: t('card.usdtDepositAddress'),
        value: depositAddress.depositAddress,
      },
    ];

    return (
      <>
        <View style={s.qrWrapper}>
          <View style={s.qrBox}>
            <QRCode
              value={depositAddress.depositAddress || ' '}
              size={180}
              color="#0B0B0F"
              backgroundColor={colors.qrBackground}
            />
          </View>
        </View>

        <View style={s.dataCard}>
          {rows.map((r, i) => (
            <View key={r.key} style={[s.dataRow, i > 0 && s.dataRowBorder]}>
              <View style={{ flex: 1 }}>
                <Text style={s.dataLabel}>{r.label}</Text>
                <Text style={s.dataValue} selectable>
                  {r.value}
                </Text>
              </View>
              {r.key === 'depositAddress' ? (
                <TouchableOpacity
                  style={s.dataCopyBtn}
                  onPress={() => copy(r.key, r.value)}
                  hitSlop={8}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={copiedKey === r.key ? 'checkmark-circle' : 'copy-outline'}
                    size={18}
                    color={copiedKey === r.key ? colors.success : colors.textFaint}
                  />
                </TouchableOpacity>
              ) : null}
            </View>
          ))}
        </View>

        <Text style={s.depositNoteBelow}>{t('card.usdtDepositNote')}</Text>
        <DepositBulletList items={depositBullets} />
      </>
    );
  };

  const renderTransfers = () => {
    if (transfers.length === 0) return null;

    return (
      <View style={[s.fiatCard, { marginTop: 4 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text style={[s.fiatCardTitle, { marginBottom: 0, textAlign: 'left' }]}>
            {t('card.usdtRecentDeposits')}
          </Text>
          <TouchableOpacity onPress={() => void refreshTransfers()} hitSlop={8}>
            <Ionicons name="refresh" size={16} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {transfers.slice(0, 5).map((tr) => {
          const statusMeta = CRYPTO_TRANSFER_STATUS[tr.state];
          const meta = statusMeta
            ? { label: t(statusMeta.labelKey), color: statusMeta.color }
            : { label: tr.state, color: '#9CA3AF' };
          const amount = tr.amount;
          const currency = (tr.sourceCurrency ?? 'usdt').toUpperCase();
          return (
            <View key={tr.bridgeTransferId} style={s.depositRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.depositRowValue} numberOfLines={1}>
                  {amount ? `${amount} ${currency}` : '—'}
                </Text>
                <Text style={s.depositLabel}>
                  {new Date(tr.createdAt).toLocaleDateString()}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {!isCryptoTransferComplete(tr) && !isCryptoTransferTerminal(tr) ? (
                  <ActivityIndicator size="small" color={meta.color} />
                ) : null}
                <Text style={[s.statusPillText, { color: meta.color }]}>{meta.label}</Text>
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  const renderBody = () => {
    if (loadingCustomer) {
      return (
        <View style={{ alignItems: 'center', paddingVertical: 32 }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      );
    }

    if (!customer?.canTransact) {
      return (
        <KycVerificationCard
          customer={customer}
          defaultName={userProfile.displayName}
          defaultEmail={hasVerifiedEmail(userProfile) ? userProfile.email : ''}
          needsEmailLink={needsEmailLink(userProfile)}
          creating={creatingKyc}
          purpose={t('card.usdtKycPurpose')}
          onStartKyc={startKyc}
          onRefresh={refreshCustomer}
        />
      );
    }

    if (customer?.canTransact && !depositAddress) {
      if (loadingAddress || !error) {
        return (
          <View style={{ alignItems: 'center', paddingVertical: 32 }}>
            <ActivityIndicator color={colors.primary} />
            <Text style={[s.networkNote, { marginTop: 12 }]}>{t('card.usdtSettingUpAddress')}</Text>
          </View>
        );
      }

      return (
        <TouchableOpacity
          onPress={() => void loadDepositAddress()}
          activeOpacity={0.85}
          style={s.primaryBtn}
          disabled={loadingAddress}
        >
          <LinearGradient
            colors={['#7C3AED', '#4F46E5']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={s.primaryBtnGradient}
          >
            <Ionicons name="refresh-outline" size={17} color="#FFF" />
            <Text style={s.primaryBtnText}>{t('card.tryAgain')}</Text>
          </LinearGradient>
        </TouchableOpacity>
      );
    }

    if (depositAddress) {
      return (
        <>
          {renderDepositInstructions()}
          {renderTransfers()}
        </>
      );
    }

    return null;
  };

  return (
    <ScrollView
      style={{ flex: 1 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={s.subtitle}>{t('card.usdtReceiveSubtitle')}</Text>
      {error ? <Text style={s.errorText}>{error}</Text> : null}
      {renderBody()}
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}
