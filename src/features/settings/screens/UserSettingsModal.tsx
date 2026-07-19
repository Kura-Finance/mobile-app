import React, { useEffect, useState } from 'react';
import { View, Modal, Dimensions, TouchableWithoutFeedback, ScrollView, TouchableOpacity, Text, Alert, Platform } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { readAsStringAsync } from 'expo-file-system/legacy';
import { usePrivy } from '@privy-io/expo';
import { useAppStore } from '../../../shared/store/useAppStore';
import { useAppTranslation } from '../../../shared/hooks/useAppTranslation';
import { useTheme } from '../../../shared/theme/ThemeContext';
import Logger from '../../../shared/utils/Logger';
import UserProfile from '../components/UserProfile';
import { displayEmail } from '../../../lib/api/auth/userProfileHelpers';
import BaseCurrencySelector from '../components/BaseCurrencySelector';
import LanguageSelector from '../components/LanguageSelector';
import ThemeSelector from '../components/ThemeSelector';
import SectionHeader from '../components/SectionHeader';
import SettingsList from '../components/SettingsList';
import ActionsAgreementsList from '../components/ActionsAgreementsList';
import ProfileSecurityScreen from './ProfileSecurityScreen';
import ConnectedAccountsScreen from './ConnectedAccountsScreen';
import ReferralsScreen from './ReferralsScreen';
import OurAgreementsScreen from './OurAgreementsScreen';

interface UserSettingsModalProps {
  isVisible: boolean;
  onClose: () => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function UserSettingsModal({ isVisible, onClose }: UserSettingsModalProps) {
  const [showProfileSecurity, setShowProfileSecurity] = useState(false);
  const [showConnectedAccounts, setShowConnectedAccounts] = useState(false);
  const [showReferrals, setShowReferrals] = useState(false);
  const [showAgreements, setShowAgreements] = useState(false);
  const [isLoadingAvatar, setIsLoadingAvatar] = useState(false);
  const animationProgress = useSharedValue(0);
  const { t } = useAppTranslation();
  const { colors } = useTheme();
  const userProfile = useAppStore((state) => state.userProfile);
  const authStatus = useAppStore((state) => state.authStatus);
  const preferences = useAppStore((state) => state.preferences);
  const setBaseCurrency = useAppStore((state) => state.setBaseCurrency);
  const setLanguage = useAppStore((state) => state.setLanguage);
  const setThemeMode = useAppStore((state) => state.setThemeMode);
  const clearAuthSession = useAppStore((state) => state.clearAuthSession);
  const updateAvatar = useAppStore((state) => state.updateAvatar);
  const { logout } = usePrivy();

  // 頭像上傳處理
  const handleAvatarPress = async () => {
    try {
      Logger.info('UserSettingsModal', 'Avatar upload started');
      
      // Android 13+ uses the system photo picker without READ_MEDIA_* permissions.
      if (Platform.OS === 'ios') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        Logger.debug('UserSettingsModal', 'Media library permission', { status });

        if (status !== 'granted') {
          Logger.warn('UserSettingsModal', 'Permission not granted');
          Alert.alert('Permission Required', 'We need permission to access your photo library');
          return;
        }
      }

      // 打開圖片選擇器 - 使用較低質量以減小文件大小
      Logger.debug('UserSettingsModal', 'Opening image picker');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'] as any,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.3, // 降低质量以减小文件大小
      });

      Logger.debug('UserSettingsModal', 'Image picker result', { canceled: result.canceled, assetsCount: result.assets?.length });

