/**
 * In-memory demo backend with the same API as api.live.ts.
 * Used when Supabase isn't configured, so the whole app can be explored with sample data.
 * Everything resets when the app reloads.
 */
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
  type SharedVideo,
  type Visibility,
} from './types';

// ───────────── Store ─────────────

type VideoRow = Omit<FeedVideo, 'username' | 'display_name' | 'avatar_url' | 'liked_by_me' | 'saved_by_me' | 'following_author'>;
type CommentRow = Omit<Comment, 'author' | 'liked_by_me'>;
type NotificationRow = { id: string; recipient_id: string; actor_id: string; type: Notification['type']; video_id: string | null; comment_id: string | null; read: boolean; created_at: string };
type MessageRow = Omit<Message, 'video'>;
type ConversationRow = { id: string; members: [string, string]; last_message_at: string; last_message_preview: string; lastRead: Record<string, string> };

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
let seq = 0;
const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(seq++).toString(36)}`;
const wait = (ms = 120) => new Promise((r) => setTimeout(r, ms));
const key = (a: string, b: string) => `${a}:${b}`;

const CLIPS = {
  flower: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
  bunny: 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_2MB.mp4',
  city: 'https://download.samplelib.com/mp4/sample-5s.mp4',
  street: 'https://download.samplelib.com/mp4/sample-10s.mp4',
  ride: 'https://download.samplelib.com/mp4/sample-15s.mp4',
  night: 'https://download.samplelib.com/mp4/sample-20s.mp4',
};
const thumb = (seed: string) => `https://picsum.photos/seed/vybe-${seed}/540/960`;

function profile(id: string, username: string, display_name: string, bio: string, img: number, followers: number): Profile {
  return {
    id,
    username,
    display_name,
    bio,
    avatar_url: `https://i.pravatar.cc/300?img=${img}`,
    followers_count: followers,
    following_count: Math.floor(followers / 40) + 12,
    likes_count: 0,
    created_at: ago(60 * 24 * 90),
  };
}

const profiles = new Map<string, Profile>(
  [
    profile('u-zuri', 'zuri.moves', 'Zuri Adebayo', 'Movement director · night-shift dreamer ✦ NYC. New film every Friday.', 47, 2_800_000),
    profile('u-milo', 'milo.wheels', 'Milo Chen', 'No brakes after midnight 🛹', 12, 184_000),
    profile('u-ari', 'ari.sol', 'Ari Sol', 'Food, film and very loud opinions 🍜', 32, 96_400),
    profile('u-luma', 'luma.wav', 'Luma', 'Making sounds for your 3am walks 🎧', 45, 412_000),
    profile('u-noah', 'noahframes', 'Noah Frames', 'Cinematographer. Every frame on purpose.', 15, 58_200),
  ].map((p) => [p.id, p]),
);

function video(id: string, user_id: string, clip: keyof typeof CLIPS, caption: string, sound_name: string, minutesAgo: number, stats: [number, number, number, number]): VideoRow {
  const [likes_count, comments_count, saves_count, views_count] = stats;
  return {
    id,
    user_id,
    video_url: CLIPS[clip],
    thumbnail_url: thumb(id),
    caption,
    sound_name,
    visibility: 'public',
    allow_comments: true,
    duration: null,
    likes_count,
    comments_count,
    saves_count,
    views_count,
    created_at: ago(minutesAgo),
  };
}

const videos: VideoRow[] = [
  video('v-1', 'u-zuri', 'night', 'Midnight weather, main character energy. We made the rain part of the choreography 🌧️ #nightshift #dancefilm #vybeoriginal', 'Afterdark · Kairo Bloom', 90, [248_000, 3, 18_000, 4_800_000]),
  video('v-2', 'u-milo', 'street', 'Found a new spot. Don’t tell anyone 🤫 #skate #cityvibes', 'Neon Static · Luma', 240, [91_000, 2, 4_200, 1_200_000]),
  video('v-3', 'u-ari', 'bunny', 'When the recipe says “simple” 😭 #foodtok #comedy', 'Original sound', 30, [12_400, 1, 900, 186_000]),
  video('v-4', 'u-luma', 'flower', 'Slowed down, bloomed out 🌸 #ambient #nature', 'Bloom (slowed) · Luma', 600, [64_000, 1, 7_100, 742_000]),
  video('v-5', 'u-noah', 'city', 'One take. No cuts. #onetake #cinematography', 'Original sound', 1_500, [33_000, 0, 5_800, 642_000]),
  video('v-6', 'u-zuri', 'ride', 'Rehearsal vs. the real thing 👀 #dancefilm #bts', 'Afterdark · Kairo Bloom', 2_900, [180_000, 0, 9_400, 2_100_000]),
  video('v-7', 'u-milo', 'night', 'Sunday joyride with the crew #cityvibes #skate', 'Original sound', 4_300, [22_000, 0, 1_100, 310_000]),
  video('v-8', 'u-luma', 'street', 'Made this beat on the train home 🚇 #producer #nightshift', 'Train Home · Luma', 7_000, [41_000, 0, 3_300, 520_000]),
];

