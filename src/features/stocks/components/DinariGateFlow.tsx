import LoadingDots from '../../../shared/components/LoadingDots';
/**
 * Shared Dinari KYC / wallet-connect gate UI.
 * Used by {@link DinariGateModal} (overlay) and {@link DinariKycScreen} (stack).
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import type { useDinariGate } from '../hooks/useDinari';
import { useDinariWaitlistJoin } from '../hooks/useDinariWaitlistJoin';
import KycWebViewModal from '../modals/KycWebViewModal';
import { useTheme } from '../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../shared/theme/theme';

type DinariGate = ReturnType<typeof useDinariGate>;

interface Props {
  gate: DinariGate;
}

export default function DinariGateFlow({ gate }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const [showKyc, setShowKyc] = useState(false);
  const waitlist = useDinariWaitlistJoin(gate.state === 'waitlist');

  const handleStartKyc = useCallback(() => setShowKyc(true), []);

  return (
    <>
      <View style={s.content}>
        {gate.state === 'checking' || gate.state === 'idle' ? (
          <View style={s.centered}>
            <LoadingDots color={colors.primary} size={10}    />
            <Text style={s.loadingText}>{t('crypto.dinariChecking')}</Text>
          </View>
        ) : gate.state === 'waitlist' ? (
          <GatePanel
            icon="notifications-outline"
            title={t('crypto.dinariWaitlistTitle')}
            subtitle={t('crypto.dinariWaitlistBody')}
            cta={waitlist.joined ? t('card.notifyJoined') : t('crypto.dinariWaitlistCta')}
            onPress={() => { void waitlist.handleJoin(); }}
            busy={waitlist.submitting || waitlist.checking}
            disabled={waitlist.joined || !waitlist.backendAvailable}
          />
        ) : gate.state === 'unsupported' ? (
          <GatePanel
            icon="time-outline"
            title={t('crypto.dinariComingSoonTitle')}
            subtitle={
              gate.error
                ? t('crypto.dinariUnavailableBody', { error: gate.error })
                : t('crypto.dinariComingSoonBody')
            }
            cta={t('crypto.dinariRetry')}
            onPress={() => { void gate.resolve(true); }}
          />
        ) : gate.state === 'kyc' ? (
          <GatePanel
            icon="shield-checkmark-outline"
            title={t('crypto.dinariKycTitle')}
            subtitle={t('crypto.dinariKycBody')}
            cta={t('crypto.dinariStartVerification')}
            onPress={handleStartKyc}
          />
        ) : gate.state === 'connect' ? (
          <GatePanel
            icon="link-outline"
            title={t('crypto.dinariConnectTitle')}
            subtitle={t('crypto.dinariConnectBody')}
            cta={t('crypto.dinariConnectWallet')}
            onPress={() => { gate.connectWallet().catch(() => undefined); }}
            busy={gate.connecting}
          />
        ) : null}
      </View>

      <KycWebViewModal
        visible={showKyc}
        getUrl={() => gate.startKyc()}
        onCheck={async () => {
          const ent = await gate.refreshEntity();
          return !!ent?.canTransact;
        }}
        onClose={() => setShowKyc(false)}
      />
    </>
  );
}

function GatePanel({
  icon,
  title,
  subtitle,
  cta,
  onPress,
  busy,
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  cta: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={s.panel}>
      <View style={s.panelIcon}>
        <Ionicons name={icon} size={26} color={colors.primary} />
      </View>
      <Text style={s.panelTitle}>{title}</Text>
      <Text style={s.panelSub}>{subtitle}</Text>
      <TouchableOpacity
        style={[s.panelBtn, disabled && s.panelBtnDisabled]}
        onPress={onPress}
        disabled={busy || disabled}
        activeOpacity={0.85}
      >
        {busy ? (
          <LoadingDots compact color="#FFFFFF" size={6}    />
        ) : (
          <Text style={s.panelBtnText}>{cta}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    content: { flex: 1, justifyContent: 'center' },
    centered: { alignItems: 'center', gap: 12, paddingVertical: 48 },
    loadingText: { color: c.textMuted, fontSize: 14 },
    panel: {
      alignItems: 'center',
      paddingHorizontal: 28,
      paddingVertical: 32,
      gap: 14,
      marginHorizontal: 16,
      backgroundColor: c.surfaceAlt,
      borderRadius: 20,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    panelIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: c.primarySoft,
      borderWidth: 1,
      borderColor: c.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    panelTitle: { color: c.text, fontSize: 18, fontWeight: '700', textAlign: 'center' },
    panelSub: { color: c.textMuted, fontSize: 14, lineHeight: 21, textAlign: 'center' },
    panelBtn: {
      marginTop: 8,
      height: 52,
      borderRadius: 14,
      backgroundColor: c.primary,
      paddingHorizontal: 32,
      minWidth: 200,
      alignItems: 'center',
      justifyContent: 'center',
    },
    panelBtnDisabled: {
      opacity: 0.55,
    },
    panelBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  });
}
