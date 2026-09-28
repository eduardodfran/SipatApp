import { StyleSheet, View } from 'react-native'
import { spacing } from '../theme/tokens'

// Road-center-line divider between sections.
export default function LaneDivider() {
  return <View style={styles.laneDivider} />
}

const styles = StyleSheet.create({
  laneDivider: {
    marginTop: spacing.xl,
    marginHorizontal: spacing.lg,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255, 255, 255, 0.13)',
  },
})
