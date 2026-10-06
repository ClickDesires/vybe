import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, IconButton } from '@/components/ui';
import { Alert } from '@/lib/alert';
import { fetchConversationPeer, fetchMessage, fetchMessages, markConversationRead, sendMessage, subscribeInserts } from '@/lib/api';
import { emit } from '@/lib/events';
import { colors, radius } from '@/lib/theme';
import type { Message, Profile } from '@/lib/types';
import { useAuth } from '@/providers/AuthProvider';

const GROUP_GAP_MS = 15 * 60 * 1000;

function stamp(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (d.toDateString() === today.toDateString()) return `Today · ${time}`;
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} · ${time}`;
}

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const me = session?.user.id;
  const insets = useSafeAreaInsets();

  const [peer, setPeer] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [text, setText] = useState('');
  const loadingOlder = useRef(false);
  const reachedStart = useRef(false);

  const markRead = useCallback(() => {
    markConversationRead(id)
      .then(() => emit('messagesRead', {}))
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    fetchConversationPeer(id).then(setPeer).catch(() => {});
    fetchMessages(id)
      .then((m) => {
        reachedStart.current = m.length < 40;
        setMessages(m);
      })
      .catch(() => setMessages([]));
    markRead();
  }, [id, markRead]);

  // Live incoming messages.
  useEffect(
    () =>
      subscribeInserts<Message>('messages', `conversation_id=eq.${id}`, async (row) => {
        if (row.sender_id === me) return; // our own sends are already on screen
        const full = row.video_id ? ((await fetchMessage(row.id).catch(() => null)) ?? row) : row;
        setMessages((ms) => (ms?.some((m) => m.id === full.id) ? ms : [full, ...(ms ?? [])]));
        markRead();
      }),
    [id, me, markRead],
  );

  const loadOlder = async () => {
    if (!messages?.length || loadingOlder.current || reachedStart.current) return;
    loadingOlder.current = true;
    const older = await fetchMessages(id, messages[messages.length - 1].created_at).catch(() => []);
    reachedStart.current = older.length < 40;
    setMessages((ms) => [...(ms ?? []), ...older]);
    loadingOlder.current = false;
  };

  const send = async () => {
    const body = text.trim();
    if (!body || !me) return;
    setText('');
    const temp: Message = { id: `temp-${Date.now()}`, conversation_id: id, sender_id: me, body, video_id: null, created_at: new Date().toISOString() };
    setMessages((ms) => [temp, ...(ms ?? [])]);
    try {
      const saved = await sendMessage(id, body);
      setMessages((ms) => ms?.map((m) => (m.id === temp.id ? saved : m)) ?? null);
    } catch (e) {
      setMessages((ms) => ms?.filter((m) => m.id !== temp.id) ?? null);
      setText(body);
      Alert.alert('Message not sent', e instanceof Error ? e.message : String(e));
    }
  };

  const openPeer = () => peer && router.push({ pathname: '/user/[id]', params: { id: peer.id } });

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.header}>
        <IconButton name="chevron-back" onPress={() => router.back()} />
        <Pressable onPress={openPeer} style={styles.headerPeer}>
          <Avatar uri={peer?.avatar_url} size={38} />
          <View>
            <Text style={styles.headerName}>{peer?.display_name || peer?.username || ' '}</Text>
            {peer && <Text style={styles.headerHandle}>@{peer.username}</Text>}
          </View>
        </Pressable>
        <IconButton name="information-circle-outline" onPress={openPeer} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {!messages ? (
          <ActivityIndicator color={colors.primary} style={{ flex: 1 }} />
        ) : (
          <FlatList
            data={messages}
            inverted
            keyExtractor={(m) => m.id}
            contentContainerStyle={{ padding: 16, gap: 4, flexGrow: 1 }}
            onEndReached={loadOlder}
            onEndReachedThreshold={0.5}
            ListEmptyComponent={
              <View style={styles.emptyChat}>
                <Avatar uri={peer?.avatar_url} size={72} ring />
                <Text style={styles.emptyName}>{peer?.display_name || peer?.username}</Text>
                <Text style={styles.emptyHint}>Say hi 👋 or share a video you love.</Text>
              </View>
            }
            renderItem={({ item, index }) => {
              const mine = item.sender_id === me;
              // Inverted list: the next item is the *earlier* message.
              const earlier = messages[index + 1];
              const showStamp = !earlier || new Date(item.created_at).getTime() - new Date(earlier.created_at).getTime() > GROUP_GAP_MS;
              return (
                <View>
                  {showStamp && <Text style={styles.stamp}>{stamp(item.created_at)}</Text>}
                  <View style={[styles.bubbleRow, mine && { justifyContent: 'flex-end' }]}>
                    <View style={{ maxWidth: '78%', gap: 4, alignItems: mine ? 'flex-end' : 'flex-start' }}>
                      {item.video_id && <VideoCard message={item} />}
                      {!!item.body && (
                        <View style={[styles.bubble, mine ? styles.mine : styles.theirs, item.id.startsWith('temp-') && { opacity: 0.6 }]}>
                          <Text style={styles.bubbleText}>{item.body}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              );
            }}
          />
        )}

        <View style={[styles.composer, { paddingBottom: insets.bottom + 10 }]}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Message…"
            placeholderTextColor={colors.textFaint}
            selectionColor={colors.primary}
            style={styles.input}
            multiline
            maxLength={2000}
          />
          <Pressable onPress={send} disabled={!text.trim()} style={[styles.send, { opacity: text.trim() ? 1 : 0.4 }]}>
            <Ionicons name="arrow-up" size={20} color={colors.text} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function VideoCard({ message }: { message: Message }) {
  const v = message.video;
  if (!v) {
    return (
      <View style={[styles.card, styles.cardGone]}>
        <Ionicons name="videocam-off-outline" size={18} color={colors.textMuted} />
        <Text style={{ color: colors.textMuted }}>Video unavailable</Text>
      </View>
    );
  }
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/watch', params: { source: JSON.stringify({ kind: 'single', videoId: v.id }) } })}
      style={styles.card}
    >
      <View style={styles.cardThumb}>
        {v.thumbnail_url ? (
          <Image source={v.thumbnail_url} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.primarySoft }]} />
        )}
        <Ionicons name="play" size={34} color="rgba(255,255,255,0.9)" />
      </View>
      <View style={styles.cardMeta}>
        <Avatar uri={v.author?.avatar_url} size={24} />
        <View style={{ flex: 1 }}>
          <Text style={styles.cardUser}>@{v.author?.username}</Text>
          {!!v.caption && (
            <Text style={styles.cardCaption} numberOfLines={1}>
              {v.caption}
            </Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, height: 60, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  headerPeer: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, marginLeft: 4 },
  headerName: { color: colors.text, fontSize: 16, fontWeight: '700' },
  headerHandle: { color: colors.textMuted, fontSize: 12 },
  stamp: { color: colors.textFaint, fontSize: 11, fontWeight: '600', textAlign: 'center', marginVertical: 12 },
  bubbleRow: { flexDirection: 'row', marginVertical: 2 },
  bubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.lg },
  mine: { backgroundColor: colors.primary, borderBottomRightRadius: 6 },
  theirs: { backgroundColor: colors.surfaceAlt, borderBottomLeftRadius: 6 },
  bubbleText: { color: colors.text, fontSize: 15, lineHeight: 21 },
  card: { width: 230, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surface },
  cardGone: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14 },
  cardThumb: { height: 260, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10 },
  cardUser: { color: colors.text, fontSize: 13, fontWeight: '700' },
  cardCaption: { color: colors.textMuted, fontSize: 12 },
  emptyChat: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, transform: [{ scaleY: -1 }] },
  emptyName: { color: colors.text, fontSize: 18, fontWeight: '700', marginTop: 6 },
  emptyHint: { color: colors.textMuted },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  input: { flex: 1, minHeight: 44, maxHeight: 120, backgroundColor: colors.surface, borderRadius: 22, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, color: colors.text, fontSize: 15 },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
});
