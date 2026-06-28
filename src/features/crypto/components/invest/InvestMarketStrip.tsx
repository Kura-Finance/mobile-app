import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../../shared/theme/theme';
import { useMarketIndices } from '../../hooks/useMarketIndices';
import type { MarketIndicesSnapshot, UsMarketStatus } from '../../../../lib/api/marketIndices/client';
import {
  FearGreedGauge,
  IndexSlider,
  MarketStatusBar,
  MiniSparkline,
} from './InvestMarketWidgetGraphics';

function formatSp500(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function formatSignedPct(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

function marketStatusColor(status: UsMarketStatus, colors: ThemeColors): string {
  switch (status) {
    case 'open':
      return '#10B981';
    case 'pre':
    case 'post':
      return '#F59E0B';
    default:
      return colors.textMuted;
  }
}

function fearGreedColor(value: number | null): string {
  if (value == null) return '#9CA3AF';
  if (value <= 25) return '#EF4444';
  if (value <= 45) return '#F97316';
  if (value <= 55) return '#9CA3AF';
  if (value <= 75) return '#84CC16';
  return '#10B981';
}

function shortFearGreedLabel(label: string | null | undefined): string | null {
  if (!label) return null;
  return label.replace('Extreme ', 'Ext. ');
}

function ChartClip({
  width,
  height,
  children,
}: {
  width: number;
  height?: number;
  children: React.ReactNode;
}) {
  if (width <= 0) return null;
  return (
    <View style={[chartClipStyles.clip, { width, height }]}>
      {children}
    </View>
  );
}

const chartClipStyles = StyleSheet.create({
  clip: {
    overflow: 'hidden',
    alignSelf: 'stretch',
  },
});

function WidgetShell({
  label,
  st,
  children,
}: {
  label: string;
  st: ReturnType<typeof makeStyles>;
  children: (width: number) => React.ReactNode;
}) {
  const [width, setWidth] = useState(0);

  const onLayout = (event: LayoutChangeEvent) => {
    const next = Math.floor(event.nativeEvent.layout.width);
    if (next > 0 && next !== width) setWidth(next);
  };

  return (
    <View style={st.widget}>
      <Text style={st.widgetLabel} numberOfLines={1}>
        {label}
      </Text>
      <View style={st.widgetContent} onLayout={onLayout}>
        {width > 0 ? children(width) : null}
      </View>
    </View>
  );
}

function UsStockWidget({
  data,
  loading,
  st,
}: {
  data: MarketIndicesSnapshot | null;
  loading: boolean;
  st: ReturnType<typeof makeStyles>;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const status = data?.usMarketStatus ?? 'closed';
  const statusColor = data ? marketStatusColor(status, colors) : colors.textMuted;
  const label = loading && !data
    ? '—'
    : status === 'open'
      ? t('crypto.usMarketOpen')
      : status === 'pre'
        ? t('crypto.usMarketPre')
        : status === 'post'
          ? t('crypto.usMarketPost')
          : t('crypto.usMarketClosed');

  return (
    <WidgetShell label={t('crypto.investWidgetUsStock')} st={st}>
      {(width) => (
        <View style={st.stackEnd}>
          <Text
            style={[st.statusValue, { color: statusColor }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
          >
            {label}
          </Text>
          <ChartClip width={width} height={8}>
            <MarketStatusBar status={status} width={width} color={statusColor} />
          </ChartClip>
        </View>
      )}
    </WidgetShell>
  );
}

function Sp500Widget({
  data,
  loading,
  st,
}: {
  data: MarketIndicesSnapshot | null;
  loading: boolean;
  st: ReturnType<typeof makeStyles>;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const changePct = data?.sp500ChangePct ?? null;
  const changeColor = changePct == null ? colors.textMuted : changePct >= 0 ? '#10B981' : '#EF4444';
  const sparkColor = changePct == null ? colors.textMuted : changeColor;
  const sparkPoints = useMemo(() => {
    const points = data?.sp500Sparkline ?? [];
    if (points.length > 20) return points.slice(-20);
    return points;
  }, [data?.sp500Sparkline]);

  return (
    <WidgetShell label={t('crypto.investWidgetSp')} st={st}>
      {(width) => (
        <View style={st.stackEnd}>
          <View style={st.valueRow}>
            <Text style={st.widgetValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              {loading && !data ? '—' : formatSp500(data?.sp500Price ?? null)}
            </Text>
            {changePct != null && (
              <Text style={[st.widgetDelta, { color: changeColor }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                {changePct >= 0 ? '▲' : '▼'}{formatSignedPct(changePct)}
              </Text>
            )}
          </View>
          {sparkPoints.length >= 2 && (
            <ChartClip width={width} height={20}>
              <MiniSparkline points={sparkPoints} width={width} height={20} color={sparkColor} />
            </ChartClip>
          )}
        </View>
      )}
    </WidgetShell>
  );
}

function AltSeasonWidget({
  data,
  loading,
  st,
}: {
  data: MarketIndicesSnapshot | null;
  loading: boolean;
  st: ReturnType<typeof makeStyles>;
}) {
  const { t } = useTranslation();
  const value = data?.altcoinSeasonIndex;

  return (
    <WidgetShell label={t('crypto.investWidgetAltSeason')} st={st}>
      {(width) => (
        <View style={st.stack}>
          <View style={st.valueRow}>
            <Text style={st.widgetValue} numberOfLines={1}>
              {loading && !data ? '—' : value ?? '—'}
            </Text>
            {value != null && (
              <Text style={st.widgetMuted}>/100</Text>
            )}
          </View>
          <View style={st.stackBottom}>
            {value != null && (
              <ChartClip width={width} height={10}>
                <IndexSlider value={value} width={width} />
              </ChartClip>
            )}
            <View style={st.sliderLabels}>
              <Text style={st.sliderLabel}>{t('crypto.investWidgetBitcoin')}</Text>
              <Text style={st.sliderLabel}>{t('crypto.investWidgetAltcoin')}</Text>
            </View>
          </View>
        </View>
      )}
    </WidgetShell>
  );
}

const FNG_GAUGE_HEIGHT = 48;

function FearGreedWidget({
  data,
  loading,
  st,
}: {
  data: MarketIndicesSnapshot | null;
  loading: boolean;
  st: ReturnType<typeof makeStyles>;
}) {
  const { t } = useTranslation();
  const value = data?.fearGreedValue;
  const valueColor = fearGreedColor(value ?? null);
  const mood = shortFearGreedLabel(data?.fearGreedLabel);

  return (
    <WidgetShell label={t('crypto.investWidgetFng')} st={st}>
      {(width) => (
        <View style={st.fngBody}>
          <View style={[st.fngStack, { width }]}>
            {value != null && (
              <FearGreedGauge value={value} width={width} height={FNG_GAUGE_HEIGHT} />
            )}
            <View style={st.fngTextOverlay} pointerEvents="none">
              <Text
                style={[st.gaugeValue, { color: valueColor }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
              >
                {loading && !data ? '—' : value ?? '—'}
              </Text>
              {mood ? (
                <Text style={st.gaugeMood} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
                  {mood}
                </Text>
              ) : null}
            </View>
          </View>
        </View>
      )}
    </WidgetShell>
  );
}

export default function InvestMarketStrip() {
  const { colors } = useTheme();
  const st = useMemo(() => makeStyles(colors), [colors]);
  const { data, loading } = useMarketIndices();

  return (
    <View style={st.row}>
      <UsStockWidget data={data} loading={loading} st={st} />
      <Sp500Widget data={data} loading={loading} st={st} />
      <AltSeasonWidget data={data} loading={loading} st={st} />
      <FearGreedWidget data={data} loading={loading} st={st} />
    </View>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'stretch',
      paddingHorizontal: 20,
      paddingBottom: 10,
      gap: 6,
      width: '100%',
    },
    widget: {
      flex: 1,
      aspectRatio: 1,
      backgroundColor: c.surfaceAlt,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      paddingHorizontal: 8,
      paddingTop: 8,
      paddingBottom: 12,
      minWidth: 0,
      overflow: 'hidden',
    },
    widgetLabel: {
      color: c.textFaint,
      fontSize: 10,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.25,
      lineHeight: 12,
      marginBottom: 4,
    },
    widgetContent: {
      flex: 1,
      minWidth: 0,
      overflow: 'hidden',
    },
    stack: {
      flex: 1,
      justifyContent: 'space-between',
      minHeight: 0,
    },
    stackEnd: {
      flex: 1,
      justifyContent: 'flex-end',
      gap: 4,
      minHeight: 0,
    },
    stackBottom: {
      gap: 6,
    },
    fngBody: {
      flex: 1,
      justifyContent: 'flex-end',
      alignItems: 'center',
      minHeight: 0,
      paddingBottom: 8,
    },
    fngStack: {
      height: FNG_GAUGE_HEIGHT,
      justifyContent: 'flex-end',
      alignItems: 'center',
    },
    fngTextOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'flex-end',
      alignItems: 'center',
      paddingTop: 8,
      gap: 1,
    },
    valueRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 2,
      flexWrap: 'nowrap',
      minWidth: 0,
    },
    statusValue: {
      fontSize: 15,
      fontWeight: '800',
      letterSpacing: -0.3,
    },
    widgetValue: {
      color: c.text,
      fontSize: 17,
      fontWeight: '700',
      letterSpacing: -0.4,
      flexShrink: 1,
    },
    widgetDelta: {
      fontSize: 9,
      fontWeight: '700',
      flexShrink: 1,
    },
    widgetMuted: {
      color: c.textMuted,
      fontSize: 11,
      fontWeight: '600',
    },
    sliderLabels: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    sliderLabel: {
      color: c.textFaint,
      fontSize: 9,
      fontWeight: '600',
    },
    gaugeValue: {
      fontSize: 16,
      fontWeight: '700',
      lineHeight: 18,
      textAlign: 'center',
      letterSpacing: -0.3,
    },
    gaugeMood: {
      color: c.textMuted,
      fontSize: 8,
      fontWeight: '600',
      textAlign: 'center',
      lineHeight: 10,
    },
  });
}
