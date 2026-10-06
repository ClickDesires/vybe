import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { VideoGrid } from '@/components/VideoGrid';
import { EmptyState, Header, IconButton } from '@/components/ui';
import { fetchFeed } from '@/lib/api';
import { compact } from '@/lib/format';
import { colors } from '@/lib/theme';
import type { FeedVideo } from '@/lib/types';

export default function TagScreen() {
  const { tag } = useLocalSearchParams<{ tag: string }>();
  const [videos, setVideos] = useState<FeedVideo[] | null>(null);

  useEffect(() => {
    fetchFeed({ kind: 'tag', tag }, 0, 60).then(setVideos).catch(() => setVideos([]));
  }, [tag]);

  const views = videos?.reduce((n, v) => n + v.views_count, 0) ?? 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title="" left={<IconButton name="chevron-back" onPress={() => router.back()} />} />
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={styles.hero}>
          <View style={styles.hash}>
            <Text style={styles.hashText}>#</Text>
          </View>
          <View>
            <Text style={styles.title}>#{tag}</Text>
            <Text style={styles.meta}>
              {videos ? `${videos.length} videos · ${compact(views)} views` : ' '}
            </Text>
          </View>
        </View>
        {!videos ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : videos.length ? (
          <VideoGrid videos={videos} source={{ kind: 'tag', tag }} showAuthor />
        ) : (
          <EmptyState icon="pricetag" title="No videos yet" body={`Add #${tag} to your caption to start the trend.`} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16, marginBottom: 8 },
  hash: { width: 72, height: 72, borderRadius: 18, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  hashText: { color: colors.lime, fontSize: 36, fontWeight: '900' },
  title: { color: colors.text, fontSize: 26, fontWeight: '800' },
  meta: { color: colors.textMuted, marginTop: 4 },
});
