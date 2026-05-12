import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePrivy } from '@privy-io/expo';
import { useAppStore } from '../../../shared/store/useAppStore';
import { useAppTranslation } from '../../../shared/hooks/useAppTranslation';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { displayEmail } from '../../../lib/api/auth/userProfileHelpers';
import EditDisplayNameScreen from './EditDisplayNameScreen';
import EditEmailScreen from './EditEmailScreen';
import ExportWalletKeyScreen from './ExportWalletKeyScreen';
import PreferenceToggle from '../components/PreferenceToggle';
import { DeleteAccountConfirmModal } from '../../../shared/components/DeleteAccountConfirmModal';

interface ProfileSecurityScreenProps {
  onClose: () => void;
}

export default function ProfileSecurityScreen({ onClose }: ProfileSecurityScreenProps) {
  const [showEditDisplay, setShowEditDisplay] = useState(false);
  const [showEditEmail, setShowEditEmail] = useState(false);
  const [showExportWallet, setShowExportWallet] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { t } = useAppTranslation();
  const { colors } = useTheme();
  const userProfile = useAppStore((state) => state.userProfile);
  const { logout: privyLogout } = usePrivy();
  const disableScreenshot = useAppStore((state) => state.preferences.disableScreenshot);
  const hideBalance = useAppStore((state) => state.preferences.hideBalance);
  const setDisableScreenshot = useAppStore((state) => state.setDisableScreenshot);
  const setHideBalance = useAppStore((state) => state.setHideBalance);

  if (showEditDisplay) {
    return <EditDisplayNameScreen onClose={() => setShowEditDisplay(false)} />;
  }

  if (showEditEmail) {
    return <EditEmailScreen onClose={() => setShowEditEmail(false)} />;
  }

  if (showExportWallet) {
    return <ExportWalletKeyScreen onClose={() => setShowExportWallet(false)} />;
  }

  const handleDeleteSuccess = () => {
    onClose();
    // Same as Sign Out: PrivyBridge clears local session when user → null.
    void privyLogout();
  };

  const ROW_STYLE = {
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
        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: 'bold' }}>
            {t('settings.profileSecurity')}
          </Text>
          <TouchableOpacity
            onPress={onClose}
            style={{ width: 32, height: 32, backgroundColor: colors.surface, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="close" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Personal Information */}
        <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 16 }}>
          {t('settings.personalInformation')}
        </Text>

        <TouchableOpacity onPress={() => setShowEditDisplay(true)} style={ROW_STYLE}>
          <View>
            <Text style={{ color: colors.text, fontWeight: '500' }}>{t('settings.displayName')}</Text>
            <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
              {userProfile.displayName || t('settings.notSet')}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setShowEditEmail(true)}
          style={{ ...ROW_STYLE, marginBottom: 32 }}
        >
          <View>
            <Text style={{ color: colors.text, fontWeight: '500' }}>{t('settings.emailAddress')}</Text>
            <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
              {displayEmail(userProfile, t('settings.emailNotLinked'))}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </TouchableOpacity>

        {/* Security Settings */}
        <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 16 }}>
          {t('settings.securitySettings')}
        </Text>

        <PreferenceToggle
          label={t('settings.disableScreenshot')}
          description={t('settings.disableScreenshotDesc')}
          value={disableScreenshot}
          onValueChange={setDisableScreenshot}
        />

        <PreferenceToggle
          label={t('settings.hideBalance')}
          description={t('settings.hideBalanceDesc')}
          value={hideBalance}
          onValueChange={setHideBalance}
        />

        {/* Export Wallet Key */}
        <TouchableOpacity onPress={() => setShowExportWallet(true)} style={{ ...ROW_STYLE, marginBottom: 32 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="key-outline" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: '500' }}>{t('exportWallet.title')}</Text>
              <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                {t('exportWallet.settingsDesc')}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </TouchableOpacity>

        {/* Danger Zone */}
        <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 16 }}>
          {t('settings.dangerZone')}
        </Text>

        <TouchableOpacity
          onPress={() => setShowDeleteConfirm(true)}
          style={{ ...ROW_STYLE, marginBottom: 0, borderColor: 'rgba(239, 68, 68, 0.2)' }}
        >
          <View>
            <Text style={{ color: colors.danger, fontWeight: '500' }}>{t('settings.deleteAccount')}</Text>
            <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
              {t('settings.permanentlyDelete')}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.danger} />
        </TouchableOpacity>
      </ScrollView>

      <DeleteAccountConfirmModal
        visible={showDeleteConfirm}
        onDismiss={() => setShowDeleteConfirm(false)}
        onSuccess={handleDeleteSuccess}
      />
    </View>
  );
}
