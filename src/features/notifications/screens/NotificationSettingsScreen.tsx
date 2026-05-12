import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Switch,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useNotificationStore } from '../../../shared/store/notification';
import type { NotificationPreferences } from '../../../shared/store/notification/types';
import { useAppStore } from '../../../shared/store/useAppStore';
import { useTheme } from '../../../shared/theme/ThemeContext';
import Logger from '../../../shared/utils/Logger';

const DEFAULT_PREFERENCES: NotificationPreferences = {
  enableEmailNotifications: true,
  enablePushNotifications: true,
  enableInAppNotifications: true,
  priceAlertThreshold: 5,
  accountActivityAlerts: true,
  transactionAlerts: true,
  systemAlerts: true,
  securityAlerts: true,
  unsubscribeAll: false,
};

type ToggleKey = Exclude<keyof NotificationPreferences, 'priceAlertThreshold' | 'userId'>;

interface ToggleRow {
  key: ToggleKey;
  label: string;
  description: string;
}

const CHANNEL_ROWS: ToggleRow[] = [
  {
    key: 'enableEmailNotifications',
    label: 'Email notifications',
    description: 'Receive notifications by email',
  },
  {
    key: 'enablePushNotifications',
    label: 'Push notifications',
    description: 'Receive notifications on this device',
  },
  {
    key: 'enableInAppNotifications',
    label: 'In-app notifications',
    description: 'Show notifications inside Kura',
  },
];

const CATEGORY_ROWS: ToggleRow[] = [
  {
    key: 'transactionAlerts',
    label: 'Transaction alerts',
    description: 'Buys, sells, transfers',
  },
  {
    key: 'accountActivityAlerts',
    label: 'Account activity',
    description: 'Logins, profile + email changes',
  },
  {
    key: 'systemAlerts',
    label: 'System messages',
    description: 'Service announcements + maintenance',
  },
  {
    key: 'securityAlerts',
    label: 'Security alerts',
    description: 'Suspicious activity, key rotations',
  },
];

const UNSUBSCRIBE_ROW: ToggleRow = {
  key: 'unsubscribeAll',
  label: 'Unsubscribe from all',
  description: 'Mute every channel until manually re-enabled',
};

export default function NotificationSettingsScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const authToken = useAppStore((state) => state.authToken);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const navigation = useNavigation<any>();

  const remotePreferences = useNotificationStore((state) => state.preferences);
  const loadPreferences = useNotificationStore((state) => state.loadPreferences);
  const updatePreferences = useNotificationStore((state) => state.updatePreferences);

  const [local, setLocal] = useState<NotificationPreferences>(remotePreferences ?? DEFAULT_PREFERENCES);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!authToken) return;
    setIsLoading(true);
    void loadPreferences().finally(() => setIsLoading(false));
  }, [authToken, loadPreferences]);

  useEffect(() => {
    if (remotePreferences) setLocal(remotePreferences);
  }, [remotePreferences]);

  const handleToggle = async (key: ToggleKey) => {
    const next = !local[key];
    const prev = local;
    const optimistic: NotificationPreferences = { ...local, [key]: next };
    setLocal(optimistic);

    setIsSaving(true);
    try {
      await updatePreferences({ [key]: next });
    } catch (error) {
      setLocal(prev);
      const message = error instanceof Error ? error.message : 'Failed to update preference';
      Alert.alert('Error', message);
      Logger.warn('NotificationSettings', 'update failed', { key, error: message });
    } finally {
      setIsSaving(false);
    }
  };

  const renderToggle = (row: ToggleRow) => (
    <View
      key={row.key}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <View style={{ flex: 1, marginRight: 12 }}>
        <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600', marginBottom: 4 }}>
          {row.label}
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>{row.description}</Text>
      </View>
      <Switch
        value={local[row.key]}
        onValueChange={() => handleToggle(row.key)}
        disabled={isSaving}
        trackColor={{ false: colors.surfaceInput, true: colors.primary }}
        thumbColor="#FFFFFF"
      />
    </View>
  );

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        paddingTop: Math.max(insets.top, 10),
      }}
    >
      <View style={{ paddingHorizontal: 24, paddingVertical: 16, flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 12 }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={{ color: colors.text, fontSize: 24, fontWeight: 'bold' }}>Settings</Text>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1, paddingHorizontal: 24 }}
          contentContainerStyle={{ paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        >
          <Text
            style={{
              color: colors.textFaint,
              fontSize: 12,
              fontWeight: '600',
              textTransform: 'uppercase',
              letterSpacing: 0.4,
              marginTop: 8,
              marginBottom: 8,
            }}
          >
            Channels
          </Text>
          {CHANNEL_ROWS.map(renderToggle)}

          <Text
            style={{
              color: colors.textFaint,
              fontSize: 12,
              fontWeight: '600',
              textTransform: 'uppercase',
              letterSpacing: 0.4,
              marginTop: 24,
              marginBottom: 8,
            }}
          >
            Categories
          </Text>
          {CATEGORY_ROWS.map(renderToggle)}

          <Text
            style={{
              color: colors.textFaint,
              fontSize: 12,
              fontWeight: '600',
              textTransform: 'uppercase',
              letterSpacing: 0.4,
              marginTop: 24,
              marginBottom: 8,
            }}
          >
            Master switch
          </Text>
          {renderToggle(UNSUBSCRIBE_ROW)}
        </ScrollView>
      )}
    </View>
  );
}
