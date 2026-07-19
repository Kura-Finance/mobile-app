import LoadingDots from '../../../../shared/components/LoadingDots';
import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, TouchableOpacity, Alert, StyleSheet,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { CryptoContact, ChainOption } from '../../hooks/useCryptoContacts';
import ContactRow from './ContactRow';
import BankAccountRow from './BankAccountRow';
import {
  deleteExternalAccount,
  listExternalAccounts,
  type ExternalAccountResult,
} from '../../../../lib/api/ramp/client';
import { KuraApiError } from '../../../../lib/api/errors';
import { getUsableAuthToken, useSessionUsable } from '../../../../lib/security/sessionAccess';
import { useTheme } from '../../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../../shared/theme/theme';

function useStyles() {
  const { colors } = useTheme();
  return useMemo(() => makeStyles(colors), [colors]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Address extractor (shared utility)
// ─────────────────────────────────────────────────────────────────────────────

export function extractAddress(raw: string): string | null {
  const t = raw.trim();
  if (/^0x[0-9a-fA-F]{40}$/.test(t)) return t;
  const m = t.match(/(0x[0-9a-fA-F]{40})/i);
  return m ? m[1] : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Currency flag helpers
// ─────────────────────────────────────────────────────────────────────────────

const CURRENCY_FLAGS: Record<string, string> = {
  usd: '🇺🇸', eur: '🇪🇺', gbp: '🇬🇧', brl: '🇧🇷', mxn: '🇲🇽',
};

function flagFor(currency?: string | null): string {
  return CURRENCY_FLAGS[(currency ?? '').toLowerCase()] ?? '🏦';
}

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  variant: 'bank' | 'crypto';
  contacts: CryptoContact[];
  isLoading: boolean;
  getChain: (chainKey: string) => ChainOption;
  removeContact: (id: string) => Promise<void>;
  onSelectContact: (contact: CryptoContact) => void;
  onAddNew: (prefillAddress?: string) => void;
  onWithdrawBank: (opts?: { accountId?: string; addNew?: boolean }) => void;
  /** Bumping this value re-fetches saved bank accounts. */
  bankRefreshKey?: number;
  onBankAccountsChanged?: () => void;
  onClose: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// "Add new" row (shared between bank + wallet cards)
// ─────────────────────────────────────────────────────────────────────────────

function AddRow({
  label,
  icon,
  children,
  onPress,
}: {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  children?: React.ReactNode;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const st = useStyles();
  return (
    <TouchableOpacity style={st.row} onPress={onPress} activeOpacity={0.7}>
      <View style={st.newIcon}>
        <Ionicons name={icon} size={20} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={st.newLabel}>{label}</Text>
        {children}
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PickerView — saved bank accounts or wallet contacts (after method selection)
// ─────────────────────────────────────────────────────────────────────────────

export default function PickerView({
  variant,
  contacts, isLoading, getChain, removeContact,
  onSelectContact, onAddNew, onWithdrawBank, bankRefreshKey, onBankAccountsChanged,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const st = useStyles();
  const sessionUsable = useSessionUsable();
  const [bankAccounts, setBankAccounts] = useState<ExternalAccountResult[]>([]);
  const [loadingBanks, setLoadingBanks] = useState(true);

  useEffect(() => {
    if (variant !== 'bank') return;
    if (!sessionUsable) {
      setBankAccounts([]);
      setLoadingBanks(false);
      return;
    }
    let cancelled = false;
    setLoadingBanks(true);
    void (async () => {
      try {
        const list = await listExternalAccounts();
        if (!cancelled) setBankAccounts(list);
      } catch {
        if (!cancelled) setBankAccounts([]);
      } finally {
        if (!cancelled) setLoadingBanks(false);
      }
    })();
    return () => { cancelled = true; };
  }, [bankRefreshKey, variant, sessionUsable]);

  const handleLongPress = (contact: CryptoContact) => {
    Alert.alert(
      t('card.removeContact'),
      t('card.removeContactConfirm', { name: contact.name }),
      [
        { text: t('card.cancel'), style: 'cancel' },
        { text: t('card.remove'), style: 'destructive', onPress: () => removeContact(contact.id) },
      ],
    );
  };

  const recipientLabel = (account: ExternalAccountResult) =>
    account.accountOwnerName || account.bankName || t('card.recipient');

  const refreshBankAccounts = async () => {
    if (!getUsableAuthToken()) {
      setBankAccounts([]);
      return;
    }
    const list = await listExternalAccounts();
    setBankAccounts(list);
    onBankAccountsChanged?.();
  };

  const handleDeleteBank = (account: ExternalAccountResult) => {
    Alert.alert(
      t('card.removeRecipient'),
      t('card.removeRecipientConfirm', { name: recipientLabel(account) }),
      [
        { text: t('card.cancel'), style: 'cancel' },
        {
          text: t('card.remove'),
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await deleteExternalAccount(account.bridgeExternalAccountId);
                await refreshBankAccounts();
              } catch (e) {
                if (e instanceof KuraApiError && e.status === 409) {
                  Alert.alert(t('card.removeRecipient'), t('card.usdtKycRequired'));
                  return;
                }
                if (e instanceof KuraApiError && e.status === 404) {
                  await refreshBankAccounts();
                  return;
                }
                Alert.alert(
                  t('card.removeRecipient'),
                  e instanceof Error ? e.message : t('card.removeRecipientFailed'),
                );
              }
            })();
          },
        },
      ],
    );
  };

  return (
    <ScrollView
      style={st.root}
      contentContainerStyle={st.scrollContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={st.prompt}>
        {variant === 'bank' ? t('card.sendMoneyBankPrompt') : t('card.sendMoneyCryptoPrompt')}
      </Text>

      {variant === 'bank' ? (
        <View style={st.card}>
          {loadingBanks ? (
            <View style={st.centerState}>
              <LoadingDots compact color={colors.textMuted} size={6}    />
            </View>
          ) : (
            bankAccounts.map((acct, i) => (
              <View key={acct.bridgeExternalAccountId} style={i > 0 ? st.rowBorder : undefined}>
                <BankAccountRow
                  account={acct}
                  flag={flagFor(acct.currency)}
                  onPress={() => onWithdrawBank({ accountId: acct.bridgeExternalAccountId })}
                  onDelete={() => handleDeleteBank(acct)}
                />
              </View>
            ))
          )}

          <View style={(!loadingBanks && bankAccounts.length > 0) ? st.rowBorder : undefined}>
            <AddRow icon="person-add-outline" label={t('card.newRecipient')} onPress={() => onWithdrawBank({ addNew: true })}>
              <Text style={st.newSub}>{t('card.newRecipientSub')}</Text>
            </AddRow>
          </View>
        </View>
      ) : (
        <View style={st.card}>
          {isLoading ? (
            <View style={st.centerState}>
              <LoadingDots compact color={colors.textMuted} size={6}    />
            </View>
          ) : (
            contacts.map((contact, i) => (
              <View key={contact.id} style={i > 0 ? st.rowBorder : undefined}>
                <ContactRow
                  contact={contact}
                  chain={getChain(contact.chainKey)}
                  onPress={() => onSelectContact(contact)}
                  onLongPress={() => handleLongPress(contact)}
                  onDelete={() => void removeContact(contact.id)}
                />
              </View>
            ))
          )}

          <View style={(!isLoading && contacts.length > 0) ? st.rowBorder : undefined}>
            <AddRow icon="wallet-outline" label={t('card.newWallet')} onPress={() => onAddNew()}>
              <Text style={st.newSub}>{t('card.multiChainSend')}</Text>
            </AddRow>
          </View>
        </View>
      )}

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.backgroundElevated },
    scrollContent: { flexGrow: 1, paddingHorizontal: 24 },
    prompt: {
      color: c.textMuted,
      fontSize: 15,
      lineHeight: 22,
      marginTop: 8,
      marginBottom: 20,
    },
    sectionLabel: {
      color: c.textFaint, fontSize: 12, fontWeight: '600', letterSpacing: 0.4,
      textTransform: 'uppercase', marginTop: 12, marginBottom: 12,
    },
    card: {
      backgroundColor: c.surface, borderRadius: 16, overflow: 'hidden',
      borderWidth: 1, borderColor: c.border,
    },
    rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
    centerState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 20 },

    // Shared row
    row: {
      flexDirection: 'row', alignItems: 'center', gap: 14,
      paddingHorizontal: 16, paddingVertical: 14,
    },
    info: { flex: 1 },
    name: { color: c.text, fontSize: 15, fontWeight: '600', marginBottom: 3 },
    meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    flag: { fontSize: 14, lineHeight: 18 },
    metaText: { color: c.textMuted, fontSize: 12, fontWeight: '500' },

    // New row (Bank / Wallet)
    newIcon: {
      width: 44, height: 44, borderRadius: 22,
      backgroundColor: 'rgba(139,92,246,0.12)', alignItems: 'center', justifyContent: 'center',
    },
    newLabel: { color: c.primary, fontSize: 15, fontWeight: '600', marginBottom: 4 },
    newSub: { color: c.textFaint, fontSize: 12, fontWeight: '500' },
  });
}
