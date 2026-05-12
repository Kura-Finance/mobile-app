import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTranslation } from '../../../shared/hooks/useAppTranslation';
import { useTheme } from '../../../shared/theme/ThemeContext';
import type { Language } from '../../../shared/store/useAppStore';

interface LanguageSelectorProps {
  selectedLanguage: Language;
  onSelectLanguage: (language: Language) => void;
}

const SUPPORTED_LANGUAGES: { code: Language; name: string; nativeName: string }[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'zh-TW', name: 'Traditional Chinese (Taiwan)', nativeName: '繁體中文 (台灣)' },
];

export default function LanguageSelector({ selectedLanguage, onSelectLanguage }: LanguageSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useAppTranslation();
  const { colors } = useTheme();

  const handleSelectLanguage = (language: Language) => {
    onSelectLanguage(language);
    setIsOpen(false);
  };

  const currentLanguage = SUPPORTED_LANGUAGES.find((lang) => lang.code === selectedLanguage);

  return (
    <View style={{ marginBottom: 12, position: 'relative' }}>
      <TouchableOpacity
        onPress={() => setIsOpen(!isOpen)}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.primarySoft }}
      >
        <View>
          <Text style={{ color: colors.text, fontWeight: '500' }}>{t('settings.language')}</Text>
          <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>{t('settings.languageDescription')}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 14, fontWeight: 'bold', color: colors.primary }}>{currentLanguage?.nativeName}</Text>
          <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={20} color={colors.primary} />
        </View>
      </TouchableOpacity>

      {isOpen && (
        <View style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 8, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.primarySoft, zIndex: 1000, overflow: 'hidden' }}>
          {SUPPORTED_LANGUAGES.map((language, index) => (
            <TouchableOpacity
              key={language.code}
              onPress={() => handleSelectLanguage(language.code)}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 12,
                backgroundColor: selectedLanguage === language.code ? colors.primarySoft : colors.surface,
                borderBottomWidth: index < SUPPORTED_LANGUAGES.length - 1 ? 1 : 0,
                borderBottomColor: colors.border,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <View>
                <Text style={{ color: colors.text, fontWeight: '500', fontSize: 14 }}>{language.nativeName}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{language.name}</Text>
              </View>
              {selectedLanguage === language.code && (
                <Ionicons name="checkmark" size={18} color={colors.primary} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}
