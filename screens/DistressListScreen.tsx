import { useState } from 'react'
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useDistressSummary, friendlyClassName, type DistressType } from '../lib/useDistressSummary'

type Props = {
  onBack: () => void
}

function severityColor(severity: string): string {
  switch (severity?.toLowerCase()) {
    case 'severe': return '#dc2626'
    case 'moderate': return '#f59e0b'
    case 'minor': return '#22c55e'
    default: return '#6b7280'
  }
}

function severityLabel(severity: string): string {
  const s = severity?.toLowerCase()
  if (s === 'severe') return 'Severe'
  if (s === 'moderate') return 'Moderate'
  if (s === 'minor') return 'Minor'
  return 'Unknown'
}

export default function DistressListScreen({ onBack }: Props) {
  const { distresstypes, loading } = useDistressSummary()
  const [selectedImage, setSelectedImage] = useState<string | null>(null)

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color="#f0f0f0" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Ionicons name="warning" size={18} color="#e6a817" />
          <Text style={styles.headerTitle}>Road Distress</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.totalCount}>{distresstypes.length}</Text>
          <Text style={styles.totalLabel}>types</Text>
        </View>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#e6a817" />
          <Text style={styles.loadingText}>Loading detections...</Text>
        </View>
      ) : distresstypes.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="checkmark-circle-outline" size={48} color="#22c55e" />
          <Text style={styles.emptyTitle}>No Distress Detected</Text>
          <Text style={styles.emptySubtitle}>
            Road surfaces look clear. Start a ride to capture data.
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {distresstypes.map((item) => (
            <DistressCard
              key={item.class_name}
              item={item}
              onImagePress={() => setSelectedImage(item.sample_image_url)}
            />
          ))}
        </ScrollView>
      )}

      {/* Image Modal */}
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
    </View>
  )
}

function DistressCard({
  item,
  onImagePress,
}: {
  item: DistressType
  onImagePress: () => void
}) {
  const color = severityColor(item.worst_severity)

  return (
    <View style={styles.card}>
      {/* Image */}
      {item.sample_image_url ? (
        <TouchableOpacity onPress={onImagePress} activeOpacity={0.85}>
          <Image
            source={{ uri: item.sample_image_url }}
            style={styles.cardImage}
            resizeMode="cover"
          />
          <View style={styles.imageOverlay}>
            <Ionicons name="expand-outline" size={18} color="#fff" />
          </View>
        </TouchableOpacity>
      ) : (
        <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
          <Ionicons name="image-outline" size={32} color="#2a2a3a" />
        </View>
      )}

      {/* Info */}
      <View style={styles.cardBody}>
        <View style={styles.cardTopRow}>
          <View style={styles.cardClassInfo}>
            <Text style={styles.className}>{item.class_name}</Text>
            <Text style={styles.friendlyName}>{friendlyClassName(item.class_name)}</Text>
          </View>
          <View style={[styles.severityBadge, { backgroundColor: color + '20' }]}>
            <View style={[styles.severityDot, { backgroundColor: color }]} />
            <Text style={[styles.severityText, { color }]}>
              {severityLabel(item.worst_severity)}
            </Text>
          </View>
        </View>

        <View style={styles.cardStats}>
          <View style={styles.statItem}>
            <Ionicons name="eye" size={14} color="#6b7280" />
            <Text style={styles.statValue}>{item.detection_count}</Text>
            <Text style={styles.statLabel}>detections</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="pulse" size={14} color="#6b7280" />
            <Text style={styles.statValue}>{(item.avg_confidence * 100).toFixed(0)}%</Text>
            <Text style={styles.statLabel}>confidence</Text>
          </View>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0c0c14',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 56 : 36,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.04)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  headerTitle: {
    color: '#f0f0f0',
    fontSize: 17,
    fontWeight: '700',
  },
  headerRight: {
    alignItems: 'center',
    minWidth: 40,
  },
  totalCount: {
    color: '#e6a817',
    fontSize: 18,
    fontWeight: '800',
  },
  totalLabel: {
    color: '#6b7280',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#6b7280',
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    color: '#f0f0f0',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 8,
  },
  emptySubtitle: {
    color: '#6b7280',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 12,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#141420',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  cardImage: {
    width: '100%',
    height: 180,
    backgroundColor: '#1a1a2e',
  },
  cardImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardBody: {
    padding: 14,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  cardClassInfo: {
    flex: 1,
  },
  className: {
    color: '#f0f0f0',
    fontSize: 20,
    fontWeight: '800',
  },
  friendlyName: {
    color: '#6b7280',
    fontSize: 13,
    marginTop: 2,
  },
  severityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  severityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  severityText: {
    fontSize: 12,
    fontWeight: '700',
  },
  cardStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 10,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statValue: {
    color: '#f0f0f0',
    fontSize: 14,
    fontWeight: '700',
  },
  statLabel: {
    color: '#4b5563',
    fontSize: 11,
  },
  statDivider: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
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
