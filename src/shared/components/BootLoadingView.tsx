import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import LoadingDots from './LoadingDots';

const BOOT_BG = '#FFFFFF';
const DOT_COLOR = '#0B0B0F';

interface BootLoadingViewProps {
  caption?: string;
}

/** Full-screen boot loader — white background + balance-style bouncing dots. */
export default function BootLoadingView({ caption }: BootLoadingViewProps) {
  return (
    <View style={styles.root}>
      <StatusBar style="dark" translucent />
      <LoadingDots color={DOT_COLOR} size={10} />
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BOOT_BG,
    justifyContent: 'center',
    alignItems: 'center',
  },
  caption: {
    marginTop: 16,
    fontSize: 13,
    color: '#6B7280',
  },
});
