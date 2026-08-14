import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
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
import AsyncStorage from '@react-native-async-storage/async-storage'
import ReportButton from '../components/ReportButton'
import VoteButtons from '../components/VoteButtons'
import { supabase } from '../lib/supabase'
import { loadPendingPhotos, updatePhotoPost, deletePhotoPost } from '../lib/pendingPhotos'
import { uploadCommunityPhoto } from '../lib/uploadCommunityPhoto'
import { validateComment, MAX_COMMENT_LENGTH } from '../lib/spamDetection'
import type { LocalPhotoPost } from '../lib/types'

type Comment = {
  id: string
  body: string
  created_at: string
  username: string | null
  user_id: string | null
}

type Props = {
  feedRefreshKey: number
  userId: string
  onTabChange: (tab: 'dashboard' | 'feed') => void
  onPhoto: () => void
  onMenuPress: () => void
  onSearch: () => void
  onViewDetail: (item: { type: 'photo'; data: any } | { type: 'pothole'; data: any }) => void
  onViewOnMap: (item: { type: 'photo'; data: any } | { type: 'pothole'; data: any }) => void
  onViewProfile: (userId: string) => void
}

type FeedItem = { type: 'photo'; data: any } | { type: 'pothole'; data: any }

const PAGE_SIZE = 10

const STATUS_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Analyzing...', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
  processed: { label: 'Detected', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)' },
  no_detection: { label: 'No Distress', color: '#71717a', bg: 'rgba(107, 114, 128, 0.1)' },
  manually_tagged: { label: 'Tagged by User', color: '#a855f7', bg: 'rgba(168, 85, 247, 0.1)' },
}

