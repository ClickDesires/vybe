import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { IconName } from '@/components/ui';
import { colors, TAB_BAR_HEIGHT } from '@/lib/theme';

const TABS: Record<string, { label: string; icon: IconName; iconActive: IconName }> = {
  index: { label: 'Home', icon: 'home-outline', iconActive: 'home' },
  discover: { label: 'Discover', icon: 'compass-outline', iconActive: 'compass' },
  inbox: { label: 'Alerts', icon: 'notifications-outline', iconActive: 'notifications' },
  profile: { label: 'Profile', icon: 'person-outline', iconActive: 'person' },
};

export function TabBar({ state, navigation, badges }: BottomTabBarProps & { badges?: Record<string, number> }) {
  const insets = useSafeAreaInsets();
  const routes = state.routes.filter((r) => TABS[r.name]);
  const left = routes.slice(0, 2);
  const right = routes.slice(2);

  const renderTab = (route: (typeof routes)[number]) => {
    const focused = state.routes[state.index]?.key === route.key;
    const meta = TABS[route.name];
    const badge = badges?.[route.name] ?? 0;
    return (
      <Pressable
        key={route.key}
        style={styles.tab}
        onPress={() => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        }}
      >
        <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
          <Ionicons name={focused ? meta.iconActive : meta.icon} size={22} color={focused ? colors.text : colors.textMuted} />
          {badge > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
            </View>
          )}
        </View>
        <Text style={[styles.label, focused && styles.labelActive]}>{meta.label}</Text>
      </Pressable>
    );
  };

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom, height: TAB_BAR_HEIGHT + insets.bottom }]}>
      {left.map(renderTab)}
      <Pressable style={styles.tab} onPress={() => router.push('/camera')} accessibilityLabel="Create video">
        {({ pressed }) => (
          <View style={[styles.create, { transform: [{ scale: pressed ? 0.92 : 1 }] }]}>
            <Ionicons name="add" size={28} color={colors.limeText} />
          </View>
        )}
      </Pressable>
      {right.map(renderTab)}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  iconWrap: { width: 34, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  iconWrapActive: { backgroundColor: colors.primarySoft },
  label: { color: colors.textMuted, fontSize: 11, fontWeight: '500' },
  labelActive: { color: colors.text, fontWeight: '700' },
  create: { width: 48, height: 36, borderRadius: 12, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: -2,
    right: -6,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.like,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: colors.text, fontSize: 10, fontWeight: '800' },
});
