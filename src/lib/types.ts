export type Profile = {
  id: string;
  username: string;
  display_name: string;
  bio: string;
  avatar_url: string | null;
  followers_count: number;
  following_count: number;
  likes_count: number;
  created_at: string;
};

export type Visibility = 'public' | 'followers' | 'private';

export type FeedVideo = {
  id: string;
  user_id: string;
  video_url: string;
  thumbnail_url: string | null;
  caption: string;
  sound_name: string;
  visibility: Visibility;
  allow_comments: boolean;
  duration: number | null;
  likes_count: number;
  comments_count: number;
  saves_count: number;
  views_count: number;
  created_at: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  liked_by_me: boolean;
  saved_by_me: boolean;
  following_author: boolean;
};

export type Comment = {
  id: string;
  video_id: string;
  user_id: string;
  parent_id: string | null;
  body: string;
  likes_count: number;
  replies_count: number;
  created_at: string;
  author: Pick<Profile, 'username' | 'display_name' | 'avatar_url'>;
  /** Filled in client-side from comment_likes. */
  liked_by_me?: boolean;
};

export type Notification = {
  id: string;
  type: 'like' | 'comment' | 'follow' | 'reply';
  video_id: string | null;
  created_at: string;
  read: boolean;
  actor: Pick<Profile, 'id' | 'username' | 'avatar_url'>;
  video: { thumbnail_url: string | null } | null;
  comment: { body: string } | null;
};

export type Conversation = {
  id: string;
  last_message_at: string;
  last_message_preview: string;
  other_id: string;
  other_username: string;
  other_display_name: string;
  other_avatar_url: string | null;
  unread_count: number;
};

export type SharedVideo = {
  id: string;
  thumbnail_url: string | null;
  caption: string;
  author: { username: string; avatar_url: string | null } | null;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string | null;
  video_id: string | null;
  created_at: string;
  video?: SharedVideo | null;
};

export const PAGE_SIZE = 8;

export type FeedSource =
  | { kind: 'forYou' }
  | { kind: 'following' }
  | { kind: 'user'; userId: string }
  | { kind: 'saved' }
  | { kind: 'tag'; tag: string }
  | { kind: 'single'; videoId: string };

export type NewPost = {
  localUri: string;
  caption: string;
  visibility: Visibility;
  allowComments: boolean;
  duration?: number | null;
  mimeType?: string | null;
};

/** The bits of a signed-in session the app uses (a Supabase Session satisfies this). */
export type AppSession = { user: { id: string; email?: string } };

export type ReportReason ='spam' | 'harassment' | 'nudity' | 'violence' | 'misinformation' | 'other';
