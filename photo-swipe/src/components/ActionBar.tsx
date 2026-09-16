import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors } from '../theme';

type Props = {
  onDelete: () => void;
  onKeep: () => void;
  onUndo: () => void;
  canUndo: boolean;
  canSwipe: boolean;
};

type RoundButtonProps = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
  size: number;
  onPress: () => void;
  disabled?: boolean;
  label: string;
  style?: StyleProp<ViewStyle>;
};

function RoundButton({ icon, color, size, onPress, disabled, label, style }: RoundButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => [
        styles.round,
        { width: size, height: size, borderRadius: size / 2, borderColor: color },
        pressed && { transform: [{ scale: 0.92 }], backgroundColor: colors.surfaceAlt },
        disabled && styles.disabled,
        style,
      ]}
    >
      <Ionicons name={icon} size={size * 0.46} color={color} />
    </Pressable>
  );
}

export function ActionBar({ onDelete, onKeep, onUndo, canSwipe, canUndo }: Props) {
  return (
    <View style={styles.row}>
      <RoundButton
        icon="close"
        color={colors.del}
        size={72}
        onPress={onDelete}
        disabled={!canSwipe}
        label="Borrar esta foto"
      />
      <RoundButton
        icon="arrow-undo"
        color={colors.textMuted}
        size={54}
        onPress={onUndo}
        disabled={!canUndo}
        label="Deshacer la última decisión"
      />
      <RoundButton
        icon="heart"
        color={colors.keep}
        size={72}
        onPress={onKeep}
        disabled={!canSwipe}
        label="Guardar esta foto"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 28,
  },
  round: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 2,
  },
  disabled: {
    opacity: 0.35,
  },
});
