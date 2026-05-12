import React from 'react';
import { View, Text, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../shared/theme/ThemeContext';

interface UserProfileProps {
  displayName: string;
  email: string;
  avatarUrl?: string;
  onAvatarPress?: () => void;
  isLoadingAvatar?: boolean;
}

export default function UserProfile({ displayName, email, avatarUrl, onAvatarPress, isLoadingAvatar }: UserProfileProps) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 40 }}>
      <TouchableOpacity 
        onPress={onAvatarPress}
        disabled={isLoadingAvatar}
        style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginRight: 16, borderWidth: 2, borderColor: colors.surface, overflow: 'hidden', position: 'relative' }}
      >
        {avatarUrl ? (
          <Image 
            source={{ uri: avatarUrl }} 
            style={{ width: '100%', height: '100%' }}
          />
        ) : (
          <Text style={{ color: colors.white, fontSize: 28, fontWeight: 'bold' }}>{displayName.trim() ? displayName.trim().slice(0, 1).toUpperCase() : '?'}</Text>
        )}
        {isLoadingAvatar ? (
          <View style={{ position: 'absolute', width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color="#FFFFFF" size="small" />
          </View>
        ) : (
          <View style={{ position: 'absolute', width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="camera" size={16} color="#FFFFFF" style={{ opacity: 0 }} />
          </View>
        )}
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 18 }}>{displayName || 'Signed out'}</Text>
        <Text style={{ color: colors.textMuted, fontSize: 14, marginTop: 2 }}>{email || 'No email available'}</Text>
      </View>
    </View>
  );
}
