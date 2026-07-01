import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTranslation } from '../../../shared/hooks/useAppTranslation';
import { useTheme } from '../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../shared/theme/theme';
import type { Language } from '../../../shared/store/useAppStore';
import PreferencePickerModal from './PreferencePickerModal';

interface LanguageSelectorProps {
  selectedLanguage: Language;
  onSelectLanguage: (language: Language) => void;
}

const SUPPORTED_LANGUAGES: { code: Language; name: string; nativeName: string }[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'zh-TW', name: 'Traditional Chinese (Taiwan)', nativeName: '繁體中文 (台灣)' },
];

export default function LanguageSelector({ selectedLanguage, onSelectLanguage }: LanguageSelectorProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const { t } = useAppTranslation();
  const { colors } = useTheme();
  const st = useMemo(() => makeStyles(colors), [colors]);

  const currentLanguage = SUPPORTED_LANGUAGES.find((lang) => lang.code === selectedLanguage);

  return (
    <>
      <TouchableOpacity
        onPress={() => setModalVisible(true)}
        style={st.row}
        activeOpacity={0.7}
      >
        <View style={st.copy}>
          <Text style={st.label}>{t('settings.language')}</Text>
          <Text style={st.description}>{t('settings.languageDescription')}</Text>
        </View>
        <View style={st.valueRow}>
          <Text style={st.valueText}>{currentLanguage?.nativeName}</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
        </View>
      </TouchableOpacity>

      <PreferencePickerModal
        visible={modalVisible}
        title={t('settings.language')}
        selectedId={selectedLanguage}
        options={SUPPORTED_LANGUAGES.map((language) => ({
          id: language.code,
          title: language.nativeName,
          subtitle: language.name,
        }))}
        onSelect={(id) => onSelectLanguage(id as Language)}
        onClose={() => setModalVisible(false)}
      />
    </>
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
      borderWidth: 1,
      borderColor: c.primarySoft,
      marginBottom: 12,
    },
    copy: { flex: 1, marginRight: 12 },
    label: { color: c.text, fontWeight: '500' },
    description: { fontSize: 12, color: c.textMuted, marginTop: 2 },
    valueRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    valueText: { fontSize: 14, fontWeight: '700', color: c.primary },
  });
}
