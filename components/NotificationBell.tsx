import { memo } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useNotifications } from '../lib/useNotifications'
import { colors, fonts, radius } from '../theme/tokens'

interface NotificationBellProps {
  userId: string
  onPress: () => void
}

/** Bell icon with live unread badge. Renders plain bell when signed out. */
export const NotificationBell = memo(function NotificationBell({ userId, onPress }: NotificationBellProps) {
  const { unread } = useNotifications(userId)
  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.btn}
      activeOpacity={0.7}
      accessibilityLabel={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
    >
      <Ionicons name="notifications-outline" size={19} color={colors.textPrimary} />
      {unread > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unread > 99 ? '99+' : String(unread)}</Text>
        </View>
      )}
    </TouchableOpacity>
  )
})

const styles = StyleSheet.create({
  btn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.hairline,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.severe,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#FFFFFF',
    fontFamily: fonts.bold,
    fontSize: 9,
    lineHeight: 12,
  },
})
