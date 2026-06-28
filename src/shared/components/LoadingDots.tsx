import React, { useEffect } from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

interface LoadingDotsProps {
  color: string;
  size?: number;
  /** Drop min-height — use inside buttons and tight rows. */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

interface DotProps {
  color: string;
  size: number;
  delay: number;
}

function Dot({ color, size, delay }: DotProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 280 }),
          withTiming(0, { duration: 280 }),
          withDelay(140, withTiming(0, { duration: 0 })),
        ),
        -1,
        false,
      ),
    );
  }, [delay, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + progress.value * 0.65,
    transform: [{ translateY: -5 * progress.value }],
  }));

  return (
    <Animated.View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
        animatedStyle,
      ]}
    />
  );
}

/**
 * Three bouncing dots — used inline where a compact loading state is needed
 * (e.g. portfolio total value) without blocking the rest of the screen.
 */
export default function LoadingDots({
  color,
  size = 8,
  compact = false,
  style,
}: LoadingDotsProps) {
  return (
    <View style={[styles.row, compact && styles.rowCompact, style]}>
      <Dot color={color} size={size} delay={0} />
      <Dot color={color} size={size} delay={140} />
      <Dot color={color} size={size} delay={280} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 40,
    justifyContent: 'center',
  },
  rowCompact: {
    minHeight: 0,
    gap: 4,
  },
});
