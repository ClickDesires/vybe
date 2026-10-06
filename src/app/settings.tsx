import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar, Header, IconButton, type IconName } from '@/components/ui';
import { Alert } from '@/lib/alert';
import { signOut as logOut } from '@/lib/api';
import { colors, radius } from '@/lib/theme';
import { useAuth } from '@/providers/AuthProvider';

export default function SettingsScreen() {
  const { profile, session } = useAuth();

  const signOut = () =>
    Alert.alert('Log out?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => logOut() },
    ]);

  const soon = () => Alert.alert('Coming soon', 'This setting arrives in the next update.');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title="Settings" left={<IconButton name="chevron-back" onPress={() => router.back()} />} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Pressable onPress={() => router.push('/edit-profile')} style={styles.card}>
          <Avatar uri={profile?.avatar_url} size={56} ring />
          <View style={{ flex: 1 }}>
            <Text style={styles.cardName}>{profile?.display_name || profile?.username}</Text>
            <Text style={styles.cardMeta}>@{profile?.username} · {session?.user.email}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>

        <Section title="Account">
          <Row icon="person-outline" label="Edit profile" onPress={() => router.push('/edit-profile')} />
          <Row icon="shield-outline" label="Privacy" value="Public" onPress={soon} />
          <Row icon="lock-closed-outline" label="Security" onPress={soon} />
          <Row icon="ban-outline" label="Blocked accounts" onPress={() => router.push('/blocked')} />
        </Section>

        <Section title="Experience">
          <Row icon="notifications-outline" label="Notifications" onPress={soon} />
          <Row icon="options-outline" label="Content preferences" onPress={soon} />
          <Row icon="moon-outline" label="Appearance" value="Dark" onPress={soon} />
        </Section>

        <Section title="Support and about">
          <Row icon="help-circle-outline" label="Help center" onPress={soon} />
          <Row icon="flag-outline" label="Report a problem" onPress={soon} />
          <Row icon="information-circle-outline" label="About VYBE" value={`v${Constants.expoConfig?.version ?? '1.0.0'}`} />
        </Section>

        <Pressable onPress={signOut} style={[styles.row, { marginTop: 24 }]}>
          <View style={[styles.rowIcon, { backgroundColor: 'rgba(255,77,109,0.12)' }]}>
            <Ionicons name="log-out-outline" size={18} color={colors.danger} />
          </View>
          <Text style={[styles.rowLabel, { color: colors.danger }]}>Log out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 24 }}>
      <Text style={styles.section}>{title.toUpperCase()}</Text>
      {children}
    </View>
  );
}

function Row({ icon, label, value, onPress }: { icon: IconName; label: string; value?: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>
      <Text style={styles.rowLabel}>{label}</Text>
      {value && <Text style={styles.rowValue}>{value}</Text>}
      {onPress && <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  cardName: { color: colors.text, fontSize: 17, fontWeight: '700' },
  cardMeta: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  section: { color: colors.textMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 11 },
  rowIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { flex: 1, color: colors.text, fontSize: 16, fontWeight: '500' },
  rowValue: { color: colors.textMuted, fontSize: 14 },
});
