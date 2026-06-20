import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { useDetectionComments } from '../lib/useDetectionComments'
import type { Detector } from '../lib/usePotholeDetectors'

const { height: SCREEN_HEIGHT } = Dimensions.get('window')
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.65

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
  detectors: Detector[]
  detectorsLoading: boolean
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

export default function PotholeDetailSheet({ visible, pothole, detectors, detectorsLoading, onClose }: Props) {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [commentDraft, setCommentDraft] = useState('')
  const translateY = useRef(new Animated.Value(SHEET_HEIGHT)).current
  const backdropOpacity = useRef(new Animated.Value(0)).current
  const { comments, loading: commentsLoading, posting, postComment } = useDetectionComments(
    pothole?.pothole_id ?? null,
  )

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id ?? null)
    })
  }, [])

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

        <ScrollView style={styles.scrollBody} showsVerticalScrollIndicator={false}>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Ionicons name="people" size={18} color={severity.bg} />
              <Text style={styles.statValue}>{detectors.length}</Text>
              <Text style={styles.statLabel}>Confirmed By</Text>
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

          <View style={styles.detectorsSection}>
            <View style={styles.detectorsHeader}>
              <Ionicons name="people" size={16} color="#888" />
              <Text style={styles.detectorsTitle}>
                Detected by ({detectors.length})
              </Text>
              {detectorsLoading && (
                <ActivityIndicator size="small" color="#888" />
              )}
            </View>

            {detectors.length === 0 && !detectorsLoading && (
              <Text style={styles.noDetectors}>No detector data</Text>
            )}

            {detectors.map((d, i) => (
              <View key={`${d.user_id}-${i}`} style={styles.detectorRow}>
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarText}>
                    {(d.username ?? d.full_name ?? '?').charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.detectorInfo}>
                  <Text style={styles.detectorName}>
                    {d.username ?? d.full_name ?? 'Unknown'}
                  </Text>
                  <Text style={styles.detectorDate}>
                    {new Date(d.detected_at).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
                {i === detectors.length - 1 && (
                  <View style={styles.latestBadge}>
                    <Text style={styles.latestBadgeText}>Latest</Text>
                  </View>
                )}
              </View>
            ))}
          </View>

          {/* Detection comments */}
          <View style={styles.commentsSection}>
            <View style={styles.commentsHeader}>
              <Ionicons name="chatbubble" size={16} color="#888" />
              <Text style={styles.commentsTitle}>
                Detection comments ({comments.length})
              </Text>
              {commentsLoading && (
                <ActivityIndicator size="small" color="#888" />
              )}
            </View>

            {comments.length === 0 && !commentsLoading && (
              <Text style={styles.noComments}>No comments yet</Text>
            )}

            {comments.map((c) => (
              <View key={c.id} style={styles.commentRow}>
                <View style={styles.commentAvatar}>
                  <Text style={styles.commentAvatarText}>
                    {(c.username ?? '?').charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.commentBody}>
                  <View style={styles.commentMeta}>
                    <Text style={styles.commentUsername}>
                      {c.username ?? 'Unknown'}
                    </Text>
                    <Text style={styles.commentDate}>
                      {new Date(c.created_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </Text>
                  </View>
                  <Text style={styles.commentText}>{c.body}</Text>
                </View>
              </View>
            ))}

            {currentUserId ? (
              <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              >
                <View style={styles.commentInputRow}>
                  <TextInput
                    style={styles.commentInput}
                    value={commentDraft}
                    onChangeText={setCommentDraft}
                    placeholder="Write a comment..."
                    placeholderTextColor="#555"
                    multiline={false}
                  />
                  <TouchableOpacity
                    style={[
                      styles.commentSendBtn,
                      (!commentDraft.trim() || posting) && styles.commentSendBtnDisabled,
                    ]}
                    disabled={!commentDraft.trim() || posting}
                    onPress={() => {
                      postComment(commentDraft)
                      setCommentDraft('')
                    }}
                  >
                    <Text style={styles.commentSendText}>
                      {posting ? '...' : 'Send'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </KeyboardAvoidingView>
            ) : (
              <Text style={styles.signInToComment}>Sign in to comment</Text>
            )}
          </View>
        </ScrollView>
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
  scrollBody: {
    flex: 1,
    paddingHorizontal: 20,
  },
  detectorsSection: {
    marginTop: 14,
    marginBottom: 20,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  detectorsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  detectorsTitle: {
    color: '#888',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flex: 1,
  },
  noDetectors: {
    color: '#555',
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 8,
  },
  detectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(67, 99, 216, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  avatarText: {
    color: '#4363d8',
    fontSize: 13,
    fontWeight: '700',
  },
  detectorInfo: {
    flex: 1,
  },
  detectorName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  detectorDate: {
    color: '#666',
    fontSize: 11,
    marginTop: 1,
  },
  latestBadge: {
    backgroundColor: 'rgba(67, 99, 216, 0.15)',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  latestBadgeText: {
    color: '#4363d8',
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  commentsSection: {
    marginTop: 14,
    marginBottom: 40,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  commentsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  commentsTitle: {
    color: '#888',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flex: 1,
  },
  noComments: {
    color: '#555',
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 8,
  },
  commentRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  commentAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(67, 99, 216, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    marginTop: 2,
  },
  commentAvatarText: {
    color: '#4363d8',
    fontSize: 11,
    fontWeight: '700',
  },
  commentBody: {
    flex: 1,
  },
  commentMeta: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  commentUsername: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  commentDate: {
    color: '#555',
    fontSize: 10,
  },
  commentText: {
    color: '#ccc',
    fontSize: 13,
    marginTop: 2,
    lineHeight: 18,
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 8,
  },
  commentInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    color: '#fff',
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  commentSendBtn: {
    backgroundColor: 'rgba(67, 99, 216, 0.2)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  commentSendBtnDisabled: {
    opacity: 0.4,
  },
  commentSendText: {
    color: '#4363d8',
    fontSize: 13,
    fontWeight: '700',
  },
  signInToComment: {
    color: '#555',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 10,
  },
})
