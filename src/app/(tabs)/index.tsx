import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Feed } from '@/components/Feed';
import { Button, EmptyState } from '@/components/ui';
import { colors } from '@/lib/theme';

type Tab = 'following' | 'forYou';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('forYou');

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {/* Both feeds stay mounted so switching tabs keeps your place. */}
      <View style={[StyleSheet.absoluteFill, tab !== 'forYou' && styles.hidden]}>
        <Feed
          source={{ kind: 'forYou' }}
          enabled={tab === 'forYou'}
          empty={
            <EmptyState
              icon="sparkles"
              title="Nothing here yet"
              body="Be the first to post something to VYBE."
              action={<Button title="Record a video" variant="lime" icon="videocam" onPress={() => router.push('/camera')} />}
            />
          }
        />
      </View>
      {tab === 'following' && (
        <View style={StyleSheet.absoluteFill}>
          <Feed
            source={{ kind: 'following' }}
            empty={
              <EmptyState
                icon="people"
                title="Follow creators you love"
                body="Videos from people you follow show up here, newest first."
                action={<Button title="Discover creators" icon="compass" onPress={() => router.navigate('/discover')} />}
              />
            }
          />
        </View>
      )}

      <View style={[styles.topBar, { top: insets.top + 6 }]} pointerEvents="box-none">
        {(['following', 'forYou'] as const).map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} hitSlop={10} style={styles.topTab}>
            <Text style={[styles.topTabText, tab === t && styles.topTabActive]}>{t === 'forYou' ? 'For You' : 'Following'}</Text>
            <View style={[styles.underline, tab !== t && { opacity: 0 }]} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hidden: { opacity: 0, pointerEvents: 'none' },
  topBar: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 28 },
  topTab: { alignItems: 'center', gap: 6 },
  topTabText: { color: 'rgba(255,255,255,0.6)', fontSize: 17, fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.4)', textShadowRadius: 6 },
  topTabActive: { color: colors.text },
  underline: { width: 24, height: 3, borderRadius: 2, backgroundColor: colors.lime },
});
