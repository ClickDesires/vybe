import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { createVideoPlayer } from 'expo-video';

import { supabase } from './supabase';
import {
  PAGE_SIZE,
  type AppSession,
  type Comment,
  type Conversation,
  type FeedSource,
  type FeedVideo,
  type Message,
  type NewPost,
  type Notification,
  type Profile,
  type ReportReason,
} from './types';

function must<T>({ data, error }: { data: T | null; error: unknown }): T {
  if (error) throw error;
  return data as T;
}

async function myId() {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error('Not signed in');
  return id;
}

// ───────────── Auth ─────────────

export async function getSession(): Promise<AppSession | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function onAuthChange(cb: (session: AppSession | null) => void) {
  const { data } = supabase.auth.onAuthStateChange((_event, next) => cb(next));
  return () => data.subscription.unsubscribe();
}

export async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

/** Returns false when the project requires email confirmation before the first sign-in. */
export async function signUp(email: string, password: string, username: string): Promise<boolean> {
  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { username, display_name: username } } });
  if (error) throw error;
  return !!data.session;
}

export async function signOut() {
  await supabase.auth.signOut();
}

// ───────────── Realtime ─────────────

/** Calls `cb` for each new row in `table` (RLS limits events to rows I may see). Returns an unsubscribe function. */
export function subscribeInserts<T>(table: 'messages' | 'notifications', filter: string | undefined, cb: (row: T) => void) {
  const channel = supabase
    .channel(`${table}:${filter ?? 'all'}:${Math.random().toString(36).slice(2)}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table, ...(filter ? { filter } : {}) }, (payload) => cb(payload.new as T))
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

// ───────────── Feeds ─────────────

export async function fetchFeed(source: FeedSource, offset: number, limit = PAGE_SIZE): Promise<FeedVideo[]> {
  let q = supabase.from('video_feed').select('*');

  switch (source.kind) {
    case 'forYou':
      q = q.order('score', { ascending: false }).order('created_at', { ascending: false });
      break;
    case 'following': {
      const me = await myId();
      const ids = must(await supabase.from('follows').select('following_id').eq('follower_id', me)).map(
        (r: { following_id: string }) => r.following_id,
      );
      if (ids.length === 0) return [];
      q = q.in('user_id', ids).order('created_at', { ascending: false });
      break;
    }
    case 'user':
      q = q.eq('user_id', source.userId).order('created_at', { ascending: false });
      break;
    case 'saved': {
      const me = await myId();
      const ids = must(
        await supabase.from('saves').select('video_id').eq('user_id', me).order('created_at', { ascending: false }),
      ).map((r: { video_id: string }) => r.video_id);
      if (ids.length === 0) return [];
      q = q.in('id', ids).order('created_at', { ascending: false });
      break;
    }
    case 'single':
      if (offset > 0) return [];
      q = q.eq('id', source.videoId);
      break;
    case 'tag':
      q = q.ilike('caption', `%#${source.tag}%`).order('score', { ascending: false });
      break;
  }

  return must(await q.range(offset, offset + limit - 1)) as FeedVideo[];
}

export async function fetchVideo(id: string): Promise<FeedVideo | null> {
  return must(await supabase.from('video_feed').select('*').eq('id', id).maybeSingle()) as FeedVideo | null;
}

/** PostgREST filter strings treat , ( ) as syntax, so strip them from user input. */
function cleanTerm(term: string) {
  return term.replace(/[,()%*\\]/g, ' ').trim();
}

export async function searchVideos(term: string): Promise<FeedVideo[]> {
  const t = cleanTerm(term);
  let q = supabase.from('video_feed').select('*');
  if (t) q = q.or(`caption.ilike.%${t}%,username.ilike.%${t}%,sound_name.ilike.%${t}%`);
  return must(await q.order('score', { ascending: false }).limit(30)) as FeedVideo[];
}

export async function searchProfiles(term: string): Promise<Profile[]> {
  const t = cleanTerm(term);
  let q = supabase.from('profiles').select('*');
  if (t) q = q.or(`username.ilike.%${t}%,display_name.ilike.%${t}%`);
  return must(await q.order('followers_count', { ascending: false }).limit(12)) as Profile[];
}

// ───────────── Engagement ─────────────

