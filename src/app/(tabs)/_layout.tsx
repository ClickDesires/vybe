import { useFocusEffect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { useCallback, useEffect, useState } from 'react';

import { TabBar } from '@/components/TabBar';
import { subscribeInserts, unreadMessageCount, unreadNotificationCount } from '@/lib/api';
import { on } from '@/lib/events';
import { colors } from '@/lib/theme';
import { useAuth } from '@/providers/AuthProvider';

export default function TabsLayout() {
  const { session } = useAuth();
  const [notifications, setNotifications] = useState(0);
  const [chats, setChats] = useState(0);

  const refreshNotifications = useCallback(() => {
    unreadNotificationCount().then(setNotifications).catch(() => {});
  }, []);
  const refreshChats = useCallback(() => {
    unreadMessageCount().then(setChats).catch(() => {});
  }, []);
  const refreshAll = useCallback(() => {
    refreshNotifications();
    refreshChats();
  }, [refreshNotifications, refreshChats]);

  useFocusEffect(refreshAll);
  useEffect(() => on('messagesRead', refreshChats), [refreshChats]);

  // Live badge: notifications and messages arrive over Supabase Realtime (RLS limits events to mine).
  useEffect(() => {
    const me = session?.user.id;
    if (!me) return;
    const offs = [
      subscribeInserts('notifications', `recipient_id=eq.${me}`, refreshNotifications),
      subscribeInserts<{ sender_id: string }>('messages', undefined, (row) => {
        if (row.sender_id !== me) refreshChats();
      }),
    ];
    return () => offs.forEach((off) => off());
  }, [session?.user.id, refreshNotifications, refreshChats]);

  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} badges={{ inbox: notifications + chats }} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}
      screenListeners={({ route }) => ({
        tabPress: () => {
          // Opening Alerts marks notifications read; unread chats keep counting until opened.
          if (route.name === 'inbox') setNotifications(0);
        },
      })}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="discover" />
      <Tabs.Screen name="inbox" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
