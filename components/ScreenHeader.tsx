import { ReactNode } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, fonts, radius, spacing } from '../theme/tokens'

type Props = {
  onBack: () => void
  /** Centered screen title. Omit when using children (e.g. inline search input). */
  title?: string
  /** Content rendered after the back button (gets its own layout, e.g. a flexed input). */
  children?: ReactNode
  /** Trailing action button(s). */
  right?: ReactNode
}

// Shared back-header used by Profile, About, FeedDetail, PublicProfile, Search.
export default function ScreenHeader({ onBack, title, children, right }: Props) {
  const insets = useSafeAreaInsets()
  return (
    <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
      <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
        <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
      </TouchableOpacity>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {children}
      {right ?? (title && !children ? <View style={styles.slot} /> : null)}
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
  backBtn: {
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
    textAlign: 'center',
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.textPrimary,
  },
  slot: {
    width: 40,
  },
})