const comments: CommentRow[] = [];
function seedComment(id: string, video_id: string, user_id: string, body: string, minutesAgo: number, likes: number, parent_id: string | null = null) {
  comments.push({ id, video_id, user_id, parent_id, body, likes_count: likes, replies_count: 0, created_at: ago(minutesAgo) });
  if (parent_id) {
    const p = comments.find((c) => c.id === parent_id);
    if (p) p.replies_count++;
  }
}
seedComment('c-1', 'v-1', 'u-zuri', 'The rooftop was freezing but we got the take 🥶', 80, 8_200);
seedComment('c-2', 'v-1', 'u-milo', 'That beat switch at 0:07 is actually unreal.', 60, 2_100);
seedComment('c-3', 'v-1', 'u-ari', 'Production, styling, movement — everything is hitting.', 48, 946);
seedComment('c-4', 'v-1', 'u-luma', 'Okay but who did the sound design 👀', 40, 210, 'c-2');
seedComment('c-5', 'v-1', 'u-zuri', 'You did, Luma 😂', 35, 640, 'c-2');
seedComment('c-6', 'v-2', 'u-noah', 'Need the behind the scenes immediately', 120, 318);
seedComment('c-7', 'v-2', 'u-ari', 'This spot is so clean', 100, 95);
seedComment('c-8', 'v-3', 'u-zuri', 'The face at the end 💀', 20, 432);
seedComment('c-9', 'v-4', 'u-noah', 'The color grade on this 🤌', 500, 120);

const likes = new Set<string>(); // user:video
const saves = new Set<string>(); // user:video
const follows = new Set<string>([key('u-milo', 'u-zuri'), key('u-ari', 'u-zuri'), key('u-noah', 'u-luma')]); // follower:following
const commentLikes = new Set<string>(); // user:comment
const blocks = new Set<string>(); // blocker:blocked
const notifications: NotificationRow[] = [];
const conversations: ConversationRow[] = [];
const messages: MessageRow[] = [];

for (const p of profiles.values()) p.likes_count = videos.filter((v) => v.user_id === p.id).reduce((n, v) => n + v.likes_count, 0);
for (const v of videos) v.comments_count = comments.filter((c) => c.video_id === v.id).length;

// ───────────── Session ─────────────

let session: AppSession | null = null;
const authListeners = new Set<(s: AppSession | null) => void>();
const DEMO_USER_KEY = 'vybe-demo-user';

// Remember who's signed in so a reload keeps you in (the sample data itself starts fresh).
function rememberUser(email: string | null) {
  try {
    if (email) localStorage.setItem(DEMO_USER_KEY, email);
    else localStorage.removeItem(DEMO_USER_KEY);
  } catch {
    // Storage unavailable: you'll just need to sign in again after a reload.
  }
}

const setSession = (s: AppSession | null) => {
  session = s;
  rememberUser(s?.user.email ?? null);
  authListeners.forEach((l) => l(s));
};

function myId() {
  if (!session) throw new Error('Not signed in');
  return session.user.id;
}

export async function getSession() {
  if (!session) {
    let email: string | null = null;
    try {
      email = localStorage.getItem(DEMO_USER_KEY);
    } catch {}
    if (email) session = { user: { id: ensureMe(email), email } };
  }
  return session;
}

export function onAuthChange(cb: (session: AppSession | null) => void) {
  authListeners.add(cb);
  return () => {
    authListeners.delete(cb);
  };
}

