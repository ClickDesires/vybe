import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';

import { colors } from '@/lib/theme';
import { ActionSheetProvider } from '@/providers/ActionSheetProvider';
import { AuthProvider, useAuth } from '@/providers/AuthProvider';

const theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.bg, card: colors.bg, primary: colors.primary, text: colors.text, border: colors.border },
};

export default function RootLayout() {
  return (
    <ThemeProvider value={theme}>
      <StatusBar style="light" />
      <View style={styles.page}>
        <View style={styles.app}>
          <AuthProvider>
            <ActionSheetProvider>
              <RootStack />
            </ActionSheetProvider>
          </AuthProvider>
        </View>
      </View>
    </ThemeProvider>
  );
}

function RootStack() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="camera" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="post" />
        <Stack.Screen
          name="comments/[id]"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.7, 1],
            sheetGrabberVisible: true,
            sheetCornerRadius: 24,
            contentStyle: { backgroundColor: colors.surface },
          }}
        />
        <Stack.Screen
          name="share/[id]"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.55, 0.9],
            sheetGrabberVisible: true,
            sheetCornerRadius: 24,
            contentStyle: { backgroundColor: colors.surface },
          }}
        />
        <Stack.Screen name="watch" options={{ animation: 'fade' }} />
        <Stack.Screen name="user/[id]" />
        <Stack.Screen name="tag/[tag]" />
        <Stack.Screen name="edit-profile" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="blocked" />
        <Stack.Screen name="messages/index" />
        <Stack.Screen name="messages/new" />
        <Stack.Screen name="chat/[id]" />
      </Stack.Protected>
    </Stack>
  );
}

/** Phone-width column on wide screens (desktop browsers, tablets); full width on phones. */
const MAX_APP_WIDTH = 520;

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#000', alignItems: 'center' },
  app: {
    flex: 1,
    width: '100%',
    maxWidth: MAX_APP_WIDTH,
    backgroundColor: colors.bg,
    overflow: 'hidden',
    ...(Platform.OS === 'web' && { borderLeftWidth: StyleSheet.hairlineWidth, borderRightWidth: StyleSheet.hairlineWidth, borderColor: colors.border }),
  },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
});
