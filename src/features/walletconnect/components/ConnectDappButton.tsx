import React, { useMemo } from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../shared/theme/theme';
import { useKuraWalletConnect } from '../context/KuraWalletConnectContext';
import WalletConnectIcon from './WalletConnectIcon';

interface Props {
  /** Match the former portfolio refresh icon button (36×36 circle). */
  variant?: 'icon' | 'pill';
}

export default function ConnectDappButton({ variant = 'icon' }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const st = useMemo(() => makeStyles(colors), [colors]);
  const navigation = useNavigation<any>();
  const { activeSessions } = useKuraWalletConnect();

  const count = activeSessions.length;
  const label = count > 0
    ? t('walletConnect.connectedCount', { count })
    : t('walletConnect.connectDapp');
  const iconColor = count > 0 ? colors.primary : '#3B99FC';

  const openManage = () => navigation.navigate('ConnectedDapps');

  if (variant === 'pill') {
    return (
      <TouchableOpacity
        style={st.pillBtn}
        onPress={openManage}
        activeOpacity={0.8}
      >
        <WalletConnectIcon size={18} color={iconColor} />
        <Text style={st.pillText} numberOfLines={1}>{label}</Text>
        {count > 0 && (
          <View style={st.badge}>
            <Text style={st.badgeText}>{count}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={openManage}
      style={st.iconBtn}
      activeOpacity={0.7}
      accessibilityLabel={label}
    >
      <WalletConnectIcon size={18} color={iconColor} />
      {count > 0 && (
        <View style={st.iconBadge}>
          <Text style={st.iconBadgeText}>{count > 9 ? '9+' : count}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    iconBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconBadge: {
      position: 'absolute',
      top: -4,
      right: -4,
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
      borderWidth: 1.5,
      borderColor: c.background,
    },
    iconBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800' },
    pillBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: c.surface,
      borderRadius: 28,
      paddingVertical: 14,
      borderWidth: 1,
      borderColor: c.borderStrong,
    },
    pillText: {
      color: c.text,
      fontSize: 14,
      fontWeight: '600',
      flexShrink: 1,
    },
    badge: {
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: c.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 6,
    },
    badgeText: { color: c.primary, fontSize: 11, fontWeight: '700' },
  });
}
