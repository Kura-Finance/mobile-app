import React, { useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Dimensions, Linking,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';

const { width: SW } = Dimensions.get('window');
const FRAME = SW * 0.65;

function extractAddress(raw: string): string | null {
  const t = raw.trim();
  if (/^0x[0-9a-fA-F]{40}$/.test(t)) return t;
  const m = t.match(/(0x[0-9a-fA-F]{40})/i);
  return m ? m[1] : null;
}

interface Props {
  onScanned: (address: string) => void;
  onCancel: () => void;
}

export default function QRScanner({ onScanned, onCancel }: Props) {
  const { t } = useTranslation();
  const [permission, requestPermission] = useCameraPermissions();
  const scannedRef = useRef(false);

  const handleBarcode = useCallback(({ data }: { data: string }) => {
    if (scannedRef.current) return;
    const address = extractAddress(data);
    if (address) { scannedRef.current = true; onScanned(address); }
  }, [onScanned]);

  if (!permission) {
    return <View style={st.center}><ActivityIndicator color="#8B5CF6" /></View>;
  }

  if (!permission.granted) {
    const canAskAgain = permission.canAskAgain !== false;

    if (canAskAgain) {
      return (
        <View style={st.center}>
          <Ionicons name="camera-outline" size={48} color="#6B7280" style={{ marginBottom: 16 }} />
          <Text style={st.permText}>{t('card.cameraAccessRequired')}</Text>
          <TouchableOpacity onPress={requestPermission} style={st.permBtn}>
            <Text style={st.permBtnText}>{t('card.continue')}</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={st.center}>
        <Ionicons name="camera-outline" size={48} color="#6B7280" style={{ marginBottom: 16 }} />
        <Text style={st.permText}>{t('card.cameraPermissionDenied')}</Text>
        <TouchableOpacity onPress={() => void Linking.openSettings()} style={st.permBtn}>
          <Text style={st.permBtnText}>{t('card.openSettings')}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onCancel} style={{ marginTop: 16 }}>
          <Text style={{ color: '#6B7280', fontSize: 14 }}>{t('card.cancel')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={st.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={handleBarcode}
      />
      <View style={st.overlay}>
        <View style={st.overlayTop} />
        <View style={st.overlayMid}>
          <View style={st.overlaySide} />
          <View style={st.frame}>
            {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
              <View key={c} style={[st.corner, st[c]]} />
            ))}
          </View>
          <View style={st.overlaySide} />
        </View>
        <View style={st.overlayBottom}>
          <Text style={st.hint}>{t('card.pointCameraHint')}</Text>
          <TouchableOpacity onPress={onCancel} style={st.cancelBtn} activeOpacity={0.8}>
            <Text style={st.cancelText}>{t('card.cancel')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const DIM = 'rgba(0,0,0,0.6)';

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  permText: { color: '#9CA3AF', fontSize: 14, textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  permBtn: { backgroundColor: '#7C3AED', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  permBtnText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  overlay: { ...StyleSheet.absoluteFillObject, flexDirection: 'column' },
  overlayTop: { flex: 1, backgroundColor: DIM },
  overlayMid: { flexDirection: 'row', height: FRAME },
  overlaySide: { flex: 1, backgroundColor: DIM },
  overlayBottom: { flex: 1, backgroundColor: DIM, alignItems: 'center', paddingTop: 28, gap: 16 },
  frame: { width: FRAME, height: FRAME, borderRadius: 4, overflow: 'visible' },
  corner: { position: 'absolute', width: 24, height: 24, borderColor: '#8B5CF6', borderWidth: 3 },
  tl: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 4 },
  tr: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 4 },
  bl: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 4 },
  br: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 4 },
  hint: { color: '#D1D5DB', fontSize: 14, fontWeight: '500' },
  cancelBtn: { backgroundColor: '#1F2937', borderRadius: 12, paddingHorizontal: 28, paddingVertical: 12 },
  cancelText: { color: '#FFF', fontSize: 15, fontWeight: '600' },
});
