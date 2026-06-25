// apps/kura-app/src/features/header/components/Header.tsx
import React, { useState, useRef, useEffect } from 'react';
import { View, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import UserSettingsModal from '../../features/settings/screens/UserSettingsModal';
import LoggerDebugPanel from '../components/LoggerDebugPanel';
import { useAppStore } from '../store/useAppStore';
import { useHeaderStore } from '../store/useHeaderStore';
import { useTheme } from '../theme/ThemeContext';

function HeaderAvatarButton({
  avatarUrl,
  onPress,
}: {
  avatarUrl?: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const [imageFailed, setImageFailed] = useState(false);
  const hasAvatar = Boolean(avatarUrl?.trim()) && !imageFailed;

  useEffect(() => {
    setImageFailed(false);
  }, [avatarUrl]);

  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        width: 40,
        height: 40,
        backgroundColor: colors.primary,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: 'transparent',
        overflow: 'hidden',
      }}
    >
      {hasAvatar ? (
        <Image
          source={{ uri: avatarUrl!.trim() }}
          style={{ width: 40, height: 40, borderRadius: 20 }}
          resizeMode="cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <Ionicons name="person" size={22} color="#FFFFFF" />
      )}
    </TouchableOpacity>
  );
}

/** Total height the Header occupies, so overlaid screens can pad their content. */
export function useHeaderHeight() {
  const insets = useSafeAreaInsets();
  return Math.max(insets.top, 10) + 6 + 40 + 8;
}

/** Rapid taps within this window trigger the debug panel; a lone tap opens settings after it elapses. */
const MULTI_TAP_WINDOW_MS = 500;

export default function Header() {
  const [isModalVisible, setModalVisible] = useState(false);
  const [isLoggerVisible, setIsLoggerVisible] = useState(false);
  const avatarClickCount = useRef(0);
  const sequenceStartRef = useRef(0);
  const avatarClickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userProfile = useAppStore((state) => state.userProfile);
  const insets = useSafeAreaInsets();
  const scrolled = useHeaderStore((state) => state.scrolled);
  const { colors, scheme } = useTheme();

  const handleAvatarPress = () => {
    const now = Date.now();

    if (
      avatarClickCount.current === 0
      || now - sequenceStartRef.current > MULTI_TAP_WINDOW_MS
    ) {
      avatarClickCount.current = 0;
      sequenceStartRef.current = now;
    }

    avatarClickCount.current += 1;

    if (avatarClickTimer.current) {
      clearTimeout(avatarClickTimer.current);
    }

    if (avatarClickCount.current >= 5) {
      avatarClickCount.current = 0;
      setIsLoggerVisible(true);
      return;
    }

    const remaining = MULTI_TAP_WINDOW_MS - (now - sequenceStartRef.current);

    avatarClickTimer.current = setTimeout(() => {
      if (avatarClickCount.current === 1) {
        setModalVisible(true);
      }
      avatarClickCount.current = 0;
      avatarClickTimer.current = null;
    }, Math.max(remaining, 0));
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
        style={{
          paddingTop: Math.max(insets.top, 10) + 6,
          paddingHorizontal: 24,
          paddingBottom: 8,
          flexDirection: 'row',
          justifyContent: 'flex-end',
          alignItems: 'center',
          width: '100%',
        }}
      >
        <HeaderAvatarButton
          avatarUrl={userProfile.avatarUrl}
          onPress={handleAvatarPress}
        />
      </View>

      {isModalVisible ? (
        <UserSettingsModal
          isVisible={isModalVisible}
          onClose={() => setModalVisible(false)}
        />
      ) : null}

      {isLoggerVisible ? (
        <LoggerDebugPanel
          isVisible={isLoggerVisible}
          onClose={() => setIsLoggerVisible(false)}
        />
      ) : null}
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
