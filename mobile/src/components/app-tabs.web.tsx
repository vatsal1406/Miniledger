import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BorderRadius, Colors, MaxContentWidth, Spacing } from '@/constants/theme';

export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="home" href="/" asChild>
            <TabButton>🏠 Home</TabButton>
          </TabTrigger>
          <TabTrigger name="loans" href="/loans" asChild>
            <TabButton>📋 Loans</TabButton>
          </TabTrigger>
          <TabTrigger name="add-loan" href="/add-loan" asChild>
            <TabButton>➕ Add Loan</TabButton>
          </TabTrigger>
          <TabTrigger name="profile" href="/profile" asChild>
            <TabButton>👤 Profile</TabButton>
          </TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

export function TabButton({ children, isFocused, ...props }: TabTriggerSlotProps) {
  return (
    <Pressable {...(props as any)} style={({ pressed }) => [styles.tabPressable, pressed && styles.pressed]}>
      <View
        style={[
          styles.tabButtonView,
          isFocused ? styles.tabFocused : styles.tabUnfocused,
        ]}>
        <Text
          style={[
            styles.tabText,
            isFocused ? styles.textFocused : styles.textUnfocused,
          ]}>
          {children}
        </Text>
      </View>
    </Pressable>
  );
}

export function CustomTabList(props: TabListProps) {
  return (
    <View {...props} style={styles.tabListContainer}>
      <View style={styles.innerContainer}>
        {/* Brand */}
        <View style={styles.brandRow}>
          <View style={styles.brandBadge}>
            <Text style={styles.brandSymbol}>₹</Text>
          </View>
          <Text style={styles.brandText}>MiniLedger</Text>
        </View>

        <View style={styles.triggersRow}>{props.children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabListContainer: {
    position: 'fixed' as any,
    bottom: 0,
    left: 0,
    right: 0,
    width: '100%',
    padding: Spacing.two,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
    pointerEvents: 'box-none' as any,
  },
  innerContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    backdropFilter: 'blur(16px)' as any,
    paddingVertical: Spacing.one + 2,
    paddingHorizontal: Spacing.three,
    borderRadius: BorderRadius.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 680,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
    gap: Spacing.two,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + 2,
    paddingHorizontal: Spacing.one,
  },
  brandBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandSymbol: {
    color: '#10B981',
    fontWeight: '800',
    fontSize: 14,
  },
  brandText: {
    fontWeight: '800',
    fontSize: 15,
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  triggersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  tabPressable: {
    borderRadius: BorderRadius.md,
  },
  pressed: {
    opacity: 0.75,
  },
  tabButtonView: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.one + 2,
    paddingHorizontal: Spacing.two + 4,
    borderRadius: BorderRadius.md,
    gap: 6,
  },
  tabFocused: {
    backgroundColor: '#0F172A',
  },
  tabUnfocused: {
    backgroundColor: 'transparent',
  },
  tabHighlightFocused: {
    backgroundColor: '#0D9488',
  },
  tabIcon: {
    fontSize: 14,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  textFocused: {
    color: '#FFFFFF',
  },
  textUnfocused: {
    color: '#64748B',
  },
  textHighlight: {
    fontWeight: '700',
  },
});
