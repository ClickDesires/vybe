import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Feed } from '@/components/Feed';
import { EmptyState, IconButton } from '@/components/ui';
import type { FeedSource } from '@/lib/api';

/** Full-screen swipeable player for a set of videos (a profile, saved list, hashtag...). */
export default function WatchScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ source: string; start?: string }>();
  const source = useMemo<FeedSource>(() => {
    try {
      return JSON.parse(params.source);
    } catch {
      return { kind: 'forYou' };
    }
  }, [params.source]);

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <Feed source={source} startAtId={params.start} empty={<EmptyState icon="videocam-off-outline" title="This video isn’t available" />} />
      <IconButton
        name="chevron-back"
        size={28}
        onPress={() => router.back()}
        style={{ position: 'absolute', top: insets.top + 6, left: 10 }}
      />
    </View>
  );
}
