import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'

const { height: SCREEN_HEIGHT } = Dimensions.get('window')
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.55

type PotholeDetail = {
  pothole_id: string
  worst_severity: string
  total_detection_hits: number
  image_url: string | null
  consolidated_latitude: number
  consolidated_longitude: number
}

type Props = {
  visible: boolean
  pothole: PotholeDetail | null
  onClose: () => void
}

function severityConfig(severity: string): { label: string; color: string; bg: string; friendlyName: string } {
  switch (severity?.toLowerCase()) {
    case 'severe':
      return {
        label: 'SEVERE',
        color: '#fff',
        bg: '#dc2626',
        friendlyName: 'Pothole Hazard — Severe',
      }
    case 'moderate':
      return {
        label: 'MODERATE',
        color: '#1a1a1a',
        bg: '#f59e0b',
        friendlyName: 'Pothole Hazard — Moderate',
      }
    case 'minor':
      return {
        label: 'MINOR',
        color: '#fff',
        bg: '#16a34a',
        friendlyName: 'Pothole Hazard — Minor',
      }
    default:
      return {
        label: 'UNKNOWN',
        color: '#fff',
        bg: '#6b7280',
        friendlyName: 'Pothole Hazard',
      }
  }
}

export default function PotholeDetailSheet({ visible, pothole, onClose }: Props) {
  const translateY = useRef(new Animated.Value(SHEET_HEIGHT)).current
  const backdropOpacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (visible && pothole) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          damping: 20,
          stiffness: 200,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start()
    } else {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: SHEET_HEIGHT,
          useNativeDriver: true,
          damping: 20,
          stiffness: 200,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start()
    }
  }, [visible, pothole])

  if (!pothole) return null

  const severity = severityConfig(pothole.worst_severity)

  return (
    <View style={styles.backdrop} pointerEvents={visible ? 'auto' : 'none'}>
      <Animated.View style={[styles.overlay, { opacity: backdropOpacity }]}>
        <TouchableOpacity style={styles.overlayTouchable} onPress={onClose} activeOpacity={1} />
      </Animated.View>

      <Animated.View
        style={[
          styles.sheet,
          { transform: [{ translateY }] },
        ]}
      >
        <View style={styles.handleBar} />

        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={[styles.severityBadge, { backgroundColor: severity.bg }]}>
              <Text style={[styles.severityBadgeText, { color: severity.color }]}>
                {severity.label}
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={20} color="#888" />
          </TouchableOpacity>
        </View>

        <Text style={styles.friendlyName}>{severity.friendlyName}</Text>

        <View style={styles.imageContainer}>
          {pothole.image_url ? (
            <ImageFrame uri={pothole.image_url} />
          ) : (
            <View style={styles.placeholderImage}>
              <Ionicons name="image-outline" size={40} color="#333" />
              <Text style={styles.placeholderText}>No image available</Text>
            </View>
          )}
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Ionicons name="warning" size={18} color={severity.bg} />
            <Text style={styles.statValue}>{pothole.total_detection_hits}</Text>
            <Text style={styles.statLabel}>Detections</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="location" size={18} color="#4363d8" />
            <Text style={styles.statValue}>
              {pothole.consolidated_latitude.toFixed(4)}
            </Text>
            <Text style={styles.statLabel}>Latitude</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="location" size={18} color="#4363d8" />
            <Text style={styles.statValue}>
              {pothole.consolidated_longitude.toFixed(4)}
            </Text>
            <Text style={styles.statLabel}>Longitude</Text>
          </View>
        </View>
      </Animated.View>
    </View>
  )
}

function ImageFrame({ uri }: { uri: string }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const imageUri = uri?.trim() || ''

  return (
    <View style={styles.imageFrame}>
      <Image
        source={{ uri: imageUri }}
        style={styles.evidenceImage}
        resizeMode="contain"
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        onError={() => { setLoading(false); setError(true) }}
      />
      {loading && (
        <View style={styles.imageLoader}>
          <ActivityIndicator size="small" color="#4363d8" />
          <Text style={styles.imageLoaderText}>Loading evidence...</Text>
        </View>
      )}
      {error && !loading && (
        <View style={styles.imageError}>
          <Ionicons name="alert-circle-outline" size={32} color="#ff4444" />
          <Text style={styles.imageErrorText}>Failed to load image</Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  overlayTouchable: {
    flex: 1,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: SHEET_HEIGHT,
    backgroundColor: '#0f0f2a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 34,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#333',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 4,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  severityBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  severityBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  friendlyName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    paddingHorizontal: 20,
    marginTop: 8,
    marginBottom: 12,
  },
  imageContainer: {
    paddingHorizontal: 20,
  },
  imageFrame: {
    width: '100%',
    height: 200,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#1a1a3a',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  evidenceImage: {
    width: '100%',
    height: '100%',
  },
  imageLoader: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a3a',
  },
  imageLoaderText: {
    color: '#666',
    fontSize: 12,
    marginTop: 8,
  },
  imageError: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a3a',
  },
  imageErrorText: {
    color: '#666',
    fontSize: 12,
    marginTop: 6,
  },
  placeholderImage: {
    width: '100%',
    height: 200,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#1a1a3a',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  placeholderText: {
    color: '#444',
    fontSize: 13,
    marginTop: 8,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginHorizontal: 20,
    marginTop: 18,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  statItem: {
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  statLabel: {
    color: '#666',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
})
