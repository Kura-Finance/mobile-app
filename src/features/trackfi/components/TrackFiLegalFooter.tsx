import React, { useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import LegalDisclaimer from '../../../shared/components/LegalDisclaimer';

interface Props {
  style?: StyleProp<ViewStyle>;
}

export default function TrackFiLegalFooter({ style }: Props) {
  const st = useMemo(() => styles, []);

  return (
    <View style={[st.wrap, style]}>
      <LegalDisclaimer variant="trackfi" centered={false} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 24,
    marginBottom: 4,
  },
});
