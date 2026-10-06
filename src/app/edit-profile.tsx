import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar, Button, Header, IconButton } from '@/components/ui';
import { Alert } from '@/lib/alert';
import { updateProfile, uploadAvatar } from '@/lib/api';
import { colors, radius } from '@/lib/theme';
import { useAuth } from '@/providers/AuthProvider';

export default function EditProfileScreen() {
  const { profile, refreshProfile } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [username, setUsername] = useState(profile?.username ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [avatar, setAvatar] = useState<string | null>(profile?.avatar_url ?? null);
  const [newAvatar, setNewAvatar] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const pickAvatar = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.9 });
    if (res.canceled || !res.assets[0]) return;
    setAvatar(res.assets[0].uri);
    setNewAvatar(res.assets[0].uri);
  };

  const save = async () => {
    setSaving(true);
    try {
      const avatar_url = newAvatar ? await uploadAvatar(newAvatar) : undefined;
      await updateProfile({ display_name: displayName.trim(), username: username.trim(), bio: bio.trim(), ...(avatar_url && { avatar_url }) });
      await refreshProfile();
      router.back();
    } catch (e) {
      Alert.alert('Couldn’t save', e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title="Edit profile" left={<IconButton name="chevron-back" onPress={() => router.back()} />} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 18 }} keyboardShouldPersistTaps="handled">
          <Pressable onPress={pickAvatar} style={{ alignItems: 'center', gap: 10 }}>
            <Avatar uri={avatar} size={104} ring />
            <Text style={{ color: colors.lime, fontWeight: '700' }}>Change photo</Text>
          </Pressable>

          <LabeledInput label="Name" value={displayName} onChangeText={setDisplayName} maxLength={40} />
          <LabeledInput
            label="Username"
            value={username}
            onChangeText={(t) => setUsername(t.toLowerCase().replace(/[^a-z0-9._]/g, ''))}
            maxLength={24}
            autoCapitalize="none"
            prefix="@"
          />
          <LabeledInput label="Bio" value={bio} onChangeText={setBio} maxLength={160} multiline hint={`${bio.length}/160`} />

          <Button title="Save" onPress={save} loading={saving} style={{ marginTop: 8 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function LabeledInput({
  label,
  hint,
  prefix,
  ...props
}: React.ComponentProps<typeof TextInput> & { label: string; hint?: string; prefix?: string }) {
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={styles.label}>{label}</Text>
        {hint && <Text style={styles.hint}>{hint}</Text>}
      </View>
      <View style={styles.inputWrap}>
        {prefix && <Text style={{ color: colors.textMuted, fontSize: 16 }}>{prefix}</Text>}
        <TextInput placeholderTextColor={colors.textFaint} selectionColor={colors.primary} style={[styles.input, props.multiline && { minHeight: 80, textAlignVertical: 'top', paddingTop: 14 }]} {...props} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  hint: { color: colors.textFaint, fontSize: 12 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, gap: 2 },
  input: { flex: 1, color: colors.text, fontSize: 16, minHeight: 50 },
});
