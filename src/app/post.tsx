import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Header, IconButton, type IconName } from '@/components/ui';
import { Alert } from '@/lib/alert';
import { publishVideo } from '@/lib/api';
import { emit } from '@/lib/events';
import { colors, radius } from '@/lib/theme';
import type { Visibility } from '@/lib/types';

const VISIBILITY: { value: Visibility; label: string; icon: IconName }[] = [
  { value: 'public', label: 'Everyone', icon: 'earth' },
  { value: 'followers', label: 'Followers', icon: 'people' },
  { value: 'private', label: 'Only me', icon: 'lock-closed' },
];

const MAX_CAPTION = 2200;

export default function PostScreen() {
  const params = useLocalSearchParams<{ uri: string; duration?: string; mimeType?: string }>();
  const player = useVideoPlayer(params.uri, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  const [caption, setCaption] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [allowComments, setAllowComments] = useState(true);
  const [step, setStep] = useState<string | null>(null);

  const insert = (token: string) => setCaption((c) => (c && !c.endsWith(' ') ? `${c} ${token}` : `${c}${token}`));

  const publish = async () => {
    setStep('Starting');
    player.pause();
    try {
      await publishVideo(
        {
          localUri: params.uri,
          caption,
          visibility,
          allowComments,
          duration: params.duration ? Number(params.duration) : null,
          mimeType: params.mimeType || null,
        },
        setStep,
      );
      emit('videoPublished', {});
      router.dismissAll();
      router.navigate('/profile');
    } catch (e) {
      setStep(null);
      player.play();
      Alert.alert('Upload failed', e instanceof Error ? e.message : String(e));
    }
  };

  const busy = step !== null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title="New post" left={<IconButton name="chevron-back" onPress={() => !busy && router.back()} />} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 20 }} keyboardShouldPersistTaps="handled">
          <View style={styles.top}>
            <View style={styles.preview}>
              <VideoView player={player} style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]} contentFit="cover" nativeControls={false} />
            </View>
            <View style={{ flex: 1, gap: 10 }}>
              <TextInput
                value={caption}
                onChangeText={(t) => setCaption(t.slice(0, MAX_CAPTION))}
                placeholder="Describe your video… add #hashtags so people can find it"
                placeholderTextColor={colors.textFaint}
                selectionColor={colors.primary}
                multiline
                style={styles.caption}
              />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Chip icon="pricetag-outline" label="Hashtag" onPress={() => insert('#')} />
                <Chip icon="at" label="Mention" onPress={() => insert('@')} />
              </View>
              <Text style={styles.counter}>
                {caption.length} / {MAX_CAPTION}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={{ gap: 10 }}>
            <Text style={styles.label}>WHO CAN WATCH</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {VISIBILITY.map((v) => (
                <Pressable key={v.value} onPress={() => setVisibility(v.value)} style={[styles.option, visibility === v.value && styles.optionActive]}>
                  <Ionicons name={v.icon} size={18} color={visibility === v.value ? colors.text : colors.textMuted} />
                  <Text style={[styles.optionText, visibility === v.value && { color: colors.text }]}>{v.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.toggleRow}>
            <Text style={styles.toggleText}>Allow comments</Text>
            <Switch value={allowComments} onValueChange={setAllowComments} trackColor={{ true: colors.primary, false: colors.surfaceAlt }} thumbColor={colors.text} />
          </View>

          <View style={styles.notice}>
            <Ionicons name="shield-checkmark-outline" size={18} color={colors.primary} />
            <Text style={styles.noticeText}>Posts must follow the VYBE community guidelines. Reported videos are reviewed by our team.</Text>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Button title={busy ? `${step}…` : 'Post now'} icon="paper-plane" onPress={publish} loading={busy} style={{ flex: 1 }} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Chip({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.chip}>
      <Ionicons name={icon} size={14} color={colors.text} />
      <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', gap: 14 },
  preview: { width: 112, height: 180, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surface },
  caption: { color: colors.text, fontSize: 16, lineHeight: 22, minHeight: 100, textAlignVertical: 'top' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.surfaceAlt, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 7 },
  counter: { color: colors.textFaint, fontSize: 12, alignSelf: 'flex-end' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  label: { color: colors.textMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  option: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: 14, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  optionActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  optionText: { color: colors.textMuted, fontWeight: '600', fontSize: 13 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleText: { color: colors.text, fontSize: 16 },
  notice: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: radius.md, borderWidth: 1, borderColor: 'rgba(139,92,246,0.35)', backgroundColor: 'rgba(139,92,246,0.08)' },
  noticeText: { flex: 1, color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  footer: { padding: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
});
