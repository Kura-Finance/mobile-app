import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../../../shared/store/useAppStore';
import { useAppTranslation } from '../../../shared/hooks/useAppTranslation';
import { useTheme } from '../../../shared/theme/ThemeContext';

interface EditDisplayNameScreenProps {
  onClose: () => void;
}

export default function EditDisplayNameScreen({ onClose }: EditDisplayNameScreenProps) {
  const { t } = useAppTranslation();
  const { colors } = useTheme();
  const userProfile = useAppStore((state) => state.userProfile);
  const setDisplayName = useAppStore((state) => state.setDisplayName);
  const [displayName, setDisplayNameLocal] = useState(userProfile.displayName);
  const [isLoading, setIsLoading] = useState(false);

  const handleSave = async () => {
    if (!displayName.trim()) {
      Alert.alert('Error', t('settings.displayNameEmpty'));
      return;
    }

    if (displayName === userProfile.displayName) {
      onClose();
      return;
    }

    try {
      setIsLoading(true);
      await setDisplayName(displayName);
      Alert.alert('Success', t('settings.displayNameUpdated'));
      onClose();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t('settings.failedUpdateDisplay');
      Alert.alert('Error', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView style={{ flex: 1, paddingTop: 64, paddingHorizontal: 24 }} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: 'bold' }}>{t('settings.editDisplayName')}</Text>
          <TouchableOpacity onPress={onClose} style={{ width: 32, height: 32, backgroundColor: colors.surface, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="close" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Form */}
        <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 16 }}>{t('settings.displayName')}</Text>
        
        <TextInput
          value={displayName}
          onChangeText={setDisplayNameLocal}
          placeholder={t('settings.enterDisplayName')}
          placeholderTextColor={colors.textFaint}
          editable={!isLoading}
          style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primarySoft, borderRadius: 12, color: colors.text, padding: 16, fontSize: 16, marginBottom: 32, opacity: isLoading ? 0.5 : 1 }}
        />

        {/* Save Button */}
        <TouchableOpacity
          onPress={handleSave}
          disabled={isLoading || displayName.trim() === ''}
          style={{ width: '100%', paddingVertical: 16, borderRadius: 12, backgroundColor: isLoading || displayName.trim() === '' ? colors.primaryDark : colors.primary, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' }}
        >
          {isLoading && <ActivityIndicator color="#FFFFFF" style={{ marginRight: 8 }} />}
          <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 }}>
            {isLoading ? t('settings.saving') : t('settings.saveChanges')}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
