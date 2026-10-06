import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { VideoGrid } from '@/components/VideoGrid';
import { Avatar, EmptyState, Field, Logo } from '@/components/ui';
import { searchProfiles, searchVideos } from '@/lib/api';
import { compact } from '@/lib/format';
import { colors, radius } from '@/lib/theme';
import type { FeedVideo, Profile } from '@/lib/types';
import { useAuth } from '@/providers/AuthProvider';

function trendingTags(videos: FeedVideo[]) {
  const counts = new Map<string, number>();
  for (const v of videos) {
    for (const m of v.caption.match(/#[\w]+/g) ?? []) {
      const tag = m.slice(1).toLowerCase();
      counts.set(tag, (counts.get(tag) ?? 0) + 1 + v.views_count / 1000);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([t]) => t);
}

export default function DiscoverScreen() {
  const { session } = useAuth();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [videos, setVideos] = useState<FeedVideo[]>([]);
  const [creators, setCreators] = useState<Profile[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.replace(/^#/, '')), 300);
    return () => clearTimeout(t);
  }, [query]);

  const [reloadKey, setReloadKey] = useState(0);
  const me = session?.user.id;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [v, c] = await Promise.all([searchVideos(debounced), searchProfiles(debounced)]);
        if (cancelled) return;
        setVideos(v);
        setCreators(c.filter((p) => p.id !== me));
        if (!debounced) setTags(trendingTags(v));
      } catch (e) {
        console.warn('discover load failed', e);
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debounced, me, reloadKey]);

  const searching = debounced.length > 0;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.text} onRefresh={() => { setRefreshing(true); setReloadKey((k) => k + 1); }} />}
      >
        <View style={styles.header}>
          <Logo />
          <Text style={styles.headerTitle}>Discover</Text>
          <View style={{ width: 80 }} />
        </View>

        <View style={{ paddingHorizontal: 16 }}>
          <Field icon="search" placeholder="Search videos, people and #tags" value={query} onChangeText={setQuery} autoCapitalize="none" autoCorrect={false} returnKeyType="search" />
        </View>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <>
            {!searching && tags.length > 0 && (
              <>
                <SectionTitle title="Trending now" />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                  {tags.map((t) => (
                    <Pressable key={t} style={styles.chip} onPress={() => router.push({ pathname: '/tag/[tag]', params: { tag: t } })}>
                      <Text style={styles.chipText}>#{t}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </>
            )}

            {creators.length > 0 && (
              <>
                <SectionTitle title={searching ? 'Creators' : 'Creators on the rise'} />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.creators}>
                  {creators.map((p) => (
                    <Pressable key={p.id} style={styles.creator} onPress={() => router.push({ pathname: '/user/[id]', params: { id: p.id } })}>
                      <Avatar uri={p.avatar_url} size={58} ring />
                      <Text style={styles.creatorName} numberOfLines={1}>
                        {p.display_name || p.username}
                      </Text>
                      <Text style={styles.creatorMeta}>{compact(p.followers_count)} followers</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </>
            )}

            <SectionTitle title={searching ? 'Videos' : 'Fresh for you'} hint={searching ? `${videos.length} results` : 'Ranked by engagement'} />
            {videos.length > 0 ? (
              <VideoGrid videos={videos} showAuthor />
            ) : (
              <EmptyState icon="search" title="No videos found" body={searching ? `Nothing matches “${debounced}” yet.` : 'Once people start posting, the best videos appear here.'} />
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={styles.sectionTitle}>
      <Text style={styles.sectionText}>{title}</Text>
      {hint && <Text style={styles.sectionHint}>{hint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 56 },
  headerTitle: { color: colors.text, fontSize: 18, fontWeight: '600' },
  sectionTitle: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 16, marginTop: 24, marginBottom: 12 },
  sectionText: { color: colors.text, fontSize: 19, fontWeight: '800' },
  sectionHint: { color: colors.textMuted, fontSize: 12 },
  chips: { paddingHorizontal: 16, gap: 8 },
  chip: { backgroundColor: colors.surfaceAlt, borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 9 },
  chipText: { color: colors.text, fontWeight: '600' },
  creators: { paddingHorizontal: 16, gap: 18 },
  creator: { alignItems: 'center', width: 78, gap: 4 },
  creatorName: { color: colors.text, fontWeight: '700', fontSize: 13, marginTop: 4 },
  creatorMeta: { color: colors.textMuted, fontSize: 11 },
});
