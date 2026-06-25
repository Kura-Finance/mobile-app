import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Easing,
  Linking,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import * as Clipboard from 'expo-clipboard';
import { isWalletConnectUri } from '../../../lib/walletconnect/constants';
import { useTheme } from '../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../shared/theme/theme';

const { width: SW } = Dimensions.get('window');
const FRAME = Math.min(SW * 0.72, 280);
const DIM = 'rgba(0,0,0,0.62)';

interface Props {
  visible: boolean;
  onClose: () => void;
  onUri: (uri: string) => void | Promise<void>;
}

function ScanLine() {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1,
          duration: 2200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 2200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [8, FRAME - 12],
  });

  return (
    <Animated.View
      style={[styles.scanLine, { transform: [{ translateY }] }]}
      pointerEvents="none"
    />
  );
}

export default function WcPairScannerModal({ visible, onClose, onUri }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const st = useMemo(() => makeStyles(colors), [colors]);

  const [permission, requestPermission] = useCameraPermissions();
  const [torchOn, setTorchOn] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  const [pasteValue, setPasteValue] = useState('');
  const [pasteError, setPasteError] = useState('');
  const [scanError, setScanError] = useState('');
  const [connecting, setConnecting] = useState(false);

  const scannedRef = useRef(false);
  const scanErrorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = useCallback(() => {
    scannedRef.current = false;
    setTorchOn(false);
    setShowPaste(false);
    setPasteValue('');
    setPasteError('');
    setScanError('');
    setConnecting(false);
    if (scanErrorTimer.current) {
      clearTimeout(scanErrorTimer.current);
      scanErrorTimer.current = null;
    }
  }, []);

  useEffect(() => {
    if (visible) reset();
    else reset();
  }, [visible, reset]);

  const flashScanError = useCallback((message: string) => {
    setScanError(message);
    scannedRef.current = false;
    if (scanErrorTimer.current) clearTimeout(scanErrorTimer.current);
    scanErrorTimer.current = setTimeout(() => setScanError(''), 2400);
  }, []);

  const submitUri = useCallback(async (uri: string) => {
    const trimmed = uri.trim();
    if (!isWalletConnectUri(trimmed)) {
      throw new Error(t('walletConnect.invalidUri'));
    }
    setConnecting(true);
    try {
      await onUri(trimmed);
    } finally {
      setConnecting(false);
    }
  }, [onUri, t]);

  const handleBarcode = useCallback(({ data }: { data: string }) => {
    if (scannedRef.current || connecting) return;
    const trimmed = data.trim();
    if (!isWalletConnectUri(trimmed)) {
      flashScanError(t('walletConnect.invalidQr'));
      return;
    }
    scannedRef.current = true;
    void submitUri(trimmed).catch(() => {
      scannedRef.current = false;
      flashScanError(t('walletConnect.pairFailed'));
    });
  }, [connecting, flashScanError, submitUri, t]);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const handlePasteFromClipboard = useCallback(async () => {
    setPasteError('');
    setShowPaste(true);
    try {
      const clip = await Clipboard.getStringAsync();
      if (clip) setPasteValue(clip.trim());
    } catch {
      // User can still type manually.
    }
  }, []);

  const handlePasteConnect = useCallback(async () => {
    setPasteError('');
    try {
      await submitUri(pasteValue);
    } catch (err) {
      setPasteError(err instanceof Error ? err.message : t('walletConnect.pairFailed'));
    }
  }, [pasteValue, submitUri, t]);

  const renderPermission = () => {
    if (!permission) {
      return (
        <View style={st.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      );
    }

    if (!permission.granted) {
      const canAskAgain = permission.canAskAgain !== false;

      if (canAskAgain) {
        return (
          <View style={st.center}>
            <View style={st.permIconWrap}>
              <Ionicons name="camera-outline" size={36} color={colors.primary} />
            </View>
            <Text style={st.permTitle}>{t('walletConnect.cameraRequiredTitle')}</Text>
            <Text style={st.permHint}>{t('walletConnect.cameraRequired')}</Text>
            <TouchableOpacity
              onPress={requestPermission}
              style={st.primaryBtn}
              activeOpacity={0.85}
            >
              <Text style={st.primaryBtnText}>{t('card.continue')}</Text>
            </TouchableOpacity>
          </View>
        );
      }

      return (
        <View style={st.center}>
          <View style={st.permIconWrap}>
            <Ionicons name="camera-outline" size={36} color={colors.primary} />
          </View>
          <Text style={st.permTitle}>{t('walletConnect.cameraRequiredTitle')}</Text>
          <Text style={st.permHint}>{t('walletConnect.cameraPermissionDenied')}</Text>
          <TouchableOpacity
            onPress={() => void Linking.openSettings()}
            style={st.primaryBtn}
            activeOpacity={0.85}
          >
            <Text style={st.primaryBtnText}>{t('card.openSettings')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handlePasteFromClipboard} style={st.linkBtn}>
            <Text style={st.linkBtnText}>{t('walletConnect.pasteLink')}</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return null;
  };

  const hasCamera = permission?.granted;
  const awaitingCameraPrompt = Boolean(permission && !permission.granted && permission.canAskAgain !== false);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={awaitingCameraPrompt ? () => {} : handleClose}
    >
      <KeyboardAvoidingView
        style={st.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* ── Header ── */}
        <View style={[st.header, { paddingTop: insets.top + 8 }]}>
          {awaitingCameraPrompt ? (
            <View style={st.headerBtn} />
          ) : (
            <TouchableOpacity onPress={handleClose} style={st.headerBtn} hitSlop={8}>
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          )}
          <Text style={st.headerTitle}>{t('walletConnect.scanTitle')}</Text>
          {hasCamera ? (
            <TouchableOpacity
              onPress={() => setTorchOn((v) => !v)}
              style={st.headerBtn}
              hitSlop={8}
            >
              <Ionicons
                name={torchOn ? 'flashlight' : 'flashlight-outline'}
                size={22}
                color={torchOn ? colors.primary : '#FFFFFF'}
              />
            </TouchableOpacity>
          ) : (
            <View style={st.headerBtn} />
          )}
        </View>

        {/* ── Camera + viewfinder ── */}
        {hasCamera && (
          <View style={st.cameraArea}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              enableTorch={torchOn}
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={connecting ? undefined : handleBarcode}
            />

            <View style={st.overlay} pointerEvents="none">
              <View style={st.overlayTop}>
                <View style={st.brandRow}>
                  <View style={st.brandIcon}>
                    <Ionicons name="link" size={16} color={colors.primary} />
                  </View>
                  <Text style={st.brandText}>WalletConnect</Text>
                </View>
              </View>

              <View style={st.overlayMid}>
                <View style={st.overlaySide} />
                <View style={st.frame}>
                  {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
                    <View key={c} style={[st.corner, st[c]]} />
                  ))}
                  <ScanLine />
                </View>
                <View style={st.overlaySide} />
              </View>

              <View style={st.overlayBottom}>
                <Text style={st.viewfinderHint}>{t('walletConnect.scanHint')}</Text>
                {scanError ? <Text style={st.scanError}>{scanError}</Text> : null}
              </View>
            </View>

            {connecting && (
              <View style={st.connectingOverlay}>
                <ActivityIndicator color="#FFFFFF" size="large" />
                <Text style={st.connectingText}>{t('walletConnect.connecting')}</Text>
              </View>
            )}
          </View>
        )}

        {!hasCamera && renderPermission()}

        {/* ── Bottom panel ── */}
        {!awaitingCameraPrompt && (
        <View style={[st.bottomPanel, { paddingBottom: insets.bottom + 16 }]}>
          {!showPaste ? (
            <>
              <Text style={st.bottomTitle}>{t('walletConnect.scanSubtitle')}</Text>
              <Text style={st.bottomHint}>{t('walletConnect.scanSteps')}</Text>
              <TouchableOpacity
                style={st.pasteBtn}
                onPress={handlePasteFromClipboard}
                activeOpacity={0.85}
                disabled={connecting}
              >
                <Ionicons name="clipboard-outline" size={18} color={colors.text} />
                <Text style={st.pasteBtnText}>{t('walletConnect.pasteLink')}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={st.pastePanel}>
              <Text style={st.pasteTitle}>{t('walletConnect.pasteTitle')}</Text>
              <TextInput
                style={st.pasteInput}
                placeholder={t('walletConnect.pastePlaceholder')}
                placeholderTextColor={colors.textFaint}
                value={pasteValue}
                onChangeText={(v) => { setPasteValue(v); setPasteError(''); }}
                autoCapitalize="none"
                autoCorrect={false}
                multiline
                selectionColor={colors.primary}
              />
              {pasteError ? <Text style={st.pasteError}>{pasteError}</Text> : null}
              <View style={st.pasteActions}>
                <TouchableOpacity
                  style={st.pasteCancelBtn}
                  onPress={() => { setShowPaste(false); setPasteError(''); }}
                  activeOpacity={0.85}
                >
                  <Text style={st.pasteCancelText}>{t('card.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[st.pasteConnectBtn, connecting && st.pasteConnectBtnDisabled]}
                  onPress={() => void handlePasteConnect()}
                  activeOpacity={0.85}
                  disabled={connecting || !pasteValue.trim()}
                >
                  {connecting ? (
                    <ActivityIndicator color="#FFF" size="small" />
                  ) : (
                    <Text style={st.pasteConnectText}>{t('walletConnect.pasteConnect')}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scanLine: {
    position: 'absolute',
    left: 10,
    right: 10,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(139,92,246,0.85)',
    shadowColor: '#8B5CF6',
    shadowOpacity: 0.8,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
});

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: '#000000' },

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingBottom: 12,
      backgroundColor: '#000000',
      zIndex: 2,
    },
    headerBtn: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      color: '#FFFFFF',
      fontSize: 17,
      fontWeight: '700',
      letterSpacing: -0.2,
    },

    cameraArea: { flex: 1, position: 'relative' },

    overlay: { ...StyleSheet.absoluteFillObject },
    overlayTop: {
      flex: 1,
      backgroundColor: DIM,
      alignItems: 'center',
      justifyContent: 'flex-end',
      paddingBottom: 28,
    },
    brandRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: 'rgba(255,255,255,0.1)',
      borderRadius: 20,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.12)',
    },
    brandIcon: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: 'rgba(139,92,246,0.2)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    brandText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },

    overlayMid: { flexDirection: 'row', height: FRAME },
    overlaySide: { flex: 1, backgroundColor: DIM },
    frame: {
      width: FRAME,
      height: FRAME,
      borderRadius: 20,
      overflow: 'hidden',
    },
    corner: {
      position: 'absolute',
      width: 28,
      height: 28,
      borderColor: c.primary,
      borderWidth: 3,
      zIndex: 2,
    },
    tl: {
      top: 0, left: 0,
      borderRightWidth: 0, borderBottomWidth: 0,
      borderTopLeftRadius: 20,
    },
    tr: {
      top: 0, right: 0,
      borderLeftWidth: 0, borderBottomWidth: 0,
      borderTopRightRadius: 20,
    },
    bl: {
      bottom: 0, left: 0,
      borderRightWidth: 0, borderTopWidth: 0,
      borderBottomLeftRadius: 20,
    },
    br: {
      bottom: 0, right: 0,
      borderLeftWidth: 0, borderTopWidth: 0,
      borderBottomRightRadius: 20,
    },

    overlayBottom: {
      flex: 1,
      backgroundColor: DIM,
      alignItems: 'center',
      paddingTop: 28,
      paddingHorizontal: 24,
      gap: 10,
    },
    viewfinderHint: {
      color: '#E5E7EB',
      fontSize: 15,
      fontWeight: '600',
      textAlign: 'center',
      lineHeight: 22,
    },
    scanError: {
      color: '#FCA5A5',
      fontSize: 13,
      fontWeight: '600',
      textAlign: 'center',
    },

    connectingOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.55)',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    },
    connectingText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },

    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
      gap: 12,
    },
    permIconWrap: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: 'rgba(139,92,246,0.15)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    permTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', textAlign: 'center' },
    permHint: { color: '#9CA3AF', fontSize: 14, textAlign: 'center', lineHeight: 21, marginBottom: 8 },
    primaryBtn: {
      backgroundColor: c.primary,
      borderRadius: 14,
      paddingHorizontal: 28,
      paddingVertical: 14,
      marginTop: 8,
    },
    primaryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
    linkBtn: { paddingVertical: 10 },
    linkBtnText: { color: c.primary, fontSize: 14, fontWeight: '600' },

    bottomPanel: {
      backgroundColor: c.backgroundElevated,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 20,
      paddingTop: 20,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
    },
    bottomTitle: { color: c.text, fontSize: 17, fontWeight: '700', marginBottom: 6 },
    bottomHint: { color: c.textMuted, fontSize: 13, lineHeight: 19, marginBottom: 16 },
    pasteBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: c.surface,
      borderRadius: 14,
      paddingVertical: 14,
      borderWidth: 1,
      borderColor: c.border,
    },
    pasteBtnText: { color: c.text, fontSize: 15, fontWeight: '600' },

    pastePanel: { gap: 10 },
    pasteTitle: { color: c.text, fontSize: 16, fontWeight: '700' },
    pasteInput: {
      minHeight: 88,
      backgroundColor: c.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      color: c.text,
      fontSize: 13,
      lineHeight: 18,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      textAlignVertical: 'top',
    },
    pasteError: { color: c.danger, fontSize: 13 },
    pasteActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
    pasteCancelBtn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      borderRadius: 14,
      backgroundColor: c.surfaceInput,
    },
    pasteCancelText: { color: c.textMuted, fontSize: 15, fontWeight: '600' },
    pasteConnectBtn: {
      flex: 1.4,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      borderRadius: 14,
      backgroundColor: c.primary,
    },
    pasteConnectBtnDisabled: { opacity: 0.6 },
    pasteConnectText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  });
}
