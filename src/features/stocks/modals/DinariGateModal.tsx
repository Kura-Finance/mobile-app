import React from 'react';
import { Modal } from 'react-native';

import DinariGateOverlay from '../components/DinariGateOverlay';
import type { useDinariGate } from '../hooks/useDinari';

interface Props {
  visible: boolean;
  gate: ReturnType<typeof useDinariGate>;
  onClose: () => void;
  onReady?: () => void;
}

/** Standalone full-screen modal (stack route fallback). Prefer {@link DinariGateOverlay} in stock detail. */
export default function DinariGateModal({ visible, gate, onClose, onReady }: Props) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <DinariGateOverlay
        gate={gate}
        onClose={onClose}
        onReady={onReady}
      />
    </Modal>
  );
}
