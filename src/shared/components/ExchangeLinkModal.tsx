import LoadingDots from './LoadingDots';
/**
 * ExchangeLinkModal - Modal for connecting crypto exchange accounts
 * Collects API credentials and sends to backend for CCXT processing
 */

import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Keyboard,
  TextInput,
  ScrollView,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Logger from '../utils/Logger';
import { useTheme } from '../theme/ThemeContext';
import { getUsableAuthToken, useSessionUsable } from '../../lib/security/sessionAccess';
import { useExchangeStore } from '../store/useExchangeStore';
import {
  connectExchange as connectExchangeAccount,
  getSupportedExchanges,
  type ExchangeCredentials,
  type SupportedExchange,
} from '../../lib/api/exchange';

import { logoDevImageSource } from '../../config/logodev';

interface ExchangeLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function ExchangeLinkModal({
  isOpen,
  onClose,
  onSuccess,
}: ExchangeLinkModalProps) {
  const { colors } = useTheme();
  const sessionUsable = useSessionUsable();
  const { fetchExchangeBalances, addExchangeAccount } = useExchangeStore();
  const connectedExchanges = useExchangeStore((state) => state.exchangeAccounts);

  const [step, setStep] = useState<'select' | 'credentials'>('select');
  const [supportedExchanges, setSupportedExchanges] = useState<SupportedExchange[]>([]);
  const [selectedExchange, setSelectedExchange] = useState<SupportedExchange | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [accountName, setAccountName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingExchanges, setIsLoadingExchanges] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [failedIcons, setFailedIcons] = useState<Set<string>>(new Set());

  // Fetch supported exchanges on mount
  useEffect(() => {
    const loadSupportedExchanges = async () => {
      try {
        setIsLoadingExchanges(true);
        setSupportedExchanges([]); // Reset on reload
        Logger.debug('ExchangeLinkModal', 'Loading supported exchanges');
        
        // Pass authToken if available (convert null to undefined)
        const exchanges = await getSupportedExchanges();
        
        Logger.debug('ExchangeLinkModal', 'Exchanges received from API', {
          count: exchanges.length,
          exchanges: exchanges,
        });
        
        Logger.debug('ExchangeLinkModal', 'Setting supportedExchanges state', {
          count: exchanges.length,
        });
        
        setSupportedExchanges(exchanges);
        
        Logger.info('ExchangeLinkModal', 'Supported exchanges loaded', {
          count: exchanges.length,
          stateCount: exchanges.length,
        });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to load exchanges';
        Logger.error('ExchangeLinkModal', 'Failed to load supported exchanges', {
          error: errorMsg,
        });
        Alert.alert('Error', 'Failed to load supported exchanges');
        setSupportedExchanges([]); // Reset on error
      } finally {
        setIsLoadingExchanges(false);
      }
    };

    if (isOpen) {
      loadSupportedExchanges();
    }
  }, [isOpen, sessionUsable]);

  // Hide exchanges that are already connected & active — connection status is
  // driven by GET /accounts, not by re-entering API keys. Users re-link via the
  // Connected Accounts screen (disconnect → reconnect) instead.
  const connectedExchangeIds = new Set(
    connectedExchanges
      .filter((acc) => acc.isActive !== false)
      .map((acc) => acc.exchange.toLowerCase()),
  );
  const availableExchanges = supportedExchanges.filter(
    (ex) => !connectedExchangeIds.has(ex.id.toLowerCase()),
  );

  const handleSelectExchange = (exchange: SupportedExchange) => {
    setSelectedExchange(exchange);
    setAccountName(`${exchange.displayName} Account`);
    setApiKey('');
    setApiSecret('');
    setPassphrase('');
    setError(null);
    setStep('credentials');
  };

  const handleIconLoadError = (exchangeId: string) => {
    setFailedIcons(prev => new Set([...prev, exchangeId]));
  };

  const handleBack = () => {
    setStep('select');
    setSelectedExchange(null);
    setApiKey('');
    setApiSecret('');
    setPassphrase('');
    setAccountName('');
    setError(null);
  };

  const handleValidateAndConnect = async () => {
    const authToken = getUsableAuthToken();
    if (!selectedExchange || !authToken) {
      setError(authToken ? 'Missing exchange information' : 'Please log in to connect an exchange');
      return;
    }

    if (!apiKey.trim() || !apiSecret.trim()) {
      setError('API Key and Secret are required');
      return;
    }

    if (selectedExchange.requiresPassphrase && !passphrase.trim()) {
      setError('Passphrase is required for this exchange');
      return;
    }

    if (!accountName.trim()) {
      setError('Account name is required');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const credentials: ExchangeCredentials = {
        exchange: selectedExchange.id,
        apiKey: apiKey.trim(),
        apiSecret: apiSecret.trim(),
        passphrase: passphrase.trim() || undefined,
      };

      // Connect account - backend will validate and use CCXT
      Logger.debug('ExchangeLinkModal', 'Connecting exchange account', {
        exchange: selectedExchange.id,
      });

      const { account: connectedAccount } = await connectExchangeAccount(credentials);

      // Validate backend response contains required fields
      if (!connectedAccount?.id || !connectedAccount?.exchange) {
        Logger.error('ExchangeLinkModal', 'Backend returned incomplete exchange account', {
          has_id: !!connectedAccount?.id,
          has_exchange: !!connectedAccount?.exchange,
          response: JSON.stringify(connectedAccount).substring(0, 200),
        });
        setError('Backend error: Invalid account response. Please try again.');
        return;
      }

      addExchangeAccount(connectedAccount);

      // Attempt to fetch initial balances
      try {
        await fetchExchangeBalances(connectedAccount.id, authToken, true);
      } catch (balanceErr) {
        Logger.error('ExchangeLinkModal', 'Failed to fetch initial balances', {
          error: balanceErr,
        });
        // Don't fail - account is connected, just couldn't load balances yet
      }

      Logger.info('ExchangeLinkModal', 'Exchange account connected successfully', {
        exchange: selectedExchange.id,
      });

      Alert.alert('Success', `Connected to ${selectedExchange.displayName}!`);

      // Reset and close
      setStep('select');
      setSelectedExchange(null);
      setApiKey('');
      setApiSecret('');
      setPassphrase('');
      setAccountName('');
      setError(null);
      setIsLoading(false);

      onSuccess?.();
      onClose();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to connect exchange';
      Logger.error('ExchangeLinkModal', 'Connection failed', { error: errorMsg });
      
      // Filter out Kraken Invalid key error from UI display
      if (errorMsg.toLowerCase().includes('kraken') && errorMsg.toLowerCase().includes('invalid')) {
        // Log but don't show this specific error to user
        Logger.warn('ExchangeLinkModal', 'Kraken invalid key - suppressed from UI', { error: errorMsg });
        setError('Failed to connect. Please check your API credentials.');
      } else {
        setError(errorMsg);
      }
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    Keyboard.dismiss();
    setStep('select');
    setSelectedExchange(null);
    setApiKey('');
    setApiSecret('');
    setPassphrase('');
    setAccountName('');
    setError(null);
    setIsLoading(false);
    setFailedIcons(new Set()); // Reset failed icons on close
    // supportedExchanges state persists for next open
    onClose();
  };

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
      onDismiss={() => {
        Keyboard.dismiss();
      }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View
            style={{
              flex: 1,
              backgroundColor: colors.overlay,
              justifyContent: 'flex-end',
            }}
          >
          {/* Modal Content */}
          <View
            style={{
              backgroundColor: colors.backgroundElevated,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingTop: 24,
              paddingHorizontal: 24,
              paddingBottom: 32,
              maxHeight: '90%',
              borderTopWidth: 1,
              borderTopColor: colors.border,
            }}
            onStartShouldSetResponder={() => true}
            onResponderTerminationRequest={() => false}
          >
            {/* Header */}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 20,
              }}
            >
              {step === 'credentials' && (
                <TouchableOpacity onPress={handleBack}>
                  <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
              )}
              {step === 'select' && <View style={{ width: 24 }} />}

              <Text
                style={{
                  fontSize: 18,
                  fontWeight: '700',
                  color: colors.text,
                  flex: 1,
                  textAlign: 'center',
                }}
              >
                {step === 'select' ? 'Select Exchange' : 'Enter Credentials'}
              </Text>

              <TouchableOpacity onPress={handleClose}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Content */}
            <ScrollView
              scrollEnabled={true}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ flexGrow: 1, paddingBottom: 16 }}
            >
              {step === 'select' && (
                <View style={{ gap: 12, flex: availableExchanges.length > 0 ? 0 : 1, justifyContent: availableExchanges.length > 0 ? 'flex-start' : 'center' }}>
                  {isLoadingExchanges ? (
                    <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                      <LoadingDots color={colors.primary} size={10}    />
                      <Text style={{ color: colors.textMuted, marginTop: 16, fontSize: 14 }}>
                        Loading exchanges...
                      </Text>
                    </View>
                  ) : availableExchanges.length > 0 ? (
                    availableExchanges.map(exchange => (
                      <TouchableOpacity
                        key={exchange.id}
                        onPress={() => handleSelectExchange(exchange)}
                        style={{
                          padding: 16,
                          borderRadius: 16,
                          borderWidth: 1,
                          borderColor: colors.border,
                          backgroundColor: colors.surface,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 16,
                        }}
                      >
                        {/* Exchange Logo */}
                        <View
                          style={{
                            width: 48,
                            height: 48,
                            borderRadius: 24,
                            backgroundColor: colors.primarySoft,
                            justifyContent: 'center',
                            alignItems: 'center',
                            overflow: 'hidden',
                          }}
                        >
                          {(() => {
                            const iconSource = logoDevImageSource(exchange.icon);
                            return iconSource && !failedIcons.has(exchange.id) ? (
                            <Image
                              source={iconSource}
                              style={{ width: 48, height: 48, borderRadius: 24 }}
                              onError={() => handleIconLoadError(exchange.id)}
                              resizeMode="cover"
                            />
                          ) : (
                            <Text style={{ fontSize: 24 }}>💱</Text>
                          );
                          })()}
                        </View>

                        {/* Exchange Name */}
                        <View style={{ flex: 1 }}>
                          <Text
                            style={{
                              fontSize: 16,
                              fontWeight: '600',
                              color: colors.text,
                            }}
                          >
                            {exchange.displayName}
                          </Text>
                        </View>

                        {/* Chevron */}
                        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                      </TouchableOpacity>
                    ))
                  ) : supportedExchanges.length > 0 ? (
                    // Every supported exchange is already connected.
                    <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                      <Ionicons name="checkmark-circle" size={48} color={colors.primary} />
                      <Text style={{ color: colors.text, marginTop: 16, fontSize: 15, fontWeight: '600' }}>
                        All exchanges connected
                      </Text>
                      <Text style={{ color: colors.textMuted, marginTop: 6, fontSize: 13, textAlign: 'center', paddingHorizontal: 24 }}>
                        Manage or remove connections from Connected Accounts in Settings.
                      </Text>
                    </View>
                  ) : (
                    <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                      <Ionicons name="alert-circle" size={48} color={colors.textMuted} />
                      <Text style={{ color: colors.textMuted, marginTop: 16, fontSize: 14 }}>
                        No exchanges available
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {step === 'credentials' && selectedExchange && (
                <View style={{ gap: 16 }}>
                  {/* Account Name */}
                  <View>
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '600',
                        color: colors.textMuted,
                        marginBottom: 8,
                      }}
                    >
                      ACCOUNT NAME (OPTIONAL)
                    </Text>
                    <TextInput
                      value={accountName}
                      onChangeText={setAccountName}
                      placeholder="e.g., My Trading Account"
                      placeholderTextColor={colors.textFaint}
                      style={{
                        borderWidth: 1,
                        borderColor: colors.border,
                        borderRadius: 12,
                        paddingHorizontal: 16,
                        paddingVertical: 12,
                        color: colors.text,
                        fontSize: 14,
                      }}
                    />
                  </View>

                  {/* API Key */}
                  <View>
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '600',
                        color: colors.textMuted,
                        marginBottom: 8,
                      }}
                    >
                      API KEY
                    </Text>
                    <TextInput
                      value={apiKey}
                      onChangeText={setApiKey}
                      placeholder="Enter your API Key"
                      placeholderTextColor={colors.textFaint}
                      secureTextEntry
                      style={{
                        borderWidth: 1,
                        borderColor: colors.border,
                        borderRadius: 12,
                        paddingHorizontal: 16,
                        paddingVertical: 12,
                        color: colors.text,
                        fontSize: 14,
                      }}
                    />
                  </View>

                  {/* API Secret */}
                  <View>
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '600',
                        color: colors.textMuted,
                        marginBottom: 8,
                      }}
                    >
                      API SECRET
                    </Text>
                    <TextInput
                      value={apiSecret}
                      onChangeText={setApiSecret}
                      placeholder="Enter your API Secret"
                      placeholderTextColor={colors.textFaint}
                      secureTextEntry
                      style={{
                        borderWidth: 1,
                        borderColor: colors.border,
                        borderRadius: 12,
                        paddingHorizontal: 16,
                        paddingVertical: 12,
                        color: colors.text,
                        fontSize: 14,
                      }}
                    />
                  </View>

                  {/* Passphrase (if required) */}
                  {selectedExchange.requiresPassphrase && (
                    <View>
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '600',
                          color: colors.textMuted,
                          marginBottom: 8,
                        }}
                      >
                        PASSPHRASE
                      </Text>
                      <TextInput
                        value={passphrase}
                        onChangeText={setPassphrase}
                        placeholder="Enter your Passphrase"
                        placeholderTextColor={colors.textFaint}
                        secureTextEntry
                        style={{
                          borderWidth: 1,
                          borderColor: colors.border,
                          borderRadius: 12,
                          paddingHorizontal: 16,
                          paddingVertical: 12,
                          color: colors.text,
                          fontSize: 14,
                        }}
                      />
                    </View>
                  )}

                  {/* Error Message */}
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

                  {/* Security Notice */}
                  <View
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      borderRadius: 12,
                      backgroundColor: 'rgba(59, 130, 246, 0.1)',
                      borderWidth: 1,
                      borderColor: 'rgba(59, 130, 246, 0.2)',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        color: '#93C5FD',
                        lineHeight: 16,
                      }}
                    >
                      🔒 Your API credentials are encrypted and stored securely on our servers. We never have access to your funds - only read-only permissions.
                    </Text>
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Footer Buttons */}
            {step === 'credentials' && (
              <View style={{ gap: 12, marginTop: 20 }}>
                <TouchableOpacity
                  onPress={handleValidateAndConnect}
                  disabled={isLoading}
                  style={{
                    paddingVertical: 14,
                    borderRadius: 12,
                    backgroundColor: colors.primary,
                    justifyContent: 'center',
                    alignItems: 'center',
                    opacity: isLoading ? 0.6 : 1,
                  }}
                >
                  {isLoading ? (
                    <LoadingDots compact color="#FFFFFF" size={6}    />
                  ) : (
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: '600',
                        color: '#FFFFFF',
                      }}
                    >
                      Connect {selectedExchange?.displayName}
                    </Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleBack}
                  disabled={isLoading}
                  style={{
                    paddingVertical: 12,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: '500',
                      color: colors.textMuted,
                    }}
                  >
                    Back
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
}
