import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar, EmptyState, Field, Header, IconButton, Button } from '@/components/ui';
import { fetchConversations, subscribeInserts } from '@/lib/api';
import { timeAgo } from '@/lib/format';
import { colors } from '@/lib/theme';
import type { Conversation } from '@/lib/types';

export default function MessagesScreen() {
  const [items, setItems] = useState<Conversation[] | null>(null);
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setItems(await fetchConversations().catch(() => []));
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // New messages in any of my conversations reorder the list live (RLS limits events to my chats).
  useEffect(() => subscribeInserts('messages', undefined, () => load()), [load]);

  const q = query.trim().toLowerCase();
  const visible = (items ?? []).filter(
    (c) => !q || c.other_username.toLowerCase().includes(q) || c.other_display_name.toLowerCase().includes(q),
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header
        title="Messages"
        left={<IconButton name="chevron-back" onPress={() => router.back()} />}
        right={<IconButton name="create-outline" onPress={() => router.push('/messages/new')} />}
      />
      <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
        <Field icon="search" placeholder="Search messages" value={query} onChangeText={setQuery} autoCapitalize="none" />
      </View>

      {!items ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
          refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.text} onRefresh={() => { setRefreshing(true); load(); }} />}
          ListHeaderComponent={visible.length ? <Text style={styles.section}>RECENT CONVERSATIONS</Text> : null}
          ListEmptyComponent={
            <EmptyState
              icon="chatbubbles-outline"
              title={q ? 'No matches' : 'No messages yet'}
              body={q ? undefined : 'Start a chat or share a video with a friend.'}
              action={q ? undefined : <Button title="New message" icon="create-outline" onPress={() => router.push('/messages/new')} />}
            />
          }
          renderItem={({ item: c }) => {
            const unread = c.unread_count > 0;
            return (
              <Pressable
                onPress={() => router.push({ pathname: '/chat/[id]', params: { id: c.id } })}
                style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surface }]}
              >
                <Avatar uri={c.other_avatar_url} size={54} />
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={styles.name} numberOfLines={1}>
                    {c.other_display_name || c.other_username}
                  </Text>
                  <Text style={[styles.preview, unread && { color: colors.text, fontWeight: '600' }]} numberOfLines={1}>
                    {c.last_message_preview}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  <Text style={[styles.time, unread && { color: colors.lime }]}>{timeAgo(c.last_message_at)}</Text>
                  {unread && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{c.unread_count > 99 ? '99+' : c.unread_count}</Text>
                    </View>
                  )}
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  section: { color: colors.textMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 10 },
  name: { color: colors.text, fontSize: 16, fontWeight: '700' },
  preview: { color: colors.textMuted, fontSize: 14 },
  time: { color: colors.textMuted, fontSize: 12 },
  badge: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: colors.text, fontSize: 12, fontWeight: '800' },
});
