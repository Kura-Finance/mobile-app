import LoadingDots from '../../../shared/components/LoadingDots';
/**
 * KycWebViewModal
 *
 * Opens Dinari's hosted KYC flow in a WebView. After the user finishes, the
 * caller polls `GET /entity` until `canTransact` flips true. This modal simply
 * surfaces the embed and a "I've finished" affordance that triggers a re-check.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { DISABLE_EME_JS } from '../../../shared/utils/webviewGuards';
import {
  allowedHostsFromSeedUrl,
  shouldAllowWebViewNavigation,
} from '../../../shared/utils/webviewAllowlist';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../shared/theme/theme';

interface Props {
  visible: boolean;
  /** Lazily produce the KYC embed URL (calls POST /kyc-link). */
  getUrl: () => Promise<string>;
  /** Re-check entity; resolve true once canTransact is satisfied. */
  onCheck: () => Promise<boolean>;
  onClose: () => void;
}

const KYC_PARTNER_HOSTS = ['dinari.com', 'withpersona.com'] as const;

export default function KycWebViewModal({ visible, getUrl, onCheck, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const st = useMemo(() => makeStyles(colors), [colors]);
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
      try {
        const u = await getUrl();
        if (!cancelled) setUrl(u);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'Failed to start verification.');
      }
    })();
    return () => { cancelled = true; };
  }, [visible, getUrl]);

  // Poll while the modal is open so a finished KYC auto-advances.
  useEffect(() => {
    if (!visible || !url) return;
    let active = true;
    const timer = setInterval(async () => {
      const done = await onCheck().catch(() => false);
      if (done && active) onClose();
    }, 5000);
    return () => { active = false; clearInterval(timer); };
  }, [visible, url, onCheck, onClose]);

  const allowedHosts = useMemo(() => {
    if (!url) return [...KYC_PARTNER_HOSTS];
    return [...new Set([...allowedHostsFromSeedUrl(url), ...KYC_PARTNER_HOSTS])];
  }, [url]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={[st.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={st.header}>
          <View style={st.brand}>
            <Ionicons name="shield-checkmark" size={18} color={colors.primary} />
            <Text style={st.title}>Identity verification</Text>
            <View style={st.poweredBy}>
              <Text style={st.poweredByText}>via Dinari</Text>
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
                <Text style={st.errorBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          ) : url ? (
            <WebView
              source={{ uri: url }}
              originWhitelist={['https://*']}
              javaScriptEnabled
              domStorageEnabled
              startInLoadingState
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction
              injectedJavaScriptBeforeContentLoaded={DISABLE_EME_JS}
              mediaCapturePermissionGrantType="prompt"
              onShouldStartLoadWithRequest={(event) =>
                shouldAllowWebViewNavigation(event.url, allowedHosts)
              }
              style={{ backgroundColor: colors.background }}
              renderLoading={() => (
                <View style={st.center}>
                  <LoadingDots color={colors.primary} size={8}   />
                </View>
              )}
              onError={() => setError('Could not load verification. Please try again.')}
            />
          ) : (
            <View style={st.center}>
              <LoadingDots color={colors.primary} size={8}   />
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
      backgroundColor: c.primarySoft, borderRadius: 6,
      paddingHorizontal: 8, paddingVertical: 3,
    },
    poweredByText: { color: c.primary, fontSize: 11, fontWeight: '600' },
    closeBtn: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: c.surfaceInput, alignItems: 'center', justifyContent: 'center',
    },
    body: { flex: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
    errorText: { color: c.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
    errorBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10, backgroundColor: c.surfaceInput },
    errorBtnText: { color: c.text, fontSize: 14, fontWeight: '600' },
  });
}
