import { Ionicons } from '@expo/vector-icons';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { IconName } from '@/components/ui';
import { colors, radius } from '@/lib/theme';

export type SheetOption = {
  label: string;
  icon?: IconName;
  destructive?: boolean;
  onPress: () => void;
};

type SheetConfig = { title?: string; message?: string; options: SheetOption[] };

const ActionSheetContext = createContext<(config: SheetConfig) => void>(() => {});

/** Bottom action sheet usable anywhere: `const show = useActionSheet(); show({ options })`. */
export function ActionSheetProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [config, setConfig] = useState<SheetConfig | null>(null);

  const close = () => setConfig(null);
  const show = useCallback((c: SheetConfig) => setConfig(c), []);

  return (
    <ActionSheetContext.Provider value={show}>
      {children}
      <Modal visible={!!config} transparent animationType="slide" onRequestClose={close} statusBarTranslucent>
        <Pressable style={styles.backdrop} onPress={close} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.grabber} />
          {config?.title && <Text style={styles.title}>{config.title}</Text>}
          {config?.message && <Text style={styles.message}>{config.message}</Text>}
          {config?.options.map((o) => (
            <Pressable
              key={o.label}
              onPress={() => {
                close();
                // Let the sheet close before the action opens anything else (alerts, other sheets).
                setTimeout(o.onPress, 250);
              }}
              style={({ pressed }) => [styles.option, pressed && { backgroundColor: colors.surfaceAlt }]}
            >
              {o.icon && <Ionicons name={o.icon} size={20} color={o.destructive ? colors.danger : colors.text} />}
              <Text style={[styles.optionText, o.destructive && { color: colors.danger }]}>{o.label}</Text>
            </Pressable>
          ))}
          <Pressable onPress={close} style={[styles.option, styles.cancel]}>
            <Text style={[styles.optionText, { textAlign: 'center', flex: 1, color: colors.textMuted }]}>Cancel</Text>
          </Pressable>
        </View>
      </Modal>
    </ActionSheetContext.Provider>
  );
}

export const useActionSheet = () => useContext(ActionSheetContext);

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { width: '100%', maxWidth: 520, alignSelf: 'center', backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 12, paddingTop: 8 },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 12 },
  title: { color: colors.text, fontSize: 16, fontWeight: '700', textAlign: 'center', marginBottom: 4 },
  message: { color: colors.textMuted, fontSize: 13, textAlign: 'center', marginBottom: 8, paddingHorizontal: 16 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 15, borderRadius: radius.md },
  optionText: { color: colors.text, fontSize: 16, fontWeight: '500' },
  cancel: { marginTop: 6, backgroundColor: colors.surfaceAlt },
});
