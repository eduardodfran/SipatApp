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
        {/* My pending posts */}
        {filteredPending.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionDot} />
              <Text style={styles.sectionTitle}>My Posts</Text>
              <Text style={styles.sectionCount}>{filteredPending.length}</Text>
            </View>
            {filteredPending.map((post) => {
              const isUploading = post.status === 'uploading' || uploadingIds.has(post.id)
              return (
                <View key={post.id} style={styles.postCard}>
                  <Image source={{ uri: post.imageUri }} style={styles.postImage} />
                  <View style={styles.postBody}>
                    <View style={styles.postTopRow}>
                      {post.caption ? <Text style={styles.caption}>{post.caption}</Text> : <Text style={styles.noCaption}>No caption</Text>}
                    </View>
                    <Text style={styles.time}>
                      {new Date(post.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                  <View style={styles.postActions}>
                    {post.status === 'pending' && !isUploading && (
                      <>
                        <TouchableOpacity style={styles.uploadBtn} onPress={() => handleUpload(post)} activeOpacity={0.7}>
                          <Ionicons name="cloud-upload-outline" size={14} color="#06b6d4" />
                          <Text style={styles.uploadBtnText}>Upload</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDelete(post.id)} style={styles.deleteBtn} activeOpacity={0.7}>
                          <Ionicons name="trash-outline" size={14} color="#dc2626" />
                        </TouchableOpacity>
                      </>
                    )}
                    {isUploading && (
                      <View style={styles.uploadingBadge}>
                        <ActivityIndicator size="small" color="#f59e0b" />
                        <Text style={styles.uploadingText}>Uploading...</Text>
                      </View>
                    )}
                    {post.status === 'uploaded' && !isUploading && (
                      <View style={styles.analyzingBadge}>
                        <Ionicons name="scan-outline" size={12} color="#f59e0b" />
                        <Text style={styles.analyzingText}>Analyzing...</Text>
                      </View>
                    )}
                  </View>
                </View>
              )
            })}
          </View>
        )}

        {/* Community feed */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="people-outline" size={14} color="#a1a1aa" />
            <Text style={styles.sectionTitle}>Community Feed</Text>
            <Text style={styles.sectionCount}>{allPosts.length}</Text>
          </View>

          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="small" color="#e6a817" />
            </View>
          ) : allPosts.length === 0 && filteredPending.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="camera-outline" size={32} color="#52525b" />
              </View>
              <Text style={styles.emptyTitle}>No reports yet</Text>
              <Text style={styles.emptySub}>Be the first to capture road distress</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={onPhoto} activeOpacity={0.7}>
                <Ionicons name="camera" size={16} color="#0c0c14" />
                <Text style={styles.emptyBtnText}>Take a Photo</Text>
              </TouchableOpacity>
            </View>
          ) : allPosts.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptySub}>No community reports yet</Text>
            </View>
          ) : (
            allPosts.map((post) => {
              const badge = STATUS_BADGE[post.detection_status] ?? STATUS_BADGE.pending
              return (
                <View key={post.id} style={styles.postCard}>
                  <Image source={{ uri: post.image_url }} style={styles.postImage} />
                  <View style={styles.postBody}>
                    <View style={styles.postTopRow}>
                      <View style={styles.reporterRow}>
                        <Ionicons name="person-circle-outline" size={16} color="#52525b" />
                        <Text style={styles.reporter}>{post.reporter_username ?? 'Anonymous'}</Text>
                      </View>
                      <Text style={styles.time}>
                        {new Date(post.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </Text>
                    </View>
                    {post.caption ? <Text style={styles.caption}>{post.caption}</Text> : null}
                    <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                      <View style={[styles.statusDot, { backgroundColor: badge.color }]} />
                      <Text style={[styles.statusText, { color: badge.color }]}>{badge.label}</Text>
                    </View>
                  </View>
                </View>
              )
            })
          )}
        </View>
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0c0c14' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 20 },

  // Sections
  section: { marginTop: 16, paddingHorizontal: 16 },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12,
  },
  sectionDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#e6a817' },
  sectionTitle: {
    color: '#a1a1aa', fontSize: 12, fontWeight: '600', textTransform: 'uppercase',
    letterSpacing: 0.5, flex: 1,
  },
  sectionCount: {
    color: '#52525b', fontSize: 11, fontWeight: '600',
    backgroundColor: 'rgba(255,255,255,0.04)', paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 8, overflow: 'hidden',
  },

  // Post cards
  postCard: {
    backgroundColor: '#141420', borderRadius: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)', marginBottom: 12,
  },
  postImage: { width: '100%', height: 180, resizeMode: 'cover' },
  postBody: { padding: 14 },
  postTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 },
  reporterRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  reporter: { color: '#a1a1aa', fontSize: 13, fontWeight: '500' },
  caption: { color: '#e4e4e7', fontSize: 14, lineHeight: 20 },
  noCaption: { color: '#3f3f46', fontSize: 13, fontStyle: 'italic' },
  time: { color: '#52525b', fontSize: 11, marginTop: 4 },

  // Post actions
  postActions: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingBottom: 14,
  },
  uploadBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(6,182,212,0.1)', paddingVertical: 8, paddingHorizontal: 16,
    borderRadius: 10,
  },
  uploadBtnText: { color: '#06b6d4', fontSize: 13, fontWeight: '600' },
  deleteBtn: {
    padding: 8, backgroundColor: 'rgba(220,38,38,0.08)', borderRadius: 10,
  },
  uploadingBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(245,158,11,0.1)', paddingVertical: 8, paddingHorizontal: 14,
    borderRadius: 10,
  },
  uploadingText: { color: '#f59e0b', fontSize: 12, fontWeight: '600' },
  analyzingBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(245,158,11,0.08)', paddingVertical: 8, paddingHorizontal: 14,
    borderRadius: 10,
  },
  analyzingText: { color: '#f59e0b', fontSize: 12, fontWeight: '600' },

  // Status badge (community posts)
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, marginTop: 4,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontWeight: '600' },

  // Empty state
  loadingWrap: { paddingVertical: 40, alignItems: 'center' },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyIconWrap: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.03)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  emptyTitle: { color: '#f0f0f0', fontSize: 16, fontWeight: '700' },
  emptySub: { color: '#4b5563', fontSize: 13, marginTop: 6, textAlign: 'center' },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#e6a817', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 14, marginTop: 20,
  },
  emptyBtnText: { color: '#0c0c14', fontSize: 14, fontWeight: '700' },
})
