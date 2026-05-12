import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useAppStore } from '../store/useAppStore';
import { useTheme } from '../theme/ThemeContext';
import Logger from '../utils/Logger';

interface DeleteAccountConfirmModalProps {
  visible: boolean;
  onDismiss: () => void;
  onSuccess: () => void;
}

export const DeleteAccountConfirmModal: React.FC<DeleteAccountConfirmModalProps> = ({
  visible,
  onDismiss,
  onSuccess,
}) => {
  const { colors } = useTheme();
  const [confirmTyped, setConfirmTyped] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const deleteAccount = useAppStore((state) => state.deleteAccount);

  const handleDeleteAccount = async () => {
    if (!confirmTyped) {
      Alert.alert('Confirm', 'Please tap "I understand" to confirm');
      return;
    }

    setIsLoading(true);
    try {
      await deleteAccount();
      setConfirmTyped(false);
      onDismiss();
      onSuccess();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to delete account';
      Logger.error('DeleteAccountConfirmModal', 'Delete account failed', { error });
      Alert.alert('Error', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setConfirmTyped(false);
    onDismiss();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleCancel}
    >
      <View style={{ flex: 1, backgroundColor: colors.overlay }}>
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: 20,
          }}
        >
          <View
            style={{
              backgroundColor: colors.backgroundElevated,
              borderRadius: 16,
              padding: 24,
              width: '100%',
              maxWidth: 400,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text
              style={{
                fontSize: 18,
                fontWeight: '600',
                color: colors.text,
                marginBottom: 12,
              }}
            >
              Delete Account?
            </Text>

            <Text
              style={{
                fontSize: 14,
                color: colors.textMuted,
                marginBottom: 20,
                lineHeight: 20,
              }}
            >
              This action cannot be undone. All your data, accounts, and investments will be permanently deleted.
            </Text>

            <TouchableOpacity
              onPress={() => setConfirmTyped((v) => !v)}
              disabled={isLoading}
              style={{
                marginBottom: 20,
                paddingVertical: 12,
                paddingHorizontal: 14,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: confirmTyped ? colors.danger : colors.border,
                backgroundColor: confirmTyped ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
              }}
            >
              <Text style={{ color: confirmTyped ? '#FCA5A5' : colors.textMuted, fontSize: 13, fontWeight: '600' }}>
                {confirmTyped ? '✓ I understand this is permanent' : 'Tap to confirm: this is permanent'}
              </Text>
            </TouchableOpacity>

            <View
              style={{
                flexDirection: 'row',
                gap: 12,
              }}
            >
              <TouchableOpacity
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onPress={handleCancel}
                disabled={isLoading}
              >
                <Text
                  style={{
                    color: colors.text,
                    fontSize: 14,
                    fontWeight: '600',
                  }}
                >
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 8,
                  backgroundColor: colors.danger,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onPress={handleDeleteAccount}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text
                    style={{
                      color: 'white',
                      fontSize: 14,
                      fontWeight: '600',
                    }}
                  >
                    Delete Account
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};
