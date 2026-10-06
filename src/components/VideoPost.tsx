import { Ionicons } from '@expo/vector-icons';
import { useEvent } from 'expo';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { memo, useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';

import { Avatar, type IconName } from '@/components/ui';
import { Alert } from '@/lib/alert';
import { deleteVideo, registerView, setFollowing, setLiked, setSaved } from '@/lib/api';
import { emit } from '@/lib/events';
import { compact, tokenizeCaption } from '@/lib/format';
import { confirmBlock, openReport } from '@/lib/safety';
import { useActionSheet } from '@/providers/ActionSheetProvider';
import { colors, radius } from '@/lib/theme';
import type { FeedVideo } from '@/lib/types';

type Props = {
  video: FeedVideo;
  height: number;
  /** The post is the one on screen. */
  active: boolean;
  /** Keep a player alive (active post and its neighbours) so swipes start instantly. */
  mounted: boolean;
  /** The screen holding the feed is focused. */
  screenFocused: boolean;
  meId?: string;
  onChange: (video: FeedVideo) => void;
};

const DOUBLE_TAP_MS = 260;

function VideoPostImpl({ video, height, active, mounted, screenFocused, meId, onChange }: Props) {
  const player = useVideoPlayer(mounted ? video.video_url : null, (p) => {
    p.loop = true;
    p.timeUpdateEventInterval = 0.25;
    // Browsers only allow autoplay without sound.
    p.muted = Platform.OS === 'web';
  });

  const [userPaused, setUserPaused] = useState(false);
  // Reset a manual pause when the post leaves the screen (state adjusted during render, per React docs).
  const [wasActive, setWasActive] = useState(active);
  if (wasActive !== active) {
    setWasActive(active);
    if (!active) setUserPaused(false);
  }
  const shouldPlay = active && screenFocused && !userPaused;

  useEffect(() => {
    if (!mounted) return;
    if (shouldPlay) player.play();
    else player.pause();
  }, [player, mounted, shouldPlay]);

  // Swiping away rewinds, so coming back starts from the top like TikTok.
  useEffect(() => {
    if (!active && mounted) {
      // expo-video exposes seeking as a mutable property.
      // eslint-disable-next-line react-hooks/immutability
      player.currentTime = 0;
    }
  }, [active, mounted, player]);

  // Count a view once someone has watched for 2 seconds.
  const viewed = useRef(false);
  useEffect(() => {
    if (!shouldPlay || viewed.current) return;
    const t = setTimeout(() => {
      viewed.current = true;
      registerView(video.id).catch(() => {});
    }, 2000);
    return () => clearTimeout(t);
  }, [shouldPlay, video.id]);

  const { currentTime } = useEvent(player, 'timeUpdate', { currentTime: 0, currentLiveTimestamp: null, currentOffsetFromLive: null, bufferedPosition: 0 });
  const duration = player.duration || video.duration || 0;
  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;

  // ── Interactions ──
  const update = (patch: Partial<FeedVideo>) => onChange({ ...video, ...patch });

  const toggleLike = (forceOn = false) => {
    const next = forceOn ? true : !video.liked_by_me;
    if (next === video.liked_by_me) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    update({ liked_by_me: next, likes_count: video.likes_count + (next ? 1 : -1) });
    setLiked(video.id, next).catch(() => update({ liked_by_me: !next }));
  };

  const toggleSave = () => {
    const next = !video.saved_by_me;
    Haptics.selectionAsync().catch(() => {});
    update({ saved_by_me: next, saves_count: video.saves_count + (next ? 1 : -1) });
    setSaved(video.id, next).catch(() => update({ saved_by_me: !next }));
  };

  const follow = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    emit('follow', { userId: video.user_id, following: true });
    setFollowing(video.user_id, true).catch(() => emit('follow', { userId: video.user_id, following: false }));
  };

  const share = () => router.push({ pathname: '/share/[id]', params: { id: video.id } });

  const confirmDelete = () =>
    Alert.alert('Delete this video?', 'It will be removed from VYBE for everyone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          deleteVideo(video.id)
            .then(() => emit('videoDeleted', { videoId: video.id }))
            .catch((e) => Alert.alert('Couldn’t delete', e instanceof Error ? e.message : String(e))),
      },
    ]);

  const showSheet = useActionSheet();
  const openMore = () =>
    showSheet({
      options: isMe
        ? [{ label: 'Delete video', icon: 'trash-outline', destructive: true, onPress: confirmDelete }]
        : [
            { label: 'Not interested', icon: 'eye-off-outline', onPress: () => emit('videoHidden', { videoId: video.id }) },
            { label: 'Report video', icon: 'flag-outline', onPress: () => openReport(showSheet, { videoId: video.id }) },
            { label: `Block @${video.username}`, icon: 'ban-outline', destructive: true, onPress: () => confirmBlock(video.user_id, video.username) },
          ],
    });

  const openProfile = () => router.push({ pathname: '/user/[id]', params: { id: video.user_id } });

  // Single tap pauses, double tap likes with a burst of hearts where you tapped.
  const lastTap = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hearts, setHearts] = useState<{ id: number; x: number; y: number }[]>([]);

  const onTap = (e: GestureResponderEvent) => {
    const now = Date.now();
    const { locationX: x, locationY: y } = e.nativeEvent;
    if (now - lastTap.current < DOUBLE_TAP_MS) {
      if (tapTimer.current) clearTimeout(tapTimer.current);
      lastTap.current = 0;
      setHearts((h) => [...h, { id: now, x, y }]);
      toggleLike(true);
      return;
    }
    lastTap.current = now;
    tapTimer.current = setTimeout(() => setUserPaused((p) => !p), DOUBLE_TAP_MS);
  };

  const isMe = meId === video.user_id;
  // Short screens (small phones, landscape browser windows) get a tighter action rail so it never overlaps the top bar.
  const dense = height < 640;

  return (
    <View style={{ height, backgroundColor: '#000' }}>
      {mounted && (
        <VideoView
          player={player}
          style={styles.video}
          contentFit="cover"
          nativeControls={false}
          surfaceType="textureView"
        />
      )}

      <Pressable style={StyleSheet.absoluteFill} onPress={onTap}>
        {userPaused && (
          <View style={styles.pauseIcon} pointerEvents="none">
            <Ionicons name="play" size={64} color="rgba(255,255,255,0.85)" />
          </View>
        )}
        {hearts.map((h) => (
          <HeartBurst key={h.id} x={h.x} y={h.y} onDone={() => setHearts((all) => all.filter((a) => a.id !== h.id))} />
        ))}
      </Pressable>

      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.75)']} style={styles.bottomShade} pointerEvents="none" />

      {/* Right action rail */}
      <View style={[styles.rail, dense && { gap: 6, bottom: 16 }]}>
        <Pressable onPress={openProfile} style={{ marginBottom: dense ? 6 : 10 }}>
          <Avatar uri={video.avatar_url} size={dense ? 38 : 46} ring />
          {!isMe && !video.following_author && (
            <Pressable onPress={follow} style={styles.followBadge} hitSlop={8}>
              <Ionicons name="add" size={14} color={colors.limeText} />
            </Pressable>
          )}
        </Pressable>
        <RailButton dense={dense} icon={video.liked_by_me ? 'heart' : 'heart-outline'} tint={video.liked_by_me ? colors.like : undefined} label={compact(video.likes_count)} onPress={() => toggleLike()} />
        <RailButton
          dense={dense}
          icon="chatbubble-ellipses-outline"
          label={compact(video.comments_count)}
          onPress={() => router.push({ pathname: '/comments/[id]', params: { id: video.id } })}
        />
        <RailButton dense={dense} icon={video.saved_by_me ? 'bookmark' : 'bookmark-outline'} tint={video.saved_by_me ? colors.lime : undefined} label={compact(video.saves_count)} onPress={toggleSave} />
        <RailButton dense={dense} icon="arrow-redo-outline" label="Share" onPress={share} />
        <RailButton dense={dense} icon="ellipsis-horizontal" label="More" onPress={openMore} />
      </View>

      {/* Caption block */}
      <View style={styles.meta} pointerEvents="box-none">
        <View style={styles.authorRow}>
          <Pressable onPress={openProfile}>
            <Text style={styles.username}>@{video.username}</Text>
          </Pressable>
          {!isMe && !video.following_author && (
            <Pressable onPress={follow} style={styles.followPill}>
              <Text style={styles.followPillText}>FOLLOW</Text>
            </Pressable>
          )}
        </View>
        {!!video.caption && (
          <Text style={styles.caption} numberOfLines={3}>
            {tokenizeCaption(video.caption).map((t, i) =>
              t.kind === 'tag' ? (
                <Text key={i} style={styles.tag} onPress={() => router.push({ pathname: '/tag/[tag]', params: { tag: t.text.slice(1) } })}>
                  {t.text}
                </Text>
              ) : (
                <Text key={i} style={t.kind === 'mention' ? styles.mention : undefined}>
                  {t.text}
                </Text>
              ),
            )}
          </Text>
        )}
        <View style={styles.soundRow}>
          <Ionicons name="musical-notes" size={14} color={colors.text} />
          <Text style={styles.sound} numberOfLines={1}>
            {video.sound_name} · @{video.username}
          </Text>
          <Text style={styles.views}>
            <Ionicons name="play" size={11} /> {compact(video.views_count)}
          </Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.progressTrack} pointerEvents="none">
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>
    </View>
  );
}

