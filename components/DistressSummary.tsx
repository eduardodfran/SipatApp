import { useState } from 'react'
import {
  ActivityIndicator,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useDistressSummary, friendlyClassName, type DistressType } from '../lib/useDistressSummary'
import { colors, fonts, radius, spacing } from '../theme/tokens'

function severityDotColor(severity: string): string {
  switch (severity?.toLowerCase()) {
    case 'severe': return colors.severe
    case 'moderate': return colors.moderate
    case 'minor': return colors.minor
    default: return colors.textMuted
  }
}

export default function DistressSummary() {
  const { distresstypes, loading } = useDistressSummary()
  const [selectedImage, setSelectedImage] = useState<string | null>(null)

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={colors.signal} />
      </View>
    )
  }

  if (distresstypes.length === 0) {
    return null
  }

  return (
    <>
      <View style={styles.container}>
        <View style={styles.header}>
          <Ionicons name="warning" size={14} color={colors.signal} />
          <Text style={styles.headerTitle}>Distress Types Detected</Text>
          <Text style={styles.headerCount}>{distresstypes.length}</Text>
        </View>

        {distresstypes.map((item) => (
          <DistressRow
            key={item.class_name}
            item={item}
            onImagePress={() => setSelectedImage(item.sample_image_url)}
          />
        ))}
      </View>

      <Modal
        visible={!!selectedImage}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedImage(null)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalClose}
            onPress={() => setSelectedImage(null)}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={28} color={colors.textPrimary} />
          </TouchableOpacity>
          {selectedImage && (
            <Image
              source={{ uri: selectedImage }}
              style={styles.modalImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </>
  )
}

function DistressRow({
  item,
  onImagePress,
}: {
  item: DistressType
  onImagePress: () => void
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <View style={[styles.severityDot, { backgroundColor: severityDotColor(item.worst_severity) }]} />
        <View style={styles.rowInfo}>
          <Text style={styles.className}>{item.class_name}</Text>
          <Text style={styles.friendlyName}>{friendlyClassName(item.class_name)}</Text>
        </View>
      </View>

      <View style={styles.rowCenter}>
        <Text style={styles.count}>{item.detection_count}</Text>
        <Text style={styles.countLabel}>hits</Text>
      </View>

      <View style={styles.rowRight}>
        <Text style={styles.confidence}>
          {(item.avg_confidence * 100).toFixed(0)}%
        </Text>
        {item.sample_image_url && (
          <TouchableOpacity
            onPress={onImagePress}
            style={styles.imageBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="image" size={14} color={colors.signal} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    overflow: 'hidden',
  },
  loadingContainer: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.xl,
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  headerTitle: {
    flex: 1,
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  headerCount: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 0.4,
    color: colors.signal,
    backgroundColor: colors.signalDim,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.sm,
  },
  severityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  rowInfo: {
    flex: 1,
  },
  className: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 14,
  },
  friendlyName: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 11,
    marginTop: 1,
  },
  rowCenter: {
    alignItems: 'center',
    marginHorizontal: spacing.lg,
  },
  count: {
    color: colors.textPrimary,
    fontFamily: fonts.monoBold,
    fontSize: 16,
  },
  countLabel: {
    color: colors.textMuted,
    fontFamily: fonts.bold,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 1,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  confidence: {
    color: colors.textMuted,
    fontFamily: fonts.mono,
    fontSize: 12,
  },
  imageBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: colors.signalDim,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalClose: {
    position: 'absolute',
    top: 54,
    right: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.hairlineStrong,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImage: {
    width: '100%',
    height: '100%',
  },
})
