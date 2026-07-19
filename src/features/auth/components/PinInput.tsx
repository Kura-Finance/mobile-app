import React, { useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  Keyboard,
  type TextInputProps,
} from 'react-native';
import { useTheme } from '../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../shared/theme/theme';
import { APP_PIN_LENGTH } from '../../../lib/security/appPinCore';

interface Props {
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
  editable?: boolean;
  testID?: string;
}

export default function PinInput({
  value,
  onChange,
  autoFocus = true,
  editable = true,
  testID,
}: Props) {
  const { colors } = useTheme();
  const inputRef = useRef<TextInput>(null);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const digits = Array.from({ length: APP_PIN_LENGTH }, (_, index) => value[index] ?? '');

  const handleChange: TextInputProps['onChangeText'] = (text) => {
    const next = text.replace(/\D/g, '').slice(0, APP_PIN_LENGTH);
    onChange(next);
    if (next.length >= APP_PIN_LENGTH) {
      inputRef.current?.blur();
      Keyboard.dismiss();
    }
  };

  useEffect(() => {
    if (!editable) {
      inputRef.current?.blur();
      Keyboard.dismiss();
    }
  }, [editable]);

  return (
    <Pressable style={styles.wrapper} onPress={() => inputRef.current?.focus()}>
      <View style={styles.cells}>
        {digits.map((digit, index) => (
          <View
            key={index}
            style={[
              styles.cell,
              value.length === index && editable ? styles.cellActive : null,
            ]}
          >
            <Text style={styles.cellText}>{digit ? '•' : ''}</Text>
          </View>
        ))}
      </View>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleChange}
        keyboardType="number-pad"
        maxLength={APP_PIN_LENGTH}
        secureTextEntry
        autoFocus={autoFocus}
        editable={editable}
        testID={testID}
        style={styles.hiddenInput}
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
      />
    </Pressable>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrapper: {
      alignItems: 'center',
    },
    cells: {
      flexDirection: 'row',
      gap: 10,
    },
    cell: {
      width: 46,
      height: 54,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cellActive: {
      borderColor: colors.primary,
    },
    cellText: {
      fontSize: 24,
      lineHeight: 28,
      color: colors.text,
      fontWeight: '700',
    },
    hiddenInput: {
      position: 'absolute',
      opacity: 0,
      width: 1,
      height: 1,
    },
  });
}
