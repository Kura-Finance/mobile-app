import React, { useEffect, useState } from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import LoadingDots from '../../../shared/components/LoadingDots';
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
  const [imageFailed, setImageFailed] = useState(false);
  const hasAvatar = Boolean(avatarUrl?.trim()) && !imageFailed;

  useEffect(() => {
    setImageFailed(false);
  }, [avatarUrl]);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 40 }}>
      <TouchableOpacity 
        onPress={onAvatarPress}
        disabled={isLoadingAvatar}
        style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginRight: 16, borderWidth: 2, borderColor: colors.surface, overflow: 'hidden', position: 'relative' }}
      >
        {hasAvatar ? (
          <Image 
            source={{ uri: avatarUrl!.trim() }} 
            style={{ width: '100%', height: '100%' }}
            onError={() => setImageFailed(true)}
          />
        ) : (
          <Ionicons name="person" size={32} color="#FFFFFF" />
        )}
        {isLoadingAvatar ? (
          <View style={{ position: 'absolute', width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }}>
            <LoadingDots compact color="#FFFFFF" size={6}    />
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
