/**
 * PriceChart
 *
 * Lightweight SVG area chart for a series of prices: a single solid trend line
 * on top with a soft semi-transparent gradient fill underneath. Colour reflects
 * the trend (green up / red down).
 */
import React, { useMemo } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import Svg, {
  Defs,
  LinearGradient as SvgLinearGradient,
  Path,
  Stop,
} from 'react-native-svg';

interface Props {
  prices: number[];
  width: number;
  height: number;
  loading?: boolean;
  /** Force a colour; otherwise derived from first→last trend. */
  positive?: boolean;
}

const PAD_V = 12;

export default function PriceChart({ prices, width, height, loading, positive }: Props) {
  const { linePath, areaPath } = useMemo(() => {
    if (prices.length < 2) return { linePath: '', areaPath: '' };

    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;
    const n = prices.length;

    const pts = prices.map((p, i) => {
      const x = (i / (n - 1)) * width;
      const norm = (p - min) / range;
      const y = height - PAD_V - norm * (height - PAD_V * 2);
      return { x, y };
    });

    let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1];
      const curr = pts[i];
      const midX = (prev.x + curr.x) / 2;
      d += ` C ${midX.toFixed(2)} ${prev.y.toFixed(2)}, ${midX.toFixed(2)} ${curr.y.toFixed(2)}, ${curr.x.toFixed(2)} ${curr.y.toFixed(2)}`;
    }

    const area = `${d} L ${pts[n - 1].x.toFixed(2)} ${height} L ${pts[0].x.toFixed(2)} ${height} Z`;
    return { linePath: d, areaPath: area };
  }, [prices, width, height]);

  const isUp = positive ?? (prices.length >= 2 ? prices[prices.length - 1] >= prices[0] : true);
  const stroke = isUp ? '#34C759' : '#EF4444';

  if (loading && prices.length === 0) {
    return (
      <View style={[styles.center, { width, height }]}>
        <ActivityIndicator size="small" color="#8B5CF6" />
      </View>
    );
  }

  if (!linePath) {
    return <View style={{ width, height }} />;
  }

  return (
    <Svg width={width} height={height}>
      <Defs>
        <SvgLinearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={stroke} stopOpacity={0.25} />
          <Stop offset="1" stopColor={stroke} stopOpacity={0} />
        </SvgLinearGradient>
      </Defs>
      <Path d={areaPath} fill="url(#priceFill)" />
      <Path d={linePath} stroke={stroke} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});
