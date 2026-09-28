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
import { colors, fonts, radius, spacing } from '../theme/tokens'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const SIDEBAR_WIDTH = SCREEN_WIDTH * 0.72

type Props = {
  visible: boolean
  activeTab: 'dashboard' | 'feed' | 'rides' | 'map'
  user: User | null
  onClose: () => void
  onTabChange: (tab: 'dashboard' | 'feed' | 'rides' | 'map') => void
  onLogout: () => void
  onProfilePress: () => void
  onAbout: () => void
}

const NAV_ITEMS: { key: 'dashboard' | 'feed' | 'rides' | 'map'; label: string; icon: string }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: 'grid-outline' },
  { key: 'rides', label: 'Rides', icon: 'bicycle-outline' },
  { key: 'feed', label: 'Feed', icon: 'images-outline' },
  { key: 'map', label: 'Map', icon: 'map-outline' },
]

export default function AppSidebar({ visible, activeTab, user, onClose, onTabChange, onLogout, onProfilePress, onAbout }: Props) {
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
            <Ionicons name="close" size={22} color={colors.textMuted} />
          </TouchableOpacity>

          {/* Profile section */}
          <TouchableOpacity
            style={styles.profileSection}
            onPress={() => {
              onProfilePress()
              onClose()
            }}
            activeOpacity={0.7}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
            <Text style={styles.profileName} numberOfLines={1}>{profileName}</Text>
            {profileEmail ? (
              <Text style={styles.profileEmail} numberOfLines={1}>{profileEmail}</Text>
            ) : null}
          </TouchableOpacity>

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
                      color={isActive ? colors.signal : colors.textSecondary}
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

          {/* About */}
          <TouchableOpacity
            style={styles.navItem}
            onPress={() => {
              onAbout()
              onClose()
            }}
            activeOpacity={0.7}
          >
            <View style={styles.navIconWrap}>
              <Ionicons name="information-circle-outline" size={20} color={colors.textSecondary} />
            </View>
            <Text style={styles.navLabel}>About</Text>
          </TouchableOpacity>

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
              <Ionicons name="log-out-outline" size={20} color={colors.severe} />
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
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
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
    backgroundColor: colors.surfaceRaised,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 40,
    paddingHorizontal: spacing.xl,
    borderRightWidth: 1,
    borderRightColor: colors.hairline,
    shadowColor: colors.background,
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 20,
  },
  closeBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 34,
    right: spacing.md,
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.hairline,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  // User block — surface card with hairline
  profileSection: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    marginTop: spacing.xxl,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.signalDim,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.signalLine,
  },
  avatarText: {
    color: colors.signal,
    fontFamily: fonts.extrabold,
    fontSize: 22,
  },
  profileName: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 17,
    textAlign: 'center',
  },
  profileEmail: {
    color: colors.textMuted,
    fontFamily: fonts.mono,
    fontSize: 12,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: colors.hairline,
    marginVertical: spacing.sm,
  },
  navSection: {
    gap: spacing.xs,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    gap: spacing.md,
  },
  navItemActive: {
    backgroundColor: colors.signalDim,
  },
  navIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.hairline,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navIconWrapActive: {
    backgroundColor: colors.signalDim,
  },
  navLabel: {
    color: colors.textSecondary,
    fontFamily: fonts.semibold,
    fontSize: 14,
    flex: 1,
  },
  navLabelActive: {
    color: colors.signal,
  },
  navActiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.signal,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    gap: spacing.md,
  },
  logoutIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.severeDim,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutText: {
    color: colors.severe,
    fontFamily: fonts.semibold,
    fontSize: 14,
  },
  // Brand tag
  version: {
    color: colors.textMuted,
    fontFamily: fonts.extrabold,
    fontSize: 11,
    letterSpacing: 0.5,
    textAlign: 'center',
    marginTop: spacing.md,
  },
})