/** First sign-in creates your demo account with a starter video and some activity to explore. */
function ensureMe(email: string, username?: string) {
  const id = `me-${email.toLowerCase()}`;
  if (!profiles.has(id)) {
    const name = (username || email.split('@')[0]).toLowerCase().replace(/[^a-z0-9._]/g, '').slice(0, 24) || 'you';
    profiles.set(id, { ...profile(id, name, name, 'Just joined VYBE ✨', 68, 0), avatar_url: null, following_count: 0, likes_count: 0, created_at: new Date().toISOString() });
    seedForNewUser(id);
  }
  return id;
}

function seedForNewUser(me: string) {
  const v: VideoRow = { ...video(uid('v'), me, 'flower', 'My first VYBE 🌸 #hello', 'Original sound', 180, [3, 1, 1, 128]), thumbnail_url: thumb('first') };
  videos.push(v);
  const p = profiles.get(me)!;
  p.likes_count = 3;
  p.followers_count = 2;
  likes.add(key('u-zuri', v.id)).add(key('u-milo', v.id)).add(key('u-ari', v.id));
  follows.add(key('u-zuri', me)).add(key('u-ari', me));
  const c = uid('c');
  comments.push({ id: c, video_id: v.id, user_id: 'u-ari', parent_id: null, body: 'Welcome to VYBE! This is gorgeous 😍', likes_count: 2, replies_count: 0, created_at: ago(150) });
  const n = (actor: string, type: Notification['type'], minutes: number, extra: Partial<NotificationRow> = {}) =>
    notifications.push({ id: uid('n'), recipient_id: me, actor_id: actor, type, video_id: null, comment_id: null, read: false, created_at: ago(minutes), ...extra });
  n('u-zuri', 'follow', 170);
  n('u-ari', 'follow', 160);
  n('u-ari', 'comment', 150, { video_id: v.id, comment_id: c });
  n('u-milo', 'like', 120, { video_id: v.id });
  n('u-zuri', 'like', 12, { video_id: v.id });

  // A conversation already in progress, like the prototype.
  const cid = uid('conv');
  conversations.push({ id: cid, members: [me, 'u-milo'], last_message_at: ago(5), last_message_preview: '', lastRead: { [me]: ago(60), 'u-milo': ago(0) } });
  const m = (from: string, body: string | null, minutes: number, video_id: string | null = null) =>
    messages.push({ id: uid('m'), conversation_id: cid, sender_id: from, body, video_id, created_at: ago(minutes) });
  m('u-milo', 'That rooftop cut from Zuri is wild. The rain made it look unreal.', 30);
  m(me, 'Right? They almost called it because of the weather 😭', 28);
  m('u-milo', null, 10, 'v-2');
  m('u-milo', 'No brakes after midnight. Tell me this isn’t the one', 5);
  const conv = conversations[conversations.length - 1];
  conv.last_message_preview = 'No brakes after midnight. Tell me this isn’t the one';
}

export async function signIn(email: string, _password: string) {
  await wait(300);
  const id = ensureMe(email);
  setSession({ user: { id, email } });
}

export async function signUp(email: string, _password: string, username: string) {
  await wait(300);
  const id = ensureMe(email, username);
  setSession({ user: { id, email } });
  return true;
}

export async function signOut() {
  setSession(null);
}

// ───────────── Realtime ─────────────

const insertListeners = new Set<{ table: string; filter?: string; cb: (row: never) => void }>();

function matches(filter: string | undefined, row: Record<string, unknown>) {
  if (!filter) return true;
  const [col, val] = filter.split('=eq.');
  return String(row[col]) === val;
}

function publish(table: 'messages' | 'notifications', row: Record<string, unknown>) {
  for (const l of insertListeners) if (l.table === table && matches(l.filter, row)) (l.cb as (r: unknown) => void)(row);
}

export function subscribeInserts<T>(table: 'messages' | 'notifications', filter: string | undefined, cb: (row: T) => void) {
  const entry = { table, filter, cb: cb as (row: never) => void };
  insertListeners.add(entry);
  return () => {
    insertListeners.delete(entry);
  };
}

function notify(recipient_id: string, actor_id: string, type: Notification['type'], video_id: string | null = null, comment_id: string | null = null) {
  if (recipient_id === actor_id) return;
  const row: NotificationRow = { id: uid('n'), recipient_id, actor_id, type, video_id, comment_id, read: false, created_at: new Date().toISOString() };
  notifications.push(row);
  publish('notifications', row);
}

