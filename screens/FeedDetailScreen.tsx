import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { fetchFastApi } from '../lib/fastapi'
import { supabase } from '../lib/supabase'
import ReportButton from '../components/ReportButton'
import VoteButtons from '../components/VoteButtons'

type Comment = {
  id: string
  body: string
  created_at: string
  username: string | null
  user_id: string | null
}

type Props = {
  item: { type: 'photo'; data: any } | { type: 'pothole'; data: any }
  onBack: () => void
  onViewOnMap: (item: { type: 'photo'; data: any } | { type: 'pothole'; data: any }) => void
  onViewProfile?: (userId: string) => void
}

const SEVERITY_COLORS: Record<string, { color: string; bg: string }> = {
  Minor: { color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
  Moderate: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  Severe: { color: '#dc2626', bg: 'rgba(222,38,38,0.1)' },
  Unknown: { color: '#6b7280', bg: 'rgba(107,114,128,0.1)' },
}

const STATUS_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Analyzing...', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
  processed: { label: 'Detected', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)' },
  no_detection: { label: 'No Distress', color: '#6b7280', bg: 'rgba(107, 114, 128, 0.1)' },
}

const formatAddress = (p: any) => {
  return p.formatted_address || [p.street, p.barangay, p.city, p.province].filter(Boolean).join(', ') || 'Unknown location'
}

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window')