export async function setLiked(videoId: string, liked: boolean) {
  const me = await myId();
  const res = liked
    ? await supabase.from('likes').upsert({ user_id: me, video_id: videoId }, { ignoreDuplicates: true })
    : await supabase.from('likes').delete().eq('user_id', me).eq('video_id', videoId);
  if (res.error) throw res.error;
}

export async function setSaved(videoId: string, saved: boolean) {
  const me = await myId();
  const res = saved
    ? await supabase.from('saves').upsert({ user_id: me, video_id: videoId }, { ignoreDuplicates: true })
    : await supabase.from('saves').delete().eq('user_id', me).eq('video_id', videoId);
  if (res.error) throw res.error;
}

export async function setFollowing(userId: string, follow: boolean) {
  const me = await myId();
  const res = follow
    ? await supabase.from('follows').upsert({ follower_id: me, following_id: userId }, { ignoreDuplicates: true })
    : await supabase.from('follows').delete().eq('follower_id', me).eq('following_id', userId);
  if (res.error) throw res.error;
}

export async function isFollowing(userId: string): Promise<boolean> {
  const me = await myId();
  const { count } = await supabase
    .from('follows')
    .select('*', { count: 'exact', head: true })
    .eq('follower_id', me)
    .eq('following_id', userId);
  return (count ?? 0) > 0;
}

export async function registerView(videoId: string) {
  await supabase.rpc('register_view', { p_video_id: videoId });
}

// ───────────── Comments ─────────────

const COMMENT_SELECT = '*, author:profiles(username, display_name, avatar_url)';

async function withMyLikes(comments: Comment[]): Promise<Comment[]> {
  if (comments.length === 0) return comments;
  const me = await myId();
  const liked = must(
    await supabase
      .from('comment_likes')
      .select('comment_id')
      .eq('user_id', me)
      .in('comment_id', comments.map((c) => c.id)),
  ) as { comment_id: string }[];
  const set = new Set(liked.map((l) => l.comment_id));
  return comments.map((c) => ({ ...c, liked_by_me: set.has(c.id) }));
}

