import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { loadPendingPhotos, updatePhotoPost, deletePhotoPost } from '../lib/pendingPhotos'
import { uploadCommunityPhoto } from '../lib/uploadCommunityPhoto'
import type { LocalPhotoPost } from '../lib/types'
import { colors, fonts, radius, spacing } from '../theme/tokens'

type Props = {
  refreshKey: number
  userId: string
}

const STATUS_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Analyzing...', color: colors.moderate, bg: colors.moderateDim },
  processed: { label: 'Detected', color: colors.minor, bg: colors.minorDim },
  no_detection: { label: 'No Distress', color: colors.textMuted, bg: colors.hairline },
}

export default function PhotoFeedSection({ refreshKey, userId }: Props) {
  const [pendingPosts, setPendingPosts] = useState<LocalPhotoPost[]>([])
  const [uploadedPosts, setUploadedPosts] = useState<any[]>([])
  const [uploadingIds, setUploadingIds] = useState<Set<string>>(new Set())

  const loadPosts = useCallback(async () => {
    const pending = await loadPendingPhotos()
    setPendingPosts(pending)

    const { data } = await supabase
      .from('v_community_photos')
      .select('*')
      .eq('activity_status', 'active')
      .order('created_at', { ascending: false })
      .limit(50)
    setUploadedPosts(data ?? [])
  }, [])

  useEffect(() => {
    loadPosts()
  }, [refreshKey])

  const handleUpload = async (post: LocalPhotoPost) => {
    if (uploadingIds.has(post.id)) return
    setUploadingIds((prev) => new Set(prev).add(post.id))
    await updatePhotoPost(post.id, { status: 'uploading' })

    try {
      const result = await uploadCommunityPhoto(
        userId,
        post.imageUri,
        post.latitude,
        post.longitude,
        post.caption,
      )
      await updatePhotoPost(post.id, {
        status: 'uploaded',
        remoteId: result.photoId,
        imageUrl: result.imageUrl,
        detection_status: 'pending',
      })
    } catch (e: any) {
      await updatePhotoPost(post.id, { status: 'pending' })
      Alert.alert('Upload Failed', e.message)
    } finally {
      setUploadingIds((prev) => {
        const next = new Set(prev)
        next.delete(post.id)
        return next
      })
      loadPosts()
    }
  }

  const handleDelete = async (id: string) => {
    await deletePhotoPost(id)
    loadPosts()
  }

  const allUploadedIds = new Set(uploadedPosts.map((p) => p.id))
  const filteredPending = pendingPosts.filter((p) => {
    if (p.status === 'uploaded' && p.remoteId && allUploadedIds.has(p.remoteId)) return false
    return true
  })

  if (filteredPending.length === 0 && uploadedPosts.length === 0) return null

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="images" size={14} color={colors.signal} />
        <Text style={styles.headerTitle}>Community Feed</Text>
      </View>

      {/* Pending posts */}
      {filteredPending.map((post) => {
        const isUploading = post.status === 'uploading' || uploadingIds.has(post.id)
        return (
          <View key={post.id} style={styles.postCard}>
            <Image source={{ uri: post.imageUri }} style={styles.postImage} />
            <View style={styles.postBody}>
              {post.caption ? <Text style={styles.postCaption}>{post.caption}</Text> : null}
              <Text style={styles.postTime}>
                {new Date(post.createdAt).toLocaleString(undefined, {
                  month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                })}
              </Text>
            </View>
            <View style={styles.postActions}>
              {post.status === 'pending' && !isUploading && (
                <>
                  <TouchableOpacity style={styles.uploadBtn} onPress={() => handleUpload(post)}>
                    <Ionicons name="cloud-upload" size={16} color={colors.signal} />
                    <Text style={styles.uploadBtnText}>Upload</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(post.id)}>
                    <Ionicons name="trash" size={16} color={colors.severe} />
                  </TouchableOpacity>
                </>
              )}
              {isUploading && (
                <View style={styles.uploadingBadge}>
                  <ActivityIndicator size="small" color={colors.moderate} />
                  <Text style={[styles.badgeText, { color: colors.moderate }]}>Uploading...</Text>
                </View>
              )}
              {post.status === 'uploaded' && (
                <View style={[styles.badge, { backgroundColor: colors.moderateDim }]}>
                  <Text style={[styles.badgeText, { color: colors.moderate }]}>
                    {post.detection_status === 'processed'
                      ? `Detected ${post.confidence ? `(${(post.confidence * 100).toFixed(0)}%)` : ''}`
                      : post.detection_status === 'no_detection'
                        ? 'No Distress'
                        : 'Analyzing...'}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )
      })}

      {/* Uploaded posts from server */}
      {uploadedPosts.map((post) => {
        if (post.user_id !== userId) return null
        const badge = STATUS_BADGE[post.detection_status] ?? STATUS_BADGE.pending
        return (
          <View key={post.id} style={styles.postCard}>
            <Image source={{ uri: post.image_url }} style={styles.postImage} />
            <View style={styles.postBody}>
              {post.caption ? <Text style={styles.postCaption}>{post.caption}</Text> : null}
              {post.formatted_address && (
                <Text style={styles.postAddress} numberOfLines={1}>{post.formatted_address}</Text>
              )}
              <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
              </View>
            </View>
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  headerTitle: {
    flex: 1,
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  postCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  postImage: { width: '100%', height: 180, resizeMode: 'cover' },
  postBody: { padding: spacing.lg },
  postCaption: {
    color: colors.textPrimary,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing.xs,
  },
  postAddress: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 16,
    marginBottom: spacing.xs,
  },
  postTime: { color: colors.textMuted, fontFamily: fonts.mono, fontSize: 11 },
  postActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.signalDim,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  uploadBtnText: { color: colors.signal, fontFamily: fonts.semibold, fontSize: 13 },
  deleteBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.severeDim,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.moderateDim,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
  },
  badgeText: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 0.4 },
})
