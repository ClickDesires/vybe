import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, useMicrophonePermissions, type CameraType } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { router, useIsFocused } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, IconButton, type IconName } from '@/components/ui';
import { colors, radius } from '@/lib/theme';

const LIMITS = [15, 60, 180] as const;
const TIMERS = [0, 3, 10] as const;

export default function CameraScreen() {
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const camera = useRef<CameraView>(null);
  const [camPerm, requestCam] = useCameraPermissions();
  const [micPerm, requestMic] = useMicrophonePermissions();

  const [facing, setFacing] = useState<CameraType>('front');
  const [torch, setTorch] = useState(false);
  const [limit, setLimit] = useState<(typeof LIMITS)[number]>(60);
  const [timer, setTimer] = useState<(typeof TIMERS)[number]>(0);
  const [ready, setReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const startedAt = useRef(0);

  // Recording clock for the progress bar.
  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setElapsed((Date.now() - startedAt.current) / 1000), 100);
    return () => clearInterval(t);
  }, [recording]);

  if (!camPerm || !micPerm) return <View style={styles.black} />;

  if (!camPerm.granted || !micPerm.granted) {
    const blocked = (!camPerm.granted && !camPerm.canAskAgain) || (!micPerm.granted && !micPerm.canAskAgain);
    return (
      <View style={[styles.black, styles.permission, { paddingTop: insets.top }]}>
        <IconButton name="close" onPress={() => router.back()} style={{ position: 'absolute', top: insets.top + 8, left: 12 }} />
        <Ionicons name="videocam" size={48} color={colors.primary} />
        <Text style={styles.permTitle}>Let’s get you filming</Text>
        <Text style={styles.permBody}>VYBE needs your camera and microphone to record videos with sound.</Text>
        <Button
          title={blocked ? 'Open settings' : 'Allow access'}
          onPress={async () => {
            if (blocked) return Linking.openSettings();
            await requestCam();
            await requestMic();
          }}
        />
        <Button title="Upload from library instead" variant="ghost" onPress={pickFromLibrary} />
      </View>
    );
  }

  const begin = async () => {
    if (!camera.current || !ready) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    startedAt.current = Date.now();
    setElapsed(0);
    setRecording(true);
    try {
      const result = await camera.current.recordAsync({ maxDuration: limit });
      const seconds = (Date.now() - startedAt.current) / 1000;
      if (result?.uri && seconds >= 1) {
        router.push({ pathname: '/post', params: { uri: result.uri, duration: String(Math.round(seconds)) } });
      }
    } catch (e) {
      console.warn('recording failed', e);
    } finally {
      setRecording(false);
      setElapsed(0);
    }
  };

  const onShutter = () => {
    if (recording) return camera.current?.stopRecording();
    if (countdown) return;
    if (!timer) return begin();
    let left: number = timer;
    setCountdown(left);
    const t = setInterval(() => {
      left -= 1;
      setCountdown(left);
      if (left <= 0) {
        clearInterval(t);
        begin();
      }
    }, 1000);
  };

  const cycle = <T,>(list: readonly T[], value: T) => list[(list.indexOf(value) + 1) % list.length];

  return (
    <View style={styles.black}>
      {focused && (
        <CameraView
          ref={camera}
          style={StyleSheet.absoluteFill}
          facing={facing}
          mode="video"
          enableTorch={torch}
          onCameraReady={() => setReady(true)}
        />
      )}

      {/* Recording progress */}
      <View style={[styles.progressTrack, { top: insets.top + 4 }]}>
        <View style={[styles.progressFill, { width: `${Math.min(1, elapsed / limit) * 100}%` }]} />
      </View>

      {/* Top bar */}
      <View style={[styles.topBar, { top: insets.top + 14 }]}>
        {!recording && <IconButton name="close" size={26} onPress={() => router.back()} style={styles.roundDark} />}
        <View style={styles.timePill}>
          {recording && <View style={styles.recDot} />}
          <Text style={styles.timeText}>{recording ? `${elapsed.toFixed(1)}s` : `Max ${limit}s`}</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {/* Side tools */}
      {!recording && (
        <View style={[styles.tools, { top: insets.top + 70 }]}>
          <Tool icon="camera-reverse-outline" label="Flip" onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))} />
          <Tool icon={torch ? 'flash' : 'flash-off-outline'} label="Flash" active={torch} onPress={() => setTorch((t) => !t)} />
          <Tool icon="timer-outline" label={timer ? `${timer}s` : 'Timer'} active={!!timer} onPress={() => setTimer(cycle(TIMERS, timer))} />
          <Tool icon="hourglass-outline" label={`${limit}s`} onPress={() => setLimit(cycle(LIMITS, limit))} />
        </View>
      )}

      {countdown > 0 && (
        <View style={styles.countdown} pointerEvents="none">
          <Text style={styles.countdownText}>{countdown}</Text>
        </View>
      )}

      {/* Bottom controls */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.side}>
          {!recording && (
            <Pressable onPress={pickFromLibrary} style={styles.sideButton}>
              <View style={styles.uploadIcon}>
                <Ionicons name="images" size={22} color={colors.text} />
              </View>
              <Text style={styles.sideLabel}>Upload</Text>
            </Pressable>
          )}
        </View>
        <Pressable onPress={onShutter} style={styles.shutterOuter} accessibilityLabel={recording ? 'Stop recording' : 'Start recording'}>
          <View style={[styles.shutterInner, recording && styles.shutterRecording]} />
        </Pressable>
        <View style={styles.side} />
      </View>
    </View>
  );
}

