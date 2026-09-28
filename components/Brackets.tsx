import { StyleSheet, View } from 'react-native'
import { colors } from '../theme/tokens'

// YOLO detection-bracket corners — the app's signature element.
export default function Brackets({ size = 18, color = colors.signalLine }: { size?: number; color?: string }) {
  const base = { position: 'absolute' as const, width: size, height: size, borderColor: color }
  return (
    <>
      <View style={[base, { top: -1, left: -1, borderTopWidth: 2, borderLeftWidth: 2 }]} />
      <View style={[base, { top: -1, right: -1, borderTopWidth: 2, borderRightWidth: 2 }]} />
      <View style={[base, { bottom: -1, left: -1, borderBottomWidth: 2, borderLeftWidth: 2 }]} />
      <View style={[base, { bottom: -1, right: -1, borderBottomWidth: 2, borderRightWidth: 2 }]} />
    </>
  )
}

export const bracketBox = StyleSheet.create({
  box: {
    alignSelf: 'flex-start',
    paddingHorizontal: 22,
    paddingVertical: 6,
  },
})
