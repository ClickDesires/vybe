import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, EmptyState, IconButton } from '@/components/ui';
import { Alert } from '@/lib/alert';
import { addComment, deleteComment, fetchComments, fetchReplies, fetchVideo, setCommentLiked } from '@/lib/api';
import { emit } from '@/lib/events';
import { compact, timeAgo } from '@/lib/format';
import { openReport } from '@/lib/safety';
import { colors, radius } from '@/lib/theme';
import type { Comment, FeedVideo } from '@/lib/types';
import { useActionSheet } from '@/providers/ActionSheetProvider';
import { useAuth } from '@/providers/AuthProvider';

type Thread = Comment & { replies?: Comment[]; expanded?: boolean; loadingReplies?: boolean };

export default function CommentsSheet() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, profile } = useAuth();
  const insets = useSafeAreaInsets();
  const showSheet = useActionSheet();
  const input = useRef<TextInput>(null);

  const [video, setVideo] = useState<FeedVideo | null>(null);
  const [threads, setThreads] = useState<Thread[] | null>(null);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchVideo(id).then(setVideo).catch(() => {});
    fetchComments(id).then(setThreads).catch(() => setThreads([]));
  }, [id]);

  const me = session?.user.id;

  // Apply a change to a comment wherever it lives (top level or inside a thread).
  const patch = (commentId: string, fn: (c: Comment) => Comment) =>
    setThreads(
      (ts) =>
        ts?.map((t) =>
          t.id === commentId ? { ...t, ...fn(t) } : t.replies ? { ...t, replies: t.replies.map((r) => (r.id === commentId ? fn(r) : r)) } : t,
        ) ?? null,
    );

  const toggleReplies = async (t: Thread) => {
    if (t.expanded) return setThreads((ts) => ts?.map((x) => (x.id === t.id ? { ...x, expanded: false } : x)) ?? null);
    setThreads((ts) => ts?.map((x) => (x.id === t.id ? { ...x, expanded: true, loadingReplies: !x.replies } : x)) ?? null);
    if (!t.replies) {
      const replies = await fetchReplies(t.id).catch(() => []);
      setThreads((ts) => ts?.map((x) => (x.id === t.id ? { ...x, replies, loadingReplies: false } : x)) ?? null);
    }
  };

  const toggleLike = (c: Comment) => {
    const next = !c.liked_by_me;
    Haptics.selectionAsync().catch(() => {});
    patch(c.id, (x) => ({ ...x, liked_by_me: next, likes_count: x.likes_count + (next ? 1 : -1) }));
    setCommentLiked(c.id, next).catch(() => patch(c.id, (x) => ({ ...x, liked_by_me: !next, likes_count: x.likes_count + (next ? -1 : 1) })));
  };

  const startReply = (c: Comment) => {
    setReplyTo(c);
    input.current?.focus();
  };

  const send = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      const parentId = replyTo ? (replyTo.parent_id ?? replyTo.id) : null;
      const c = await addComment(id, text, parentId);
      if (parentId) {
        setThreads(
          (ts) =>
            ts?.map((t) =>
              t.id === parentId ? { ...t, replies_count: t.replies_count + 1, expanded: true, replies: [...(t.replies ?? []), c] } : t,
            ) ?? null,
        );
      } else {
        setThreads((ts) => [c, ...(ts ?? [])]);
      }
      setText('');
      setReplyTo(null);
      setVideo((v) => v && { ...v, comments_count: v.comments_count + 1 });
      emit('commentCount', { videoId: id, delta: 1 });
    } catch (e) {
      Alert.alert('Couldn’t post comment', e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  };

  const remove = (c: Comment) =>
    Alert.alert('Delete comment?', c.body, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteComment(c.id).catch(() => {});
          // Deleting a top-level comment also removes its replies (cascade).
          const removed = c.parent_id ? 1 : 1 + c.replies_count;
          setThreads(
            (ts) =>
              (c.parent_id
                ? ts?.map((t) =>
                    t.id === c.parent_id ? { ...t, replies_count: Math.max(0, t.replies_count - 1), replies: t.replies?.filter((r) => r.id !== c.id) } : t,
                  )
                : ts?.filter((t) => t.id !== c.id)) ?? null,
          );
          setVideo((v) => v && { ...v, comments_count: Math.max(0, v.comments_count - removed) });
          emit('commentCount', { videoId: id, delta: -removed });
        },
      },
    ]);

  const openMenu = (c: Comment) => {
    const canDelete = c.user_id === me || video?.user_id === me;
    showSheet({
      options: [
        { label: 'Reply', icon: 'arrow-undo-outline', onPress: () => startReply(c) },
        ...(c.user_id !== me ? [{ label: 'Report comment', icon: 'flag-outline' as const, onPress: () => openReport(showSheet, { commentId: c.id }) }] : []),
        ...(canDelete ? [{ label: 'Delete', icon: 'trash-outline' as const, destructive: true, onPress: () => remove(c) }] : []),
      ],
    });
  };

  const total = video?.comments_count ?? threads?.length ?? 0;

  const renderComment = (c: Comment, isReply = false) => (
    <Pressable key={c.id} onLongPress={() => openMenu(c)} delayLongPress={300} style={[styles.row, isReply && styles.replyRow]}>
      <Pressable onPress={() => router.push({ pathname: '/user/[id]', params: { id: c.user_id } })}>
        <Avatar uri={c.author?.avatar_url} size={isReply ? 28 : 36} />
      </Pressable>
      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={styles.author}>@{c.author?.username}</Text>
          {c.user_id === video?.user_id && (
            <View style={styles.creatorBadge}>
              <Text style={styles.creatorBadgeText}>CREATOR</Text>
            </View>
          )}
        </View>
        <Text style={styles.body}>{c.body}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.time}>{timeAgo(c.created_at)}</Text>
          {video?.allow_comments !== false && (
            <Pressable onPress={() => startReply(c)} hitSlop={8}>
              <Text style={styles.replyLink}>Reply</Text>
            </Pressable>
          )}
        </View>
      </View>
      <Pressable onPress={() => toggleLike(c)} hitSlop={8} style={styles.like}>
        <Ionicons name={c.liked_by_me ? 'heart' : 'heart-outline'} size={18} color={c.liked_by_me ? colors.like : colors.textMuted} />
        {c.likes_count > 0 && <Text style={styles.likeCount}>{compact(c.likes_count)}</Text>}
      </Pressable>
    </Pressable>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.surface }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <Text style={styles.title}>{compact(total)} comments</Text>
        <IconButton name="close" onPress={() => router.back()} style={styles.close} />
      </View>

      {!threads ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
      ) : (
        <FlatList
          data={threads}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ paddingVertical: 8, flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={<EmptyState icon="chatbubbles-outline" title="No comments yet" body="Start the conversation." />}
          renderItem={({ item: t }) => (
            <View>
              {renderComment(t)}
              {t.expanded && t.replies?.map((r) => renderComment(r, true))}
              {t.replies_count > 0 && (
                <Pressable onPress={() => toggleReplies(t)} style={styles.viewReplies}>
                  <View style={styles.viewRepliesLine} />
                  {t.loadingReplies ? (
                    <ActivityIndicator size="small" color={colors.textMuted} />
                  ) : (
                    <Text style={styles.viewRepliesText}>
                      {t.expanded ? 'Hide replies' : `View ${t.replies_count} ${t.replies_count === 1 ? 'reply' : 'replies'}`}
                    </Text>
                  )}
                  <Ionicons name={t.expanded ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textMuted} />
                </Pressable>
              )}
            </View>
          )}
        />
      )}

      {video && !video.allow_comments ? (
        <View style={[styles.composer, { paddingBottom: insets.bottom + 12 }]}>
          <Ionicons name="lock-closed" size={16} color={colors.textMuted} />
          <Text style={{ color: colors.textMuted }}>Comments are turned off for this video.</Text>
        </View>
      ) : (
        <View style={{ backgroundColor: colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }}>
          {replyTo && (
            <View style={styles.replyBanner}>
              <Text style={styles.replyBannerText} numberOfLines={1}>
                Replying to <Text style={{ color: colors.text, fontWeight: '700' }}>@{replyTo.author?.username}</Text>
              </Text>
              <IconButton name="close" size={16} onPress={() => setReplyTo(null)} />
            </View>
          )}
          <View style={[styles.composer, { paddingBottom: insets.bottom + 12 }]}>
            <Avatar uri={profile?.avatar_url} size={36} />
            <TextInput
              ref={input}
              value={text}
              onChangeText={setText}
              placeholder={replyTo ? 'Add a reply…' : 'Add a comment…'}
              placeholderTextColor={colors.textFaint}
              selectionColor={colors.primary}
              style={styles.input}
              maxLength={500}
              multiline
            />
            <Pressable onPress={send} disabled={!text.trim() || sending} style={[styles.send, { opacity: text.trim() ? 1 : 0.4 }]}>
              {sending ? <ActivityIndicator color={colors.text} size="small" /> : <Ionicons name="arrow-up" size={20} color={colors.text} />}
            </Pressable>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { height: 56, alignItems: 'center', justifyContent: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, marginTop: 8 },
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
  close: { position: 'absolute', right: 12, backgroundColor: colors.surfaceAlt, borderRadius: 18 },
  row: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  replyRow: { paddingLeft: 64, paddingVertical: 8 },
  author: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  creatorBadge: { backgroundColor: colors.primarySoft, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  creatorBadgeText: { color: colors.primary, fontSize: 10, fontWeight: '800' },
  body: { color: colors.text, fontSize: 15, lineHeight: 20 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  time: { color: colors.textFaint, fontSize: 12 },
  replyLink: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  like: { alignItems: 'center', width: 32, gap: 2, paddingTop: 4 },
  likeCount: { color: colors.textMuted, fontSize: 11 },
  viewReplies: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 64, paddingVertical: 6 },
  viewRepliesLine: { width: 24, height: StyleSheet.hairlineWidth, backgroundColor: colors.textFaint },
  viewRepliesText: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  replyBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 16, paddingRight: 8, paddingTop: 6, backgroundColor: colors.surfaceAlt },
  replyBannerText: { color: colors.textMuted, fontSize: 13, flex: 1 },
  composer: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 12 },
  input: { flex: 1, minHeight: 42, maxHeight: 110, backgroundColor: colors.surfaceAlt, borderRadius: radius.lg, paddingHorizontal: 16, paddingTop: 11, paddingBottom: 11, color: colors.text, fontSize: 15 },
  send: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
});
