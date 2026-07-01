import LoadingDots from '../../../shared/components/LoadingDots';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
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
  getOrCreateCryptoDepositAddress,
  formatDepositFeeLabel,
  type KycLinkRequest,
  type LiquidationAddressResult,
} from '../../../lib/api/ramp/client';
import { openBridgeHostedKycFlow } from '../../../lib/api/ramp/hostedFlow';
import KycVerificationCard from '../components/KycVerificationCard';
import DepositBulletList from '../components/DepositBulletList';
import { buildUsdtDepositBullets } from '../config/receiveDepositBullets';
import { useBridgeCustomer } from '../hooks/useBridgeCustomer';

interface UsdtReceivePanelProps {
  smartAddress: string;
}

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
  const authToken = useAppStore((st) => st.authToken);

  const {
    customer,
    loadingCustomer,
    refreshCustomer: fetchBridgeCustomer,
  } = useBridgeCustomer({ enabled: !!authToken });
  const [creatingKyc, setCreatingKyc] = useState(false);

  const [depositAddress, setDepositAddress] = useState<LiquidationAddressResult | null>(null);
  const [loadingAddress, setLoadingAddress] = useState(false);

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [error, setError] = useState('');

  const refreshCustomer = useCallback(async () => {
    setError('');
    try {
      await fetchBridgeCustomer();
    } catch (e) {
      setError(errMessage(e));
    }
  }, [fetchBridgeCustomer]);

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

  useEffect(() => {
    if (!customer?.canTransact) return;
    if (depositAddress || loadingAddress) return;
    void loadDepositAddress();
  }, [customer?.canTransact, depositAddress, loadingAddress, loadDepositAddress]);

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

  const renderBody = () => {
    if (loadingCustomer) {
      return (
        <View style={{ alignItems: 'center', paddingVertical: 32 }}>
          <LoadingDots color={colors.primary} size={8}   />
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
            <LoadingDots color={colors.primary} size={8}   />
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
      return renderDepositInstructions();
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