/** Top-level comments, most liked first (ties broken by newest). */
export async function fetchComments(videoId: string): Promise<Comment[]> {
  const rows = must(
    await supabase
      .from('comments')
      .select(COMMENT_SELECT)
      .eq('video_id', videoId)
      .is('parent_id', null)
      .order('likes_count', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(100),
  ) as Comment[];
  return withMyLikes(rows);
}

export async function fetchReplies(commentId: string): Promise<Comment[]> {
  const rows = must(
    await supabase.from('comments').select(COMMENT_SELECT).eq('parent_id', commentId).order('created_at').limit(100),
  ) as Comment[];
  return withMyLikes(rows);
}

export async function addComment(videoId: string, body: string, parentId?: string | null): Promise<Comment> {
  const me = await myId();
  return must(
    await supabase
      .from('comments')
      .insert({ video_id: videoId, user_id: me, body: body.trim(), parent_id: parentId ?? null })
      .select(COMMENT_SELECT)
      .single(),
  ) as Comment;
}

export async function setCommentLiked(commentId: string, liked: boolean) {
  const me = await myId();
  const res = liked
    ? await supabase.from('comment_likes').upsert({ user_id: me, comment_id: commentId }, { ignoreDuplicates: true })
    : await supabase.from('comment_likes').delete().eq('user_id', me).eq('comment_id', commentId);
  if (res.error) throw res.error;
}

export async function deleteComment(id: string) {
  const { error } = await supabase.from('comments').delete().eq('id', id);
  if (error) throw error;
}

// ───────────── Messages ─────────────

export async function fetchConversations(): Promise<Conversation[]> {
  return must(
    await supabase.from('my_conversations').select('*').order('last_message_at', { ascending: false }).limit(100),
  ) as Conversation[];
}

export async function unreadMessageCount(): Promise<number> {
  const rows = must(await supabase.from('my_conversations').select('unread_count')) as { unread_count: number }[];
  return rows.reduce((n, r) => n + (r.unread_count > 0 ? 1 : 0), 0);
}

export async function startConversation(userId: string): Promise<string> {
  const { data, error } = await supabase.rpc('start_conversation', { p_other: userId });
  if (error) throw error;
  return data as string;
}

export async function fetchConversationPeer(conversationId: string): Promise<Profile | null> {
  const me = await myId();
  const row = must(
    await supabase
      .from('conversation_members')
      .select('profile:profiles(*)')
      .eq('conversation_id', conversationId)
      .neq('user_id', me)
      .maybeSingle(),
  ) as { profile: Profile } | null;
  return row?.profile ?? null;
}

const MESSAGE_SELECT = '*, video:videos(id, thumbnail_url, caption, author:profiles(username, avatar_url))';

/** Newest first, for an inverted chat list. Pass `before` to page back in time. */
export async function fetchMessages(conversationId: string, before?: string): Promise<Message[]> {
  let q = supabase.from('messages').select(MESSAGE_SELECT).eq('conversation_id', conversationId);
  if (before) q = q.lt('created_at', before);
  return must(await q.order('created_at', { ascending: false }).limit(40)) as Message[];
}

export async function fetchMessage(id: string): Promise<Message | null> {
  return must(await supabase.from('messages').select(MESSAGE_SELECT).eq('id', id).maybeSingle()) as Message | null;
}

export async function sendMessage(conversationId: string, body: string | null, videoId?: string | null): Promise<Message> {
  const me = await myId();
  return must(
    await supabase
      .from('messages')
      .insert({ conversation_id: conversationId, sender_id: me, body: body?.trim() || null, video_id: videoId ?? null })
      .select(MESSAGE_SELECT)
      .single(),
  ) as Message;
}

export async function markConversationRead(conversationId: string) {
  await supabase.rpc('mark_conversation_read', { p_conversation: conversationId });
}

/** Sends a video to someone, opening the conversation if needed. */
export async function shareVideoTo(userId: string, videoId: string, note?: string) {
  const cid = await startConversation(userId);
  await sendMessage(cid, note ?? null, videoId);
}

/** People to share with: recent chats first, then people you follow. */
export async function fetchShareTargets(): Promise<Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'>[]> {
  const me = await myId();
  const [convos, follows] = await Promise.all([
    fetchConversations().catch(() => [] as Conversation[]),
    supabase
      .from('follows')
      .select('profile:profiles!follows_following_id_fkey(id, username, display_name, avatar_url)')
      .eq('follower_id', me)
      .order('created_at', { ascending: false })
      .limit(50),
  ]);
  const seen = new Set<string>();
  const out: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'>[] = [];
  for (const c of convos) {
    if (seen.has(c.other_id)) continue;
    seen.add(c.other_id);
    out.push({ id: c.other_id, username: c.other_username, display_name: c.other_display_name, avatar_url: c.other_avatar_url });
  }
  for (const row of (follows.data ?? []) as unknown as { profile: Profile | null }[]) {
    if (!row.profile || seen.has(row.profile.id)) continue;
    seen.add(row.profile.id);
    out.push(row.profile);
  }
  return out;
}

// ───────────── Safety ─────────────

export async function blockUser(userId: string) {
  const { error } = await supabase.rpc('block_user', { p_user: userId });
  if (error) throw error;
}

export async function unblockUser(userId: string) {
  const me = await myId();
  const { error } = await supabase.from('blocks').delete().eq('blocker_id', me).eq('blocked_id', userId);
  if (error) throw error;
}

export async function hasBlocked(userId: string): Promise<boolean> {
  const me = await myId();
  const { count } = await supabase
    .from('blocks')
    .select('*', { count: 'exact', head: true })
    .eq('blocker_id', me)
    .eq('blocked_id', userId);
  return (count ?? 0) > 0;
}

export async function fetchBlocked(): Promise<Profile[]> {
  const me = await myId();
  const rows = must(
    await supabase
      .from('blocks')
      .select('profile:profiles!blocks_blocked_id_fkey(*)')
      .eq('blocker_id', me)
      .order('created_at', { ascending: false }),
  ) as unknown as { profile: Profile }[];
  return rows.map((r) => r.profile).filter(Boolean);
}

export async function report(target: { videoId?: string; commentId?: string; userId?: string }, reason: ReportReason) {
  const me = await myId();
  const { error } = await supabase.from('reports').insert({
    reporter_id: me,
    video_id: target.videoId ?? null,
    comment_id: target.commentId ?? null,
    user_id: target.userId ?? null,
    reason,
  });
  if (error) throw error;
}

