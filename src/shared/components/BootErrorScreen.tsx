import LoadingDots from './LoadingDots';
import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';

export type BootErrorIcon = 'cloud-offline' | 'alert-circle' | 'settings';

export interface BootErrorAction {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  loading?: boolean;
}

interface BootErrorScreenProps {
  icon?: BootErrorIcon;
  title: string;
  message: string;
  actions?: BootErrorAction[];
}

const ICON_MAP: Record<
  BootErrorIcon,
  { name: keyof typeof Ionicons.glyphMap; bg: string; color: string }
> = {
  'cloud-offline': {
    name: 'cloud-offline-outline',
    bg: 'rgba(245, 158, 11, 0.12)',
    color: '#D97706',
  },
  'alert-circle': {
    name: 'alert-circle-outline',
    bg: 'rgba(239, 68, 68, 0.10)',
    color: '#DC2626',
  },
  settings: {
    name: 'settings-outline',
    bg: 'rgba(124, 58, 237, 0.10)',
    color: '#7C3AED',
  },
};

/** Full-screen boot / auth error — white background, calm copy, clear actions. */
export default function BootErrorScreen({
  icon = 'alert-circle',
  title,
  message,
  actions = [],
}: BootErrorScreenProps) {
  const iconMeta = ICON_MAP[icon];
  const styles = useMemo(() => makeStyles(), []);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <StatusBar style="dark" translucent />
      <View style={styles.body}>
        <View style={[styles.iconWrap, { backgroundColor: iconMeta.bg }]}>
          <Ionicons name={iconMeta.name} size={32} color={iconMeta.color} />
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
      </View>

      {actions.length > 0 ? (
        <View style={styles.actions}>
          {actions.map((action) => {
            const isPrimary = action.variant !== 'secondary';
            return (
              <TouchableOpacity
                key={action.label}
                onPress={action.onPress}
                disabled={action.loading}
                activeOpacity={0.85}
                style={[
                  isPrimary ? styles.primaryBtn : styles.secondaryBtn,
                  action.loading && styles.btnDisabled,
                ]}
              >
                {action.loading ? (
                  <LoadingDots
                    compact
                    color={isPrimary ? '#FFFFFF' : '#7C3AED'}
                    size={6}
                  />
                ) : (
                  <Text
                    style={isPrimary ? styles.primaryBtnText : styles.secondaryBtnText}
                  >
                    {action.label}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function makeStyles() {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: '#FFFFFF',
    },
    body: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 32,
    },
    iconWrap: {
      width: 72,
      height: 72,
      borderRadius: 36,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 24,
    },
    title: {
      fontSize: 22,
      fontWeight: '700',
      color: '#0B0B0F',
      textAlign: 'center',
      marginBottom: 12,
      letterSpacing: -0.3,
    },
    message: {
      fontSize: 15,
      lineHeight: 22,
      color: '#6B7280',
      textAlign: 'center',
    },
    actions: {
      paddingHorizontal: 24,
      paddingBottom: 8,
      gap: 10,
    },
    primaryBtn: {
      backgroundColor: '#7C3AED',
      paddingVertical: 16,
      borderRadius: 14,
      alignItems: 'center',
      shadowColor: '#7C3AED',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 10,
    },
    secondaryBtn: {
      paddingVertical: 14,
      borderRadius: 14,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: 'rgba(0,0,0,0.08)',
      backgroundColor: '#FFFFFF',
    },
    primaryBtnText: {
      fontSize: 16,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    secondaryBtnText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#0B0B0F',
    },
    btnDisabled: {
      opacity: 0.7,
    },
  });
}
