import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

type Props = {
  active: 'dashboard' | 'feed'
  onTabChange: (tab: 'dashboard' | 'feed') => void
}

export default function AppTabBar({ active, onTabChange }: Props) {
  return (
    <View style={styles.container}>
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
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#0c0c14',
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
    gap: 4,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  tabActive: {
    backgroundColor: 'rgba(230, 168, 23, 0.12)',
  },
  tabText: {
    color: '#52525b',
    fontSize: 14,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#e6a817',
  },
})