// ───────────── Feeds ─────────────

const blockedBetween = (a: string, b: string) => blocks.has(key(a, b)) || blocks.has(key(b, a));

function canSee(v: VideoRow, me: string | null) {
  if (me && blockedBetween(me, v.user_id)) return false;
  if (v.visibility === 'public' || v.user_id === me) return true;
  return v.visibility === 'followers' && !!me && follows.has(key(me, v.user_id));
}

function toFeed(v: VideoRow): FeedVideo {
  const me = session?.user.id ?? '';
  const p = profiles.get(v.user_id)!;
  return {
    ...v,
    username: p.username,
    display_name: p.display_name,
    avatar_url: p.avatar_url,
    liked_by_me: likes.has(key(me, v.id)),
    saved_by_me: saves.has(key(me, v.id)),
    following_author: follows.has(key(me, v.user_id)),
  };
}

const score = (v: VideoRow) =>
  (v.likes_count + 2 * v.comments_count + 3 * v.saves_count + 0.1 * v.views_count + 1) /
  Math.pow((Date.now() - new Date(v.created_at).getTime()) / 3_600_000 + 2, 1.5);
const newest = (a: VideoRow, b: VideoRow) => b.created_at.localeCompare(a.created_at);

export async function fetchFeed(source: FeedSource, offset: number, limit = PAGE_SIZE): Promise<FeedVideo[]> {
  await wait();
  const me = session?.user.id ?? null;
  let list = videos.filter((v) => canSee(v, me));
  switch (source.kind) {
    case 'forYou':
      list.sort((a, b) => score(b) - score(a));
      break;
    case 'following':
      list = list.filter((v) => me && follows.has(key(me, v.user_id))).sort(newest);
      break;
    case 'user':
      list = list.filter((v) => v.user_id === source.userId).sort(newest);
      break;
    case 'saved':
      list = list.filter((v) => me && saves.has(key(me, v.id))).sort(newest);
      break;
    case 'tag':
      list = list.filter((v) => v.caption.toLowerCase().includes(`#${source.tag.toLowerCase()}`)).sort((a, b) => score(b) - score(a));
      break;
    case 'single':
      list = list.filter((v) => v.id === source.videoId);
      break;
  }
  return list.slice(offset, offset + limit).map(toFeed);
}

export async function fetchVideo(id: string) {
  await wait(60);
  const v = videos.find((x) => x.id === id);
  return v && canSee(v, session?.user.id ?? null) ? toFeed(v) : null;
}

export async function searchVideos(term: string) {
  await wait();
  const t = term.trim().toLowerCase();
  const me = session?.user.id ?? null;
  return videos
    .filter((v) => canSee(v, me))
    .filter((v) => !t || v.caption.toLowerCase().includes(t) || v.sound_name.toLowerCase().includes(t) || profiles.get(v.user_id)!.username.includes(t))
    .sort((a, b) => score(b) - score(a))
    .slice(0, 30)
    .map(toFeed);
}

export async function searchProfiles(term: string) {
  await wait();
  const t = term.trim().toLowerCase();
  const me = session?.user.id ?? '';
  return [...profiles.values()]
    .filter((p) => !blockedBetween(me, p.id))
    .filter((p) => !t || p.username.includes(t) || p.display_name.toLowerCase().includes(t))
    .sort((a, b) => b.followers_count - a.followers_count)
    .slice(0, 12);
}

// ───────────── Engagement ─────────────

export async function setLiked(videoId: string, liked: boolean) {
  await wait(60);
  const me = myId();
  const v = videos.find((x) => x.id === videoId);
  if (!v || likes.has(key(me, videoId)) === liked) return;
  if (liked) likes.add(key(me, videoId));
  else likes.delete(key(me, videoId));
  v.likes_count += liked ? 1 : -1;
  profiles.get(v.user_id)!.likes_count += liked ? 1 : -1;
  if (liked) notify(v.user_id, me, 'like', v.id);
}

export async function setSaved(videoId: string, saved: boolean) {
  await wait(60);
  const me = myId();
  const v = videos.find((x) => x.id === videoId);
  if (!v || saves.has(key(me, videoId)) === saved) return;
  if (saved) saves.add(key(me, videoId));
  else saves.delete(key(me, videoId));
  v.saves_count += saved ? 1 : -1;
}

