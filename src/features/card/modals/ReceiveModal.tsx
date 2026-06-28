import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Clipboard,
  ScrollView,
  Animated,
  Dimensions,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import { makeModalStyles } from './modalStyles';
import FiatReceivePanel, { FIAT_OPTIONS } from './FiatReceivePanel';
import UsdtReceivePanel from './UsdtReceivePanel';
import MoonPayModal from './MoonPayModal';
import type { FiatCurrency } from '../../../lib/api/ramp/client';
import TokenLogo from '../../crypto/components/TokenLogo';
import { BLUE_CHIPS, USDT_DISPLAY } from '../../crypto/config/blueChips';
import { useTheme } from '../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../shared/theme/theme';

const USDC_TOKEN = BLUE_CHIPS.find((tk) => tk.symbol === 'USDC') ?? BLUE_CHIPS[0];

const SW = Dimensions.get('window').width;

interface ReceiveModalProps {
  visible: boolean;
  onClose: () => void;
  smartAddress: string;
  mode: 'topup' | 'receive';
}

type Screen = 'method' | 'fiatPick' | 'cryptoPick' | 'crypto' | 'usdtTron' | 'fiat';

export default function ReceiveModal({ visible, onClose, smartAddress, mode }: ReceiveModalProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const s = useMemo(() => makeModalStyles(colors), [colors]);
  const rs = useMemo(() => makeReceiveStyles(colors), [colors]);
  const [screen, setScreen] = useState<Screen>('method');
  const [selectedFiat, setSelectedFiat] = useState<FiatCurrency>('usd');
  const [copied, setCopied] = useState(false);
  const [moonpayOpen, setMoonpayOpen] = useState(false);

  const slideAnim = useRef(new Animated.Value(0)).current;
  const historyRef = useRef<Screen[]>([]);

  const fiatName = useCallback(
    (code: FiatCurrency) => t(`card.fiatName${code.charAt(0).toUpperCase()}${code.slice(1)}`),
    [t],
  );

  const navigate = useCallback(
    (next: Screen, dir: 'forward' | 'back' = 'forward') => {
      if (dir === 'forward') historyRef.current.push(screen);
      slideAnim.setValue(dir === 'forward' ? SW : -SW);
      setScreen(next);
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 120,
        friction: 16,
      }).start();
    },
    [screen, slideAnim],
  );

  const goBack = useCallback(() => {
    const prev = historyRef.current.pop() ?? 'method';
    navigate(prev, 'back');
  }, [navigate]);

  const reset = useCallback(() => {
    historyRef.current = [];
    setScreen('method');
    setCopied(false);
    slideAnim.setValue(0);
  }, [slideAnim]);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const copy = useCallback(() => {
    Clipboard.setString(smartAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [smartAddress]);

  const openFiat = useCallback(
    (code: FiatCurrency) => {
      setSelectedFiat(code);
      navigate('fiat');
    },
    [navigate],
  );

  const openMoonPay = useCallback(() => {
    setMoonpayOpen(true);
  }, []);

  // ── Nav bar title per screen ───────────────────────────────────────────────
  const selectedOption = FIAT_OPTIONS.find((o) => o.code === selectedFiat)!;
  const navTitle =
    screen === 'method'
      ? mode === 'topup'
        ? t('card.addFunds')
        : t('card.addMoney')
      : screen === 'fiatPick'
        ? t('card.addMoneyBankTransfer')
        : screen === 'cryptoPick'
          ? t('card.addMoneyCrypto')
          : screen === 'crypto'
            ? 'USDC'
            : screen === 'usdtTron'
              ? 'USDT'
              : `${selectedOption.flag}  ${selectedOption.label} ${t('card.account')}`;

  const renderMethodPicker = () => (
    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
      <Text style={rs.prompt}>{t('card.addMoneyPrompt')}</Text>

      <TouchableOpacity style={rs.methodRow} activeOpacity={0.7} onPress={() => navigate('fiatPick')}>
        <View style={rs.methodIconWrap}>
          <Ionicons name="business-outline" size={22} color={colors.primary} />
        </View>
        <View style={rs.methodBody}>
          <Text style={rs.listTitle}>{t('card.addMoneyBankTransfer')}</Text>
          <Text style={rs.methodSub}>{t('card.addMoneyBankTransferSub')}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
      </TouchableOpacity>

      <TouchableOpacity
        style={[rs.methodRow, { marginTop: 10 }]}
        activeOpacity={0.7}
        onPress={() => navigate('cryptoPick')}
      >
        <View style={rs.methodIconWrap}>
          <Ionicons name="logo-bitcoin" size={22} color={colors.primary} />
        </View>
        <View style={rs.methodBody}>
          <Text style={rs.listTitle}>{t('card.addMoneyCrypto')}</Text>
          <Text style={rs.methodSub}>{t('card.addMoneyCryptoSub')}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
      </TouchableOpacity>

      <TouchableOpacity
        style={[rs.methodRow, { marginTop: 10 }]}
        activeOpacity={0.7}
        onPress={openMoonPay}
      >
        <View style={rs.methodIconWrap}>
          <Ionicons name="card-outline" size={22} color={colors.primary} />
        </View>
        <View style={rs.methodBody}>
          <Text style={rs.listTitle}>{t('card.addMoneyDebitCard')}</Text>
          <Text style={rs.methodSub}>{t('card.addMoneyDebitCardSub')}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
      </TouchableOpacity>

      <View style={{ height: 24 }} />
    </ScrollView>
  );

  const renderFiatPick = () => (
    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
      <Text style={rs.prompt}>{t('card.addMoneyFiatPrompt')}</Text>
      <View style={rs.card}>
        {FIAT_OPTIONS.map((opt, i) => (
          <TouchableOpacity
            key={opt.code}
            style={[rs.fiatRow, i > 0 && rs.fiatRowBorder]}
            activeOpacity={0.7}
            onPress={() => openFiat(opt.code)}
          >
            <Text style={rs.fiatFlag}>{opt.flag}</Text>
            <View style={{ flex: 1 }}>
              <Text style={rs.listTitle}>
                {opt.label} <Text style={rs.fiatName}>· {fiatName(opt.code)}</Text>
              </Text>
              <View style={rs.chipRow}>
                <View style={rs.chip}>
                  <Text style={rs.chipText}>{opt.rails}</Text>
                </View>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
          </TouchableOpacity>
        ))}
      </View>
      <View style={{ height: 24 }} />
    </ScrollView>
  );

  const renderCryptoPick = () => (
    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
      <Text style={rs.prompt}>{t('card.addMoneyCryptoPrompt')}</Text>
      <TouchableOpacity style={rs.listRow} activeOpacity={0.7} onPress={() => navigate('crypto')}>
        <TokenLogo token={USDC_TOKEN} size={40} />
        <View style={{ flex: 1 }}>
          <Text style={rs.listTitle}>USDC</Text>
          <View style={rs.chipRow}>
            <View style={rs.chip}>
              <Text style={rs.chipText}>Base</Text>
            </View>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
      </TouchableOpacity>

      <TouchableOpacity
        style={[rs.listRow, { marginTop: 10 }]}
        activeOpacity={0.7}
        onPress={() => navigate('usdtTron')}
      >
        <TokenLogo token={USDT_DISPLAY} size={40} />
        <View style={{ flex: 1 }}>
          <Text style={rs.listTitle}>USDT</Text>
          <View style={rs.chipRow}>
            <View style={rs.chip}>
              <Text style={rs.chipText}>TRC20</Text>
            </View>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
      </TouchableOpacity>

      <View style={{ height: 24 }} />
    </ScrollView>
  );

  // ── Page 2 (crypto): QR + address ──────────────────────────────────────────
  const renderCrypto = () => (
    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
      <Text style={s.subtitle}>
        {mode === 'topup' ? t('card.receiveTopupSubtitle') : t('card.receiveSubtitle')}
      </Text>

      <View style={s.qrWrapper}>
        <View style={s.qrBox}>
          <QRCode value={smartAddress || ' '} size={180} color="#0B0B0F" backgroundColor={colors.qrBackground} />
        </View>
      </View>

      <TouchableOpacity onPress={copy} style={s.addressBox} activeOpacity={0.7}>
        <View style={s.scBadge}>
          <Ionicons name="cube-outline" size={11} color={colors.primary} />
          <Text style={s.scBadgeText}>Base</Text>
        </View>
        <Text style={s.addressFull} numberOfLines={1} ellipsizeMode="middle">
          {smartAddress}
        </Text>
        <Ionicons name={copied ? 'checkmark-circle' : 'copy-outline'} size={18} color={copied ? colors.success : colors.textFaint} />
      </TouchableOpacity>

      <TouchableOpacity onPress={copy} style={s.primaryBtn} activeOpacity={0.85}>
        <LinearGradient
          colors={copied ? ['#065F46', '#047857'] : ['#7C3AED', '#4F46E5']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={s.primaryBtnGradient}
        >
          <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={17} color="#FFF" />
          <Text style={s.primaryBtnText}>{copied ? t('card.copied') : t('card.copyAddress')}</Text>
        </LinearGradient>
      </TouchableOpacity>

      <Text style={s.networkNote}>{t('card.receiveNetworkNote')}</Text>
      <View style={{ height: 24 }} />
    </ScrollView>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <SafeAreaView style={rs.root} edges={['top', 'bottom']}>
        {/* ── Unified nav bar ── */}
        <View style={rs.navBar}>
          <View style={rs.handle} />
          <View style={rs.titleRow}>
            {screen !== 'method' ? (
              <TouchableOpacity onPress={goBack} style={rs.navBtn} activeOpacity={0.7}>
                <Ionicons name="chevron-back" size={24} color={colors.text} />
              </TouchableOpacity>
            ) : (
              <View style={rs.navBtn} />
            )}
            <Text style={rs.title} numberOfLines={1}>{navTitle}</Text>
            <TouchableOpacity onPress={handleClose} style={rs.navBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Sliding content ── */}
        <Animated.View style={[rs.screenWrap, { transform: [{ translateX: slideAnim }] }]}>
          {screen === 'method' && renderMethodPicker()}
          {screen === 'fiatPick' && renderFiatPick()}
          {screen === 'cryptoPick' && renderCryptoPick()}
          {screen === 'crypto' && renderCrypto()}
          {screen === 'usdtTron' && <UsdtReceivePanel smartAddress={smartAddress} />}
          {screen === 'fiat' && (
            <FiatReceivePanel
              smartAddress={smartAddress}
              initialCurrency={selectedFiat}
              hideSelector
            />
          )}
        </Animated.View>
      </SafeAreaView>

      <MoonPayModal
        visible={moonpayOpen}
        onClose={() => setMoonpayOpen(false)}
        walletAddress={smartAddress}
        baseCurrencyCode={selectedFiat}
      />
    </Modal>
  );
}

function makeReceiveStyles(c: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.backgroundElevated },
    navBar: { paddingHorizontal: 16, paddingBottom: 4, backgroundColor: c.backgroundElevated },
    handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: c.borderStrong, alignSelf: 'center', marginTop: 12, marginBottom: 14 },
    titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
    title: { flex: 1, textAlign: 'center', color: c.text, fontSize: 18, fontWeight: '700' },
    navBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    screenWrap: { flex: 1, paddingHorizontal: 24 },

    prompt: {
      color: c.textMuted,
      fontSize: 15,
      lineHeight: 22,
      marginTop: 8,
      marginBottom: 20,
    },

    methodRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      backgroundColor: c.surface,
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 16,
      borderWidth: 1,
      borderColor: c.border,
    },
    methodIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.primarySoft,
    },
    methodBody: { flex: 1, gap: 4 },
    methodSub: { color: c.textMuted, fontSize: 13, lineHeight: 18 },

    sectionLabel: {
      color: c.textFaint, fontSize: 12, fontWeight: '600', textTransform: 'uppercase',
      letterSpacing: 0.4, marginTop: 12, marginBottom: 12,
    },

    card: {
      backgroundColor: c.surface, borderRadius: 16, overflow: 'hidden',
      borderWidth: 1, borderColor: c.border,
    },

    listRow: {
      flexDirection: 'row', alignItems: 'center', gap: 14,
      backgroundColor: c.surface, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 16,
      borderWidth: 1, borderColor: c.border,
    },
    listTitle: { color: c.text, fontSize: 16, fontWeight: '700', marginBottom: 6 },
    fiatName: { color: c.textMuted, fontSize: 14, fontWeight: '500' },

    fiatRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14 },
    fiatRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
    fiatFlag: { fontSize: 26, lineHeight: 32, width: 40, textAlign: 'center' },

    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    chip: { backgroundColor: c.surfaceInput, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
    chipText: { color: c.textMuted, fontSize: 11, fontWeight: '600' },
  });
}
