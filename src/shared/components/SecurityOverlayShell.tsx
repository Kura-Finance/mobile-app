import React from 'react';
import { Modal, Platform, StyleSheet, View } from 'react-native';
import { FullWindowOverlay } from 'react-native-screens';
import OverlayStatusBar from './OverlayStatusBar';

interface SecurityOverlayShellProps {
  children: React.ReactNode;
  /** Block Android back and other shell-level dismiss while biometrics are in flight. */
  interactionLocked?: boolean;
  /** Android back button handler. Defaults to no-op. */
  onRequestClose?: () => void;
}

/**
 * Full-screen security overlay shell.
 * iOS uses FullWindowOverlay so content renders above stack-pushed screens and RN Modals.
 */
export default function SecurityOverlayShell({
  children,
  interactionLocked = false,
  onRequestClose = () => {},
}: SecurityOverlayShellProps) {
  const handleRequestClose = interactionLocked ? () => {} : onRequestClose;
  const content = (
    <View style={styles.root}>
      <OverlayStatusBar />
      {children}
    </View>
  );

  if (Platform.OS === 'ios') {
    return (
      <FullWindowOverlay unstable_accessibilityContainerViewIsModal>
        {content}
      </FullWindowOverlay>
    );
  }

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      presentationStyle="overFullScreen"
      onRequestClose={handleRequestClose}
    >
      {content}
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
