// apps/kura-app/src/features/header/components/Header.tsx
import React, { useState, useRef, useMemo } from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import UserSettingsModal from '../../features/settings/screens/UserSettingsModal';
import LoggerDebugPanel from '../components/LoggerDebugPanel';
import { useAppStore } from '../store/useAppStore';
import { useNotificationStore } from '../store/notification';
import { useHeaderStore } from '../store/useHeaderStore';
import { useTheme } from '../theme/ThemeContext';

/** Total height the Header occupies, so overlaid screens can pad their content. */
export function useHeaderHeight() {
  const insets = useSafeAreaInsets();
  return Math.max(insets.top, 10) + 6 + 40 + 8;
}

export default function Header() {
  const [isModalVisible, setModalVisible] = useState(false);
  const [isLoggerVisible, setIsLoggerVisible] = useState(false);
  const logoClickCount = useRef(0);
  const logoClickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userProfile = useAppStore((state) => state.userProfile);
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const unreadCount = useNotificationStore((state) => state.unreadCount);
  const scrolled = useHeaderStore((state) => state.scrolled);
  const { colors, scheme } = useTheme();

  // 缓存计算的值，避免每次渲染都重新计算
  const { avatarInitial } = useMemo(() => {
    const trimmedName = userProfile.displayName.trim();
    return {
      avatarInitial: trimmedName ? trimmedName.slice(0, 1).toUpperCase() : '?',
    };
  }, [userProfile.displayName]);

  const handleLogoPress = () => {
    logoClickCount.current += 1;

    // 如果已有定时器，清除它
    if (logoClickTimer.current) {
      clearTimeout(logoClickTimer.current);
    }

    // 如果连续按5次，打开日志面板
    if (logoClickCount.current === 5) {
      setIsLoggerVisible(true);
      logoClickCount.current = 0;
      return;
    }

    // 5秒后重置计数
    logoClickTimer.current = setTimeout(() => {
      logoClickCount.current = 0;
      logoClickTimer.current = null;
    }, 5000);
  };

  const overlayPosition = {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  };

  const inner = (
    <>
      <View 
        style={{ paddingTop: Math.max(insets.top, 10) + 6, paddingHorizontal: 24, paddingBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}
      >
        <TouchableOpacity onPress={handleLogoPress} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Image
            source={require('../../../assets/kura-logo.png')}
            style={{ width: 40, height: 40, borderRadius: 20 }}
            resizeMode="cover"
          />
        </TouchableOpacity>

        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity 
            onPress={() => navigation.navigate('Notifications')}
            style={{ width: 40, height: 40, backgroundColor: colors.surface, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}
          >
            <Ionicons name="notifications-outline" size={20} color={colors.textMuted} />
            {unreadCount > 0 && (
              <View style={{ position: 'absolute', top: 6, right: 6, width: 18, height: 18, backgroundColor: colors.danger, borderRadius: 9, borderWidth: 2, borderColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: 'bold' }}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => setModalVisible(true)}
            style={{ width: 40, height: 40, backgroundColor: colors.primary, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent', overflow: 'hidden' }}
          >
            {userProfile.avatarUrl ? (
              <Image 
                source={{ uri: userProfile.avatarUrl }} 
                style={{ width: 40, height: 40, borderRadius: 20 }}
                resizeMode="cover"
              />
            ) : (
              <Text style={{ color: '#FFFFFF', fontWeight: 'bold' }}>{avatarInitial}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <UserSettingsModal 
        isVisible={isModalVisible} 
        onClose={() => setModalVisible(false)} 
      />

      <LoggerDebugPanel 
        isVisible={isLoggerVisible}
        onClose={() => setIsLoggerVisible(false)}
      />
    </>
  );

  // Scrolled → translucent frosted blur (same behaviour in light & dark).
  if (scrolled) {
    return (
      <BlurView
        intensity={50}
        tint={scheme === 'light' ? 'light' : 'dark'}
        style={{
          ...overlayPosition,
          backgroundColor: scheme === 'light' ? 'rgba(255,255,255,0.6)' : 'rgba(11,11,15,0.55)',
        }}
      >
        {inner}
      </BlurView>
    );
  }

  // Default → solid, blends seamlessly with the screen background, no divider.
  return (
    <View style={{ ...overlayPosition, backgroundColor: colors.background }}>
      {inner}
    </View>
  );
}