      if (!result.canceled && result.assets[0]) {
        setIsLoadingAvatar(true);
        
        try {
          const imageUri = result.assets[0].uri;
          Logger.info('UserSettingsModal', 'Image selected', { uri: imageUri, fileName: result.assets[0].fileName });
          
          // 使用 expo-file-system legacy API 轉換為 base64
          Logger.debug('UserSettingsModal', 'Starting base64 conversion');
          const base64 = await readAsStringAsync(imageUri, {
            encoding: 'base64' as any,
          });
          
          Logger.info('UserSettingsModal', 'Base64 conversion successful', { base64Length: base64.length });
          Logger.debug('UserSettingsModal', 'Base64 first 50 chars', { preview: base64.substring(0, 50) });
          
          // 檢查是否為空
          if (!base64 || base64.trim().length === 0) {
            const errorMsg = 'Image data is empty. Please select a valid image.';
            Logger.error('UserSettingsModal', errorMsg, { base64: base64 });
            Alert.alert('Invalid Image', errorMsg);
            setIsLoadingAvatar(false);
            return;
          }
          
          // 檢查大小限制（最多 400KB）
          const MAX_SIZE = 400 * 1024; // 400KB
          if (base64.length > MAX_SIZE) {
            const sizeInKB = Math.round(base64.length / 1024);
            const errorMsg = `Image too large (${sizeInKB}KB). Maximum allowed size is 400KB. Please choose a smaller image.`;
            Logger.warn('UserSettingsModal', 'Image size exceed limit', { base64Length: base64.length, maxSize: MAX_SIZE, sizeKB: sizeInKB });
            Alert.alert('Image Too Large', errorMsg);
            setIsLoadingAvatar(false);
            return;
          }
          
          // 添加 data URI 頭部
          const dataUri = `data:image/jpeg;base64,${base64}`;
          Logger.info('UserSettingsModal', 'Data URI created', { totalLength: dataUri.length, prefix: dataUri.substring(0, 80) });
          
          Logger.debug('UserSettingsModal', 'Starting avatar upload');
          await updateAvatar(dataUri);
          
          Logger.info('UserSettingsModal', 'Avatar updated successfully in store');
          Alert.alert('Success', 'Avatar updated successfully');
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to process image';
          Logger.error('UserSettingsModal', 'Failed to update avatar', { error: errorMessage, fullError: error });
          Alert.alert('Error', errorMessage);
        } finally {
          setIsLoadingAvatar(false);
          Logger.debug('UserSettingsModal', 'Avatar upload process finished');
        }
      } else {
        Logger.debug('UserSettingsModal', 'Image picker cancelled');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to pick image';
      Logger.error('UserSettingsModal', 'Failed to pick image', { error: errorMessage, fullError: error });
      Alert.alert('Error', errorMessage);
    }
  };

  useEffect(() => {
    if (isVisible) {
      animationProgress.value = withTiming(1, { duration: 300 });
    } else {
      animationProgress.value = withTiming(0, { duration: 300 });
    }
  }, [isVisible, animationProgress]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: animationProgress.value,
  }));

  const drawerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (1 - animationProgress.value) * SCREEN_WIDTH }],
  }));

  const handleClose = () => {
    animationProgress.value = withTiming(0, { duration: 300 }, (finished) => {
      if (finished) {
        runOnJS(onClose)();
      }
    });
  };

  const handleSignOut = () => {
    // Close drawer first, then logout so navigation transition is smooth
    handleClose();
    // Calling Privy logout() sets user → null, which triggers PrivyBridgeProvider
    // to call clearDataKey() + clearAuthSession(), and App.tsx then shows the Auth screen.
    void logout();
  };

  if (!isVisible) return null;

  // If Profile & Security is shown, render it instead
  if (showProfileSecurity) {
    return (
      <Modal visible={isVisible} transparent animationType="none" onRequestClose={() => setShowProfileSecurity(false)}>
        <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'flex-start' }}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <Animated.View style={[{ position: 'absolute', width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)' }, backdropStyle]} />
          </TouchableWithoutFeedback>

          <Animated.View style={[{ width: '100%', height: '100%', backgroundColor: colors.background, zIndex: 1 }, drawerStyle]}>
            <ProfileSecurityScreen onClose={() => setShowProfileSecurity(false)} />
          </Animated.View>
        </View>
      </Modal>
    );
  }

  // If Connected Accounts is shown, render it instead
  if (showConnectedAccounts) {
    return (
      <Modal visible={isVisible} transparent animationType="none" onRequestClose={() => setShowConnectedAccounts(false)}>
        <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'flex-start' }}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <Animated.View style={[{ position: 'absolute', width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)' }, backdropStyle]} />
          </TouchableWithoutFeedback>

          <Animated.View style={[{ width: '100%', height: '100%', backgroundColor: colors.background, zIndex: 1 }, drawerStyle]}>
            <ConnectedAccountsScreen onClose={() => setShowConnectedAccounts(false)} />
          </Animated.View>
        </View>
      </Modal>
    );
  }

  if (showReferrals) {
    return (
      <Modal visible={isVisible} transparent animationType="none" onRequestClose={() => setShowReferrals(false)}>
        <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'flex-start' }}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <Animated.View style={[{ position: 'absolute', width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)' }, backdropStyle]} />
          </TouchableWithoutFeedback>

          <Animated.View style={[{ width: '100%', height: '100%', backgroundColor: colors.background, zIndex: 1 }, drawerStyle]}>
            <ReferralsScreen onClose={() => setShowReferrals(false)} />
          </Animated.View>
        </View>
      </Modal>
    );
  }

  if (showAgreements) {
    return (
      <Modal visible={isVisible} transparent animationType="none" onRequestClose={() => setShowAgreements(false)}>
        <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'flex-start' }}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <Animated.View style={[{ position: 'absolute', width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)' }, backdropStyle]} />
          </TouchableWithoutFeedback>

          <Animated.View style={[{ width: '100%', height: '100%', backgroundColor: colors.background, zIndex: 1 }, drawerStyle]}>
            <OurAgreementsScreen onClose={() => setShowAgreements(false)} />
          </Animated.View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={isVisible} transparent animationType="none" onRequestClose={handleClose}>
      <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'flex-start' }}>
        <TouchableWithoutFeedback onPress={handleClose}>
          <Animated.View style={[{ position: 'absolute', width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)' }, backdropStyle]} />
        </TouchableWithoutFeedback>

        <Animated.View style={[{ width: '100%', height: '100%', backgroundColor: colors.background, zIndex: 1 }, drawerStyle]}>
          <ScrollView style={{ flex: 1, paddingTop: 64, paddingHorizontal: 24 }} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false} nestedScrollEnabled>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
              <Text style={{ color: colors.text, fontSize: 20, fontWeight: 'bold' }}>{t('settings.account')}</Text>
              <TouchableOpacity onPress={handleClose} style={{ width: 32, height: 32, backgroundColor: colors.surface, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <UserProfile 
              displayName={userProfile.displayName}
              email={displayEmail(userProfile, t('settings.emailNotLinked'))}
              avatarUrl={userProfile.avatarUrl}
              onAvatarPress={handleAvatarPress}
              isLoadingAvatar={isLoadingAvatar}
            />

            <SectionHeader title={t('settings.preferences')} />
            <View style={{ flexDirection: 'column', gap: 8, marginBottom: 32 }}>
              <BaseCurrencySelector 
                selectedCurrency={preferences.baseCurrency}
                onSelectCurrency={setBaseCurrency}
              />
              <LanguageSelector 
                selectedLanguage={preferences.language}
                onSelectLanguage={setLanguage}
              />
              <ThemeSelector
                selectedMode={preferences.themeMode}
                onSelectMode={setThemeMode}
              />
            </View>

            <SectionHeader title={t('settings.general')} />
            <View style={{ marginBottom: 32 }}>
              <SettingsList
                onProfileSecurityPress={() => setShowProfileSecurity(true)}
                onConnectedAccountsPress={() => setShowConnectedAccounts(true)}
              />

              <Text
                style={{
                  color: colors.textMuted,
                  fontSize: 13,
                  fontWeight: '600',
                  marginTop: 8,
                  marginBottom: 12,
                }}
              >
                {t('settings.actionsAndAgreements')}
              </Text>
              <ActionsAgreementsList
                onReferralsPress={() => setShowReferrals(true)}
                onAgreementsPress={() => setShowAgreements(true)}
                onSignOutPress={handleSignOut}
                showSignOut={authStatus === 'authenticated'}
              />
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}
