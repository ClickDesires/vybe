import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar, Button, EmptyState, Header, IconButton } from '@/components/ui';
import { fetchBlocked, unblockUser } from '@/lib/api';
import { colors } from '@/lib/theme';
import type { Profile } from '@/lib/types';

export default function BlockedScreen() {
  const [people, setPeople] = useState<Profile[] | null>(null);

  useEffect(() => {
    fetchBlocked().then(setPeople).catch(() => setPeople([]));
  }, []);

  const unblock = async (p: Profile) => {
    setPeople((ps) => ps?.filter((x) => x.id !== p.id) ?? null);
    await unblockUser(p.id).catch(() => setPeople((ps) => (ps ? [p, ...ps] : [p])));
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title="Blocked accounts" left={<IconButton name="chevron-back" onPress={() => router.back()} />} />
      {!people ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
      ) : (
        <FlatList
          data={people}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ flexGrow: 1 }}
          ListEmptyComponent={<EmptyState icon="ban-outline" title="No blocked accounts" body="People you block will appear here." />}
          renderItem={({ item: p }) => (
            <View style={styles.row}>
              <Avatar uri={p.avatar_url} size={46} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{p.display_name || p.username}</Text>
                <Text style={styles.handle}>@{p.username}</Text>
              </View>
              <Button title="Unblock" variant="secondary" small onPress={() => unblock(p)} />
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  name: { color: colors.text, fontSize: 16, fontWeight: '600' },
  handle: { color: colors.textMuted, fontSize: 13 },
});
