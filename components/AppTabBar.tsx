import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

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
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: '#0c0c14',
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 10,
    padding: 3,
    gap: 3,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: '#06b6d4',
  },
  tabText: {
    color: '#71717a',
    fontSize: 13,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#0c0c14',
  },
})