export async function setFollowing(userId: string, follow: boolean) {
  await wait(60);
  const me = myId();
  if (follow && blockedBetween(me, userId)) throw new Error('You can’t follow this account.');
  if (follows.has(key(me, userId)) === follow) return;
  if (follow) follows.add(key(me, userId));
  else follows.delete(key(me, userId));
  profiles.get(me)!.following_count += follow ? 1 : -1;
  profiles.get(userId)!.followers_count += follow ? 1 : -1;
  if (follow) notify(userId, me, 'follow');
}

export async function isFollowing(userId: string) {
  return follows.has(key(myId(), userId));
}

export async function registerView(videoId: string) {
  const v = videos.find((x) => x.id === videoId);
  if (v) v.views_count++;
}

// ───────────── Comments ─────────────

function toComment(c: CommentRow): Comment {
  const p = profiles.get(c.user_id)!;
  return { ...c, author: { username: p.username, display_name: p.display_name, avatar_url: p.avatar_url }, liked_by_me: commentLikes.has(key(session?.user.id ?? '', c.id)) };
}

const visibleComment = (c: CommentRow) => !blockedBetween(session?.user.id ?? '', c.user_id);

export async function fetchComments(videoId: string) {
  await wait();
  return comments
    .filter((c) => c.video_id === videoId && !c.parent_id && visibleComment(c))
    .sort((a, b) => b.likes_count - a.likes_count || b.created_at.localeCompare(a.created_at))
    .map(toComment);
}

export async function fetchReplies(commentId: string) {
  await wait();
  return comments
    .filter((c) => c.parent_id === commentId && visibleComment(c))
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map(toComment);
}

export async function addComment(videoId: string, body: string, parentId?: string | null) {
  await wait();
  const me = myId();
  const v = videos.find((x) => x.id === videoId);
  if (!v?.allow_comments) throw new Error('Comments are turned off for this video.');
  const parent = parentId ? comments.find((c) => c.id === parentId) : undefined;
  const rootId = parent ? (parent.parent_id ?? parent.id) : null; // replies are one level deep
  const row: CommentRow = { id: uid('c'), video_id: videoId, user_id: me, parent_id: rootId, body: body.trim(), likes_count: 0, replies_count: 0, created_at: new Date().toISOString() };
  comments.push(row);
  v.comments_count++;
  const root = rootId ? comments.find((c) => c.id === rootId) : undefined;
  if (root) root.replies_count++;
  if (parent) notify(parent.user_id, me, 'reply', videoId, row.id);
  if (v.user_id !== parent?.user_id) notify(v.user_id, me, 'comment', videoId, row.id);
  return toComment(row);
}

export async function setCommentLiked(commentId: string, liked: boolean) {
  await wait(60);
  const me = myId();
  const c = comments.find((x) => x.id === commentId);
  if (!c || commentLikes.has(key(me, commentId)) === liked) return;
  if (liked) commentLikes.add(key(me, commentId));
  else commentLikes.delete(key(me, commentId));
  c.likes_count += liked ? 1 : -1;
}

export async function deleteComment(id: string) {
  await wait(60);
  const c = comments.find((x) => x.id === id);
  if (!c) return;
  const doomed = new Set([id, ...comments.filter((x) => x.parent_id === id).map((x) => x.id)]);
  const v = videos.find((x) => x.id === c.video_id);
  if (v) v.comments_count = Math.max(0, v.comments_count - doomed.size);
  if (c.parent_id) {
    const p = comments.find((x) => x.id === c.parent_id);
    if (p) p.replies_count = Math.max(0, p.replies_count - 1);
  }
  for (let i = comments.length - 1; i >= 0; i--) if (doomed.has(comments[i].id)) comments.splice(i, 1);
}

// ───────────── Messages ─────────────

const otherMember = (c: ConversationRow, me: string) => (c.members[0] === me ? c.members[1] : c.members[0]);

function unreadIn(c: ConversationRow, me: string) {
  return messages.filter((m) => m.conversation_id === c.id && m.sender_id !== me && m.created_at > (c.lastRead[me] ?? '')).length;
}

