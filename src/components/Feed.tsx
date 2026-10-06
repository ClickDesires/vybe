import { useIsFocused } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, AppState, FlatList, RefreshControl, StyleSheet, View, type ViewToken } from 'react-native';

import { VideoPost } from '@/components/VideoPost';
import { fetchFeed, PAGE_SIZE, type FeedSource } from '@/lib/api';
import { on } from '@/lib/events';
import { colors } from '@/lib/theme';
import type { FeedVideo } from '@/lib/types';
import { useAuth } from '@/providers/AuthProvider';

type Props = {
  source: FeedSource;
  /** Jump straight to this video (e.g. opened from a profile grid). */
  startAtId?: string;
  /** Extra condition for playback, e.g. the For You tab being the selected one. */
  enabled?: boolean;
  empty?: ReactNode;
};

export function Feed({ source, startAtId, enabled = true, empty }: Props) {
  const { session } = useAuth();
  const focused = useIsFocused();
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const [height, setHeight] = useState(0);
  const [videos, setVideos] = useState<FeedVideo[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const done = useRef(false);
  const loadingMore = useRef(false);

  const sourceKey = JSON.stringify(source);

  const load = useCallback(
    async (reset: boolean) => {
      if (loadingMore.current || (!reset && done.current)) return;
      loadingMore.current = true;
      try {
        // When opening a specific video, grab a bigger first page so it is likely included.
        const limit = reset && startAtId ? 60 : PAGE_SIZE;
        const page = await fetchFeed(JSON.parse(sourceKey), reset ? 0 : videos.length, limit);
        done.current = page.length < limit;
        if (reset && startAtId) {
          const i = page.findIndex((v) => v.id === startAtId);
          setIndex(Math.max(0, i));
        }
        setVideos((prev) => {
          if (reset) return page;
          const seen = new Set(prev.map((v) => v.id));
          return [...prev, ...page.filter((v) => !seen.has(v.id))];
        });
      } catch (e) {
        console.warn('feed load failed', e);
      } finally {
        loadingMore.current = false;
        setLoading(false);
        setRefreshing(false);
      }
    },
    [sourceKey, startAtId, videos.length],
  );

  // Initial load. Callers pass a fixed source per mounted Feed.
  // load() only sets state after its network request resolves, so this cannot cascade renders.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setAppActive(s === 'active'));
    return () => sub.remove();
  }, []);

  // Keep posts in sync with actions taken elsewhere.
  useEffect(() => {
    const offs = [
      on('follow', ({ userId, following }) =>
        setVideos((vs) => vs.map((v) => (v.user_id === userId ? { ...v, following_author: following } : v))),
      ),
      on('commentCount', ({ videoId, delta }) =>
        setVideos((vs) => vs.map((v) => (v.id === videoId ? { ...v, comments_count: Math.max(0, v.comments_count + delta) } : v))),
      ),
      on('videoDeleted', ({ videoId }) => setVideos((vs) => vs.filter((v) => v.id !== videoId))),
      on('videoHidden', ({ videoId }) => setVideos((vs) => vs.filter((v) => v.id !== videoId))),
      on('blocked', ({ userId }) => setVideos((vs) => vs.filter((v) => v.user_id !== userId))),
    ];
    return () => offs.forEach((off) => off());
  }, []);

  // FlatList requires this callback to never change identity.
  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems[0];
    if (first?.index != null) setIndex(first.index);
  }, []);

  const onChange = useCallback((next: FeedVideo) => {
    setVideos((vs) => vs.map((v) => (v.id === next.id ? next : v)));
  }, []);

  const screenFocused = focused && appActive && enabled;

  return (
    <View style={styles.container} onLayout={(e) => setHeight(e.nativeEvent.layout.height)}>
      {loading || !height ? (
        <ActivityIndicator style={styles.center} color={colors.primary} />
      ) : videos.length === 0 ? (
        <View style={styles.center}>{empty}</View>
      ) : (
        <FlatList
          data={videos}
          keyExtractor={(v) => v.id}
          renderItem={({ item, index: i }) => (
            <VideoPost
              video={item}
              height={height}
              active={i === index}
              mounted={Math.abs(i - index) <= 1}
              screenFocused={screenFocused}
              meId={session?.user.id}
              onChange={onChange}
            />
          )}
          initialScrollIndex={index}
          getItemLayout={(_, i) => ({ length: height, offset: height * i, index: i })}
          pagingEnabled
          snapToInterval={height}
          snapToAlignment="start"
          decelerationRate="fast"
          disableIntervalMomentum
          showsVerticalScrollIndicator={false}
          windowSize={3}
          initialNumToRender={2}
          maxToRenderPerBatch={2}
          removeClippedSubviews
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
          onEndReached={() => load(false)}
          onEndReachedThreshold={2}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={colors.text}
              onRefresh={() => {
                setRefreshing(true);
                done.current = false;
                load(true);
              }}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
