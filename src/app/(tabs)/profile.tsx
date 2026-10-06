import { ProfileView } from '@/components/ProfileView';
import { useAuth } from '@/providers/AuthProvider';

export default function MyProfileScreen() {
  const { session } = useAuth();
  if (!session) return null;
  return <ProfileView userId={session.user.id} />;
}
