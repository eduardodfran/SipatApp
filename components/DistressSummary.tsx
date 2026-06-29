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

function severityDotColor(severity: string): string {
  switch (severity?.toLowerCase()) {
    case 'severe': return '#dc2626'
    case 'moderate': return '#f59e0b'
    case 'minor': return '#22c55e'
    default: return '#6b7280'
  }
}

export default function DistressSummary() {
  const { distresstypes, loading } = useDistressSummary()
  const [selectedImage, setSelectedImage] = useState<string | null>(null)

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#e6a817" />
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
          <Ionicons name="warning" size={16} color="#e6a817" />
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
            <Ionicons name="close" size={28} color="#fff" />
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
          <TouchableOpacity onPress={onImagePress} style={styles.imageBtn}>
            <Ionicons name="image" size={14} color="#e6a817" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#141420',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    overflow: 'hidden',
  },
  loadingContainer: {
    backgroundColor: '#141420',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    padding: 20,
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  headerTitle: {
    color: '#6b7280',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flex: 1,
  },
  headerCount: {
    color: '#e6a817',
    fontSize: 12,
    fontWeight: '700',
    backgroundColor: 'rgba(230, 168, 23, 0.12)',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
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
    color: '#f0f0f0',
    fontSize: 14,
    fontWeight: '700',
  },
  friendlyName: {
    color: '#6b7280',
    fontSize: 11,
    marginTop: 1,
  },
  rowCenter: {
    alignItems: 'center',
    marginHorizontal: 16,
  },
  count: {
    color: '#f0f0f0',
    fontSize: 16,
    fontWeight: '700',
  },
  countLabel: {
    color: '#4b5563',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  confidence: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '600',
  },
  imageBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(230, 168, 23, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: '#000',
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
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImage: {
    width: '100%',
    height: '100%',
  },
})
