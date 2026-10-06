import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { compact } from '@/lib/format';
import { colors, radius } from '@/lib/theme';
import type { FeedVideo } from '@/lib/types';
import type { FeedSource } from '@/lib/api';

type Props = {
  videos: FeedVideo[];
  /** Feed to open when a tile is tapped, so people can keep swiping through the set. */
  source?: FeedSource;
  showAuthor?: boolean;
  gap?: number;
  padding?: number;
};

export function VideoGrid({ videos, source, showAuthor, gap = 6, padding = 8 }: Props) {
  // Size tiles from the space we actually get (the app is a narrow column on wide screens).
  const window = useWindowDimensions();
  const [width, setWidth] = useState(Math.min(window.width, 520));
  const tile = Math.floor((width - padding * 2 - gap * 2) / 3);

  const open = (v: FeedVideo) => {
    const s: FeedSource = source ?? { kind: 'user', userId: v.user_id };
    router.push({ pathname: '/watch', params: { source: JSON.stringify(s), start: v.id } });
  };

  return (
    <View style={[styles.grid, { gap, paddingHorizontal: padding }]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {videos.map((v) => (
        <Pressable key={v.id} onPress={() => open(v)} style={({ pressed }) => [{ width: tile, height: tile * 1.4, opacity: pressed ? 0.8 : 1 }]}>
          <View style={styles.tile}>
            {v.thumbnail_url ? (
              <Image source={v.thumbnail_url} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
            ) : (
              <LinearGradient colors={[colors.primary, '#2A1B55']} style={[StyleSheet.absoluteFill, styles.placeholder]}>
                <Text style={styles.placeholderText} numberOfLines={4}>
                  {v.caption || 'VYBE'}
                </Text>
              </LinearGradient>
            )}
            {v.visibility !== 'public' && (
              <View style={styles.lock}>
                <Ionicons name={v.visibility === 'private' ? 'lock-closed' : 'people'} size={11} color={colors.text} />
              </View>
            )}
            <LinearGradient colors={['transparent', 'rgba(0,0,0,0.7)']} style={styles.shade} />
            <View style={styles.stats}>
              <Ionicons name="play-outline" size={13} color={colors.text} />
              <Text style={styles.statText}>{compact(v.views_count)}</Text>
            </View>
            {showAuthor && (
              <Text style={styles.author} numberOfLines={1}>
                @{v.username}
              </Text>
            )}
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  tile: { flex: 1, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: colors.surface },
  placeholder: { padding: 10, justifyContent: 'center' },
  placeholderText: { color: colors.text, fontWeight: '700', fontSize: 12 },
  shade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 64 },
  stats: { position: 'absolute', left: 6, bottom: 6, flexDirection: 'row', alignItems: 'center', gap: 3 },
  statText: { color: colors.text, fontSize: 12, fontWeight: '700' },
  // Sits on its own line above the view count so the two never collide on narrow tiles.
  author: { position: 'absolute', left: 6, right: 6, bottom: 24, color: colors.text, fontSize: 11, fontWeight: '600', opacity: 0.85 },
  lock: { position: 'absolute', top: 6, right: 6, backgroundColor: colors.overlay, borderRadius: 8, padding: 4 },
});
