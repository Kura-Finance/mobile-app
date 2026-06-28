import LoadingDots from '../../../shared/components/LoadingDots';
import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Image,
  Alert,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useKuraWalletConnect } from '../context/KuraWalletConnectContext';
import type { DappSessionRecord } from '../lib/dappSessionHistory';
import WalletConnectIcon from '../components/WalletConnectIcon';
import { useTheme } from '../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../shared/theme/theme';

function useStyles() {
  const { colors } = useTheme();
  return useMemo(() => makeStyles(colors), [colors]);
}

function formatRelativeTime(ts: number, t: TFunction): string {
  const diffMs = Date.now() - ts;
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);
  if (diffMins < 1) return t('walletConnect.timeJustNow');
  if (diffMins < 60) return t('walletConnect.timeMinutesAgo', { count: diffMins });
  if (diffHours < 24) return t('walletConnect.timeHoursAgo', { count: diffHours });
  if (diffDays < 7) return t('walletConnect.timeDaysAgo', { count: diffDays });
  return new Date(ts).toLocaleDateString();
}

function DappAvatar({
  record,
  size = 44,
  showActiveDot = false,
}: {
  record: DappSessionRecord;
  size?: number;
  showActiveDot?: boolean;
}) {
  const st = useStyles();
  const { colors } = useTheme();
  const initial = (record.name || '?').charAt(0).toUpperCase();
  const radius = size / 2.75;

  const avatar = record.icon ? (
    <Image
      source={{ uri: record.icon }}
      style={[st.avatar, { width: size, height: size, borderRadius: radius }]}
    />
  ) : (
    <View style={[st.avatarFallback, { width: size, height: size, borderRadius: radius }]}>
      <Text style={[st.avatarInitial, { fontSize: size * 0.38 }]}>{initial}</Text>
    </View>
  );

  if (!showActiveDot) return avatar;

  return (
    <View style={{ width: size, height: size }}>
      {avatar}
      <View style={[st.activeDot, { borderColor: colors.surfaceAlt }]} />
    </View>
  );
}