// ───────────── Profiles ─────────────

export async function fetchProfile(id: string): Promise<Profile | null> {
  return must(await supabase.from('profiles').select('*').eq('id', id).maybeSingle()) as Profile | null;
}

export async function updateProfile(patch: Partial<Pick<Profile, 'username' | 'display_name' | 'bio' | 'avatar_url'>>) {
  const me = await myId();
  const { error } = await supabase.from('profiles').update(patch).eq('id', me);
  if (error) {
    if ((error as { code?: string }).code === '23505') throw new Error('That username is taken.');
    if ((error as { code?: string }).code === '23514')
      throw new Error('Usernames are 3–24 characters: lowercase letters, numbers, dots and underscores.');
    throw error;
  }
}

export async function uploadAvatar(localUri: string): Promise<string> {
  const me = await myId();
  const small = await (await ImageManipulator.manipulate(localUri).resize({ width: 400 }).renderAsync()).saveAsync({
    format: SaveFormat.JPEG,
    compress: 0.8,
  });
  const path = `${me}/avatar-${Date.now()}.jpg`;
  return uploadFile('avatars', path, small.uri, 'image/jpeg');
}

// ───────────── Notifications ─────────────

export async function fetchNotifications(): Promise<Notification[]> {
  const me = await myId();
  return must(
    await supabase
      .from('notifications')
      .select('id, type, video_id, created_at, read, actor:profiles!notifications_actor_id_fkey(id, username, avatar_url), video:videos(thumbnail_url), comment:comments(body)')
      .eq('recipient_id', me)
      .order('created_at', { ascending: false })
      .limit(60),
  ) as unknown as Notification[];
}

export async function markNotificationsRead() {
  const me = await myId();
  await supabase.from('notifications').update({ read: true }).eq('recipient_id', me).eq('read', false);
}

export async function unreadNotificationCount(): Promise<number> {
  const me = await myId();
  const { count } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('recipient_id', me)
    .eq('read', false);
  return count ?? 0;
}

// ───────────── Publishing ─────────────

async function uploadFile(bucket: 'videos' | 'avatars', path: string, localUri: string, contentType: string) {
  const bytes = await new File(localUri).arrayBuffer();
  const { error } = await supabase.storage.from(bucket).upload(path, bytes, { contentType, upsert: false });
  if (error) throw error;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

/** Grabs a frame near the start of the clip and saves it as a JPEG. Returns null if the platform can't. */
async function makeThumbnail(localUri: string): Promise<string | null> {
  const player = createVideoPlayer(localUri);
  try {
    const [thumb] = await player.generateThumbnailsAsync([0.5], { maxWidth: 540 });
    if (!thumb) return null;
    const ref = await ImageManipulator.manipulate(thumb).renderAsync();
    const saved = await ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.75 });
    return saved.uri;
  } catch {
    return null;
  } finally {
    player.release();
  }
}

export async function publishVideo(post: NewPost, onProgress?: (step: string) => void) {
  const me = await myId();
  const stamp = Date.now();
  const ext = post.mimeType?.includes('quicktime') ? 'mov' : 'mp4';

  onProgress?.('Preparing cover');
  const thumbLocal = await makeThumbnail(post.localUri);

  onProgress?.('Uploading video');
  const videoUrl = await uploadFile('videos', `${me}/${stamp}.${ext}`, post.localUri, post.mimeType ?? 'video/mp4');

  let thumbnailUrl: string | null = null;
  if (thumbLocal) {
    onProgress?.('Uploading cover');
    thumbnailUrl = await uploadFile('videos', `${me}/${stamp}.jpg`, thumbLocal, 'image/jpeg').catch(() => null);
  }

  onProgress?.('Publishing');
  const { error } = await supabase.from('videos').insert({
    user_id: me,
    video_url: videoUrl,
    thumbnail_url: thumbnailUrl,
    caption: post.caption.trim(),
    visibility: post.visibility,
    allow_comments: post.allowComments,
    duration: post.duration ?? null,
  });
  if (error) throw error;
}

export async function deleteVideo(id: string) {
  const { error } = await supabase.from('videos').delete().eq('id', id);
  if (error) throw error;
}
