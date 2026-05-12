import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Logger from '../utils/Logger';
import { useTheme } from '../theme/ThemeContext';
import type { ThemeColors } from '../theme/theme';

interface LoggerDebugPanelProps {
  module?: string;
  isVisible: boolean;
  onClose: () => void;
}

type LevelFilter = 'all' | 'error' | 'warn' | 'info' | 'debug';

const LEVEL_FILTERS: { key: LevelFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'error', label: 'Error' },
  { key: 'warn', label: 'Warn' },
  { key: 'info', label: 'Info' },
  { key: 'debug', label: 'Debug' },
];

function levelColor(c: ThemeColors, level: string): string {
  switch (level) {
    case 'error':
      return c.danger;
    case 'warn':
      return c.warning;
    case 'debug':
      return c.primary;
    default:
      return c.success;
  }
}

export default function LoggerDebugPanel({ module, isVisible, onClose }: LoggerDebugPanelProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const [logs, setLogs] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all');
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!isVisible) return;

    const interval = setInterval(() => {
      const allLogs = Logger.getLogs({ module, limit: 50 });
      setLogs(allLogs);
    }, 500);

    return () => clearInterval(interval);
  }, [module, isVisible]);

  const filteredLogs = useMemo(() => {
    const q = query.trim().toLowerCase();
    return logs.filter((log) => {
      if (levelFilter !== 'all' && log.level !== levelFilter) return false;
      if (!q) return true;
      const haystack = `${log.level} ${log.module} ${log.message} ${
        log.data ? JSON.stringify(log.data) : ''
      }`.toLowerCase();
      return haystack.includes(q);
    });
  }, [logs, query, levelFilter]);

  const handleExport = async () => {
    const exported = Logger.exportLogs();
    if (!exported || exported.trim().length === 0) {
      Logger.warn('LoggerDebugPanel', 'No logs to export');
      return;
    }
    try {
      await Share.share({ message: exported, title: 'Kura Debug Logs' });
    } catch (err) {
      Logger.warn('LoggerDebugPanel', 'Export share failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  };

  if (!isVisible) return null;

  return (
    <Modal visible={isVisible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[s.root, { paddingTop: insets.top }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={s.header}>
          <Text style={s.title}>
            Debug Console{module ? ` · ${module}` : ''}
          </Text>
          <TouchableOpacity onPress={onClose} style={s.closeBtn} hitSlop={8}>
            <Ionicons name="close" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Level filter pills */}
        <View style={s.pillRow}>
          {LEVEL_FILTERS.map(({ key, label }) => {
            const active = levelFilter === key;
            const accent = key === 'all' ? colors.primary : levelColor(colors, key);
            return (
              <TouchableOpacity
                key={key}
                onPress={() => setLevelFilter(key)}
                style={[
                  s.pill,
                  active && { backgroundColor: accent + '26', borderColor: accent },
                ]}
              >
                <Text style={[s.pillText, { color: active ? accent : colors.textMuted }]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Logs */}
        <ScrollView
          ref={scrollViewRef}
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
          maintainVisibleContentPosition={{
            minIndexForVisible: 0,
            autoscrollToTopThreshold: 10,
          }}
        >
          {filteredLogs.length === 0 ? (
            <Text style={s.empty}>
              {query ? 'No matching logs.' : 'No logs yet…'}
            </Text>
          ) : (
            filteredLogs.map((log, idx) => {
              const accent = levelColor(colors, log.level);
              return (
                <View key={idx} style={[s.logRow, { borderLeftColor: accent }]}>
                  <View style={s.logMeta}>
                    <Text style={[s.logLevel, { color: accent }]}>
                      [{log.level.toUpperCase()}] {log.module}
                    </Text>
                    <Text style={s.logTime}>
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </Text>
                  </View>
                  <Text style={s.logMessage}>{log.message}</Text>
                  {log.data && (
                    <Text style={s.logData}>
                      {JSON.stringify(log.data, null, 2).substring(0, 200)}
                    </Text>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>

        {/* Actions */}
        <View style={s.actions}>
          <TouchableOpacity
            onPress={() => Logger.clearLogs()}
            style={[s.actionBtn, { backgroundColor: colors.surfaceInput }]}
          >
            <Ionicons name="trash-outline" size={15} color={colors.danger} />
            <Text style={[s.actionText, { color: colors.danger }]}>Clear</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleExport}
            style={[s.actionBtn, { backgroundColor: colors.surfaceInput }]}
          >
            <Ionicons name="share-outline" size={15} color={colors.primary} />
            <Text style={[s.actionText, { color: colors.primary }]}>Export</Text>
          </TouchableOpacity>
        </View>

        {/* Search (bottom) */}
        <View style={[s.searchWrap, { paddingBottom: insets.bottom + 10 }]}>
          <View style={s.searchBar}>
            <Ionicons name="search" size={16} color={colors.textFaint} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search logs…"
              placeholderTextColor={colors.textFaint}
              style={s.searchInput}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={colors.textFaint} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    header: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    title: { color: c.text, fontSize: 17, fontWeight: '700' },
    closeBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: c.surfaceInput,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pillRow: {
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 4,
    },
    pill: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surfaceInput,
    },
    pillText: { fontSize: 12, fontWeight: '600' },
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: 16, paddingVertical: 12 },
    empty: { color: c.textFaint, fontSize: 13, marginTop: 16, textAlign: 'center' },
    logRow: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginVertical: 4,
      borderRadius: 10,
      backgroundColor: c.surface,
      borderLeftWidth: 3,
    },
    logMeta: { flexDirection: 'row', justifyContent: 'space-between' },
    logLevel: { fontSize: 11, fontWeight: '700' },
    logTime: { color: c.textFaint, fontSize: 10 },
    logMessage: { color: c.text, fontSize: 12, marginTop: 4 },
    logData: { color: c.textMuted, fontSize: 10, marginTop: 4, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
    actions: {
      paddingHorizontal: 16,
      paddingTop: 10,
      flexDirection: 'row',
      gap: 12,
    },
    actionBtn: {
      flex: 1,
      flexDirection: 'row',
      gap: 6,
      paddingVertical: 10,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
    },
    actionText: { fontSize: 13, fontWeight: '600' },
    searchWrap: {
      paddingHorizontal: 16,
      paddingTop: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
      marginTop: 10,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: c.surfaceInput,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: Platform.OS === 'ios' ? 10 : 4,
    },
    searchInput: { flex: 1, color: c.text, fontSize: 14, padding: 0 },
  });
}
