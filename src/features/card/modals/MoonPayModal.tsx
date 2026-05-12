import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { DISABLE_EME_JS } from '../../../shared/utils/webviewGuards';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../shared/theme/theme';
import {
  MOONPAY_CONFIGURED,
  buildMoonPayUrl,
  type MoonPayUrlParams,
} from '../config/moonpayConfig';
import { signMoonPayUrl } from '../../../lib/api/moonpay/client';

interface MoonPayModalProps {
  visible: boolean;
  onClose: () => void;
  /** Destination wallet (Safe SCA on Base). */
  walletAddress: string;
  /** Fiat currency the user pays in (e.g. 'usd'). */
  baseCurrencyCode?: string;
}

export default function MoonPayModal({
  visible,
  onClose,
  walletAddress,
  baseCurrencyCode,
}: MoonPayModalProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const st = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) {
      setUrl(null);
      setError('');
      return;
    }

    let cancelled = false;
    void (async () => {
      setError('');
      try {
        if (!MOONPAY_CONFIGURED) {
          throw new Error(t('card.moonpayNotConfigured'));
        }
        const params: MoonPayUrlParams = {
          walletAddress: walletAddress || undefined,
          baseCurrencyCode,
        };
        const unsigned = buildMoonPayUrl(params);

        // Live mode requires a backend-signed URL. Fall back to the unsigned
        // URL when signing is unavailable (works in sandbox).
        let finalUrl = unsigned;
        try {
          finalUrl = await signMoonPayUrl(unsigned);
        } catch {
          finalUrl = unsigned;
        }

        if (!cancelled) setUrl(finalUrl);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : t('card.moonpayFailedOpen'));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [visible, walletAddress, baseCurrencyCode, t]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={[st.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={st.header}>
          <View style={st.brand}>
            <Ionicons name="card" size={18} color={colors.primary} />
            <Text style={st.title}>{t('card.cardDeposit')}</Text>
            <View style={st.poweredBy}>
              <Text style={st.poweredByText}>{t('card.viaMoonpay')}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={onClose} style={st.closeBtn} hitSlop={8}>
            <Ionicons name="close" size={22} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        <View style={st.body}>
          {error ? (
            <View style={st.center}>
              <Ionicons name="alert-circle-outline" size={40} color={colors.danger} />
              <Text style={st.errorText}>{error}</Text>
              <TouchableOpacity onPress={onClose} style={st.errorBtn}>
                <Text style={st.errorBtnText}>{t('card.close')}</Text>
              </TouchableOpacity>
            </View>
          ) : url ? (
            <WebView
              source={{ uri: url }}
              originWhitelist={['*']}
              javaScriptEnabled
              domStorageEnabled
              startInLoadingState
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction
              injectedJavaScriptBeforeContentLoaded={DISABLE_EME_JS}
              mediaCapturePermissionGrantType="grant"
              renderLoading={() => (
                <View style={st.center}>
                  <ActivityIndicator color={colors.primary} />
                </View>
              )}
              onError={() => setError(t('card.moonpayCouldNotLoad'))}
            />
          ) : (
            <View style={st.center}>
              <ActivityIndicator color={colors.primary} />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border,
    },
    brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    title: { color: c.text, fontSize: 17, fontWeight: '700' },
    poweredBy: {
      backgroundColor: 'rgba(139,92,246,0.15)', borderRadius: 6,
      paddingHorizontal: 8, paddingVertical: 3,
    },
    poweredByText: { color: c.primary, fontSize: 11, fontWeight: '600' },
    closeBtn: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: c.surfaceInput, alignItems: 'center', justifyContent: 'center',
    },
    body: { flex: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
    errorText: { color: c.text, fontSize: 14, textAlign: 'center', lineHeight: 20 },
    errorBtn: {
      paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10,
      backgroundColor: c.surfaceInput,
    },
    errorBtnText: { color: c.text, fontSize: 14, fontWeight: '600' },
  });
}