export async function fetchConversations(): Promise<Conversation[]> {
  await wait();
  const me = myId();
  return conversations
    .filter((c) => c.members.includes(me) && messages.some((m) => m.conversation_id === c.id))
    .sort((a, b) => b.last_message_at.localeCompare(a.last_message_at))
    .map((c) => {
      const p = profiles.get(otherMember(c, me))!;
      return {
        id: c.id,
        last_message_at: c.last_message_at,
        last_message_preview: c.last_message_preview,
        other_id: p.id,
        other_username: p.username,
        other_display_name: p.display_name,
        other_avatar_url: p.avatar_url,
        unread_count: unreadIn(c, me),
      };
    });
}

export async function unreadMessageCount() {
  const me = session?.user.id;
  if (!me) return 0;
  return conversations.filter((c) => c.members.includes(me) && unreadIn(c, me) > 0).length;
}

export async function startConversation(userId: string) {
  await wait();
  const me = myId();
  if (blockedBetween(me, userId)) throw new Error('You can’t message this account.');
  const existing = conversations.find((c) => c.members.includes(me) && c.members.includes(userId));
  if (existing) return existing.id;
  const now = new Date().toISOString();
  const c: ConversationRow = { id: uid('conv'), members: [me, userId], last_message_at: now, last_message_preview: '', lastRead: { [me]: now, [userId]: now } };
  conversations.push(c);
  return c.id;
}

export async function fetchConversationPeer(conversationId: string) {
  const c = conversations.find((x) => x.id === conversationId);
  return c ? (profiles.get(otherMember(c, myId())) ?? null) : null;
}

function sharedVideo(id: string | null): SharedVideo | null {
  const v = id ? videos.find((x) => x.id === id) : undefined;
  if (!v) return null;
  const p = profiles.get(v.user_id)!;
  return { id: v.id, thumbnail_url: v.thumbnail_url, caption: v.caption, author: { username: p.username, avatar_url: p.avatar_url } };
}

const toMessage = (m: MessageRow): Message => ({ ...m, video: sharedVideo(m.video_id) });

export async function fetchMessages(conversationId: string, before?: string) {
  await wait();
  return messages
    .filter((m) => m.conversation_id === conversationId && (!before || m.created_at < before))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 40)
    .map(toMessage);
}

export async function fetchMessage(id: string) {
  const m = messages.find((x) => x.id === id);
  return m ? toMessage(m) : null;
}

const REPLIES = ['haha no way 😂', 'okay this is actually so good', 'sending this to everyone', 'WAIT 👀', 'we need to collab on this', 'you always find the best ones', '🔥🔥🔥', 'lol I’m saving this'];

function insertMessage(conversationId: string, sender: string, body: string | null, videoId: string | null) {
  const c = conversations.find((x) => x.id === conversationId);
  if (!c) throw new Error('Conversation not found');
  const row: MessageRow = { id: uid('m'), conversation_id: conversationId, sender_id: sender, body: body?.trim() || null, video_id: videoId, created_at: new Date().toISOString() };
  messages.push(row);
  c.last_message_at = row.created_at;
  c.last_message_preview = row.video_id && !row.body ? 'Shared a video' : (row.body ?? '').slice(0, 120);
  c.lastRead[sender] = row.created_at;
  publish('messages', row);
  return row;
}

export async function sendMessage(conversationId: string, body: string | null, videoId?: string | null) {
  await wait();
  const me = myId();
  const c = conversations.find((x) => x.id === conversationId);
  if (!c) throw new Error('Conversation not found');
  const other = otherMember(c, me);
  if (blockedBetween(me, other)) throw new Error('You can’t message this account.');
  const row = insertMessage(conversationId, me, body, videoId ?? null);
  // Demo friends write back, so you can see live delivery and unread badges.
  setTimeout(() => {
    if (!blockedBetween(me, other)) insertMessage(conversationId, other, REPLIES[Math.floor(Math.random() * REPLIES.length)], null);
  }, 1800 + Math.random() * 1500);
  return toMessage(row);
}

export async function markConversationRead(conversationId: string) {
  const c = conversations.find((x) => x.id === conversationId);
  if (c && session) c.lastRead[session.user.id] = new Date().toISOString();
}

export async function shareVideoTo(userId: string, videoId: string, note?: string) {
  const cid = await startConversation(userId);
  await sendMessage(cid, note ?? null, videoId);
}

