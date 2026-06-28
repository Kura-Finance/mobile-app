import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, TouchableWithoutFeedback, Keyboard } from 'react-native';
import LoadingDots from './LoadingDots';
import { Ionicons } from '@expo/vector-icons';
import Logger from '../utils/Logger';
import { useTheme } from '../theme/ThemeContext';
import { useWalletSync } from '../hooks/useWalletSync';

interface ConnectAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPlaidPress?: () => void;
  onWeb3Press?: () => void;
  onExchangePress?: () => void;
}

export default function ConnectAccountModal({
  isOpen,
  onClose,
  onPlaidPress,
  onWeb3Press,
  onExchangePress,
}: ConnectAccountModalProps) {
  const { colors } = useTheme();
  const { openWallet } = useWalletSync();
  const [isConnecting, setIsConnecting] = useState<'plaid' | 'web3' | 'exchange' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePlaidPress = () => {
    try {
      setIsConnecting('plaid');
      setError(null);
      // 直接通知父组件打开 PlaidLinkModal
      // PlaidLinkModal 会自动处理所有 Plaid 逻辑
      onClose();
      setTimeout(() => {
        setIsConnecting(null);
        onPlaidPress?.();
      }, 200);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to open Plaid';
      setError(errorMsg);
      setIsConnecting(null);
      Logger.error('ConnectAccountModal', 'Failed to open Plaid', { error: errorMsg });
    }
  };

  const handleWeb3Press = () => {
    try {
      setIsConnecting('web3');
      setError(null);
      
      // Close ConnectAccountModal and open AppKit modal
      onClose();
      
      // Small delay to ensure modal closes smoothly
      setTimeout(async () => {
        try {
          // Use WalletSync hook to open wallet - this is async
          await openWallet();
          Logger.info('ConnectAccountModal', 'Wallet modal opened successfully');
          setIsConnecting(null);
          
          // Also notify parent component if callback provided
          onWeb3Press?.();
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Failed to open Web3 wallet';
          Logger.error('ConnectAccountModal', 'Error opening wallet', { error: errorMsg });
          setError(errorMsg);
          setIsConnecting(null);
        }
      }, 200);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to open Web3 wallet';
      setError(errorMsg);
      setIsConnecting(null);
      Logger.error('ConnectAccountModal', 'Failed to open Web3 wallet', { error: errorMsg });
    }
  };

  const handleExchangePress = () => {
    try {
      setIsConnecting('exchange');
      setError(null);
      
      // Close ConnectAccountModal
      onClose();
      
      // Small delay to ensure modal closes smoothly
      setTimeout(() => {
        setIsConnecting(null);
        onExchangePress?.();
      }, 200);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to open exchange';
      setError(errorMsg);
      setIsConnecting(null);
      Logger.error('ConnectAccountModal', 'Failed to open exchange', { error: errorMsg });
    }
  };

  const handleClose = () => {
    Keyboard.dismiss();
    setError(null);
    setIsConnecting(null);
    onClose();
  };

  return (
    <>
      <Modal 
        visible={isOpen} 
        transparent 
        animationType="fade" 
        onRequestClose={handleClose}
        onDismiss={() => {
          Keyboard.dismiss();
        }}
      >
        <TouchableWithoutFeedback onPress={handleClose}>
          <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', alignItems: 'center' }}>
            {/* Card - use View instead of TouchableWithoutFeedback to avoid event conflicts */}
            <View
              style={{
                width: '85%',
                backgroundColor: colors.backgroundElevated,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: colors.border,
                overflow: 'hidden',
              }}
              onStartShouldSetResponder={() => true}
              onResponderTerminationRequest={() => false}
            >
                {/* Header */}
                <View
                  style={{
                    paddingTop: 24,
                    paddingHorizontal: 24,
                    paddingBottom: 20,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                  }}
                >
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 4 }}>Connect Account</Text>
                    <Text style={{ fontSize: 13, color: colors.textMuted }}>Select the type of account to link.</Text>
                  </View>
                  <TouchableOpacity
                    onPress={handleClose}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: colors.surface,
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    <Ionicons name="close" size={20} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>

                {/* Content */}
                <View style={{ padding: 24, gap: 16 }}>
                  {error && (
                    <View
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        borderRadius: 12,
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        borderWidth: 1,
                        borderColor: 'rgba(239, 68, 68, 0.2)',
                      }}
                    >
                      <Text style={{ fontSize: 12, color: '#FCA5A5' }}>{error}</Text>
                    </View>
                  )}

                  {/* Plaid Button */}
                  <TouchableOpacity
                    onPress={handlePlaidPress}
                    disabled={isConnecting !== null}
                    style={{
                      padding: 16,
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: isConnecting === 'plaid' ? 'rgba(139, 92, 246, 0.5)' : colors.border,
                      backgroundColor: isConnecting === 'plaid' ? 'rgba(139, 92, 246, 0.1)' : colors.surface,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 16,
                    }}
                  >
                    {/* Icon */}
                    <View
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 12,
                        backgroundColor: 'rgba(139, 92, 246, 0.2)',
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                    >
                      <Ionicons name="card-outline" size={24} color="#8B5CF6" />
                    </View>

                    {/* Content */}
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 16, fontWeight: '600', color: '#8B5CF6', marginBottom: 4 }}>Plaid</Text>
                      <Text style={{ fontSize: 12, color: colors.textMuted, lineHeight: 16 }}>Connect bank & brokerage accounts</Text>
                    </View>

                    {/* Spinner or Arrow */}
                    {isConnecting === 'plaid' ? (
                      <LoadingDots compact color="#8B5CF6" size={6}    />
                    ) : (
                      <Ionicons name="chevron-forward" size={20} color="#8B5CF6" />
                    )}
                  </TouchableOpacity>

                  {/* AppKit Wallet Button */}
                  <TouchableOpacity
                    onPress={handleWeb3Press}
                    disabled={isConnecting !== null}
                    style={{
                      padding: 16,
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: isConnecting === 'web3' ? 'rgba(59, 130, 246, 0.5)' : colors.border,
                      backgroundColor: isConnecting === 'web3' ? 'rgba(59, 130, 246, 0.1)' : colors.surface,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 16,
                    }}
                  >
                    {/* Icon */}
                    <View
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 12,
                        backgroundColor: 'rgba(59, 130, 246, 0.2)',
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                    >
                      <Ionicons name="wallet" size={24} color="#3B82F6" />
                    </View>

                    {/* Content */}
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 16, fontWeight: '600', color: '#3B82F6', marginBottom: 4 }}>Reown AppKit</Text>
                      <Text style={{ fontSize: 12, color: colors.textMuted, lineHeight: 16 }}>Connect Web3 wallets</Text>
                    </View>

                    {/* Spinner or Arrow */}
                    {isConnecting === 'web3' ? (
                      <LoadingDots compact color="#3B82F6" size={6}    />
                    ) : (
                      <Ionicons name="chevron-forward" size={20} color="#3B82F6" />
                    )}
                  </TouchableOpacity>

                  {/* Exchange Button */}
                  <TouchableOpacity
                    onPress={handleExchangePress}
                    disabled={isConnecting !== null}
                    style={{
                      padding: 16,
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: isConnecting === 'exchange' ? 'rgba(34, 197, 94, 0.5)' : colors.border,
                      backgroundColor: isConnecting === 'exchange' ? 'rgba(34, 197, 94, 0.1)' : colors.surface,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 16,
                    }}
                  >
                    {/* Icon */}
                    <View
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 12,
                        backgroundColor: 'rgba(34, 197, 94, 0.2)',
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                    >
                      <Ionicons name="swap-horizontal" size={24} color="#22C55E" />
                    </View>

                    {/* Content */}
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 16, fontWeight: '600', color: '#22C55E', marginBottom: 4 }}>Exchange</Text>
                      <Text style={{ fontSize: 12, color: colors.textMuted, lineHeight: 16 }}>Connect crypto exchange accounts</Text>
                    </View>

                    {/* Spinner or Arrow */}
                    {isConnecting === 'exchange' ? (
                      <LoadingDots compact color="#22C55E" size={6}    />
                    ) : (
                      <Ionicons name="chevron-forward" size={20} color="#22C55E" />
                    )}
                  </TouchableOpacity>
                </View>
              </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
}