async function pickFromLibrary() {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['videos'],
    videoMaxDuration: 180,
    quality: 1,
  });
  if (result.canceled || !result.assets[0]) return;
  const a = result.assets[0];
  router.push({
    pathname: '/post',
    params: {
      uri: a.uri,
      duration: a.duration ? String(Math.round(a.duration / 1000)) : '',
      mimeType: a.mimeType ?? '',
    },
  });
}

function Tool({ icon, label, onPress, active }: { icon: IconName; label: string; onPress: () => void; active?: boolean }) {
  return (
    <Pressable onPress={onPress} style={styles.tool}>
      <View style={[styles.toolIcon, active && { backgroundColor: colors.primary }]}>
        <Ionicons name={icon} size={22} color={colors.text} />
      </View>
      <Text style={styles.toolLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  black: { flex: 1, backgroundColor: '#000' },
  permission: { alignItems: 'center', justifyContent: 'center', padding: 28, gap: 14 },
  permTitle: { color: colors.text, fontSize: 22, fontWeight: '800', marginTop: 8 },
  permBody: { color: colors.textMuted, textAlign: 'center', lineHeight: 21, marginBottom: 8 },
  progressTrack: { position: 'absolute', left: 12, right: 12, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' },
  progressFill: { height: 4, backgroundColor: colors.lime },
  topBar: { position: 'absolute', left: 12, right: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  roundDark: { backgroundColor: colors.overlay, borderRadius: 18 },
  timePill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.overlay, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 7 },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.like },
  timeText: { color: colors.text, fontWeight: '700' },
  tools: { position: 'absolute', right: 12, gap: 16, alignItems: 'center' },
  tool: { alignItems: 'center', gap: 4 },
  toolIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center' },
  toolLabel: { color: colors.text, fontSize: 11, fontWeight: '600' },
  countdown: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  countdownText: { color: colors.text, fontSize: 120, fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 20 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  side: { width: 80, alignItems: 'center' },
  sideButton: { alignItems: 'center', gap: 6 },
  uploadIcon: { width: 44, height: 44, borderRadius: 10, borderWidth: 2, borderColor: colors.text, alignItems: 'center', justifyContent: 'center' },
  sideLabel: { color: colors.text, fontSize: 12, fontWeight: '600' },
  shutterOuter: { width: 84, height: 84, borderRadius: 42, borderWidth: 5, borderColor: colors.text, alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primary },
  shutterRecording: { width: 32, height: 32, borderRadius: 8, backgroundColor: colors.like },
});