export default function FeedDetailScreen({ item, onBack, onViewOnMap, onViewProfile }: Props) {
  const [comments, setComments] = useState<Comment[] | null>(null)
  const [draft, setDraft] = useState('')
  const [posting, setPosting] = useState(false)
  const [fullScreenImageUri, setFullScreenImageUri] = useState<string | null>(null)
  const [captionEditVisible, setCaptionEditVisible] = useState(false)
  const [captionDraft, setCaptionDraft] = useState(item.type === 'pothole' ? (item.data.caption ?? '') : '')
  const [savingCaption, setSavingCaption] = useState(false)
  const [voteData, setVoteData] = useState({ upvotes: 0, downvotes: 0, userVote: 0 })

  const loadComments = useCallback(async () => {
    if (item.type === 'photo') {
      const { data } = await supabase.rpc('get_community_photo_comments', { p_photo_id: item.data.id })
      setComments((data ?? []) as Comment[])
    } else {
      const { data } = await supabase.rpc('get_detection_comments', { p_pothole_id: item.data.pothole_id })
      setComments((data ?? []) as Comment[])
    }
  }, [item])

  useEffect(() => {
    loadComments()
  }, [])

  useEffect(() => {
    const fetchVotes = async () => {
      const { data } = await supabase.rpc('get_content_votes', {
        p_content_type: item.type,
        p_content_id: item.type === 'photo' ? String(item.data.id) : String(item.data.pothole_id),
      })
      if (data) setVoteData(data)
    }
    fetchVotes()
  }, [item])

  const handleVerify = useCallback(async (body: string) => {
    if (item.type === 'photo') {
      await supabase.rpc('create_community_photo_comment', { p_photo_id: item.data.id, p_body: body })
    } else {
      await supabase.rpc('create_detection_comment', { p_pothole_id: item.data.pothole_id, p_body: body })
    }
    loadComments()
  }, [item, loadComments])

  const handleSend = useCallback(async () => {
    const text = draft.trim()
    if (!text || posting) return
    setPosting(true)
    if (item.type === 'photo') {
      await supabase.rpc('create_community_photo_comment', { p_photo_id: item.data.id, p_body: text })
    } else {
      await supabase.rpc('create_detection_comment', { p_pothole_id: item.data.pothole_id, p_body: text })
    }
    await loadComments()
    setDraft('')
    setPosting(false)
  }, [draft, posting, item, loadComments])

  const handleSaveCaption = useCallback(async () => {
    if (item.type !== 'pothole' || savingCaption) return
    setSavingCaption(true)
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token
      await fetchFastApi(`/verified-potholes/${item.data.pothole_id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ caption: captionDraft.trim() }),
      })
      item.data.caption = captionDraft.trim()
      setCaptionEditVisible(false)
    } catch {
    } finally {
      setSavingCaption(false)
    }
  }, [item, captionDraft, savingCaption])

  const verifyCount = comments ? comments.filter((c) => c.body.includes('✅')).length : 0
  const commentCount = comments ? comments.length : 0

  if (item.type === 'photo') {
    const post = item.data
    const badge = STATUS_BADGE[post.detection_status] ?? STATUS_BADGE.pending

    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={22} color="#e0e0e0" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Photo Report</Text>
          <TouchableOpacity onPress={() => onViewOnMap(item)} style={styles.mapBtn} activeOpacity={0.7}>
            <Ionicons name="map-outline" size={18} color="#6b7280" />
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity activeOpacity={0.9} onPress={() => setFullScreenImageUri(post.image_url)}>
            <Image source={{ uri: post.image_url }} style={styles.heroImage} />
          </TouchableOpacity>
          <View style={styles.content}>
            <View style={styles.metaRow}>
              <TouchableOpacity style={styles.reporterRow} onPress={() => post.user_id && onViewProfile?.(post.user_id)} activeOpacity={0.7}>
                <Ionicons name="person-circle-outline" size={18} color="#52525b" />
                <Text style={styles.reporter}>{post.reporter_username ?? 'Anonymous'}</Text>
              </TouchableOpacity>
              <Text style={styles.date}>
                {new Date(post.created_at).toLocaleDateString(undefined, {
                  month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
                })}
              </Text>
            </View>
            {post.caption ? <Text style={styles.caption}>{post.caption}</Text> : null}
            <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
              <View style={[styles.statusDot, { backgroundColor: badge.color }]} />
              <Text style={[styles.statusText, { color: badge.color }]}>{badge.label}</Text>
            </View>
            {post.confidence != null && (
              <Text style={styles.confidence}>Confidence: {(post.confidence * 100).toFixed(0)}%</Text>
            )}
          </View>

          {renderInteractions()}
        </ScrollView>
        {fullScreenImageUri && (
          <FullScreenViewer uri={fullScreenImageUri} onClose={() => setFullScreenImageUri(null)} />
        )}
      </View>
    )
  }

  const p = item.data
  const sev = SEVERITY_COLORS[p.worst_severity] ?? SEVERITY_COLORS.Unknown

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color="#e0e0e0" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Detection</Text>
        <TouchableOpacity onPress={() => onViewOnMap(item)} style={styles.mapBtn} activeOpacity={0.7}>
          <Ionicons name="map-outline" size={18} color="#6b7280" />
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
        {p.image_url ? (
          <TouchableOpacity activeOpacity={0.9} onPress={() => setFullScreenImageUri(p.image_url)}>
            <Image source={{ uri: p.image_url }} style={styles.heroImage} />
          </TouchableOpacity>
        ) : (
          <View style={[styles.placeholder, { backgroundColor: sev.bg }]}>
            <View style={styles.placeholderIcon}>
              <Ionicons name="warning" size={40} color={sev.color} />
            </View>
            <Text style={[styles.placeholderLabel, { color: sev.color }]}>Pothole</Text>
          </View>
        )}
        <View style={styles.content}>
          <View style={styles.metaRow}>
            <TouchableOpacity style={styles.reporterRow} onPress={() => p.reporter_user_id && onViewProfile?.(p.reporter_user_id)} activeOpacity={0.7}>
              <Ionicons name="person-circle-outline" size={18} color="#52525b" />
              <Text style={styles.reporter}>{p.reporter_username ?? 'Auto-detected'}</Text>
            </TouchableOpacity>
            <Text style={styles.date}>
              {p.citizen_first_reported_at
                ? new Date(p.citizen_first_reported_at).toLocaleDateString(undefined, {
                    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
                  })
                : null}
            </Text>
          </View>
          <Text style={styles.address}>{formatAddress(p)}</Text>
          <View style={styles.captionRow}>
            {p.caption ? <Text style={styles.captionText} numberOfLines={3}>{p.caption}</Text> : <Text style={styles.captionPlaceholder}>No description yet.</Text>}
            <TouchableOpacity onPress={() => { setCaptionDraft(p.caption ?? ''); setCaptionEditVisible(true) }} style={styles.captionEditBtn} activeOpacity={0.7}>
              <Ionicons name="pencil" size={14} color="#71717a" />
            </TouchableOpacity>
          </View>
          <View style={styles.metaRow}>
            <View style={[styles.severityBadge, { backgroundColor: sev.bg }]}>
              <View style={[styles.severityDot, { backgroundColor: sev.color }]} />
              <Text style={[styles.severityLabel, { color: sev.color }]}>{p.worst_severity}</Text>
            </View>
            <View style={styles.statChip}>
              <Ionicons name="flash" size={12} color="#6b7280" />
              <Text style={styles.statText}>{p.total_detection_hits} hit{p.total_detection_hits !== 1 ? 's' : ''}</Text>
            </View>
            <View style={styles.statChip}>
              <Ionicons name="people" size={12} color="#6b7280" />
              <Text style={styles.statText}>{p.detectors_count} detector{p.detectors_count !== 1 ? 's' : ''}</Text>
            </View>
          </View>
        </View>

        {renderInteractions()}
      </ScrollView>
      {fullScreenImageUri && (
        <FullScreenViewer uri={fullScreenImageUri} onClose={() => setFullScreenImageUri(null)} />
      )}
      <Modal visible={captionEditVisible} transparent animationType="fade" onRequestClose={() => setCaptionEditVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Caption</Text>
            <TextInput style={styles.modalInput} value={captionDraft} onChangeText={setCaptionDraft} placeholder="Describe this pothole…" placeholderTextColor="#52525b" multiline maxLength={280} autoFocus />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setCaptionEditVisible(false)} style={styles.modalCancelBtn} activeOpacity={0.7}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSaveCaption} style={[styles.modalSaveBtn, savingCaption && { opacity: 0.5 }]} activeOpacity={0.7} disabled={savingCaption}>
                <Text style={styles.modalSaveText}>{savingCaption ? 'Saving…' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  )

  function renderInteractions() {
    return (
      <>
        <View style={styles.divider} />
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Verification</Text>
          <View style={styles.verifyRow}>
            <TouchableOpacity style={styles.verifyBtnStill} onPress={() => handleVerify('✅ Still here')} activeOpacity={0.7}>
              <Ionicons name="checkmark-circle-outline" size={16} color="#22c55e" />
              <Text style={styles.verifyBtnStillText}>Still here</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.verifyBtnFixed} onPress={() => handleVerify('✅ Fixed')} activeOpacity={0.7}>
              <Ionicons name="close-circle-outline" size={16} color="#ef4444" />
              <Text style={styles.verifyBtnFixedText}>Fixed</Text>
            </TouchableOpacity>
            <Text style={styles.verifyCount}>{verifyCount}</Text>
          </View>
        </View>

        <View style={styles.divider} />
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Community</Text>
          <View style={styles.communityRow}>
            <VoteButtons
              contentType={item.type}
              contentId={item.type === 'photo' ? String(item.data.id) : String(item.data.pothole_id)}
              initialUpvotes={voteData.upvotes}
              initialDownvotes={voteData.downvotes}
              initialUserVote={voteData.userVote}
            />
            <ReportButton
              contentType={item.type}
              contentId={item.type === 'photo' ? String(item.data.id) : String(item.data.pothole_id)}
            />
          </View>
        </View>

        <View style={styles.divider} />
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Comments ({commentCount})</Text>
          {!comments ? (
            <ActivityIndicator size="small" color="#6b7280" style={{ marginVertical: 16 }} />
          ) : comments.length === 0 ? (
            <Text style={styles.noComments}>No comments yet</Text>
          ) : (
            comments.map((c) => (
              <View key={c.id} style={styles.commentRow}>
                <TouchableOpacity style={styles.commentAvatar} onPress={() => c.user_id && onViewProfile?.(c.user_id)} activeOpacity={0.7}>
                  <Text style={styles.commentAvatarText}>{(c.username ?? '?').charAt(0).toUpperCase()}</Text>
                </TouchableOpacity>
                <View style={styles.commentBody}>
                  <TouchableOpacity onPress={() => c.user_id && onViewProfile?.(c.user_id)} activeOpacity={0.7}>
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
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.commentInputRow}>
              <TextInput
                style={styles.commentInput}
                value={draft}
                onChangeText={setDraft}
                placeholder="Write a comment..."
                placeholderTextColor="#374151"
                multiline={false}
              />
              <TouchableOpacity
                style={[styles.commentSendBtn, (!draft.trim() || posting) && styles.commentSendBtnDisabled]}
                disabled={!draft.trim() || posting}
                onPress={handleSend}
              >
                <Text style={styles.commentSendText}>{posting ? '...' : 'Send'}</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>

        <View style={{ height: 60 }} />
      </>
    )
  }
}

function FullScreenViewer({ uri, onClose }: { uri: string; onClose: () => void }) {
  const scale = useRef(new Animated.Value(1)).current
  const translate = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current
  const lastScale = useRef(1)
  const lastPan = useRef({ x: 0, y: 0 })
  const initialDist = useRef(0)

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => {
        if (g.numberActiveTouches >= 2) return true
        return lastScale.current > 1.05
      },
      onPanResponderGrant: () => {
        lastPan.current = { x: (translate as any).x?._value ?? 0, y: (translate as any).y?._value ?? 0 }
      },
      onPanResponderMove: (evt, g) => {
        const touches = evt.nativeEvent.touches
        if (touches && touches.length >= 2) {
          const dx = touches[0].pageX - touches[1].pageX
          const dy = touches[0].pageY - touches[1].pageY
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (initialDist.current === 0) { initialDist.current = dist; return }
          const s = Math.min(Math.max(lastScale.current * (dist / initialDist.current), 1), 4)
          scale.setValue(s)
        } else if (lastScale.current > 1.05) {
          translate.setValue({ x: lastPan.current.x + g.dx, y: lastPan.current.y + g.dy })
        }
      },
      onPanResponderRelease: () => {
        initialDist.current = 0
        lastScale.current = (scale as any)._value ?? 1
        lastPan.current = { x: (translate as any).x?._value ?? 0, y: (translate as any).y?._value ?? 0 }
        if (lastScale.current < 1) {
          Animated.parallel([
            Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
            Animated.spring(translate, { toValue: { x: 0, y: 0 }, useNativeDriver: true }),
          ]).start()
          lastScale.current = 1
          lastPan.current = { x: 0, y: 0 }
        }
      },
    }),
  ).current

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={fsStyles.backdrop}>
        <TouchableOpacity style={fsStyles.closeBtn} onPress={onClose} activeOpacity={0.7}>
          <Ionicons name="close" size={24} color="#f0f0f0" />
        </TouchableOpacity>
        <Animated.View
          style={[{ flex: 1, justifyContent: 'center', alignItems: 'center' }, { transform: [{ scale }, ...translate.getTranslateTransform()] }]}
          {...pan.panHandlers}
        >
          <Image source={{ uri }} style={fsStyles.image} resizeMode="contain" />
        </Animated.View>
      </View>
    </Modal>
  )
}

const fsStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 34,
    right: 16,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: SCREEN_W,
    height: SCREEN_H,
  },
})

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0c0c14' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 56 : 36, paddingBottom: 12, paddingHorizontal: 16,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  headerTitle: { color: '#f0f0f0', fontSize: 16, fontWeight: '700' },
  mapBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.04)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  scroll: { flex: 1 },
  heroImage: { width: '100%', height: 260, resizeMode: 'cover' },
  placeholder: { width: '100%', height: 200, justifyContent: 'center', alignItems: 'center' },
  placeholderIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(0,0,0,0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: 10,
  },
  placeholderLabel: { fontSize: 15, fontWeight: '700' },
  content: { padding: 16 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' },
  reporterRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  reporter: { color: '#a1a1aa', fontSize: 14, fontWeight: '500' },
  date: { color: '#52525b', fontSize: 11 },
  caption: { color: '#e4e4e7', fontSize: 15, lineHeight: 22, marginBottom: 8 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, marginTop: 4,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontWeight: '600' },
  confidence: { color: '#6b7280', fontSize: 12, marginTop: 6 },
  address: { color: '#a1a1aa', fontSize: 13, lineHeight: 18, marginBottom: 8 },
  severityBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingVertical: 5, paddingHorizontal: 12, borderRadius: 8,
  },
  severityDot: { width: 7, height: 7, borderRadius: 3.5 },
  severityLabel: { fontSize: 12, fontWeight: '700' },
  statChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { color: '#6b7280', fontSize: 11, fontWeight: '500' },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.04)', marginHorizontal: 16 },
  section: { padding: 16 },
  sectionTitle: { color: '#f0f0f0', fontSize: 14, fontWeight: '700', marginBottom: 10 },
  verifyRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  verifyBtnStill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(34,197,94,0.08)', paddingVertical: 8, paddingHorizontal: 16,
    borderRadius: 10, borderWidth: 1, borderColor: 'rgba(34,197,94,0.15)',
  },
  verifyBtnStillText: { color: '#22c55e', fontSize: 13, fontWeight: '600' },
  verifyBtnFixed: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(239,68,68,0.08)', paddingVertical: 8, paddingHorizontal: 16,
    borderRadius: 10, borderWidth: 1, borderColor: 'rgba(239,68,68,0.15)',
  },
  verifyBtnFixedText: { color: '#ef4444', fontSize: 13, fontWeight: '600' },
  verifyCount: { color: '#71717a', fontSize: 13, fontWeight: '600', marginLeft: 'auto' },
  noComments: { color: '#374151', fontSize: 13, textAlign: 'center', paddingVertical: 12 },
  commentRow: { flexDirection: 'row', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)' },
  commentAvatar: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: 'rgba(230, 168, 23, 0.12)', justifyContent: 'center', alignItems: 'center',
  },
  commentAvatarText: { color: '#e6a817', fontSize: 11, fontWeight: '700' },
  commentBody: { flex: 1 },
  commentUsername: { color: '#e4e4e7', fontSize: 12, fontWeight: '600' },
  commentText: { color: '#a1a1aa', fontSize: 13, marginTop: 1, lineHeight: 17 },
  commentTime: { color: '#6b7280', fontSize: 10, marginTop: 2 },
  commentInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  commentInput: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10,
    paddingVertical: 10, paddingHorizontal: 14, color: '#f0f0f0', fontSize: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)',
  },
  commentSendBtn: {
    backgroundColor: 'rgba(230, 168, 23, 0.15)',
    paddingVertical: 10, paddingHorizontal: 18, borderRadius: 10,
  },
  commentSendBtnDisabled: { opacity: 0.4 },
  commentSendText: { color: '#e6a817', fontSize: 13, fontWeight: '700' },
  communityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  captionRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  captionText: { flex: 1, color: '#a1a1aa', fontSize: 12, lineHeight: 17, fontStyle: 'italic' },
  captionPlaceholder: { flex: 1, color: '#3f3f46', fontSize: 12, fontStyle: 'italic' },
  captionEditBtn: { width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.04)', justifyContent: 'center', alignItems: 'center', marginTop: -2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard: { backgroundColor: '#18181b', borderRadius: 16, padding: 20, width: '100%', maxWidth: 400, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  modalTitle: { color: '#f0f0f0', fontSize: 16, fontWeight: '700', marginBottom: 12 },
  modalInput: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 12, color: '#f0f0f0', fontSize: 14, minHeight: 80, textAlignVertical: 'top', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 14 },
  modalCancelBtn: { paddingVertical: 8, paddingHorizontal: 16 },
  modalCancelText: { color: '#71717a', fontSize: 13, fontWeight: '600' },
  modalSaveBtn: { backgroundColor: 'rgba(230,168,23,0.15)', paddingVertical: 8, paddingHorizontal: 18, borderRadius: 10 },
  modalSaveText: { color: '#e6a817', fontSize: 13, fontWeight: '700' },
})
