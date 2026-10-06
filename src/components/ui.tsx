import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { colors, radius } from '@/lib/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function Avatar({ uri, size = 40, ring = false }: { uri?: string | null; size?: number; ring?: boolean }) {
  const inner = (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.surfaceAlt, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
      {uri ? (
        <Image source={uri} style={{ width: size, height: size }} contentFit="cover" transition={150} />
      ) : (
        <Ionicons name="person" size={size * 0.5} color={colors.textFaint} />
      )}
    </View>
  );
  if (!ring) return inner;
  return <View style={{ padding: 3, borderRadius: size, borderWidth: 2, borderColor: colors.primary }}>{inner}</View>;
}

type ButtonVariant = 'primary' | 'secondary' | 'lime' | 'ghost';

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  loading,
  disabled,
  style,
  small,
}: {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  small?: boolean;
}) {
  const bg = { primary: colors.primary, secondary: colors.surfaceAlt, lime: colors.lime, ghost: 'transparent' }[variant];
  const fg = variant === 'lime' ? colors.limeText : colors.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 },
        variant === 'ghost' && { borderWidth: 1, borderColor: colors.border },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={small ? 15 : 18} color={fg} />}
          <Text style={[styles.buttonText, small && { fontSize: 13 }, { color: fg }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

export function Field({ icon, ...props }: TextInputProps & { icon?: IconName }) {
  return (
    <View style={styles.field}>
      {icon && <Ionicons name={icon} size={18} color={colors.textMuted} />}
      <TextInput placeholderTextColor={colors.textFaint} selectionColor={colors.primary} style={styles.fieldInput} {...props} />
    </View>
  );
}

export function IconButton({ name, onPress, size = 22, style }: { name: IconName; onPress?: () => void; size?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable onPress={onPress} hitSlop={10} style={({ pressed }) => [styles.iconButton, { opacity: pressed ? 0.6 : 1 }, style]}>
      <Ionicons name={name} size={size} color={colors.text} />
    </Pressable>
  );
}

export function Header({ title, left, right }: { title: string; left?: ReactNode; right?: ReactNode }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerSide}>{left}</View>
      <Text style={styles.headerTitle} numberOfLines={1}>
        {title}
      </Text>
      <View style={[styles.headerSide, { alignItems: 'flex-end' }]}>{right}</View>
    </View>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: IconName; title: string; body?: string; action?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={28} color={colors.primary} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {body && <Text style={styles.emptyBody}>{body}</Text>}
      {action}
    </View>
  );
}

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View style={{ width: size, height: size, borderRadius: size * 0.28, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: colors.lime, fontWeight: '900', fontSize: size * 0.6 }}>V</Text>
      </View>
      <Text style={{ color: colors.text, fontWeight: '900', fontSize: size * 0.75, letterSpacing: 1 }}>VYBE</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 50,
    borderRadius: radius.md,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonSmall: { height: 34, paddingHorizontal: 14, borderRadius: radius.sm },
  buttonText: { fontSize: 16, fontWeight: '600' },
  field: {
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  fieldInput: { flex: 1, color: colors.text, fontSize: 16, height: '100%' },
  iconButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  header: { height: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  headerSide: { width: 72 },
  headerTitle: { flex: 1, textAlign: 'center', color: colors.text, fontSize: 18, fontWeight: '600' },
  empty: { alignItems: 'center', padding: 32, gap: 10 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  emptyBody: { color: colors.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 8 },
});
