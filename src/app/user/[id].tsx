import { router, useLocalSearchParams } from 'expo-router';

import { ProfileView } from '@/components/ProfileView';
import { IconButton } from '@/components/ui';

export default function UserScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ProfileView userId={id} headerLeft={<IconButton name="chevron-back" onPress={() => router.back()} />} />;
}
