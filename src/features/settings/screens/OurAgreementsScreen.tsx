import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTranslation } from '../../../shared/hooks/useAppTranslation';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { brand } from '../../../config/branding';
import LegalDisclaimer from '../../../shared/components/LegalDisclaimer';

const TOS_URL = `${brand.homepage}/tos`;
const PRIVACY_URL = `${brand.homepage}/privacy`;
const DISCLAIMER_URL = `${brand.homepage}/disclaimer`;

interface Props {
  onClose: () => void;
}

function openUrl(url: string) {
  void Linking.openURL(url).catch(() => undefined);
}

export default function OurAgreementsScreen({ onClose }: Props) {
  const { t } = useAppTranslation();
  const { colors } = useTheme();

  const rowStyle = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.primarySoft,
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

        <TouchableOpacity onPress={() => openUrl(TOS_URL)} style={rowStyle} activeOpacity={0.7}>
          <Text style={{ color: colors.text, fontWeight: '500' }}>{t('settings.termsOfService')}</Text>
          <Ionicons name="open-outline" size={20} color={colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => openUrl(PRIVACY_URL)} style={rowStyle} activeOpacity={0.7}>
          <Text style={{ color: colors.text, fontWeight: '500' }}>{t('settings.privacyPolicy')}</Text>
          <Ionicons name="open-outline" size={20} color={colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => openUrl(DISCLAIMER_URL)} style={rowStyle} activeOpacity={0.7}>
          <Text style={{ color: colors.text, fontWeight: '500' }}>{t('settings.disclaimer')}</Text>
          <Ionicons name="open-outline" size={20} color={colors.textMuted} />
        </TouchableOpacity>

        <LegalDisclaimer variant="riskSummary" centered={false} style={{ marginTop: 16 }} />
      </ScrollView>
    </View>
  );
}
