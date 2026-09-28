import { ReactNode } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, fonts, radius, spacing } from '../theme/tokens'

type Props = {
  title: string
  onMenuPress: () => void
  /** Trailing action button(s). */
  right?: ReactNode
  /** 'left': title next to the menu button (Rides). 'center': title centered with brand dot (Feed). */
  variant?: 'left' | 'center'
}

// Shared hamburger-header used by Feed and Rides (Dashboard keeps its custom one).
export default function MenuHeader({ title, onMenuPress, right, variant = 'left' }: Props) {
  const insets = useSafeAreaInsets()
  return (
    <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
      <TouchableOpacity onPress={onMenuPress} style={styles.iconBtn} activeOpacity={0.7}>
        <Ionicons name="menu" size={20} color={colors.textPrimary} />
      </TouchableOpacity>
      {variant === 'center' ? (
        <View style={styles.centerWrap}>
          <Text style={styles.titleCenter}>{title}</Text>
          <View style={styles.dot} />
        </View>
      ) : (
        <Text style={styles.title}>{title}</Text>
      )}
      {right ?? <View style={styles.slot} />}
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.hairline,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  title: {
    flex: 1,
    fontFamily: fonts.extrabold,
    fontSize: 20,
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  centerWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  titleCenter: {
    fontFamily: fonts.extrabold,
    fontSize: 17,
    color: colors.textPrimary,
    letterSpacing: 0.4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.signal,
  },
  slot: {
    width: 40,
  },
})
