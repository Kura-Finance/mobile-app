import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import LoadingDots from '../../../../shared/components/LoadingDots';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Path, Stop } from 'react-native-svg';

interface Props {
  prices: number[];
  width: number;
  height: number;
  loading?: boolean;
  color?: string;
  /** Tighter vertical padding and thinner stroke for compact cards */
  compact?: boolean;
}

const PAD_V = 14;
const PAD_V_COMPACT = 6;

export default function NetWorthChart({
  prices,
  width,
  height,
  loading,
  color = '#6366F1',
  compact = false,
}: Props) {
  const padV = compact ? PAD_V_COMPACT : PAD_V;
  const strokeWidth = compact ? 2 : 2.5;

  const { linePath, areaPath } = useMemo(() => {
    if (prices.length < 2) return { linePath: '', areaPath: '' };

    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const flat = max === min;
    const range = max - min || 1;
    const n = prices.length;

    const pts = prices.map((p, i) => {
      const x = (i / (n - 1)) * width;
      const norm = flat ? 0.5 : (p - min) / range;
      const y = height - padV - norm * (height - padV * 2);
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
  }, [prices, width, height, padV]);

  if (loading && prices.length === 0) {
    return (
      <View style={[styles.center, { width, height }]}>
        <LoadingDots compact color={color} size={6}    />
      </View>
    );
  }

  if (!linePath) {
    return <View style={{ width, height }} />;
  }

  return (
    <Svg width={width} height={height}>
      <Defs>
        <SvgLinearGradient id="netWorthFill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity={0.22} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </SvgLinearGradient>
      </Defs>
      <Path d={areaPath} fill="url(#netWorthFill)" />
      <Path
        d={linePath}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});