export async function fetchShareTargets() {
  await wait();
  const me = myId();
  const seen = new Set<string>();
  const out: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'>[] = [];
  const add = (id: string) => {
    const p = profiles.get(id);
    if (!p || seen.has(id) || id === me || blockedBetween(me, id)) return;
    seen.add(id);
    out.push({ id: p.id, username: p.username, display_name: p.display_name, avatar_url: p.avatar_url });
  };
  (await fetchConversations()).forEach((c) => add(c.other_id));
  for (const f of follows) if (f.startsWith(`${me}:`)) add(f.slice(me.length + 1));
  // In the demo, suggest everyone so sharing is always possible.
  for (const id of profiles.keys()) add(id);
  return out;
}

// ───────────── Safety ─────────────

export async function blockUser(userId: string) {
  await wait();
  const me = myId();
  blocks.add(key(me, userId));
  for (const [a, b] of [[me, userId], [userId, me]]) {
    if (follows.delete(key(a, b))) {
      profiles.get(a)!.following_count--;
      profiles.get(b)!.followers_count--;
    }
  }
}

export async function unblockUser(userId: string) {
  await wait();
  blocks.delete(key(myId(), userId));
}

export async function hasBlocked(userId: string) {
  return blocks.has(key(myId(), userId));
}

export async function fetchBlocked() {
  await wait();
  const me = myId();
  return [...blocks].filter((b) => b.startsWith(`${me}:`)).map((b) => profiles.get(b.slice(me.length + 1))!).filter(Boolean);
}

export async function report(_target: { videoId?: string; commentId?: string; userId?: string }, _reason: ReportReason) {
  await wait(300);
}

// ───────────── Profiles ─────────────

export async function fetchProfile(id: string) {
  await wait(60);
  const p = profiles.get(id);
  return p ? { ...p } : null;
}

export async function updateProfile(patch: Partial<Pick<Profile, 'username' | 'display_name' | 'bio' | 'avatar_url'>>) {
  await wait();
  const me = myId();
  if (patch.username !== undefined) {
    if (!/^[a-z0-9._]{3,24}$/.test(patch.username)) throw new Error('Usernames are 3–24 characters: lowercase letters, numbers, dots and underscores.');
    if ([...profiles.values()].some((p) => p.username === patch.username && p.id !== me)) throw new Error('That username is taken.');
  }
  Object.assign(profiles.get(me)!, patch);
}

export async function uploadAvatar(localUri: string) {
  await wait(300);
  return localUri;
}

// ───────────── Notifications ─────────────

export async function fetchNotifications(): Promise<Notification[]> {
  await wait();
  const me = myId();
  return notifications
    .filter((n) => n.recipient_id === me && !blockedBetween(me, n.actor_id))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((n) => {
      const actor = profiles.get(n.actor_id)!;
      const v = n.video_id ? videos.find((x) => x.id === n.video_id) : undefined;
      const c = n.comment_id ? comments.find((x) => x.id === n.comment_id) : undefined;
      return {
        id: n.id,
        type: n.type,
        video_id: n.video_id,
        created_at: n.created_at,
        read: n.read,
        actor: { id: actor.id, username: actor.username, avatar_url: actor.avatar_url },
        video: v ? { thumbnail_url: v.thumbnail_url } : null,
        comment: c ? { body: c.body } : null,
      };
    });
}

export async function markNotificationsRead() {
  const me = session?.user.id;
  notifications.forEach((n) => {
    if (n.recipient_id === me) n.read = true;
  });
}

export async function unreadNotificationCount() {
  const me = session?.user.id;
  return notifications.filter((n) => n.recipient_id === me && !n.read).length;
}

// ───────────── Publishing ─────────────

export async function publishVideo(post: NewPost, onProgress?: (step: string) => void) {
  const me = myId();
  onProgress?.('Uploading video');
  await wait(700);
  onProgress?.('Publishing');
  await wait(300);
  const visibility: Visibility = post.visibility;
  videos.push({
    id: uid('v'),
    user_id: me,
    video_url: post.localUri,
    thumbnail_url: null,
    caption: post.caption.trim(),
    sound_name: 'Original sound',
    visibility,
    allow_comments: post.allowComments,
    duration: post.duration ?? null,
    likes_count: 0,
    comments_count: 0,
    saves_count: 0,
    views_count: 0,
    created_at: new Date().toISOString(),
  });
}

export async function deleteVideo(id: string) {
  await wait();
  const i = videos.findIndex((v) => v.id === id && v.user_id === myId());
  if (i >= 0) videos.splice(i, 1);
}
