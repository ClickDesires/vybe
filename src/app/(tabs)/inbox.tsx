import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar, EmptyState, Logo } from '@/components/ui';
import { fetchNotifications, markNotificationsRead, unreadMessageCount } from '@/lib/api';
import { timeAgo } from '@/lib/format';
import { colors, radius } from '@/lib/theme';
import type { Notification } from '@/lib/types';

type Filter = 'all' | 'comments';

const BADGE = {
  like: { icon: 'heart', color: colors.like },
  comment: { icon: 'chatbubble', color: colors.primary },
  reply: { icon: 'arrow-undo', color: colors.primary },
  follow: { icon: 'person-add', color: colors.lime },
} as const;

function group(items: Notification[]) {
  const day = 24 * 3600 * 1000;
  const now = Date.now();
  const buckets: Record<string, Notification[]> = { Today: [], 'This week': [], Earlier: [] };
  for (const n of items) {
    const age = now - new Date(n.created_at).getTime();
    buckets[age < day ? 'Today' : age < 7 * day ? 'This week' : 'Earlier'].push(n);
  }
  return Object.entries(buckets)
    .filter(([, data]) => data.length)
    .map(([title, data]) => ({ title, data }));
}

export default function InboxScreen() {
  const [items, setItems] = useState<Notification[] | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [unreadChats, setUnreadChats] = useState(0);

  const load = useCallback(async () => {
    const [list, chats] = await Promise.all([fetchNotifications().catch(() => []), unreadMessageCount().catch(() => 0)]);
    setItems(list);
    setUnreadChats(chats);
    setRefreshing(false);
    markNotificationsRead().catch(() => {});
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const visible = (items ?? []).filter((n) => filter === 'all' || n.type === 'comment' || n.type === 'reply');

  const open = (n: Notification) => {
    if (n.type === 'follow' || !n.video_id) router.push({ pathname: '/user/[id]', params: { id: n.actor.id } });
    else if (n.type === 'comment' || n.type === 'reply') router.push({ pathname: '/comments/[id]', params: { id: n.video_id } });
    else router.push({ pathname: '/watch', params: { source: JSON.stringify({ kind: 'single', videoId: n.video_id }) } });
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.header}>
        <Logo />
        <Text style={styles.headerTitle}>Activity</Text>
        <View style={{ width: 80, alignItems: 'flex-end' }}>
          <Pressable onPress={() => router.push('/messages')} hitSlop={10} accessibilityLabel="Messages" style={styles.dmButton}>
            <Ionicons name="paper-plane-outline" size={22} color={colors.text} />
            {unreadChats > 0 && (
              <View style={styles.dmBadge}>
                <Text style={styles.dmBadgeText}>{unreadChats > 9 ? '9+' : unreadChats}</Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      <View style={styles.segment}>
        {(['all', 'comments'] as const).map((f) => (
          <Pressable key={f} onPress={() => setFilter(f)} style={[styles.segmentItem, filter === f && styles.segmentActive]}>
            <Text style={[styles.segmentText, filter === f && { color: colors.text }]}>{f === 'all' ? 'All activity' : 'Comments'}</Text>
          </Pressable>
        ))}
      </View>

      {!items ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <SectionList
          sections={group(visible)}
          keyExtractor={(n) => n.id}
          contentContainerStyle={{ paddingBottom: 24, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.text} onRefresh={() => { setRefreshing(true); load(); }} />}
          ListEmptyComponent={<EmptyState icon="notifications-outline" title="All quiet for now" body="Likes, comments and new followers will show up here." />}
          renderSectionHeader={({ section }) => <Text style={styles.section}>{section.title.toUpperCase()}</Text>}
          stickySectionHeadersEnabled={false}
          renderItem={({ item: n }) => (
            <Pressable onPress={() => open(n)} style={({ pressed }) => [styles.row, !n.read && styles.unread, pressed && { opacity: 0.7 }]}>
              <View>
                <Avatar uri={n.actor?.avatar_url} size={46} />
                <View style={[styles.badge, { backgroundColor: BADGE[n.type].color }]}>
                  <Ionicons name={BADGE[n.type].icon} size={10} color={n.type === 'follow' ? colors.limeText : colors.text} />
                </View>
              </View>
              <Text style={styles.text} numberOfLines={3}>
                <Text style={styles.actor}>{n.actor?.username}</Text>
                {n.type === 'like' && ' liked your video.'}
                {n.type === 'follow' && ' started following you.'}
                {n.type === 'comment' && ` commented: “${n.comment?.body ?? ''}”`}
                {n.type === 'reply' && ` replied to your comment: “${n.comment?.body ?? ''}”`}
                <Text style={styles.time}> {timeAgo(n.created_at)}</Text>
              </Text>
              {n.video?.thumbnail_url ? (
                <Image source={n.video.thumbnail_url} style={styles.thumb} contentFit="cover" />
              ) : n.type !== 'follow' ? (
                <View style={[styles.thumb, { backgroundColor: colors.primarySoft }]} />
              ) : null}
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 56 },
  headerTitle: { color: colors.text, fontSize: 18, fontWeight: '600' },
  dmButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  dmBadge: { position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.bg },
  dmBadgeText: { color: colors.text, fontSize: 10, fontWeight: '800' },
  segment: { flexDirection: 'row', marginHorizontal: 16, padding: 4, backgroundColor: colors.surface, borderRadius: radius.md, marginBottom: 6 },
  segmentItem: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radius.sm },
  segmentActive: { backgroundColor: colors.primary },
  segmentText: { color: colors.textMuted, fontWeight: '600' },
  section: { color: colors.textMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, paddingHorizontal: 16, paddingTop: 18, paddingBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  unread: { backgroundColor: 'rgba(139,92,246,0.07)' },
  badge: { position: 'absolute', right: -2, bottom: -2, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.bg },
  text: { flex: 1, color: colors.text, fontSize: 14, lineHeight: 20 },
  actor: { fontWeight: '800' },
  time: { color: colors.textMuted },
  thumb: { width: 44, height: 58, borderRadius: 6 },
});
