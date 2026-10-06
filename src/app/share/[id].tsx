import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, Button, type IconName } from '@/components/ui';
import { fetchShareTargets, fetchVideo, shareVideoTo } from '@/lib/api';
import { colors, radius } from '@/lib/theme';
import type { FeedVideo, Profile } from '@/lib/types';

type Target = Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'>;

export default function ShareSheet() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [video, setVideo] = useState<FeedVideo | null>(null);
  const [targets, setTargets] = useState<Target[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchVideo(id).then(setVideo).catch(() => {});
    fetchShareTargets().then(setTargets).catch(() => setTargets([]));
  }, [id]);

  const toggle = (uid: string) => {
    Haptics.selectionAsync().catch(() => {});
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  const send = async () => {
    setSending(true);
    // Send to everyone selected; one failure (e.g. a block) shouldn't stop the rest.
    await Promise.allSettled([...selected].map((uid) => shareVideoTo(uid, id, note.trim() || undefined)));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    router.back();
  };

  const systemShare = () => {
    if (!video) return;
    Share.share({ message: `Watch @${video.username} on VYBE: ${video.caption}\n${video.video_url}` }).catch(() => {});
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, paddingTop: 20, paddingBottom: insets.bottom + 12 }}>
      <Text style={styles.title}>Send to</Text>

      {!targets ? (
        <ActivityIndicator color={colors.primary} style={{ marginVertical: 32 }} />
      ) : targets.length === 0 ? (
        <Text style={styles.empty}>Follow people to send them videos.</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.people}>
          {targets.map((t) => {
            const on = selected.has(t.id);
            return (
              <Pressable key={t.id} onPress={() => toggle(t.id)} style={styles.person}>
                <View>
                  <Avatar uri={t.avatar_url} size={60} />
                  {on && (
                    <View style={styles.check}>
                      <Ionicons name="checkmark" size={14} color={colors.limeText} />
                    </View>
                  )}
                </View>
                <Text style={[styles.personName, on && { color: colors.text }]} numberOfLines={1}>
                  {t.display_name || t.username}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {selected.size > 0 ? (
        <View style={styles.sendRow}>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Add a message…"
            placeholderTextColor={colors.textFaint}
            selectionColor={colors.primary}
            style={styles.note}
          />
          <Button title={`Send${selected.size > 1 ? ` (${selected.size})` : ''}`} onPress={send} loading={sending} />
        </View>
      ) : (
        <View style={styles.actions}>
          <Action icon="share-outline" label="More apps" onPress={systemShare} />
          <Action icon="chatbubbles-outline" label="New chat" onPress={() => router.replace('/messages/new')} />
        </View>
      )}
    </View>
  );
}

function Action({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.action}>
      <View style={styles.actionIcon}>
        <Ionicons name={icon} size={22} color={colors.text} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 16, fontWeight: '700', textAlign: 'center', marginBottom: 16 },
  empty: { color: colors.textMuted, textAlign: 'center', marginVertical: 28 },
  people: { paddingHorizontal: 16, gap: 16, paddingBottom: 8 },
  person: { width: 68, alignItems: 'center', gap: 6 },
  personName: { color: colors.textMuted, fontSize: 12 },
  check: { position: 'absolute', right: -2, bottom: -2, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.surface },
  sendRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginTop: 16, alignItems: 'center' },
  note: { flex: 1, height: 50, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, paddingHorizontal: 14, color: colors.text, fontSize: 15 },
  actions: { flexDirection: 'row', gap: 20, paddingHorizontal: 16, marginTop: 20, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: 18 },
  action: { alignItems: 'center', gap: 6, width: 68 },
  actionIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { color: colors.textMuted, fontSize: 12 },
});
