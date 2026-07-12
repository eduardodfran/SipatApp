import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Image,
  ScrollView,
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
import AppTabBar from '../components/AppTabBar'

type Props = {
  feedRefreshKey: number
  userId: string
  onTabChange: (tab: 'dashboard' | 'feed') => void
  onPhoto: () => void
}

const STATUS_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Analyzing...', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
  processed: { label: 'Detected', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)' },
  no_detection: { label: 'No Distress', color: '#6b7280', bg: 'rgba(107, 114, 128, 0.1)' },
}

export default function FeedScreen({ feedRefreshKey, userId, onTabChange, onPhoto }: Props) {
  const [pendingPosts, setPendingPosts] = useState<LocalPhotoPost[]>([])
  const [uploadedPosts, setUploadedPosts] = useState<any[]>([])
  const [uploadingIds, setUploadingIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  const loadPosts = useCallback(async () => {
    setLoading(true)
    const [pending, { data }] = await Promise.all([
      loadPendingPhotos(),
      supabase.from('community_photos').select('*').order('created_at', { ascending: false }).limit(50),
    ])
    setPendingPosts(pending)
    setUploadedPosts(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    loadPosts()
  }, [feedRefreshKey])

  const handleUpload = async (post: LocalPhotoPost) => {
    if (uploadingIds.has(post.id)) return
    setUploadingIds((prev) => new Set(prev).add(post.id))
    await updatePhotoPost(post.id, { status: 'uploading' })
    try {
      const result = await uploadCommunityPhoto(userId, post.imageUri, post.latitude, post.longitude, post.caption)
      await updatePhotoPost(post.id, { status: 'uploaded', remoteId: result.photoId, imageUrl: result.imageUrl, detection_status: 'pending' })
    } catch (e: any) {
      await updatePhotoPost(post.id, { status: 'pending' })
    } finally {
      setUploadingIds((prev) => { const n = new Set(prev); n.delete(post.id); return n })
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

  const allPosts = [...uploadedPosts]

  return (
    <View style={styles.container}>
      <AppTabBar active="feed" onTabChange={onTabChange} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Pending posts (own) */}
        {filteredPending.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>My Posts</Text>
            {filteredPending.map((post) => {
              const isUploading = post.status === 'uploading' || uploadingIds.has(post.id)
              return (
                <View key={post.id} style={styles.postCard}>
                  <Image source={{ uri: post.imageUri }} style={styles.postImage} />
                  <View style={styles.postBody}>
                    {post.caption ? <Text style={styles.caption}>{post.caption}</Text> : null}
                    <Text style={styles.time}>
                      {new Date(post.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                  <View style={styles.postActions}>
                    {post.status === 'pending' && !isUploading && (
                      <>
                        <TouchableOpacity style={styles.actionBtn} onPress={() => handleUpload(post)}>
                          <Ionicons name="cloud-upload" size={14} color="#06b6d4" />
                          <Text style={styles.actionBtnText}>Upload</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDelete(post.id)} style={styles.iconBtn}>
                          <Ionicons name="trash" size={16} color="#dc2626" />
                        </TouchableOpacity>
                      </>
                    )}
                    {isUploading && (
                      <View style={[styles.badge, { backgroundColor: 'rgba(245,158,11,0.1)' }]}>
                        <ActivityIndicator size="small" color="#f59e0b" />
                        <Text style={[styles.badgeText, { color: '#f59e0b' }]}>Uploading...</Text>
                      </View>
                    )}
                    {post.status === 'uploaded' && (
                      <View style={[styles.badge, { backgroundColor: 'rgba(245,158,11,0.1)' }]}>
                        <Text style={[styles.badgeText, { color: '#f59e0b' }]}>Analyzing...</Text>
                      </View>
                    )}
                  </View>
                </View>
              )
            })}
          </>
        )}

        {/* All community posts */}
        <Text style={styles.sectionTitle}>Community Feed</Text>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="small" color="#e6a817" />
          </View>
        ) : allPosts.length === 0 && filteredPending.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="images-outline" size={40} color="#2a2a3a" />
            <Text style={styles.emptyTitle}>No posts yet</Text>
            <Text style={styles.emptySub}>Be the first to report a distress</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={onPhoto}>
              <Ionicons name="camera" size={16} color="#0c0c14" />
              <Text style={styles.emptyBtnText}>Take a Photo</Text>
            </TouchableOpacity>
          </View>
        ) : (
          allPosts.map((post) => {
            const badge = STATUS_BADGE[post.detection_status] ?? STATUS_BADGE.pending
            return (
              <View key={post.id} style={styles.postCard}>
                <Image source={{ uri: post.image_url }} style={styles.postImage} />
                <View style={styles.postBody}>
                  <View style={styles.postHeader}>
                    <Ionicons name="person-circle-outline" size={18} color="#52525b" />
                    <Text style={styles.reporter}>{post.reporter_username ?? 'Anonymous'}</Text>
                    <Text style={styles.time}>
                      {new Date(post.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </Text>
                  </View>
                  {post.caption ? <Text style={styles.caption}>{post.caption}</Text> : null}
                  <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                    <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
                  </View>
                </View>
              </View>
            )
          })
        )}
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0c0c14' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 12 },
  sectionTitle: {
    color: '#a1a1aa', fontSize: 12, fontWeight: '600', textTransform: 'uppercase',
    letterSpacing: 0.5, marginBottom: 4,
  },
  postCard: {
    backgroundColor: '#141420', borderRadius: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)',
  },
  postImage: { width: '100%', height: 200, resizeMode: 'cover' },
  postBody: { padding: 12 },
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  reporter: { color: '#a1a1aa', fontSize: 13, fontWeight: '500', flex: 1 },
  caption: { color: '#e4e4e7', fontSize: 14, lineHeight: 20, marginBottom: 8 },
  time: { color: '#52525b', fontSize: 11 },
  postActions: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingBottom: 12,
  },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(6,182,212,0.1)', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8,
  },
  actionBtnText: { color: '#06b6d4', fontSize: 12, fontWeight: '600' },
  iconBtn: { padding: 6 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
    paddingVertical: 4, paddingHorizontal: 10, borderRadius: 6,
  },
  badgeText: { fontSize: 11, fontWeight: '600' },
  loadingWrap: { paddingVertical: 40, alignItems: 'center' },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyTitle: { color: '#f0f0f0', fontSize: 16, fontWeight: '700', marginTop: 12 },
  emptySub: { color: '#4b5563', fontSize: 13, marginTop: 4, textAlign: 'center' },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#e6a817', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 14, marginTop: 20,
  },
  emptyBtnText: { color: '#0c0c14', fontSize: 14, fontWeight: '700' },
})