function SessionRow({
  record,
  onDisconnect,
  onRemove,
  busy,
  isLast,
}: {
  record: DappSessionRecord;
  onDisconnect: (record: DappSessionRecord) => void;
  onRemove: (record: DappSessionRecord) => void;
  busy: boolean;
  isLast?: boolean;
}) {
  const st = useStyles();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const isActive = record.status === 'active';
  const timeLabel = isActive
    ? t('walletConnect.connectedAt', { time: formatRelativeTime(record.connectedAt, t) })
    : t('walletConnect.disconnectedAt', {
        time: formatRelativeTime(record.disconnectedAt ?? record.lastSeenAt, t),
      });

  return (
    <View style={[st.row, !isLast && st.rowDivider, !isActive && st.rowPast]}>
      <DappAvatar record={record} showActiveDot={isActive} />
      <View style={st.rowBody}>
        <Text style={st.rowName} numberOfLines={1}>{record.name}</Text>
        {!!record.url && (
          <Text style={st.rowUrl} numberOfLines={1}>
            {record.url.replace(/^https?:\/\//, '')}
          </Text>
        )}
        <View style={st.rowMetaLine}>
          <View style={[st.statusDot, isActive ? st.statusDotActive : st.statusDotInactive]} />
          <Text style={st.rowMeta}>{timeLabel}</Text>
        </View>
      </View>
      <TouchableOpacity
        style={[st.rowAction, isActive ? st.rowActionDanger : st.rowActionMuted]}
        disabled={busy}
        onPress={() => (isActive ? onDisconnect(record) : onRemove(record))}
        hitSlop={8}
        activeOpacity={0.7}
        accessibilityLabel={
          isActive ? t('walletConnect.disconnect') : t('walletConnect.removeTitle')
        }
      >
        {busy ? (
          <LoadingDots compact color={isActive ? colors.danger : colors.textMuted} size={6}    />
        ) : (
          <Ionicons
            name={isActive ? 'unlink-outline' : 'trash-outline'}
            size={18}
            color={isActive ? colors.danger : colors.textMuted}
          />
        )}
      </TouchableOpacity>
    </View>
  );
}

function SectionCard({
  title,
  records,
  emptyIcon,
  emptyText,
  trailing,
  onDisconnect,
  onRemove,
  busyTopic,
}: {
  title: string;
  records: DappSessionRecord[];
  emptyIcon: React.ComponentProps<typeof Ionicons>['name'];
  emptyText: string;
  trailing?: React.ReactNode;
  onDisconnect: (record: DappSessionRecord) => void;
  onRemove: (record: DappSessionRecord) => void;
  busyTopic: string | null;
}) {
  const st = useStyles();
  const { colors } = useTheme();

  return (
    <View style={st.sectionCard}>
      <View style={st.sectionHeader}>
        <Text style={st.sectionTitle}>{title}</Text>
        {trailing}
      </View>

      {records.length === 0 ? (
        <View style={st.emptySection}>
          <View style={st.emptyIconWrap}>
            <Ionicons name={emptyIcon} size={22} color={colors.textFaint} />
          </View>
          <Text style={st.emptyText}>{emptyText}</Text>
        </View>
      ) : (
        records.map((record, index) => {
          const busy = busyTopic === record.topic || busyTopic === record.id;
          return (
            <SessionRow
              key={record.id}
              record={record}
              onDisconnect={onDisconnect}
              onRemove={onRemove}
              busy={busy}
              isLast={index === records.length - 1}
            />
          );
        })
      )}
    </View>
  );
}

export default function ConnectedDappsScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const st = useStyles();
  const navigation = useNavigation<any>();

  const {
    isReady,
    dappHistory,
    refreshSessions,
    openPairScanner,
    disconnectSession,
    removeDappHistoryEntry,
    clearDisconnectedHistory,
  } = useKuraWalletConnect();

  const [refreshing, setRefreshing] = useState(false);
  const [busyTopic, setBusyTopic] = useState<string | null>(null);

  const active = dappHistory.filter((r) => r.status === 'active');
  const past = dappHistory.filter((r) => r.status === 'disconnected');

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshSessions();
    } finally {
      setRefreshing(false);
    }
  }, [refreshSessions]);

  const handleDisconnect = useCallback(
    (record: DappSessionRecord) => {
      if (!record.topic) return;
      Alert.alert(
        t('walletConnect.disconnectTitle'),
        t('walletConnect.disconnectConfirm', { name: record.name }),
        [
          { text: t('card.cancel'), style: 'cancel' },
          {
            text: t('walletConnect.disconnect'),
            style: 'destructive',
            onPress: () => {
              setBusyTopic(record.topic!);
              void disconnectSession(record.topic!)
                .finally(() => setBusyTopic(null));
            },
          },
        ],
      );
    },
    [disconnectSession, t],
  );

  const handleRemove = useCallback(
    (record: DappSessionRecord) => {
      Alert.alert(
        t('walletConnect.removeTitle'),
        t('walletConnect.removeConfirm', { name: record.name }),
        [
          { text: t('card.cancel'), style: 'cancel' },
          {
            text: t('card.remove'),
            style: 'destructive',
            onPress: () => {
              setBusyTopic(record.id);
              void removeDappHistoryEntry(record.id).finally(() => setBusyTopic(null));
            },
          },
        ],
      );
    },
    [removeDappHistoryEntry, t],
  );

  const handleClearPast = useCallback(() => {
    if (past.length === 0) return;
    Alert.alert(
      t('walletConnect.clearPastTitle'),
      t('walletConnect.clearPastConfirm'),
      [
        { text: t('card.cancel'), style: 'cancel' },
        {
          text: t('walletConnect.clearPast'),
          style: 'destructive',
          onPress: () => void clearDisconnectedHistory(),
        },
      ],
    );
  }, [clearDisconnectedHistory, past.length, t]);

  const listHeader = useMemo(
    () => (
      <View style={st.listHeader}>
        <Text style={st.subtitle}>{t('walletConnect.manageSubtitle')}</Text>

        <TouchableOpacity
          style={[st.connectCard, !isReady && st.connectCardDisabled]}
          onPress={openPairScanner}
          disabled={!isReady}
          activeOpacity={0.75}
        >
          <View style={st.connectIconWrap}>
            <WalletConnectIcon size={22} color={colors.primary} />
          </View>
          <View style={st.connectBody}>
            <Text style={st.connectTitle}>{t('walletConnect.connectNew')}</Text>
            <Text style={st.connectHint}>{t('walletConnect.scanSubtitle')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.primary} />
        </TouchableOpacity>

        {!isReady && (
          <View style={st.noticeBox}>
            <Ionicons name="information-circle-outline" size={18} color={colors.warning} />
            <Text style={st.noticeText}>{t('walletConnect.walletNotReady')}</Text>
          </View>
        )}
      </View>
    ),
    [colors.primary, colors.warning, isReady, openPairScanner, st, t],
  );

  const sections = useMemo(
    () => [
      {
        key: 'active',
        title: t('walletConnect.sectionActive', { count: active.length }),
        records: active,
        emptyIcon: 'link-outline' as const,
        emptyText: t('walletConnect.noActiveSessions'),
      },
      {
        key: 'past',
        title: t('walletConnect.sectionPast', { count: past.length }),
        records: past,
        emptyIcon: 'time-outline' as const,
        emptyText: t('walletConnect.noPastSessions'),
      },
    ],
    [active, past, t],
  );

  return (
    <View style={[st.root, { paddingTop: insets.top }]}>
      <View style={st.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={st.backBtn} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={st.titleWrap}>
          <Text style={st.screenTitle}>{t('walletConnect.manageTitle')}</Text>
          {active.length > 0 && (
            <View style={st.titleBadge}>
              <Text style={st.titleBadgeText}>{active.length}</Text>
            </View>
          )}
        </View>
        <View style={st.backBtn} />
      </View>

      <FlatList
        data={sections}
        keyExtractor={(item) => item.key}
        contentContainerStyle={[st.listContent, { paddingBottom: insets.bottom + 24 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
        ListHeaderComponent={listHeader}
        renderItem={({ item }) => (
          <SectionCard
            title={item.title}
            records={item.records}
            emptyIcon={item.emptyIcon}
            emptyText={item.emptyText}
            onDisconnect={handleDisconnect}
            onRemove={handleRemove}
            busyTopic={busyTopic}
            trailing={
              item.key === 'past' && past.length > 0 ? (
                <TouchableOpacity
                  onPress={handleClearPast}
                  hitSlop={8}
                  style={st.clearPastBtn}
                  activeOpacity={0.7}
                >
                  <Text style={st.clearPastText}>{t('walletConnect.clearPast')}</Text>
                </TouchableOpacity>
              ) : undefined
            }
          />
        )}
      />
    </View>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },

    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingBottom: 8,
    },
    backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    titleWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    screenTitle: { color: c.text, fontSize: 17, fontWeight: '700' },
    titleBadge: {
      minWidth: 22,
      height: 22,
      borderRadius: 11,
      paddingHorizontal: 6,
      backgroundColor: c.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    titleBadgeText: { color: c.primary, fontSize: 12, fontWeight: '800' },

    listContent: { paddingHorizontal: 16, gap: 16 },
    listHeader: { gap: 12, paddingBottom: 4 },
    subtitle: {
      color: c.textMuted,
      fontSize: 14,
      lineHeight: 20,
      paddingHorizontal: 2,
    },

    connectCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      padding: 16,
      backgroundColor: c.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.primarySoft,
    },
    connectCardDisabled: { opacity: 0.55 },
    connectIconWrap: {
      width: 48,
      height: 48,
      borderRadius: 14,
      backgroundColor: c.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    connectBody: { flex: 1, minWidth: 0, gap: 4 },
    connectTitle: { color: c.text, fontSize: 15, fontWeight: '700' },
    connectHint: { color: c.textMuted, fontSize: 12, lineHeight: 17 },

    noticeBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      padding: 14,
      borderRadius: 14,
      backgroundColor: 'rgba(251,191,36,0.08)',
      borderWidth: 1,
      borderColor: 'rgba(251,191,36,0.22)',
    },
    noticeText: { flex: 1, color: c.textMuted, fontSize: 13, lineHeight: 18 },

    sectionCard: {
      backgroundColor: c.surfaceAlt,
      borderRadius: 20,
      overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    sectionTitle: {
      color: c.textFaint,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    clearPastBtn: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
      backgroundColor: 'rgba(239,68,68,0.08)',
    },
    clearPastText: { color: c.danger, fontSize: 12, fontWeight: '600' },

    emptySection: {
      alignItems: 'center',
      paddingHorizontal: 24,
      paddingVertical: 28,
      gap: 10,
    },
    emptyIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: c.surfaceInput,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyText: { color: c.textFaint, fontSize: 13, lineHeight: 19, textAlign: 'center' },

    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    rowDivider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    rowPast: { opacity: 0.82 },
    avatar: {
      backgroundColor: c.surfaceInput,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    avatarFallback: {
      backgroundColor: c.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.primarySoft,
    },
    avatarInitial: { color: c.primary, fontWeight: '800' },
    activeDot: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: c.success,
      borderWidth: 2,
    },
    rowBody: { flex: 1, minWidth: 0, gap: 3 },
    rowName: { color: c.text, fontSize: 15, fontWeight: '700' },
    rowUrl: { color: c.textMuted, fontSize: 12 },
    rowMetaLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
    statusDot: { width: 6, height: 6, borderRadius: 3 },
    statusDotActive: { backgroundColor: c.success },
    statusDotInactive: { backgroundColor: c.textFaint },
    rowMeta: { color: c.textFaint, fontSize: 11 },
    rowAction: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    rowActionDanger: {
      backgroundColor: 'rgba(239,68,68,0.08)',
      borderColor: 'rgba(239,68,68,0.18)',
    },
    rowActionMuted: { backgroundColor: c.surfaceInput },
  });
}