const SEVERITY_COLORS: Record<string, { color: string; bg: string }> = {
  Minor: { color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
  Moderate: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  Severe: { color: '#ef4444', bg: 'rgba(239, 68, 68,0.1)' },
  Unknown: { color: '#71717a', bg: 'rgba(107,114,128,0.1)' },
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
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={12} color="#71717a" />
      </TouchableOpacity>
      {expanded && (
        <View style={styles.filterRow}>
          <TextInput style={styles.filterInput} value={local.country} onChangeText={(t) => setLocal((p) => ({ ...p, country: t }))} onBlur={() => onFiltersChange(local)} placeholder="Country" placeholderTextColor="#71717a" />
          <TextInput style={styles.filterInput} value={local.city} onChangeText={(t) => setLocal((p) => ({ ...p, city: t }))} onBlur={() => onFiltersChange(local)} placeholder="City" placeholderTextColor="#71717a" />
          <TextInput style={styles.filterInput} value={local.street} onChangeText={(t) => setLocal((p) => ({ ...p, street: t }))} onBlur={() => onFiltersChange(local)} placeholder="Street" placeholderTextColor="#71717a" />
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

export default function FeedScreen({ feedRefreshKey, userId, onTabChange, onPhoto, onMenuPress, onSearch, onViewDetail, onViewOnMap, onViewProfile }: Props) {
  const [pendingPosts, setPendingPosts] = useState<LocalPhotoPost[]>([])
  const [uploadedPosts, setUploadedPosts] = useState<any[]>([])
  const [uploadingIds, setUploadingIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null)
  const [commentsByPost, setCommentsByPost] = useState<Record<string, Comment[]>>({})
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({})
  const [postingComment, setPostingComment] = useState<Record<string, boolean>>({})
  const [photoVotes, setPhotoVotes] = useState<Record<string, { upvotes: number; downvotes: number; userVote: number }>>({})
  const [potholeVotes, setPotholeVotes] = useState<Record<string, { upvotes: number; downvotes: number; userVote: number }>>({})

  const [potholes, setPotholes] = useState<any[]>([])
  const [potholeExpandedId, setPotholeExpandedId] = useState<number | null>(null)
  const [potholeComments, setPotholeComments] = useState<Record<number, any[]>>({})
  const [potholeDrafts, setPotholeDrafts] = useState<Record<number, string>>({})
  const [potholePosting, setPotholePosting] = useState<Record<number, boolean>>({})

  const [filters, setFilters] = useState({ country: '', city: '', street: '' })
  const [sortBy, setSortBy] = useState<'hot' | 'new' | 'old'>('hot')
  const [photoOffset, setPhotoOffset] = useState(0)
  const [potholeOffset, setPotholeOffset] = useState(0)
  const [hasMorePhotos, setHasMorePhotos] = useState(true)
  const [hasMorePotholes, setHasMorePotholes] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [showFeedGuide, setShowFeedGuide] = useState(false)

  useEffect(() => {
    AsyncStorage.getItem('@sipat_feed_guide_seen').then((seen) => {
      if (!seen) setShowFeedGuide(true)
    })
  }, [])

  const dismissFeedGuide = () => {
    setShowFeedGuide(false)
    AsyncStorage.setItem('@sipat_feed_guide_seen', '1')
  }

  const loadPosts = useCallback(async (page = 0) => {
    if (page === 0) setLoading(true)
    const photoOff = page * PAGE_SIZE
    const potholeOff = page * PAGE_SIZE

    const [pending, photoRes, potholeRes] = await Promise.all([
      page === 0 ? loadPendingPhotos() : Promise.resolve([] as LocalPhotoPost[]),
      supabase.rpc('get_feed_photos', { p_offset: photoOff, p_limit: PAGE_SIZE }),
      supabase.rpc('get_feed_potholes', { p_offset: potholeOff, p_limit: PAGE_SIZE }),
    ])
    const photoData = photoRes.data
    const potholeData = potholeRes.data
    if (photoRes.error) console.error('[FeedScreen] get_feed_photos error:', photoRes.error)
    if (potholeRes.error) console.error('[FeedScreen] get_feed_potholes error:', potholeRes.error)

    const pvMap: Record<string, { upvotes: number; downvotes: number; userVote: number }> = {}
    for (const p of photoData ?? []) {
      pvMap[String(p.id)] = {
        upvotes: Number(p.upvote_count ?? 0),
        downvotes: Number(p.downvote_count ?? 0),
        userVote: Number(p.user_vote ?? 0),
      }
    }
    const hvMap: Record<string, { upvotes: number; downvotes: number; userVote: number }> = {}
    for (const h of potholeData ?? []) {
      hvMap[String(h.pothole_id)] = {
        upvotes: Number(h.upvote_count ?? 0),
        downvotes: Number(h.downvote_count ?? 0),
        userVote: Number(h.user_vote ?? 0),
      }
    }

    if (page === 0) {
      setPendingPosts(pending as LocalPhotoPost[])
      setUploadedPosts(photoData ?? [])
      setPotholes(potholeData ?? [])
      setPhotoVotes(pvMap)
      setPotholeVotes(hvMap)
      setPhotoOffset(PAGE_SIZE)
      setPotholeOffset(PAGE_SIZE)
    } else {
      setUploadedPosts((prev) => [...prev, ...(photoData ?? [])])
      setPotholes((prev) => [...prev, ...(potholeData ?? [])])
      setPhotoVotes((prev) => ({ ...prev, ...pvMap }))
      setPotholeVotes((prev) => ({ ...prev, ...hvMap }))
      setPhotoOffset((prev) => prev + PAGE_SIZE)
      setPotholeOffset((prev) => prev + PAGE_SIZE)
    }

    setHasMorePhotos((photoData ?? []).length === PAGE_SIZE)
    setHasMorePotholes((potholeData ?? []).length === PAGE_SIZE)
    setLoading(false)
    setLoadingMore(false)
  }, [])

  useEffect(() => {
    loadPosts(0)
    loadPendingPhotos().then((posts) => {
      const stale = posts.filter((p) => p.status === 'uploaded')
      stale.forEach((p) => deletePhotoPost(p.id))
    })
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
      await deletePhotoPost(post.id)
      setPendingPosts((prev) => prev.filter((p) => p.id !== post.id))
    } catch (e: any) {
      console.error('[FeedScreen] Upload failed:', e?.message ?? String(e))
      Alert.alert('Upload Failed', e?.message ?? 'Unknown error')
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

    const validation = validateComment(text)
    if (!validation.ok) {
      Alert.alert('Comment blocked', validation.error!)
      return
    }

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

  const handleDeletePhoto = useCallback(async (postId: number) => {
    Alert.alert('Delete post', 'Are you sure you want to delete this photo? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          const { error } = await supabase.from('community_photos').delete().eq('id', postId)
          if (error) {
            Alert.alert('Error', error.message)
            return
          }
          setUploadedPosts((prev) => prev.filter((p) => p.id !== postId))
        }
      },
    ])
  }, [])

  const handleTagAsPothole = useCallback(async (postId: number) => {
    Alert.alert('Tag as Pothole', 'Manually mark this photo as a road pothole? This overrides the AI result.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm', onPress: async () => {
          const { error } = await supabase
            .from('community_photos')
            .update({ detection_status: 'manually_tagged', class_name: 'manually_tagged', confidence: 1.0 })
            .eq('id', postId)
          if (error) {
            Alert.alert('Error', error.message)
            return
          }
          setUploadedPosts((prev) => prev.map((p) =>
            p.id === postId ? { ...p, detection_status: 'manually_tagged', class_name: 'manually_tagged', confidence: 1.0 } : p
          ))
        }
      },
    ])
  }, [])

  const handleDeletePothole = useCallback(async (pothole: any) => {
    Alert.alert('Delete detection', 'Are you sure you want to delete this detection? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          const { error } = await supabase.from('raw_detections')
            .delete()
            .eq('user_id', pothole.reporter_user_id)
            .gte('latitude', pothole.consolidated_latitude - 0.0001)
            .lte('latitude', pothole.consolidated_latitude + 0.0001)
            .gte('longitude', pothole.consolidated_longitude - 0.0001)
            .lte('longitude', pothole.consolidated_longitude + 0.0001)
          if (error) {
            Alert.alert('Error', error.message)
            return
          }
          setPotholes((prev) => prev.filter((p) => p.pothole_id !== pothole.pothole_id))
        }
      },
    ])
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

    const validation = validateComment(text)
    if (!validation.ok) {
      Alert.alert('Comment blocked', validation.error!)
      return
    }

    setPotholePosting((prev) => ({ ...prev, [potholeId]: true }))
    await supabase.rpc('create_detection_comment', { p_pothole_id: potholeId, p_body: text })
    await loadPotholeComments(potholeId)
    setPotholeDrafts((prev) => ({ ...prev, [potholeId]: '' }))
    setPotholePosting((prev) => ({ ...prev, [potholeId]: false }))
  }, [potholeDrafts, potholePosting, loadPotholeComments])

  const allUploadedIds = new Set(uploadedPosts.map((p) => String(p.id)))
  const filteredPending = pendingPosts.filter((p) => {
    if (p.status === 'uploaded' && p.remoteId != null && allUploadedIds.has(String(p.remoteId))) return false
    return true
  })

  const feedItems: FeedItem[] = [
    ...uploadedPosts.map((p) => ({ type: 'photo' as const, data: p })),
    ...potholes.map((p) => ({ type: 'pothole' as const, data: p })),
  ].sort((a: any, b: any) => {
    switch (sortBy) {
      case 'new': {
        const ta = a.type === 'photo' ? a.data.created_at : (a.data.latest_activity_at || a.data.citizen_first_reported_at)
        const tb = b.type === 'photo' ? b.data.created_at : (b.data.latest_activity_at || b.data.citizen_first_reported_at)
        return new Date(tb).getTime() - new Date(ta).getTime()
      }
      case 'old': {
        const ta = a.type === 'photo' ? a.data.created_at : (a.data.latest_activity_at || a.data.citizen_first_reported_at)
        const tb = b.type === 'photo' ? b.data.created_at : (b.data.latest_activity_at || b.data.citizen_first_reported_at)
        return new Date(ta).getTime() - new Date(tb).getTime()
      }
      case 'hot':
      default: {
        const sa = a.data.hot_score ?? 0
        const sb = b.data.hot_score ?? 0
        return sb - sa
      }
    }
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
                <TouchableOpacity style={styles.reporterRow} onPress={() => post.user_id && onViewProfile(post.user_id)} activeOpacity={0.7}>
                  <Ionicons name="person-circle-outline" size={16} color="#71717a" />
                  <Text style={styles.reporter}>{post.reporter_username ?? 'Anonymous'}</Text>
                </TouchableOpacity>
                <Text style={styles.time}>
                  {new Date(post.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </Text>
                {post.user_id === userId && (
                  <TouchableOpacity onPress={() => handleDeletePhoto(post.id)} style={styles.mapBtn} activeOpacity={0.7}>
                    <Ionicons name="trash-outline" size={15} color="#ef4444" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => onViewOnMap(item)} style={styles.mapBtn} activeOpacity={0.7}>
                  <Ionicons name="map-outline" size={15} color="#71717a" />
                </TouchableOpacity>
              </View>
              {post.caption ? <Text style={styles.caption}>{post.caption}</Text> : null}
              <View style={styles.statusRow}>
                <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                  <View style={[styles.statusDot, { backgroundColor: badge.color }]} />
                  <Text style={[styles.statusText, { color: badge.color }]}>{badge.label}</Text>
                </View>
                {post.detection_status === 'no_detection' && userId && (
                  <TouchableOpacity style={styles.tagPotholeBtn} onPress={() => handleTagAsPothole(post.id)} activeOpacity={0.7}>
                    <Ionicons name="warning-outline" size={12} color="#f59e0b" />
                    <Text style={styles.tagPotholeText}>This is a pothole</Text>
                  </TouchableOpacity>
                )}
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
          <View style={styles.voteRow}>
            <VoteButtons
              contentType="photo"
              contentId={String(post.id)}
              initialUpvotes={photoVotes[String(post.id)]?.upvotes ?? 0}
              initialDownvotes={photoVotes[String(post.id)]?.downvotes ?? 0}
              initialUserVote={photoVotes[String(post.id)]?.userVote ?? 0}
              onVoteChange={(upvotes, downvotes, userVote) =>
                setPhotoVotes((prev) => ({ ...prev, [String(post.id)]: { upvotes, downvotes, userVote } }))
              }
            />
            <ReportButton
              contentType="photo"
              contentId={String(post.id)}
              onReported={(count) => {
                setUploadedPosts(prev => prev.map(p =>
                  p.id === post.id ? { ...p, report_count: count } : p
                ));
              }}
            />
          </View>
          <TouchableOpacity style={styles.commentsToggle} onPress={() => {
            if (commentCount > 0) {
              onViewDetail(item)
            } else {
              toggleComments(post.id)
            }
          }} activeOpacity={0.7}>
            <Ionicons name={commentCount > 0 ? 'chatbubble-ellipses' : 'chatbubble-outline'} size={14} color="#71717a" />
            <Text style={styles.commentsToggleText}>
              {commentCount > 0 ? `View all ${commentCount} comment${commentCount !== 1 ? 's' : ''}` : 'Comment'}
            </Text>
            {commentCount > 0 && <Ionicons name="open-outline" size={12} color="#71717a" />}
          </TouchableOpacity>
          {isExpanded && (
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <View style={styles.commentsSection}>
                {!comments ? (
                  <ActivityIndicator size="small" color="#71717a" />
                ) : comments.length === 0 ? (
                  <Text style={styles.noComments}>No comments yet</Text>
                ) : (
                  comments.map((c: Comment) => (
                    <View key={c.id} style={styles.commentRow}>
                      <TouchableOpacity style={styles.commentAvatar} onPress={() => c.user_id && onViewProfile(c.user_id)} activeOpacity={0.7}>
                        <Text style={styles.commentAvatarText}>{(c.username ?? '?').charAt(0).toUpperCase()}</Text>
                      </TouchableOpacity>
                      <View style={styles.commentBody}>
                        <TouchableOpacity onPress={() => c.user_id && onViewProfile(c.user_id)} activeOpacity={0.7}>
                          <Text style={styles.commentUsername}>{c.username ?? 'Unknown'}</Text>
                        </TouchableOpacity>
                        <Text style={styles.commentText}>{c.body}</Text>
                        <Text style={styles.commentTime}>
                          {new Date(c.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </View>
                    </View>
                  ))
                )}
                <View style={styles.commentInputRow}>
                  <TextInput style={styles.commentInput} value={commentDrafts[postKey] ?? ''} onChangeText={(text) => setCommentDrafts((prev) => ({ ...prev, [postKey]: text }))} placeholder="Write a comment..." placeholderTextColor="#71717a" multiline={false} />
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
              <TouchableOpacity style={styles.reporterRow} onPress={() => p.reporter_user_id && onViewProfile(p.reporter_user_id)} activeOpacity={0.7}>
                <Ionicons name="person-circle-outline" size={16} color="#71717a" />
                <Text style={styles.reporter}>{p.reporter_username ?? 'Auto-detected'}</Text>
              </TouchableOpacity>
              <Text style={styles.time}>
                {p.citizen_first_reported_at ? new Date(p.citizen_first_reported_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : null}
              </Text>
              {p.reporter_user_id === userId && (
                <TouchableOpacity onPress={() => handleDeletePothole(p)} style={styles.mapBtn} activeOpacity={0.7}>
                  <Ionicons name="trash-outline" size={15} color="#ef4444" />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => onViewOnMap(item)} style={styles.mapBtn} activeOpacity={0.7}>
                <Ionicons name="map-outline" size={15} color="#71717a" />
              </TouchableOpacity>
            </View>
            <Text style={styles.address}>{formatAddress(p)}</Text>
            {p.caption ? <Text style={styles.potholeCaption} numberOfLines={1}>{p.caption}</Text> : null}
            <View style={styles.potholeMetaRow}>
              <View style={[styles.severityBadge, { backgroundColor: sev.bg }]}>
                <View style={[styles.severityDot, { backgroundColor: sev.color }]} />
                <Text style={[styles.severityLabel, { color: sev.color }]}>{p.worst_severity}</Text>
              </View>
              <View style={styles.hitsBadge}><Ionicons name="flash" size={12} color="#71717a" /><Text style={styles.hitsText}>{p.total_detection_hits} hit{p.total_detection_hits !== 1 ? 's' : ''}</Text></View>
              <View style={styles.hitsBadge}><Ionicons name="people" size={12} color="#71717a" /><Text style={styles.hitsText}>{p.detectors_count} detector{p.detectors_count !== 1 ? 's' : ''}</Text></View>
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
        <View style={styles.voteRow}>
          <VoteButtons
            contentType="pothole"
            contentId={String(p.pothole_id)}
            initialUpvotes={potholeVotes[String(p.pothole_id)]?.upvotes ?? 0}
            initialDownvotes={potholeVotes[String(p.pothole_id)]?.downvotes ?? 0}
            initialUserVote={potholeVotes[String(p.pothole_id)]?.userVote ?? 0}
            onVoteChange={(upvotes, downvotes, userVote) =>
              setPotholeVotes((prev) => ({ ...prev, [String(p.pothole_id)]: { upvotes, downvotes, userVote } }))
            }
          />
          <ReportButton
            contentType="pothole"
            contentId={String(p.pothole_id)}
            onReported={(count) => {
              setPotholes(prev => prev.map(h =>
                h.pothole_id === p.pothole_id ? { ...h, report_count: count } : h
              ));
            }}
          />
        </View>
        <TouchableOpacity style={styles.commentsToggle} onPress={() => {
          if (pCommentCount > 0) {
            onViewDetail(item)
          } else {
            if (potholeExpandedId === potholeKey) { setPotholeExpandedId(null) }
            else { setPotholeExpandedId(potholeKey); if (!potholeComments[potholeKey]) loadPotholeComments(potholeKey) }
          }
        }} activeOpacity={0.7}>
          <Ionicons name={pCommentCount > 0 ? 'chatbubble-ellipses' : 'chatbubble-outline'} size={14} color="#71717a" />
          <Text style={styles.commentsToggleText}>{pCommentCount > 0 ? `View all ${pCommentCount} comment${pCommentCount !== 1 ? 's' : ''}` : 'Comment'}</Text>
          {pCommentCount > 0 && <Ionicons name="open-outline" size={12} color="#71717a" />}
        </TouchableOpacity>
        {pIsExpanded && (
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.commentsSection}>
              {!pComments ? <ActivityIndicator size="small" color="#71717a" />
              : pComments.length === 0 ? <Text style={styles.noComments}>No comments yet</Text>
              : pComments.map((c: any) => (
                <View key={c.id} style={styles.commentRow}>
                  <TouchableOpacity style={styles.commentAvatar} onPress={() => c.user_id && onViewProfile(c.user_id)} activeOpacity={0.7}>
                    <Text style={styles.commentAvatarText}>{(c.username ?? '?').charAt(0).toUpperCase()}</Text>
                  </TouchableOpacity>
                  <View style={styles.commentBody}>
                    <TouchableOpacity onPress={() => c.user_id && onViewProfile(c.user_id)} activeOpacity={0.7}>
                      <Text style={styles.commentUsername}>{c.username ?? 'Unknown'}</Text>
                    </TouchableOpacity>
                    <Text style={styles.commentText}>{c.body}</Text>
                    <Text style={styles.commentTime}>{new Date(c.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</Text>
                  </View>
                </View>
              ))}
              <View style={styles.commentInputRow}>
                <TextInput style={styles.commentInput} value={potholeDrafts[potholeKey] ?? ''} onChangeText={(text) => setPotholeDrafts((prev) => ({ ...prev, [potholeKey]: text }))} placeholder="Write a comment..." placeholderTextColor="#71717a" multiline={false} />
                <TouchableOpacity style={[styles.commentSendBtn, (!potholeDrafts[potholeKey]?.trim() || potholePosting[potholeKey]) && styles.commentSendBtnDisabled]} disabled={!potholeDrafts[potholeKey]?.trim() || potholePosting[potholeKey]} onPress={() => handlePotholeSendComment(potholeKey)}>
                  <Text style={styles.commentSendText}>{potholePosting[potholeKey] ? '...' : 'Send'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        )}
      </View>
    )
  }, [commentsByPost, expandedPostId, commentDrafts, postingComment, photoVotes, potholeVotes, potholeComments, potholeExpandedId, potholeDrafts, potholePosting, onViewDetail, toggleComments, handleVerify, handleSendComment, loadPotholeComments, handlePotholeVerify, handlePotholeSendComment, handleTagAsPothole])

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
                        <Ionicons name="trash-outline" size={14} color="#ef4444" />
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

      {/* Sort bar */}
      <View style={styles.sortBar}>
        {([
          { key: 'hot' as const, label: 'Hot', icon: 'flame' },
          { key: 'new' as const, label: 'New', icon: 'arrow-down' },
          { key: 'old' as const, label: 'Old', icon: 'arrow-up' },
        ]).map((opt) => (
          <TouchableOpacity
            key={opt.key}
            style={[styles.sortBtn, sortBy === opt.key && styles.sortBtnActive]}
            onPress={() => setSortBy(opt.key)}
            activeOpacity={0.7}
          >
            <Ionicons name={opt.icon as any} size={12} color={sortBy === opt.key ? '#0c0c14' : '#71717a'} />
            <Text style={[styles.sortBtnText, sortBy === opt.key && styles.sortBtnTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {showFeedGuide && (
        <View style={styles.guideCard}>
          <View style={styles.guideHeader}>
            <Text style={styles.guideTitle}>How the Feed Works</Text>
            <TouchableOpacity onPress={dismissFeedGuide} activeOpacity={0.7}>
              <Ionicons name="close" size={18} color="#71717a" />
            </TouchableOpacity>
          </View>
          <View style={styles.guideRow}>
            <View style={styles.guideIconWrap}><Ionicons name="thumbs-up-outline" size={16} color="#06b6d4" /></View>
            <View style={styles.guideTextWrap}>
              <Text style={styles.guideLabel}>Vote</Text>
              <Text style={styles.guideDesc}>Upvote posts you agree with. Most-voted posts rise to the top.</Text>
            </View>
          </View>
          <View style={styles.guideRow}>
            <View style={styles.guideIconWrap}><Ionicons name="flag-outline" size={16} color="#ef4444" /></View>
            <View style={styles.guideTextWrap}>
              <Text style={styles.guideLabel}>Report</Text>
              <Text style={styles.guideDesc}>Flag spam, duplicates, or wrong detections. 3 reports = auto-hidden.</Text>
            </View>
          </View>
          <View style={styles.guideRow}>
            <View style={styles.guideIconWrap}><Ionicons name="checkmark-circle-outline" size={16} color="#22c55e" /></View>
            <View style={styles.guideTextWrap}>
              <Text style={styles.guideLabel}>Verify</Text>
              <Text style={styles.guideDesc}>Confirm if a pothole is still there or has been fixed.</Text>
            </View>
          </View>
        </View>
      )}

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
    if (loading) return <View style={styles.loadingWrap}><ActivityIndicator size="small" color="#06b6d4" /></View>
    if (hasNoContent) return (
      <View style={styles.emptyState}>
        <View style={styles.emptyIconWrap}><Ionicons name="camera-outline" size={32} color="#71717a" /></View>
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
    if (loadingMore) return <View style={styles.loadingWrap}><ActivityIndicator size="small" color="#06b6d4" /></View>
    if (!hasMorePhotos && !hasMorePotholes && filteredFeedItems.length > 0) return <Text style={styles.endText}>That's all</Text>
    return null
  }, [loadingMore, hasMorePhotos, hasMorePotholes, filteredFeedItems.length])

  return (
    <View style={styles.container}>
      <View style={styles.feedHeader}>
        <TouchableOpacity onPress={onMenuPress} style={styles.menuBtn} activeOpacity={0.7}>
          <Ionicons name="menu" size={22} color="#fafafa" />
        </TouchableOpacity>
        <View style={styles.feedHeaderCenter}>
          <Text style={styles.feedHeaderLabel}>Sipat</Text>
          <View style={styles.feedHeaderDot} />
        </View>
        <TouchableOpacity onPress={onSearch} style={styles.searchBtn} activeOpacity={0.7}>
          <Ionicons name="search-outline" size={20} color="#fafafa" />
        </TouchableOpacity>
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
    paddingTop: Platform.OS === 'ios' ? 56 : 36, paddingBottom: 12, paddingHorizontal: 20,
  },
  menuBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.06)', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  searchBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.06)', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  feedHeaderCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginRight: 38 },
  feedHeaderLabel: { color: '#fafafa', fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  feedHeaderDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#06b6d4' },
  scrollContent: { paddingBottom: 40, paddingHorizontal: 16 },

  section: { marginTop: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#06b6d4' },
  sectionTitle: { color: '#a1a1aa', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, flex: 1 },
  sectionCount: { color: '#71717a', fontSize: 11, fontWeight: '600', backgroundColor: 'rgba(255, 255, 255, 0.06)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, overflow: 'hidden' },

  // Filter
  filterToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 4 },
  filterToggleText: { color: '#a1a1aa', fontSize: 13, fontWeight: '500', flex: 1 },
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  filterInput: {
    flex: 1, minWidth: 80, backgroundColor: 'rgba(255, 255, 255, 0.06)', borderRadius: 10,
    paddingVertical: 10, paddingHorizontal: 12, color: '#fafafa', fontSize: 13,
    borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  filterClear: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10, backgroundColor: 'rgba(6, 182, 212,0.1)' },
  filterClearText: { color: '#06b6d4', fontSize: 12, fontWeight: '600' },

  sortBar: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4, paddingVertical: 8 },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, backgroundColor: 'rgba(255, 255, 255, 0.06)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.06)' },
  sortBtnActive: { backgroundColor: '#06b6d4', borderColor: '#06b6d4' },
  sortBtnText: { color: '#71717a', fontSize: 12, fontWeight: '600' },
  sortBtnTextActive: { color: '#0c0c14' },

  // Feed guide
  guideCard: {
    marginHorizontal: 16, marginTop: 12,
    backgroundColor: '#18181b', borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  guideHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10,
  },
  guideTitle: { color: '#fafafa', fontSize: 14, fontWeight: '700' },
  guideRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8,
  },
  guideIconWrap: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.04)', justifyContent: 'center', alignItems: 'center', marginTop: 1,
  },
  guideTextWrap: { flex: 1 },
  guideLabel: { color: '#fafafa', fontSize: 13, fontWeight: '600', marginBottom: 1 },
  guideDesc: { color: '#71717a', fontSize: 12, lineHeight: 16 },

  postCard: { backgroundColor: '#18181b', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.06)', marginBottom: 12 },
  postImage: { width: '100%', height: 180, resizeMode: 'cover' },
  postBody: { padding: 14 },
  postTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 },
  reporterRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  mapBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#18181b', alignItems: 'center', justifyContent: 'center', marginLeft: 4 },
  reporter: { color: '#a1a1aa', fontSize: 13, fontWeight: '500' },
  caption: { color: '#fafafa', fontSize: 14, lineHeight: 20 },
  noCaption: { color: '#71717a', fontSize: 13, fontStyle: 'italic' },
  time: { color: '#71717a', fontSize: 11, marginTop: 4 },
  address: { color: '#a1a1aa', fontSize: 12, lineHeight: 16, marginTop: 2 },
  potholeCaption: { color: '#71717a', fontSize: 11, lineHeight: 15, marginTop: 4, fontStyle: 'italic' },

  postActions: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingBottom: 14 },
  uploadBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(6,182,212,0.1)', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 10 },
  uploadBtnText: { color: '#06b6d4', fontSize: 13, fontWeight: '600' },
  deleteBtn: { padding: 8, backgroundColor: 'rgba(239, 68, 68,0.08)', borderRadius: 10 },
  uploadingBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(245,158,11,0.1)', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10 },
  uploadingText: { color: '#f59e0b', fontSize: 12, fontWeight: '600' },
  analyzingBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(245,158,11,0.08)', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10 },
  analyzingText: { color: '#f59e0b', fontSize: 12, fontWeight: '600' },

  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, marginTop: 4 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 4 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontWeight: '600' },
  tagPotholeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: 5, paddingHorizontal: 10, borderRadius: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1, borderColor: 'rgba(245, 158, 11, 0.2)',
  },
  tagPotholeText: { color: '#f59e0b', fontSize: 11, fontWeight: '600' },

  potholePlaceholder: { width: '100%', height: 140, justifyContent: 'center', alignItems: 'center' },
  potholePlaceholderIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(0,0,0,0.2)', justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  potholePlaceholderLabel: { fontSize: 13, fontWeight: '700' },
  potholeMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  severityBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 8 },
  severityDot: { width: 6, height: 6, borderRadius: 3 },
  severityLabel: { fontSize: 11, fontWeight: '700' },
  hitsBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  hitsText: { color: '#71717a', fontSize: 11, fontWeight: '500' },

  verifyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingBottom: 10 },
  verifyBtnStill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(34,197,94,0.08)', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(34,197,94,0.15)' },
  verifyBtnStillText: { color: '#22c55e', fontSize: 12, fontWeight: '600' },
  verifyBtnFixed: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(239,68,68,0.08)', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(239,68,68,0.15)' },
  verifyBtnFixedText: { color: '#ef4444', fontSize: 12, fontWeight: '600' },
  verifyCount: { color: '#71717a', fontSize: 11, fontWeight: '600', marginLeft: 'auto' },

  commentsToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingBottom: 10 },
  commentsToggleText: { color: '#71717a', fontSize: 12, fontWeight: '500', flex: 1 },
  commentsSection: { paddingHorizontal: 14, paddingBottom: 14 },
  noComments: { color: '#71717a', fontSize: 12, textAlign: 'center', paddingVertical: 8 },
  commentRow: { flexDirection: 'row', gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)' },
  commentAvatar: { width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(6, 182, 212, 0.12)', justifyContent: 'center', alignItems: 'center' },
  commentAvatarText: { color: '#06b6d4', fontSize: 10, fontWeight: '700' },
  commentBody: { flex: 1 },
  commentUsername: { color: '#fafafa', fontSize: 11, fontWeight: '600' },
  commentText: { color: '#a1a1aa', fontSize: 12, marginTop: 1, lineHeight: 16 },
  commentTime: { color: '#71717a', fontSize: 10, marginTop: 2 },
  commentInputRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  commentInput: { flex: 1, backgroundColor: 'rgba(255, 255, 255, 0.06)', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, color: '#fafafa', fontSize: 13, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.06)' },
  commentSendBtn: { backgroundColor: 'rgba(6, 182, 212, 0.15)', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8 },
  commentSendBtnDisabled: { opacity: 0.4 },
  commentSendText: { color: '#06b6d4', fontSize: 12, fontWeight: '700' },
  voteRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.06)' },

  loadingWrap: { paddingVertical: 40, alignItems: 'center' },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyIconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.03)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyTitle: { color: '#fafafa', fontSize: 16, fontWeight: '700' },
  emptySub: { color: '#71717a', fontSize: 13, marginTop: 6, textAlign: 'center' },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#06b6d4', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 14, marginTop: 20 },
  emptyBtnText: { color: '#0c0c14', fontSize: 14, fontWeight: '700' },
  endText: { color: '#71717a', fontSize: 12, textAlign: 'center', paddingVertical: 24 },
})
