import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { loadPendingPhotos, updatePhotoPost, deletePhotoPost } from '../lib/pendingPhotos'
import { uploadCommunityPhoto } from '../lib/uploadCommunityPhoto'
import type { LocalPhotoPost } from '../lib/types'

type Comment = {
  id: string
  body: string
  created_at: string
  username: string | null
}

type Props = {
  feedRefreshKey: number
  userId: string
  onTabChange: (tab: 'dashboard' | 'feed') => void
  onPhoto: () => void
  onMenuPress: () => void
  onViewDetail: (item: { type: 'photo'; data: any } | { type: 'pothole'; data: any }) => void
  onViewOnMap: (item: { type: 'photo'; data: any } | { type: 'pothole'; data: any }) => void
}

type FeedItem = { type: 'photo'; data: any } | { type: 'pothole'; data: any }

const PAGE_SIZE = 10

const STATUS_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Analyzing...', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
  processed: { label: 'Detected', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)' },
  no_detection: { label: 'No Distress', color: '#6b7280', bg: 'rgba(107, 114, 128, 0.1)' },
}

const SEVERITY_COLORS: Record<string, { color: string; bg: string }> = {
  Minor: { color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
  Moderate: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  Severe: { color: '#dc2626', bg: 'rgba(222,38,38,0.1)' },
  Unknown: { color: '#6b7280', bg: 'rgba(107,114,128,0.1)' },
}

const formatAddress = (p: any) => {
  return p.formatted_address || [p.street, p.barangay, p.city, p.province].filter(Boolean).join(', ') || 'Unknown location'
}

function FilterBar({ filters, onFiltersChange }: { filters: { country: string; city: string; street: string }; onFiltersChange: (f: { country: string; city: string; street: string }) => void }) {
  const [local, setLocal] = useState(filters)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    setLocal(filters)
  }, [filters.country, filters.city, filters.street])

  return (
    <View style={styles.section}>
      <TouchableOpacity style={styles.filterToggle} onPress={() => setExpanded((v) => !v)} activeOpacity={0.7}>
        <Ionicons name="funnel-outline" size={14} color="#a1a1aa" />
        <Text style={styles.filterToggleText}>{expanded ? 'Hide filters' : 'Filter by location'}</Text>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={12} color="#52525b" />
      </TouchableOpacity>
      {expanded && (
        <View style={styles.filterRow}>
          <TextInput style={styles.filterInput} value={local.country} onChangeText={(t) => setLocal((p) => ({ ...p, country: t }))} onBlur={() => onFiltersChange(local)} placeholder="Country" placeholderTextColor="#374151" />
          <TextInput style={styles.filterInput} value={local.city} onChangeText={(t) => setLocal((p) => ({ ...p, city: t }))} onBlur={() => onFiltersChange(local)} placeholder="City" placeholderTextColor="#374151" />
          <TextInput style={styles.filterInput} value={local.street} onChangeText={(t) => setLocal((p) => ({ ...p, street: t }))} onBlur={() => onFiltersChange(local)} placeholder="Street" placeholderTextColor="#374151" />
          {(filters.country || filters.city || filters.street) && (
            <TouchableOpacity onPress={() => { setLocal({ country: '', city: '', street: '' }); onFiltersChange({ country: '', city: '', street: '' }) }} style={styles.filterClear} activeOpacity={0.7}>
              <Text style={styles.filterClearText}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  )
}

export default function FeedScreen({ feedRefreshKey, userId, onTabChange, onPhoto, onMenuPress, onViewDetail, onViewOnMap }: Props) {
  const [pendingPosts, setPendingPosts] = useState<LocalPhotoPost[]>([])
  const [uploadedPosts, setUploadedPosts] = useState<any[]>([])
  const [uploadingIds, setUploadingIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null)
  const [commentsByPost, setCommentsByPost] = useState<Record<string, Comment[]>>({})
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({})
  const [postingComment, setPostingComment] = useState<Record<string, boolean>>({})

  const [potholes, setPotholes] = useState<any[]>([])
  const [potholeExpandedId, setPotholeExpandedId] = useState<number | null>(null)
  const [potholeComments, setPotholeComments] = useState<Record<number, any[]>>({})
  const [potholeDrafts, setPotholeDrafts] = useState<Record<number, string>>({})
  const [potholePosting, setPotholePosting] = useState<Record<number, boolean>>({})

  const [filters, setFilters] = useState({ country: '', city: '', street: '' })
  const [photoOffset, setPhotoOffset] = useState(0)
  const [potholeOffset, setPotholeOffset] = useState(0)
  const [hasMorePhotos, setHasMorePhotos] = useState(true)
  const [hasMorePotholes, setHasMorePotholes] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const loadPosts = useCallback(async (page = 0) => {
    if (page === 0) setLoading(true)
    const photoOff = page * PAGE_SIZE
    const potholeOff = page * PAGE_SIZE

    const [pending, { data: photoData, count: photoCount }, { data: potholeData, count: potholeCount }] = await Promise.all([
      page === 0 ? loadPendingPhotos() : Promise.resolve([] as LocalPhotoPost[]),
      supabase.from('community_photos').select('*', { count: 'exact', head: false })
        .order('created_at', { ascending: false }).range(photoOff, photoOff + PAGE_SIZE - 1),
      supabase
        .from('v_unified_potholes')
        .select(
          'pothole_id, consolidated_latitude, consolidated_longitude, worst_severity, '
          + 'total_detection_hits, citizen_first_reported_at, latest_activity_at, '
          + 'image_url, reporter_username, reporter_avatar, detectors_count, '
          + 'street, barangay, city, province, country, formatted_address',
          { count: 'exact', head: false },
        )
        .not('worst_severity', 'is', null)
        .order('citizen_first_reported_at', { ascending: false, nullsFirst: false })
        .range(potholeOff, potholeOff + PAGE_SIZE - 1),
    ])

    if (page === 0) {
      setPendingPosts(pending as LocalPhotoPost[])
      setUploadedPosts(photoData ?? [])
      setPotholes(potholeData ?? [])
      setPhotoOffset(PAGE_SIZE)
      setPotholeOffset(PAGE_SIZE)
    } else {
      setUploadedPosts((prev) => [...prev, ...(photoData ?? [])])
      setPotholes((prev) => [...prev, ...(potholeData ?? [])])
      setPhotoOffset((prev) => prev + PAGE_SIZE)
      setPotholeOffset((prev) => prev + PAGE_SIZE)
    }

    setHasMorePhotos(photoCount != null && photoOff + PAGE_SIZE < photoCount)
    setHasMorePotholes(potholeCount != null && potholeOff + PAGE_SIZE < potholeCount)
    setLoading(false)
    setLoadingMore(false)
  }, [])

  useEffect(() => {
    loadPosts(0)
  }, [feedRefreshKey])

  const handleLoadMore = useCallback(() => {
    if (loadingMore || (!hasMorePhotos && !hasMorePotholes)) return
    setLoadingMore(true)
    const nextPage = Math.ceil(Math.max(photoOffset, potholeOffset) / PAGE_SIZE)
    loadPosts(nextPage)
  }, [loadingMore, hasMorePhotos, hasMorePotholes, photoOffset, potholeOffset, loadPosts])

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
      loadPosts(0)
    }
  }

  const handleDelete = async (id: string) => {
    await deletePhotoPost(id)
    loadPosts(0)
  }

  const toggleComments = useCallback(async (postId: number) => {
    const key = String(postId)
    if (expandedPostId === key) { setExpandedPostId(null); return }
    setExpandedPostId(key)
    if (!commentsByPost[key]) {
      const { data } = await supabase.rpc('get_community_photo_comments', { p_photo_id: postId })
      setCommentsByPost((prev) => ({ ...prev, [key]: (data ?? []) as Comment[] }))
    }
  }, [expandedPostId, commentsByPost])

  const handleSendComment = useCallback(async (postId: number) => {
    const key = String(postId)
    const text = commentDrafts[key]?.trim()
    if (!text || postingComment[key]) return
    setPostingComment((prev) => ({ ...prev, [key]: true }))
    await supabase.rpc('create_community_photo_comment', { p_photo_id: postId, p_body: text })
    const { data } = await supabase.rpc('get_community_photo_comments', { p_photo_id: postId })
    setCommentsByPost((prev) => ({ ...prev, [key]: (data ?? []) as Comment[] }))
    setCommentDrafts((prev) => ({ ...prev, [key]: '' }))
    setPostingComment((prev) => ({ ...prev, [key]: false }))
  }, [commentDrafts, postingComment])

  const handleVerify = useCallback(async (postId: number, body: string) => {
    await supabase.rpc('create_community_photo_comment', { p_photo_id: postId, p_body: body })
    const { data } = await supabase.rpc('get_community_photo_comments', { p_photo_id: postId })
    const key = String(postId)
    setCommentsByPost((prev) => ({ ...prev, [key]: (data ?? []) as Comment[] }))
  }, [])

  const loadPotholeComments = useCallback(async (potholeId: number) => {
    const { data } = await supabase.rpc('get_detection_comments', { p_pothole_id: potholeId })
    setPotholeComments((prev) => ({ ...prev, [potholeId]: data ?? [] }))
  }, [])

  const handlePotholeVerify = useCallback(async (potholeId: number, body: string) => {
    await supabase.rpc('create_detection_comment', { p_pothole_id: potholeId, p_body: body })
    loadPotholeComments(potholeId)
  }, [loadPotholeComments])

  const handlePotholeSendComment = useCallback(async (potholeId: number) => {
    const text = potholeDrafts[potholeId]?.trim()
    if (!text || potholePosting[potholeId]) return
    setPotholePosting((prev) => ({ ...prev, [potholeId]: true }))
    await supabase.rpc('create_detection_comment', { p_pothole_id: potholeId, p_body: text })
    await loadPotholeComments(potholeId)
    setPotholeDrafts((prev) => ({ ...prev, [potholeId]: '' }))
    setPotholePosting((prev) => ({ ...prev, [potholeId]: false }))
  }, [potholeDrafts, potholePosting, loadPotholeComments])

  const allUploadedIds = new Set(uploadedPosts.map((p) => p.id))
  const filteredPending = pendingPosts.filter((p) => {
    if (p.status === 'uploaded' && p.remoteId && allUploadedIds.has(p.remoteId)) return false
    return true
  })

  const feedItems: FeedItem[] = [
    ...uploadedPosts.map((p) => ({ type: 'photo' as const, data: p })),
    ...potholes.map((p) => ({ type: 'pothole' as const, data: p })),
  ].sort((a: any, b: any) => {
    const da = a.type === 'photo' ? a.data.created_at : a.data.citizen_first_reported_at
    const db = b.type === 'photo' ? b.data.created_at : b.data.citizen_first_reported_at
    return new Date(db || 0).getTime() - new Date(da || 0).getTime()
  })

  const filteredFeedItems = feedItems.filter((item) => {
    const d = item.data
    if (filters.country && (d.country ?? '').toLowerCase() !== filters.country.toLowerCase()) return false
    if (filters.city && !(d.city ?? '').toLowerCase().includes(filters.city.toLowerCase())) return false
    if (filters.street && !(d.street ?? '').toLowerCase().includes(filters.street.toLowerCase())) return false
    return true
  })

  const renderFeedItem = useCallback(({ item }: { item: FeedItem }) => {
    if (item.type === 'photo') {
      const post = item.data
      const badge = STATUS_BADGE[post.detection_status] ?? STATUS_BADGE.pending
      const postKey = String(post.id)
      const comments = commentsByPost[postKey]
      const verifyCount = comments ? comments.filter((c: Comment) => c.body.includes('✅')).length : 0
      const commentCount = comments ? comments.length : 0
      const isExpanded = expandedPostId === postKey

      return (
        <View style={styles.postCard}>
          <TouchableOpacity activeOpacity={0.85} onPress={() => onViewDetail(item)}>
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
                <TouchableOpacity onPress={() => onViewOnMap(item)} style={styles.mapBtn} activeOpacity={0.7}>
                  <Ionicons name="map-outline" size={15} color="#6b7280" />
                </TouchableOpacity>
              </View>
              {post.caption ? <Text style={styles.caption}>{post.caption}</Text> : null}
              <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                <View style={[styles.statusDot, { backgroundColor: badge.color }]} />
                <Text style={[styles.statusText, { color: badge.color }]}>{badge.label}</Text>
              </View>
            </View>
          </TouchableOpacity>
          <View style={styles.verifyRow}>
            <TouchableOpacity style={styles.verifyBtnStill} onPress={() => handleVerify(post.id, '✅ Still here')} activeOpacity={0.7}>
              <Ionicons name="checkmark-circle-outline" size={14} color="#22c55e" />
              <Text style={styles.verifyBtnStillText}>Still here</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.verifyBtnFixed} onPress={() => handleVerify(post.id, '✅ Fixed')} activeOpacity={0.7}>
              <Ionicons name="close-circle-outline" size={14} color="#ef4444" />
              <Text style={styles.verifyBtnFixedText}>Fixed</Text>
            </TouchableOpacity>
            <Text style={styles.verifyCount}>{verifyCount}</Text>
          </View>
          <TouchableOpacity style={styles.commentsToggle} onPress={() => toggleComments(post.id)} activeOpacity={0.7}>
            <Ionicons name={isExpanded ? 'chatbubble-ellipses' : 'chatbubble-outline'} size={14} color="#6b7280" />
            <Text style={styles.commentsToggleText}>
              {commentCount > 0 ? `${commentCount} comment${commentCount !== 1 ? 's' : ''}` : 'Comment'}
            </Text>
            <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={12} color="#52525b" />
          </TouchableOpacity>
          {isExpanded && (
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <View style={styles.commentsSection}>
                {!comments ? (
                  <ActivityIndicator size="small" color="#6b7280" />
                ) : comments.length === 0 ? (
                  <Text style={styles.noComments}>No comments yet</Text>
                ) : (
                  comments.map((c: Comment) => (
                    <View key={c.id} style={styles.commentRow}>
                      <View style={styles.commentAvatar}>
                        <Text style={styles.commentAvatarText}>{(c.username ?? '?').charAt(0).toUpperCase()}</Text>
                      </View>
                      <View style={styles.commentBody}>
                        <Text style={styles.commentUsername}>{c.username ?? 'Unknown'}</Text>
                        <Text style={styles.commentText}>{c.body}</Text>
                        <Text style={styles.commentTime}>
                          {new Date(c.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </View>
                    </View>
                  ))
                )}
                <View style={styles.commentInputRow}>
                  <TextInput style={styles.commentInput} value={commentDrafts[postKey] ?? ''} onChangeText={(text) => setCommentDrafts((prev) => ({ ...prev, [postKey]: text }))} placeholder="Write a comment..." placeholderTextColor="#374151" multiline={false} />
                  <TouchableOpacity style={[styles.commentSendBtn, (!commentDrafts[postKey]?.trim() || postingComment[postKey]) && styles.commentSendBtnDisabled]} disabled={!commentDrafts[postKey]?.trim() || postingComment[postKey]} onPress={() => handleSendComment(post.id)}>
                    <Text style={styles.commentSendText}>{postingComment[postKey] ? '...' : 'Send'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </KeyboardAvoidingView>
          )}
        </View>
      )
    }

    const p = item.data
    const sev = SEVERITY_COLORS[p.worst_severity] ?? SEVERITY_COLORS.Unknown
    const potholeKey = p.pothole_id
    const pComments = potholeComments[potholeKey]
    const pVerifyCount = pComments ? pComments.filter((c: any) => c.body.includes('✅')).length : 0
    const pCommentCount = pComments ? pComments.length : 0
    const pIsExpanded = potholeExpandedId === potholeKey

    return (
      <View style={styles.postCard}>
        <TouchableOpacity activeOpacity={0.85} onPress={() => onViewDetail(item)}>
          {p.image_url ? (
            <Image source={{ uri: p.image_url }} style={styles.postImage} />
          ) : (
            <View style={[styles.potholePlaceholder, { backgroundColor: sev.bg }]}>
              <View style={styles.potholePlaceholderIcon}><Ionicons name="warning" size={32} color={sev.color} /></View>
              <Text style={[styles.potholePlaceholderLabel, { color: sev.color }]}>Pothole</Text>
            </View>
          )}
          <View style={styles.postBody}>
            <View style={styles.postTopRow}>
              <View style={styles.reporterRow}>
                <Ionicons name="person-circle-outline" size={16} color="#52525b" />
                <Text style={styles.reporter}>{p.reporter_username ?? 'Auto-detected'}</Text>
              </View>
              <Text style={styles.time}>
                {p.citizen_first_reported_at ? new Date(p.citizen_first_reported_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : null}
              </Text>
              <TouchableOpacity onPress={() => onViewOnMap(item)} style={styles.mapBtn} activeOpacity={0.7}>
                <Ionicons name="map-outline" size={15} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <Text style={styles.address}>{formatAddress(p)}</Text>
            <View style={styles.potholeMetaRow}>
              <View style={[styles.severityBadge, { backgroundColor: sev.bg }]}>
                <View style={[styles.severityDot, { backgroundColor: sev.color }]} />
                <Text style={[styles.severityLabel, { color: sev.color }]}>{p.worst_severity}</Text>
              </View>
              <View style={styles.hitsBadge}><Ionicons name="flash" size={12} color="#6b7280" /><Text style={styles.hitsText}>{p.total_detection_hits} hit{p.total_detection_hits !== 1 ? 's' : ''}</Text></View>
              <View style={styles.hitsBadge}><Ionicons name="people" size={12} color="#6b7280" /><Text style={styles.hitsText}>{p.detectors_count} detector{p.detectors_count !== 1 ? 's' : ''}</Text></View>
            </View>
          </View>
        </TouchableOpacity>
        <View style={styles.verifyRow}>
          <TouchableOpacity style={styles.verifyBtnStill} onPress={() => handlePotholeVerify(potholeKey, '✅ Still here')} activeOpacity={0.7}>
            <Ionicons name="checkmark-circle-outline" size={14} color="#22c55e" /><Text style={styles.verifyBtnStillText}>Still here</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.verifyBtnFixed} onPress={() => handlePotholeVerify(potholeKey, '✅ Fixed')} activeOpacity={0.7}>
            <Ionicons name="close-circle-outline" size={14} color="#ef4444" /><Text style={styles.verifyBtnFixedText}>Fixed</Text>
          </TouchableOpacity>
          <Text style={styles.verifyCount}>{pVerifyCount}</Text>
        </View>
        <TouchableOpacity style={styles.commentsToggle} onPress={() => {
          if (potholeExpandedId === potholeKey) { setPotholeExpandedId(null) }
          else { setPotholeExpandedId(potholeKey); if (!potholeComments[potholeKey]) loadPotholeComments(potholeKey) }
        }} activeOpacity={0.7}>
          <Ionicons name={pIsExpanded ? 'chatbubble-ellipses' : 'chatbubble-outline'} size={14} color="#6b7280" />
          <Text style={styles.commentsToggleText}>{pCommentCount > 0 ? `${pCommentCount} comment${pCommentCount !== 1 ? 's' : ''}` : 'Comment'}</Text>
          <Ionicons name={pIsExpanded ? 'chevron-up' : 'chevron-down'} size={12} color="#52525b" />
        </TouchableOpacity>
        {pIsExpanded && (
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.commentsSection}>
              {!pComments ? <ActivityIndicator size="small" color="#6b7280" />
              : pComments.length === 0 ? <Text style={styles.noComments}>No comments yet</Text>
              : pComments.map((c: any) => (
                <View key={c.id} style={styles.commentRow}>
                  <View style={styles.commentAvatar}><Text style={styles.commentAvatarText}>{(c.username ?? '?').charAt(0).toUpperCase()}</Text></View>
                  <View style={styles.commentBody}>
                    <Text style={styles.commentUsername}>{c.username ?? 'Unknown'}</Text>
                    <Text style={styles.commentText}>{c.body}</Text>
                    <Text style={styles.commentTime}>{new Date(c.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</Text>
                  </View>
                </View>
              ))}
              <View style={styles.commentInputRow}>
                <TextInput style={styles.commentInput} value={potholeDrafts[potholeKey] ?? ''} onChangeText={(text) => setPotholeDrafts((prev) => ({ ...prev, [potholeKey]: text }))} placeholder="Write a comment..." placeholderTextColor="#374151" multiline={false} />
                <TouchableOpacity style={[styles.commentSendBtn, (!potholeDrafts[potholeKey]?.trim() || potholePosting[potholeKey]) && styles.commentSendBtnDisabled]} disabled={!potholeDrafts[potholeKey]?.trim() || potholePosting[potholeKey]} onPress={() => handlePotholeSendComment(potholeKey)}>
                  <Text style={styles.commentSendText}>{potholePosting[potholeKey] ? '...' : 'Send'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        )}
      </View>
    )
  }, [commentsByPost, expandedPostId, commentDrafts, postingComment, potholeComments, potholeExpandedId, potholeDrafts, potholePosting, onViewDetail, toggleComments, handleVerify, handleSendComment, loadPotholeComments, handlePotholeVerify, handlePotholeSendComment])

  const hasNoContent = filteredFeedItems.length === 0 && filteredPending.length === 0

  const ListHeader = useCallback(() => (
    <>
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

      <FilterBar filters={filters} onFiltersChange={setFilters} />

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="people-outline" size={14} color="#a1a1aa" />
          <Text style={styles.sectionTitle}>Feed</Text>
          <Text style={styles.sectionCount}>{filteredFeedItems.length}</Text>
        </View>
      </View>
    </>
  ), [filteredPending, uploadingIds, filteredFeedItems.length, handleUpload, handleDelete])

  const ListEmpty = useCallback(() => {
    if (loading) return <View style={styles.loadingWrap}><ActivityIndicator size="small" color="#e6a817" /></View>
    if (hasNoContent) return (
      <View style={styles.emptyState}>
        <View style={styles.emptyIconWrap}><Ionicons name="camera-outline" size={32} color="#52525b" /></View>
        <Text style={styles.emptyTitle}>No reports yet</Text>
        <Text style={styles.emptySub}>Be the first to capture road distress</Text>
        <TouchableOpacity style={styles.emptyBtn} onPress={onPhoto} activeOpacity={0.7}>
          <Ionicons name="camera" size={16} color="#0c0c14" />
          <Text style={styles.emptyBtnText}>Take a Photo</Text>
        </TouchableOpacity>
      </View>
    )
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptySub}>No reports match your filters</Text>
      </View>
    )
  }, [loading, hasNoContent, onPhoto])

  const ListFooter = useCallback(() => {
    if (loadingMore) return <View style={styles.loadingWrap}><ActivityIndicator size="small" color="#e6a817" /></View>
    if (!hasMorePhotos && !hasMorePotholes && filteredFeedItems.length > 0) return <Text style={styles.endText}>That's all</Text>
    return null
  }, [loadingMore, hasMorePhotos, hasMorePotholes, filteredFeedItems.length])

  return (
    <View style={styles.container}>
      <View style={styles.feedHeader}>
        <TouchableOpacity onPress={onMenuPress} style={styles.menuBtn} activeOpacity={0.7}>
          <Ionicons name="menu" size={22} color="#e0e0e0" />
        </TouchableOpacity>
        <View style={styles.feedHeaderCenter}>
          <Text style={styles.feedHeaderLabel}>Sipat</Text>
          <View style={styles.feedHeaderDot} />
        </View>
      </View>

      <FlatList
        data={filteredFeedItems}
        renderItem={renderFeedItem}
        keyExtractor={(item) => item.type === 'photo' ? `photo-${item.data.id}` : `pothole-${item.data.pothole_id}`}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        ListFooterComponent={ListFooter}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0c0c14' },
  feedHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: 56, paddingBottom: 12, paddingHorizontal: 20,
  },
  menuBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  feedHeaderCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginRight: 38 },
  feedHeaderLabel: { color: '#f0f0f0', fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  feedHeaderDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#e6a817' },
  scrollContent: { paddingBottom: 40, paddingHorizontal: 16 },

  section: { marginTop: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#e6a817' },
  sectionTitle: { color: '#a1a1aa', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, flex: 1 },
  sectionCount: { color: '#52525b', fontSize: 11, fontWeight: '600', backgroundColor: 'rgba(255,255,255,0.04)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, overflow: 'hidden' },

  // Filter
  filterToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 4 },
  filterToggleText: { color: '#a1a1aa', fontSize: 13, fontWeight: '500', flex: 1 },
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  filterInput: {
    flex: 1, minWidth: 80, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10,
    paddingVertical: 10, paddingHorizontal: 12, color: '#f0f0f0', fontSize: 13,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)',
  },
  filterClear: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10, backgroundColor: 'rgba(230,168,23,0.1)' },
  filterClearText: { color: '#e6a817', fontSize: 12, fontWeight: '600' },

  postCard: { backgroundColor: '#141420', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)', marginBottom: 12 },
  postImage: { width: '100%', height: 180, resizeMode: 'cover' },
  postBody: { padding: 14 },
  postTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 },
  reporterRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  mapBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#191925', alignItems: 'center', justifyContent: 'center', marginLeft: 4 },
  reporter: { color: '#a1a1aa', fontSize: 13, fontWeight: '500' },
  caption: { color: '#e4e4e7', fontSize: 14, lineHeight: 20 },
  noCaption: { color: '#3f3f46', fontSize: 13, fontStyle: 'italic' },
  time: { color: '#52525b', fontSize: 11, marginTop: 4 },
  address: { color: '#a1a1aa', fontSize: 12, lineHeight: 16, marginTop: 2 },

  postActions: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingBottom: 14 },
  uploadBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(6,182,212,0.1)', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 10 },
  uploadBtnText: { color: '#06b6d4', fontSize: 13, fontWeight: '600' },
  deleteBtn: { padding: 8, backgroundColor: 'rgba(220,38,38,0.08)', borderRadius: 10 },
  uploadingBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(245,158,11,0.1)', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10 },
  uploadingText: { color: '#f59e0b', fontSize: 12, fontWeight: '600' },
  analyzingBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(245,158,11,0.08)', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10 },
  analyzingText: { color: '#f59e0b', fontSize: 12, fontWeight: '600' },

  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, marginTop: 4 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontWeight: '600' },

  potholePlaceholder: { width: '100%', height: 140, justifyContent: 'center', alignItems: 'center' },
  potholePlaceholderIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(0,0,0,0.2)', justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  potholePlaceholderLabel: { fontSize: 13, fontWeight: '700' },
  potholeMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  severityBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 8 },
  severityDot: { width: 6, height: 6, borderRadius: 3 },
  severityLabel: { fontSize: 11, fontWeight: '700' },
  hitsBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  hitsText: { color: '#6b7280', fontSize: 11, fontWeight: '500' },

  verifyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingBottom: 10 },
  verifyBtnStill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(34,197,94,0.08)', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(34,197,94,0.15)' },
  verifyBtnStillText: { color: '#22c55e', fontSize: 12, fontWeight: '600' },
  verifyBtnFixed: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(239,68,68,0.08)', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(239,68,68,0.15)' },
  verifyBtnFixedText: { color: '#ef4444', fontSize: 12, fontWeight: '600' },
  verifyCount: { color: '#71717a', fontSize: 11, fontWeight: '600', marginLeft: 'auto' },

  commentsToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingBottom: 10 },
  commentsToggleText: { color: '#6b7280', fontSize: 12, fontWeight: '500', flex: 1 },
  commentsSection: { paddingHorizontal: 14, paddingBottom: 14 },
  noComments: { color: '#374151', fontSize: 12, textAlign: 'center', paddingVertical: 8 },
  commentRow: { flexDirection: 'row', gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)' },
  commentAvatar: { width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(230, 168, 23, 0.12)', justifyContent: 'center', alignItems: 'center' },
  commentAvatarText: { color: '#e6a817', fontSize: 10, fontWeight: '700' },
  commentBody: { flex: 1 },
  commentUsername: { color: '#e4e4e7', fontSize: 11, fontWeight: '600' },
  commentText: { color: '#a1a1aa', fontSize: 12, marginTop: 1, lineHeight: 16 },
  commentTime: { color: '#6b7280', fontSize: 10, marginTop: 2 },
  commentInputRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  commentInput: { flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, color: '#f0f0f0', fontSize: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)' },
  commentSendBtn: { backgroundColor: 'rgba(230, 168, 23, 0.15)', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8 },
  commentSendBtnDisabled: { opacity: 0.4 },
  commentSendText: { color: '#e6a817', fontSize: 12, fontWeight: '700' },

  loadingWrap: { paddingVertical: 40, alignItems: 'center' },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyIconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.03)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyTitle: { color: '#f0f0f0', fontSize: 16, fontWeight: '700' },
  emptySub: { color: '#4b5563', fontSize: 13, marginTop: 6, textAlign: 'center' },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#e6a817', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 14, marginTop: 20 },
  emptyBtnText: { color: '#0c0c14', fontSize: 14, fontWeight: '700' },
  endText: { color: '#374151', fontSize: 12, textAlign: 'center', paddingVertical: 24 },
})
