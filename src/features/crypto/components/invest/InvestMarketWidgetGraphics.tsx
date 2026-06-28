import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, Path, Rect } from 'react-native-svg';

import type { UsMarketStatus } from '../../../../lib/api/marketIndices/client';

const GAUGE_COLORS = ['#EF4444', '#F97316', '#EAB308', '#84CC16', '#10B981'];
const ALT_SEASON_COLORS = ['#F97316', '#FDBA74', '#93C5FD', '#3B82F6'];
const CHART_INSET = 1;
const GAUGE_SEGMENT_COUNT = 5;
const GAUGE_GAP_ANGLE = 0.045;

function buildSparklinePath(points: number[], width: number, height: number): string {
  if (points.length < 2) return '';

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const padY = 2;
  const innerWidth = Math.max(1, width - CHART_INSET * 2);

  const coords = points.map((point, index) => {
    const x = CHART_INSET + (index / (points.length - 1)) * innerWidth;
    const y = height - padY - ((point - min) / range) * (height - padY * 2);
    return { x, y };
  });

  return coords
    .map((coord, index) => `${index === 0 ? 'M' : 'L'} ${coord.x.toFixed(1)} ${coord.y.toFixed(1)}`)
    .join(' ');
}

export function MiniSparkline({
  points,
  width,
  height,
  color,
}: {
  points: number[];
  width: number;
  height: number;
  color: string;
}) {
  const path = useMemo(() => buildSparklinePath(points, width, height), [points, width, height]);
  if (!path) return <View style={{ width, height }} />;

  return (
    <Svg width={width} height={height}>
      <Path
        d={path}
        stroke={color}
        strokeWidth={1.5}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function MarketStatusBar({
  status,
  width,
  color,
}: {
  status: UsMarketStatus;
  width: number;
  color: string;
}) {
  const height = 8;
  const segments = 5;
  const gap = 2;
  const innerWidth = Math.max(1, width - CHART_INSET * 2);
  const segmentWidth = (innerWidth - gap * (segments - 1)) / segments;

  const activeIndex = (() => {
    switch (status) {
      case 'pre':
        return 1;
      case 'open':
        return 2;
      case 'post':
        return 3;
      default:
        return -1;
    }
  })();

  return (
    <Svg width={width} height={height}>
      {Array.from({ length: segments }, (_, index) => {
        const x = CHART_INSET + index * (segmentWidth + gap);
        const active = index === activeIndex;
        const segW = index === segments - 1
          ? innerWidth - index * (segmentWidth + gap)
          : segmentWidth;
        return (
          <Rect
            key={index}
            x={x}
            y={0}
            width={Math.max(0, segW)}
            height={height}
            rx={height / 2}
            fill={active ? color : 'rgba(148,163,184,0.28)'}
          />
        );
      })}
    </Svg>
  );
}

function gaugePoint(cx: number, cy: number, radius: number, angle: number) {
  return {
    x: cx + radius * Math.cos(angle),
    y: cy - radius * Math.sin(angle),
  };
}

function describeUpArc(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number,
): string {
  const start = gaugePoint(cx, cy, radius, startAngle);
  const end = gaugePoint(cx, cy, radius, endAngle);
  const largeArc = Math.abs(startAngle - endAngle) > Math.PI ? 1 : 0;
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${radius} ${radius} 0 ${largeArc} 0 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

export function FearGreedGauge({
  value,
  width,
  height,
}: {
  value: number;
  width: number;
  height: number;
}) {
  const strokeW = 3.5;
  const padTop = 2;
  const padBottom = 8;
  const cx = width / 2;
  const cy = height - padBottom - strokeW / 2;
  const radius = Math.max(
    8,
    Math.min(width / 2 - strokeW - 2, cy - padTop - strokeW / 2),
  );
  const start = Math.PI;
  const end = 0;
  const span = start - end;
  const clamped = Math.max(0, Math.min(100, value));
  const needleAngle = start - (clamped / 100) * span;
  const trackSpan = span - GAUGE_GAP_ANGLE * (GAUGE_SEGMENT_COUNT - 1);
  const segmentSpan = trackSpan / GAUGE_SEGMENT_COUNT;

  const segments = useMemo(
    () =>
      GAUGE_COLORS.map((segmentColor, index) => {
        const segStart = start - index * (segmentSpan + GAUGE_GAP_ANGLE);
        const segEnd = segStart - segmentSpan;
        return {
          key: `${segmentColor}-${index}`,
          d: describeUpArc(cx, cy, radius, segStart, segEnd),
          color: segmentColor,
        };
      }),
    [cx, cy, radius, segmentSpan, start],
  );

  const needle = gaugePoint(cx, cy, radius, needleAngle);
  const trackPath = describeUpArc(cx, cy, radius, start, end);

  return (
    <Svg width={width} height={height}>
      <Path
        d={trackPath}
        stroke="rgba(148,163,184,0.14)"
        strokeWidth={strokeW}
        fill="none"
        strokeLinecap="round"
      />
      {segments.map((segment) => (
        <Path
          key={segment.key}
          d={segment.d}
          stroke={segment.color}
          strokeWidth={strokeW}
          fill="none"
          strokeLinecap="round"
        />
      ))}
      <Circle
        cx={needle.x}
        cy={needle.y}
        r={4}
        fill="#FFFFFF"
        stroke="rgba(15,23,42,0.18)"
        strokeWidth={1}
      />
    </Svg>
  );
}

export function IndexSlider({
  value,
  width,
}: {
  value: number;
  width: number;
}) {
  const height = 10;
  const clamped = Math.max(0, Math.min(100, value));
  const innerWidth = Math.max(1, width - CHART_INSET * 2);
  const segmentWidth = innerWidth / ALT_SEASON_COLORS.length;
  const thumbX = CHART_INSET + Math.max(4, Math.min(innerWidth - 4, (clamped / 100) * innerWidth));
  const clipId = useMemo(() => `alt-season-${Math.round(width)}`, [width]);

  return (
    <View style={styles.sliderWrap}>
      <Svg width={width} height={height}>
        <Defs>
          <ClipPath id={clipId}>
            <Rect
              x={CHART_INSET}
              y={0}
              width={innerWidth}
              height={height}
              rx={height / 2}
              ry={height / 2}
            />
          </ClipPath>
        </Defs>
        <G clipPath={`url(#${clipId})`}>
          {ALT_SEASON_COLORS.map((segmentColor, index) => {
            const x = CHART_INSET + index * segmentWidth;
            const w = index === ALT_SEASON_COLORS.length - 1
              ? innerWidth - index * segmentWidth
              : segmentWidth;
            return (
              <Rect
                key={segmentColor}
                x={x}
                y={0}
                width={Math.max(0, w)}
                height={height}
                fill={segmentColor}
              />
            );
          })}
        </G>
        <Circle
          cx={thumbX}
          cy={height / 2}
          r={3.5}
          fill="#FFFFFF"
          stroke="rgba(0,0,0,0.1)"
          strokeWidth={0.5}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  sliderWrap: {
    width: '100%',
    overflow: 'hidden',
  },
});
