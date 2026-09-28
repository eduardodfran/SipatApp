import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { colors, fonts, radius, spacing } from '../theme/tokens'

type Props = {
  active: 'dashboard' | 'feed'
  onTabChange: (tab: 'dashboard' | 'feed') => void
}

export default function AppTabBar({ active, onTabChange }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, active === 'dashboard' && styles.tabActive]}
          onPress={() => onTabChange('dashboard')}
        >
          <Text style={[styles.tabText, active === 'dashboard' && styles.tabTextActive]}>
            Dashboard
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, active === 'feed' && styles.tabActive]}
          onPress={() => onTabChange('feed')}
        >
          <Text style={[styles.tabText, active === 'feed' && styles.tabTextActive]}>
            Feed
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
    paddingHorizontal: spacing.lg,
    paddingBottom: 10,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: colors.hairline,
    borderRadius: 10,
    padding: 3,
    gap: 3,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  tabActive: {
    backgroundColor: colors.signal,
  },
  tabText: {
    color: colors.textMuted,
    fontSize: 13,
    fontFamily: fonts.semibold,
  },
  tabTextActive: {
    color: colors.onSignal,
  },
})
