import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar, EmptyState, Field, Header, IconButton } from '@/components/ui';
import { Alert } from '@/lib/alert';
import { fetchShareTargets, searchProfiles, startConversation } from '@/lib/api';
import { colors } from '@/lib/theme';
import type { Profile } from '@/lib/types';
import { useAuth } from '@/providers/AuthProvider';

type Person = Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'>;

export default function NewMessageScreen() {
  const { session } = useAuth();
  const [query, setQuery] = useState('');
  const [people, setPeople] = useState<Person[] | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  // Suggestions (recent chats + people you follow) until you type; then search everyone.
  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      const list = query.trim() ? await searchProfiles(query).catch(() => []) : await fetchShareTargets().catch(() => []);
      if (!cancelled) setPeople(list.filter((p) => p.id !== session?.user.id));
    }, query ? 250 : 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, session?.user.id]);

  const open = async (p: Person) => {
    setOpening(p.id);
    try {
      const id = await startConversation(p.id);
      router.replace({ pathname: '/chat/[id]', params: { id } });
    } catch (e) {
      Alert.alert('Can’t message this account', e instanceof Error ? e.message : String(e));
      setOpening(null);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title="New message" left={<IconButton name="close" onPress={() => router.back()} />} />
      <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
        <Field icon="search" placeholder="Search people" value={query} onChangeText={setQuery} autoCapitalize="none" autoFocus />
      </View>
      {!people ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
      ) : (
        <FlatList
          data={people}
          keyExtractor={(p) => p.id}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={people.length ? <Text style={styles.section}>{query ? 'RESULTS' : 'SUGGESTED'}</Text> : null}
          ListEmptyComponent={<EmptyState icon="people-outline" title={query ? 'No one found' : 'Follow people to chat'} />}
          renderItem={({ item: p }) => (
            <Pressable onPress={() => open(p)} style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surface }]}>
              <Avatar uri={p.avatar_url} size={46} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{p.display_name || p.username}</Text>
                <Text style={styles.handle}>@{p.username}</Text>
              </View>
              {opening === p.id && <ActivityIndicator color={colors.primary} />}
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  section: { color: colors.textMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, paddingHorizontal: 16, paddingVertical: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  name: { color: colors.text, fontSize: 16, fontWeight: '600' },
  handle: { color: colors.textMuted, fontSize: 13 },
});
