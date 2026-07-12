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

type Props = {
  refreshKey: number
  userId: string
}

const STATUS_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Analyzing...', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
  processed: { label: 'Detected', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)' },
  no_detection: { label: 'No Distress', color: '#6b7280', bg: 'rgba(107, 114, 128, 0.1)' },
}

export default function PhotoFeedSection({ refreshKey, userId }: Props) {
  const [pendingPosts, setPendingPosts] = useState<LocalPhotoPost[]>([])
  const [uploadedPosts, setUploadedPosts] = useState<any[]>([])
  const [uploadingIds, setUploadingIds] = useState<Set<string>>(new Set())

  const loadPosts = useCallback(async () => {
    const pending = await loadPendingPhotos()
    setPendingPosts(pending)

    const { data } = await supabase
      .from('community_photos')
      .select('*')
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
        <Ionicons name="images" size={18} color="#e6a817" />
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
                    <Ionicons name="cloud-upload" size={16} color="#06b6d4" />
                    <Text style={styles.uploadBtnText}>Upload</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(post.id)}>
                    <Ionicons name="trash" size={16} color="#dc2626" />
                  </TouchableOpacity>
                </>
              )}
              {isUploading && (
                <View style={styles.uploadingBadge}>
                  <ActivityIndicator size="small" color="#f59e0b" />
                  <Text style={[styles.badgeText, { color: '#f59e0b' }]}>Uploading...</Text>
                </View>
              )}
              {post.status === 'uploaded' && (
                <View style={[styles.badge, { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}>
                  <Text style={[styles.badgeText, { color: '#f59e0b' }]}>
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
  container: { gap: 10 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4,
  },
  headerTitle: { color: '#f0f0f0', fontSize: 16, fontWeight: '700', flex: 1 },
  postCard: {
    backgroundColor: '#141420', borderRadius: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)',
  },
  postImage: { width: '100%', height: 180, resizeMode: 'cover' },
  postBody: { padding: 12 },
  postCaption: { color: '#e4e4e7', fontSize: 14, lineHeight: 20, marginBottom: 4 },
  postAddress: { color: '#52525b', fontSize: 11, marginBottom: 6 },
  postTime: { color: '#52525b', fontSize: 11 },
  postActions: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingBottom: 12,
  },
  uploadBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(6, 182, 212, 0.1)', paddingVertical: 6, paddingHorizontal: 12,
    borderRadius: 8,
  },
  uploadBtnText: { color: '#06b6d4', fontSize: 12, fontWeight: '600' },
  deleteBtn: { padding: 6 },
  uploadingBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.1)', paddingVertical: 6, paddingHorizontal: 12,
    borderRadius: 8,
  },
  badge: {
    alignSelf: 'flex-start', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 6,
  },
  badgeText: { fontSize: 11, fontWeight: '600' },
})
