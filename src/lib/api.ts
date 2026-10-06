/**
 * Data access for the whole app. Uses Supabase when it's configured, otherwise an in-memory
 * demo backend, so the app can be explored before any backend is set up.
 */
import * as demo from './api.demo';
import * as live from './api.live';
import { isConfigured } from './config';

export { PAGE_SIZE, type FeedSource, type NewPost } from './types';

const impl: typeof live = isConfigured ? live : demo;

export const {
  getSession,
  onAuthChange,
  signIn,
  signUp,
  signOut,
  subscribeInserts,
  fetchFeed,
  fetchVideo,
  searchVideos,
  searchProfiles,
  setLiked,
  setSaved,
  setFollowing,
  isFollowing,
  registerView,
  fetchComments,
  fetchReplies,
  addComment,
  setCommentLiked,
  deleteComment,
  fetchConversations,
  unreadMessageCount,
  startConversation,
  fetchConversationPeer,
  fetchMessages,
  fetchMessage,
  sendMessage,
  markConversationRead,
  shareVideoTo,
  fetchShareTargets,
  blockUser,
  unblockUser,
  hasBlocked,
  fetchBlocked,
  report,
  fetchProfile,
  updateProfile,
  uploadAvatar,
  fetchNotifications,
  markNotificationsRead,
  unreadNotificationCount,
  publishVideo,
  deleteVideo,
} = impl;

export const isDemo = !isConfigured;
