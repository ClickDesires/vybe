import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { VideoGrid } from '@/components/VideoGrid';
import { Avatar, Button, EmptyState, IconButton } from '@/components/ui';
import { Alert } from '@/lib/alert';
import { fetchFeed, fetchProfile, hasBlocked, isFollowing, setFollowing, startConversation, unblockUser, type FeedSource } from '@/lib/api';
import { emit, on } from '@/lib/events';
import { compact } from '@/lib/format';
import { confirmBlock, openReport } from '@/lib/safety';
import { colors } from '@/lib/theme';
import type { FeedVideo, Profile } from '@/lib/types';
import { useActionSheet } from '@/providers/ActionSheetProvider';
import { useAuth } from '@/providers/AuthProvider';

type Props = { userId: string; headerLeft?: ReactNode };

export function ProfileView({ userId, headerLeft }: Props) {
  const { session } = useAuth();
  const isMe = session?.user.id === userId;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [videos, setVideos] = useState<FeedVideo[] | null>(null);
  const [saved, setSaved] = useState<FeedVideo[] | null>(null);
  const [tab, setTab] = useState<'videos' | 'saved'>('videos');
  const [following, setFollowingState] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [opening, setOpening] = useState(false);
  const showSheet = useActionSheet();

  const load = useCallback(async () => {
    const [p, v, f, b] = await Promise.all([
      fetchProfile(userId),
      fetchFeed({ kind: 'user', userId }, 0, 60),
      isMe ? Promise.resolve(false) : isFollowing(userId),
      isMe ? Promise.resolve(false) : hasBlocked(userId),
    ]).catch((): [Profile | null, FeedVideo[], boolean, boolean] => [null, [], false, false]);
    setProfile(p);
    setVideos(v);
    setFollowingState(f);
    setBlocked(b);
    if (isMe) setSaved(await fetchFeed({ kind: 'saved' }, 0, 60).catch(() => []));
    setRefreshing(false);
  }, [userId, isMe]);

  // Refresh whenever the screen comes back into view (after posting, editing, etc.).
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(
    () =>
      on('follow', ({ userId: id, following: f }) => {
        if (id !== userId) return;
        setFollowingState(f);
      }),
    [userId],
  );

  const toggleFollow = () => {
    const next = !following;
    setFollowingState(next);
    setProfile((p) => p && { ...p, followers_count: p.followers_count + (next ? 1 : -1) });
    emit('follow', { userId, following: next });
    setFollowing(userId, next).catch(() => {
      setFollowingState(!next);
      emit('follow', { userId, following: !next });
    });
  };

  const message = async () => {
    setOpening(true);
    try {
      const id = await startConversation(userId);
      router.push({ pathname: '/chat/[id]', params: { id } });
    } catch (e) {
      Alert.alert('Can’t message this account', e instanceof Error ? e.message : String(e));
    } finally {
      setOpening(false);
    }
  };

  const unblock = () =>
    unblockUser(userId)
      .then(() => load())
      .catch((e) => Alert.alert('Couldn’t unblock', e instanceof Error ? e.message : String(e)));

  const openMenu = () => {
    if (!profile) return;
    showSheet({
      title: `@${profile.username}`,
      options: [
        { label: 'Share profile', icon: 'share-social-outline', onPress: () => Share.share({ message: `Check out @${profile.username} on VYBE` }) },
        { label: 'Report account', icon: 'flag-outline', onPress: () => openReport(showSheet, { userId }) },
        blocked
          ? { label: 'Unblock', icon: 'checkmark-circle-outline', onPress: unblock }
          : { label: 'Block', icon: 'ban-outline', destructive: true, onPress: () => confirmBlock(userId, profile.username, load) },
      ],
    });
  };

  if (!profile) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  const list = tab === 'videos' ? videos : saved;
  const listSource: FeedSource = tab === 'videos' ? { kind: 'user', userId } : { kind: 'saved' };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.topBar}>
        <View style={{ width: 40 }}>{headerLeft}</View>
        <Text style={styles.handle} numberOfLines={1}>
          {profile.username}
        </Text>
        <View style={{ width: 40, alignItems: 'flex-end' }}>
          {isMe ? (
            <IconButton name="menu" onPress={() => router.push('/settings')} />
          ) : (
            <IconButton name="ellipsis-horizontal" onPress={openMenu} />
          )}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.text} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        <View style={styles.hero}>
          <Avatar uri={profile.avatar_url} size={92} ring />
          <Text style={styles.name}>{profile.display_name || profile.username}</Text>
          {!!profile.bio && <Text style={styles.bio}>{profile.bio}</Text>}

          <View style={styles.stats}>
            <Stat value={profile.following_count} label="Following" />
            <Stat value={profile.followers_count} label="Followers" />
            <Stat value={profile.likes_count} label="Likes" />
          </View>

          <View style={styles.actions}>
            {isMe ? (
              <>
                <Button title="Edit profile" variant="secondary" style={{ flex: 1 }} onPress={() => router.push('/edit-profile')} />
                <Button title="" icon="settings-outline" variant="secondary" style={{ width: 50, paddingHorizontal: 0 }} onPress={() => router.push('/settings')} />
              </>
            ) : blocked ? (
              <Button title="Unblock" variant="secondary" icon="checkmark-circle-outline" style={{ flex: 1 }} onPress={unblock} />
            ) : (
              <>
                <Button
                  title={following ? 'Following' : 'Follow'}
                  icon={following ? 'checkmark' : 'person-add'}
                  variant={following ? 'secondary' : 'primary'}
                  style={{ flex: 1 }}
                  onPress={toggleFollow}
                />
                <Button title="Message" variant="secondary" style={{ flex: 1 }} loading={opening} onPress={message} />
              </>
            )}
          </View>
        </View>

        {blocked ? (
          <EmptyState icon="ban-outline" title={`You blocked @${profile.username}`} body="Unblock to see their videos and let them find you again." />
        ) : (
        <>
        <View style={styles.tabs}>
          <TabIcon icon="grid-outline" active={tab === 'videos'} onPress={() => setTab('videos')} />
          {isMe && <TabIcon icon="bookmark-outline" active={tab === 'saved'} onPress={() => setTab('saved')} />}
        </View>

        {!list ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
        ) : list.length ? (
          <View style={{ paddingTop: 8 }}>
            <VideoGrid videos={list} source={listSource} />
          </View>
        ) : tab === 'videos' ? (
          <EmptyState
            icon="videocam-outline"
            title={isMe ? 'Share your first video' : 'No videos yet'}
            body={isMe ? 'Your videos will live here.' : `When @${profile.username} posts, you’ll see it here.`}
            action={isMe ? <Button title="Record" variant="lime" icon="add" onPress={() => router.push('/camera')} /> : undefined}
          />
        ) : (
          <EmptyState icon="bookmark-outline" title="Nothing saved" body="Tap the bookmark on any video to keep it here. Only you can see this." />
        )}
        </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={{ alignItems: 'center', minWidth: 80 }}>
      <Text style={styles.statValue}>{compact(value)}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function TabIcon({ icon, active, onPress }: { icon: 'grid-outline' | 'bookmark-outline'; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.tab, active && styles.tabActive]}>
      <Ionicons name={icon} size={22} color={active ? colors.text : colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  topBar: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 },
  handle: { color: colors.text, fontSize: 17, fontWeight: '700', flex: 1, textAlign: 'center' },
  hero: { alignItems: 'center', paddingHorizontal: 20, paddingTop: 8 },
  name: { color: colors.text, fontSize: 22, fontWeight: '700', marginTop: 12 },
  bio: { color: colors.textMuted, fontSize: 14, textAlign: 'center', marginTop: 6, lineHeight: 20 },
  stats: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginTop: 18 },
  statValue: { color: colors.text, fontSize: 19, fontWeight: '800' },
  statLabel: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 10, alignSelf: 'stretch', marginTop: 18 },
  tabs: { flexDirection: 'row', marginTop: 22, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: colors.lime },
});
