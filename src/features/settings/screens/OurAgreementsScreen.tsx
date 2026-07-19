import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { brand } from '../../../config/branding';
import { useAppTranslation } from '../../../shared/hooks/useAppTranslation';
import { useTheme } from '../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../shared/theme/theme';
import LoadingDots from '../../../shared/components/LoadingDots';
import { DISABLE_EME_JS } from '../../../shared/utils/webviewGuards';
import {
  allowedHostsFromSeedUrl,
  shouldAllowWebViewNavigation,
} from '../../../shared/utils/webviewAllowlist';

const TOS_URL = `${brand.homepage}/tos`;
const PRIVACY_URL = `${brand.homepage}/privacy`;
const DISCLAIMER_URL = `${brand.homepage}/disclaimer`;
const PROHIBITED_ACTIVITIES_URL = `${brand.homepage}/prohibited-activities`;
const REFERRAL_TERMS_URL = `${brand.homepage}/referral-terms`;

/** Allow brand site hosts (exact + parent) for legal pages. */
const LEGAL_HOSTS = [brand.universalLinkHost] as const;

interface Props {
  onClose: () => void;
}

type LegalDocTitleKey =
  | 'settings.termsOfService'
  | 'settings.privacyPolicy'
  | 'settings.disclaimer'
  | 'settings.prohibitedActivities'
  | 'settings.referralTerms';

interface LegalDoc {
  titleKey: LegalDocTitleKey;
  url: string;
}

export default function OurAgreementsScreen({ onClose }: Props) {
  const { t } = useAppTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const st = useMemo(() => makeStyles(colors), [colors]);
  const [activeDoc, setActiveDoc] = useState<LegalDoc | null>(null);
  const [loadError, setLoadError] = useState(false);

  const docs: LegalDoc[] = useMemo(
    () => [
      { titleKey: 'settings.termsOfService', url: TOS_URL },
      { titleKey: 'settings.privacyPolicy', url: PRIVACY_URL },
      { titleKey: 'settings.disclaimer', url: DISCLAIMER_URL },
      { titleKey: 'settings.prohibitedActivities', url: PROHIBITED_ACTIVITIES_URL },
      { titleKey: 'settings.referralTerms', url: REFERRAL_TERMS_URL },
    ],
    [],
  );

  const allowedHosts = useMemo(() => {
    if (!activeDoc) return [...LEGAL_HOSTS];
    return [...new Set([...allowedHostsFromSeedUrl(activeDoc.url), ...LEGAL_HOSTS])];
  }, [activeDoc]);

  const closeWebView = () => {
    setActiveDoc(null);
    setLoadError(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        style={{ flex: 1, paddingTop: 64, paddingHorizontal: 24 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: 'bold' }}>
            {t('settings.ourAgreements')}
          </Text>
          <TouchableOpacity
            onPress={onClose}
            style={{
              width: 32,
              height: 32,
              backgroundColor: colors.surface,
              borderRadius: 16,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="close" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        <Text style={{ color: colors.textMuted, fontSize: 14, lineHeight: 21, marginBottom: 24 }}>
          {t('settings.ourAgreementsDescription')}
        </Text>

        {docs.map((doc) => (
          <TouchableOpacity
            key={doc.url}
            onPress={() => {
              setLoadError(false);
              setActiveDoc(doc);
            }}
            style={st.row}
            activeOpacity={0.7}
          >
            <Text style={{ color: colors.text, fontWeight: '500' }}>{t(doc.titleKey)}</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Modal
        visible={!!activeDoc}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={closeWebView}
      >
        <View style={[st.webRoot, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <View style={st.webHeader}>
            <Text style={st.webTitle} numberOfLines={1}>
              {activeDoc ? t(activeDoc.titleKey) : ''}
            </Text>
            <TouchableOpacity onPress={closeWebView} style={st.webCloseBtn} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={st.webBody}>
            {loadError ? (
              <View style={st.webCenter}>
                <Ionicons name="alert-circle-outline" size={40} color={colors.danger} />
                <Text style={st.webErrorText}>{t('settings.legalPageLoadFailed')}</Text>
                <TouchableOpacity
                  onPress={() => {
                    setLoadError(false);
                    const doc = activeDoc;
                    setActiveDoc(null);
                    requestAnimationFrame(() => setActiveDoc(doc));
                  }}
                  style={st.webRetryBtn}
                  activeOpacity={0.7}
                >
                  <Text style={st.webRetryText}>{t('boot.tryAgain')}</Text>
                </TouchableOpacity>
              </View>
            ) : activeDoc ? (
              <WebView
                source={{ uri: activeDoc.url }}
                originWhitelist={['https://*']}
                javaScriptEnabled
                domStorageEnabled
                startInLoadingState
                injectedJavaScriptBeforeContentLoaded={DISABLE_EME_JS}
                onShouldStartLoadWithRequest={(event) =>
                  shouldAllowWebViewNavigation(event.url, allowedHosts)
                }
                style={{ backgroundColor: colors.background }}
                renderLoading={() => (
                  <View style={st.webCenter}>
                    <LoadingDots color={colors.primary} size={8} />
                  </View>
                )}
                onError={() => setLoadError(true)}
              />
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      backgroundColor: c.surface,
      borderRadius: 12,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: c.primarySoft,
    },
    webRoot: { flex: 1, backgroundColor: c.background },
    webHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
      gap: 12,
    },
    webTitle: { flex: 1, color: c.text, fontSize: 17, fontWeight: '700' },
    webCloseBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: c.surfaceInput,
      alignItems: 'center',
      justifyContent: 'center',
    },
    webBody: { flex: 1 },
    webCenter: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
      gap: 16,
    },
    webErrorText: { color: c.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
    webRetryBtn: {
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 10,
      backgroundColor: c.surfaceInput,
    },
    webRetryText: { color: c.text, fontSize: 14, fontWeight: '600' },
  });
}