export const VideoPost = memo(VideoPostImpl);

function RailButton({ icon, label, onPress, tint, dense }: { icon: IconName; label: string; onPress: () => void; tint?: string; dense?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.railButton, dense && { gap: 2 }, { transform: [{ scale: pressed ? 0.9 : 1 }] }]} hitSlop={6}>
      <View style={[styles.railIcon, dense && styles.railIconDense]}>
        <Ionicons name={icon} size={dense ? 21 : 26} color={tint ?? colors.text} />
      </View>
      <Text style={[styles.railLabel, dense && { fontSize: 11 }]}>{label}</Text>
    </Pressable>
  );
}

function HeartBurst({ x, y, onDone }: { x: number; y: number; onDone: () => void }) {
  const [anim] = useState(() => new Animated.Value(0));
  const [tilt] = useState(() => `${Math.round(Math.random() * 40 - 20)}deg`);
  useEffect(() => {
    Animated.sequence([
      Animated.spring(anim, { toValue: 1, useNativeDriver: true, friction: 4, tension: 160 }),
      Animated.timing(anim, { toValue: 2, duration: 450, delay: 150, useNativeDriver: true }),
    ]).start(onDone);
  }, [anim, onDone]);
  const scale = anim.interpolate({ inputRange: [0, 1, 2], outputRange: [0.4, 1.15, 1.6] });
  const opacity = anim.interpolate({ inputRange: [0, 0.3, 1, 2], outputRange: [0, 1, 1, 0] });
  const translateY = anim.interpolate({ inputRange: [0, 1, 2], outputRange: [0, 0, -90] });
  return (
    <Animated.View
      pointerEvents="none"
      style={{ position: 'absolute', left: x - 50, top: y - 50, opacity, transform: [{ translateY }, { scale }, { rotate: tilt }] }}
    >
      <Ionicons name="heart" size={100} color={colors.like} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Explicit 100% size: on web this lands on a <video> tag, which ignores edge offsets and would keep its own resolution.
  video: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },
  pauseIcon: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  bottomShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 280 },
  rail: { position: 'absolute', right: 10, bottom: 28, alignItems: 'center', gap: 14 },
  railButton: { alignItems: 'center', gap: 4 },
  railIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  railIconDense: { width: 40, height: 40, borderRadius: 20 },
  railLabel: { color: colors.text, fontSize: 12, fontWeight: '700' },
  followBadge: {
    position: 'absolute',
    bottom: -8,
    alignSelf: 'center',
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: { position: 'absolute', left: 16, right: 84, bottom: 24, gap: 8 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  username: { color: colors.text, fontSize: 17, fontWeight: '800' },
  followPill: { backgroundColor: colors.lime, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 4 },
  followPillText: { color: colors.limeText, fontWeight: '800', fontSize: 12 },
  caption: { color: colors.text, fontSize: 15, lineHeight: 21 },
  tag: { color: colors.lime, fontWeight: '700' },
  mention: { fontWeight: '700' },
  soundRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sound: { color: colors.text, fontSize: 13, fontWeight: '600', flexShrink: 1 },
  views: { color: colors.textMuted, fontSize: 12, marginLeft: 6 },
  progressTrack: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, backgroundColor: 'rgba(255,255,255,0.2)' },
  progressFill: { height: 3, backgroundColor: colors.lime },
});
