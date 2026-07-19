import React, { useEffect } from 'react';
import { Platform, StatusBar as RNStatusBar } from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { useTheme } from '../theme/ThemeContext';

/**
 * Status bar for full-screen overlays (FullWindowOverlay / Modal).
 * Uses imperative barStyle on iOS so light icons render correctly in dark mode.
 */
export default function OverlayStatusBar() {
  const { scheme } = useTheme();
  const expoStyle = scheme === 'light' ? 'dark' : 'light';
  const barStyle = scheme === 'light' ? 'dark-content' : 'light-content';

  useEffect(() => {
    const previous = RNStatusBar.pushStackEntry({ barStyle, animated: true });
    return () => {
      RNStatusBar.popStackEntry(previous);
    };
  }, [barStyle]);

  return (
    <>
      <ExpoStatusBar style={expoStyle} translucent />
      {Platform.OS === 'android' ? (
        <RNStatusBar barStyle={barStyle} translucent backgroundColor="transparent" />
      ) : null}
    </>
  );
}
