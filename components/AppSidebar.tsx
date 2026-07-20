import { useEffect, useRef } from 'react'
import {
  Animated,
  Dimensions,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { User } from '@supabase/supabase-js'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const SIDEBAR_WIDTH = SCREEN_WIDTH * 0.72

type Props = {
  visible: boolean
  activeTab: 'dashboard' | 'feed' | 'rides'
  user: User | null
  onClose: () => void
  onTabChange: (tab: 'dashboard' | 'feed' | 'rides') => void
  onLogout: () => void
}

const NAV_ITEMS: { key: 'dashboard' | 'feed' | 'rides'; label: string; icon: string }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: 'grid-outline' },
  { key: 'rides', label: 'Rides', icon: 'bicycle-outline' },
  { key: 'feed', label: 'Feed', icon: 'images-outline' },
]

export default function AppSidebar({ visible, activeTab, user, onClose, onTabChange, onLogout }: Props) {
  const slideAnim = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current
  const fadeAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start()
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -SIDEBAR_WIDTH,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start()
    }
  }, [visible])

  const profileName = user?.user_metadata?.username ?? user?.email?.split('@')[0] ?? 'User'
  const profileEmail = user?.email ?? ''
  const initial = profileName.charAt(0).toUpperCase()

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.container}>
        {/* Backdrop */}
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
          <TouchableOpacity style={styles.backdropTouch} onPress={onClose} activeOpacity={1} />
        </Animated.View>

        {/* Sidebar */}
        <Animated.View style={[styles.sidebar, { transform: [{ translateX: slideAnim }] }]}>
          {/* Close button */}
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
            <Ionicons name="close" size={22} color="#6b7280" />
          </TouchableOpacity>

          {/* Profile section */}
          <View style={styles.profileSection}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
            <Text style={styles.profileName} numberOfLines={1}>{profileName}</Text>
            {profileEmail ? (
              <Text style={styles.profileEmail} numberOfLines={1}>{profileEmail}</Text>
            ) : null}
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Navigation items */}
          <View style={styles.navSection}>
            {NAV_ITEMS.map((item) => {
              const isActive = activeTab === item.key
              return (
                <TouchableOpacity
                  key={item.key}
                  style={[styles.navItem, isActive && styles.navItemActive]}
                  onPress={() => {
                    onTabChange(item.key)
                    onClose()
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.navIconWrap, isActive && styles.navIconWrapActive]}>
                    <Ionicons
                      name={item.icon as any}
                      size={20}
                      color={isActive ? '#e6a817' : '#6b7280'}
                    />
                  </View>
                  <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>
                    {item.label}
                  </Text>
                  {isActive && <View style={styles.navActiveDot} />}
                </TouchableOpacity>
              )
            })}
          </View>

          {/* Spacer */}
          <View style={{ flex: 1 }} />

          {/* Divider */}
          <View style={styles.divider} />

          {/* Logout */}
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={() => {
              onLogout()
              onClose()
            }}
            activeOpacity={0.7}
          >
            <View style={styles.logoutIconWrap}>
              <Ionicons name="log-out-outline" size={20} color="#dc2626" />
            </View>
            <Text style={styles.logoutText}>Sign Out</Text>
          </TouchableOpacity>

          {/* Version */}
          <Text style={styles.version}>Sipat v1.0</Text>
        </Animated.View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  backdropTouch: {
    flex: 1,
  },
  sidebar: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: SIDEBAR_WIDTH,
    backgroundColor: '#111118',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 40,
    paddingHorizontal: 20,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.04)',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 20,
  },
  closeBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 34,
    right: 14,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.04)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 20,
    marginTop: 10,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(230, 168, 23, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'rgba(230, 168, 23, 0.2)',
  },
  avatarText: {
    color: '#e6a817',
    fontSize: 22,
    fontWeight: '800',
  },
  profileName: {
    color: '#f0f0f0',
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  profileEmail: {
    color: '#6b7280',
    fontSize: 12,
    marginTop: 3,
    textAlign: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    marginVertical: 8,
  },
  navSection: {
    gap: 4,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 12,
  },
  navItemActive: {
    backgroundColor: 'rgba(230, 168, 23, 0.08)',
  },
  navIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  navIconWrapActive: {
    backgroundColor: 'rgba(230, 168, 23, 0.12)',
  },
  navLabel: {
    color: '#a1a1aa',
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  navLabelActive: {
    color: '#f0f0f0',
    fontWeight: '700',
  },
  navActiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#e6a817',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 12,
  },
  logoutIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(222, 38, 38, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutText: {
    color: '#dc2626',
    fontSize: 15,
    fontWeight: '600',
  },
  version: {
    color: '#374151',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 12,
    fontWeight: '500',
  },
})
