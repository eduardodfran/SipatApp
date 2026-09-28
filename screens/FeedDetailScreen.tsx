import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
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
import { validateComment } from '../lib/spamDetection'
import ReportButton from '../components/ReportButton'
import VoteButtons from '../components/VoteButtons'
import ScreenHeader from '../components/ScreenHeader'
import { colors, fonts, radius, spacing } from '../theme/tokens'

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
  Minor: { color: colors.minor, bg: colors.minorDim },
  Moderate: { color: colors.moderate, bg: colors.moderateDim },
  Severe: { color: colors.severe, bg: colors.severeDim },
  Unknown: { color: colors.textMuted, bg: colors.surfaceRaised },
}

const STATUS_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Analyzing...', color: colors.moderate, bg: colors.moderateDim },
  processed: { label: 'Detected', color: colors.minor, bg: colors.minorDim },
  no_detection: { label: 'No Distress', color: colors.textMuted, bg: colors.surfaceRaised },
  manually_tagged: { label: 'Tagged by User', color: colors.signal, bg: colors.signalDim },
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
  const [itemState, setItem] = useState(item)

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
      if (data) {
        const row = Array.isArray(data) ? data[0] : data
        setVoteData({
          upvotes: row?.upvotes ?? 0,
          downvotes: row?.downvotes ?? 0,
          userVote: row?.user_vote ?? 0,
        })
      }
    }
    fetchVotes()
  }, [item])

  const handleVerify = useCallback(async (body: string) => {
    const signal = body === '✅ Fixed' ? 'fixed' : 'still'
    try {
      await supabase.rpc('mark_hazard_signal', {
        p_content_type: item.type === 'photo' ? 'photo' : 'pothole',
        p_content_id: String(item.type === 'photo' ? item.data.id : item.data.pothole_id),
        p_signal: signal,
      })
    } catch {}
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

    const validation = validateComment(text)
    if (!validation.ok) {
      Alert.alert('Comment blocked', validation.error!)
      return
    }

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

  const handleTagAsPothole = useCallback(async () => {
    if (item.type !== 'photo') return
    Alert.alert('Tag as Pothole', 'Manually mark this photo as a road pothole? This overrides the AI result.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm', onPress: async () => {
          const { error } = await supabase
            .from('community_photos')
            .update({ detection_status: 'manually_tagged', class_name: 'manually_tagged', confidence: 1.0 })
            .eq('id', item.data.id)
          if (error) {
            Alert.alert('Error', error.message)
            return
          }
          item.data.detection_status = 'manually_tagged'
          item.data.class_name = 'manually_tagged'
          item.data.confidence = 1.0
          setItem({ ...item })
        }
      },
    ])
  }, [item])

  const verifyCount = comments ? comments.filter((c) => c.body.includes('✅')).length : 0
  const commentCount = comments ? comments.length : 0

  const mapBtn = (
    <TouchableOpacity onPress={() => onViewOnMap(item)} style={styles.iconBtn} activeOpacity={0.7}>
      <Ionicons name="map-outline" size={19} color={colors.textPrimary} />
    </TouchableOpacity>
  )

  if (item.type === 'photo') {
    const post = item.data
    const badge = STATUS_BADGE[post.detection_status] ?? STATUS_BADGE.pending

    return (
      <View style={styles.container}>
        <ScreenHeader onBack={onBack} title="Photo Report" right={mapBtn} />
        <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity activeOpacity={0.9} onPress={() => setFullScreenImageUri(post.image_url)} style={styles.heroWrap}>
            <Image source={{ uri: post.image_url }} style={styles.heroImage} />
          </TouchableOpacity>
          <View style={styles.content}>
            <View style={styles.metaRow}>
              <TouchableOpacity style={styles.reporterRow} onPress={() => post.user_id && onViewProfile?.(post.user_id)} activeOpacity={0.7}>
                <Ionicons name="person-circle-outline" size={18} color={colors.textMuted} />
                <Text style={styles.reporter}>{post.reporter_username ?? 'Anonymous'}</Text>
              </TouchableOpacity>
              <Text style={styles.date}>
                {new Date(post.created_at).toLocaleDateString(undefined, {
                  month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
                })}
              </Text>
            </View>
            {post.caption ? <Text style={styles.caption}>{post.caption}</Text> : null}
            <View style={styles.statusRow}>
              <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                <View style={[styles.statusDot, { backgroundColor: badge.color }]} />
                <Text style={[styles.statusText, { color: badge.color }]}>{badge.label}</Text>
              </View>
              {post.detection_status === 'no_detection' && (
                <TouchableOpacity style={styles.tagPotholeBtn} onPress={handleTagAsPothole} activeOpacity={0.7}>
                  <Ionicons name="warning-outline" size={14} color={colors.moderate} />
                  <Text style={styles.tagPotholeText}>This is a pothole</Text>
                </TouchableOpacity>
              )}
            </View>
            {post.confidence != null && post.detection_status !== 'manually_tagged' && (
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
      <ScreenHeader onBack={onBack} title="Detection" right={mapBtn} />
      <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
        {p.image_url ? (
          <TouchableOpacity activeOpacity={0.9} onPress={() => setFullScreenImageUri(p.image_url)} style={styles.heroWrap}>
            <Image source={{ uri: p.image_url }} style={styles.heroImage} />
          </TouchableOpacity>
        ) : (
          <View style={[styles.heroWrap, styles.placeholder, { backgroundColor: sev.bg }]}>
            <View style={styles.placeholderIcon}>
              <Ionicons name="warning" size={40} color={sev.color} />
            </View>
            <Text style={[styles.placeholderLabel, { color: sev.color }]}>Pothole</Text>
          </View>
        )}
        <View style={styles.content}>
          <View style={styles.metaRow}>
            <TouchableOpacity style={styles.reporterRow} onPress={() => p.reporter_user_id && onViewProfile?.(p.reporter_user_id)} activeOpacity={0.7}>
              <Ionicons name="person-circle-outline" size={18} color={colors.textMuted} />
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
              <Ionicons name="pencil" size={14} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
          <View style={styles.metaRow}>
            <View style={[styles.severityBadge, { backgroundColor: sev.bg }]}>
              <View style={[styles.severityDot, { backgroundColor: sev.color }]} />
              <Text style={[styles.severityLabel, { color: sev.color }]}>{p.worst_severity}</Text>
            </View>
            <View style={styles.statChip}>
              <Ionicons name="flash" size={12} color={colors.textMuted} />
              <Text style={styles.statText}>{p.total_detection_hits} hit{p.total_detection_hits !== 1 ? 's' : ''}</Text>
            </View>
            <View style={styles.statChip}>
              <Ionicons name="people" size={12} color={colors.textMuted} />
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
            <TextInput style={styles.modalInput} value={captionDraft} onChangeText={setCaptionDraft} placeholder="Describe this pothole…" placeholderTextColor={colors.textMuted} multiline maxLength={280} autoFocus />
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
              <Ionicons name="checkmark-circle-outline" size={16} color={colors.minor} />
              <Text style={styles.verifyBtnStillText}>Still here</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.verifyBtnFixed} onPress={() => handleVerify('✅ Fixed')} activeOpacity={0.7}>
              <Ionicons name="close-circle-outline" size={16} color={colors.severe} />
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
              onVoteChange={(upvotes, downvotes, userVote) =>
                setVoteData({ upvotes, downvotes, userVote })
              }
            />
            <ReportButton
              contentType={item.type}
              contentId={item.type === 'photo' ? String(item.data.id) : String(item.data.pothole_id)}
              onReported={(count) => {
                setItem(prev => ({
                  ...prev,
                  data: { ...prev.data, report_count: count }
                }));
              }}
            />
          </View>
        </View>

        <View style={styles.divider} />
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Comments ({commentCount})</Text>
          {!comments ? (
            <ActivityIndicator size="small" color={colors.textMuted} style={{ marginVertical: 16 }} />
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
                placeholderTextColor={colors.textMuted}
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
          <Ionicons name="close" size={24} color={colors.textPrimary} />
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
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 34,
    right: spacing.lg,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.hairline,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: SCREEN_W,
    height: SCREEN_H,
  },
})

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  iconBtn: {
    width: 40, height: 40, borderRadius: radius.md,
    backgroundColor: colors.hairline, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: colors.hairline,
  },
  scroll: { flex: 1 },
  heroWrap: {
    marginHorizontal: spacing.lg, marginTop: spacing.sm,
    borderRadius: radius.lg, overflow: 'hidden',
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.hairline,
  },
  heroImage: { width: '100%', height: 260, resizeMode: 'cover' },
  placeholder: { height: 200, justifyContent: 'center', alignItems: 'center' },
  placeholderIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.sm,
  },
  placeholderLabel: { fontFamily: fonts.bold, fontSize: 15 },
  content: { padding: spacing.lg },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 6, flexWrap: 'wrap' },
  reporterRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  reporter: { color: colors.textSecondary, fontFamily: fonts.medium, fontSize: 14 },
  date: { color: colors.textMuted, fontFamily: fonts.mono, fontSize: 11 },
  caption: { color: colors.textPrimary, fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, marginBottom: spacing.sm },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    paddingVertical: 5, paddingHorizontal: spacing.md, borderRadius: radius.sm,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap', marginTop: spacing.xs },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 0.4 },
  tagPotholeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: 5, paddingHorizontal: 10, borderRadius: radius.sm,
    backgroundColor: colors.moderateDim,
  },
  tagPotholeText: { color: colors.moderate, fontFamily: fonts.bold, fontSize: 10, letterSpacing: 0.4 },
  confidence: { color: colors.textMuted, fontFamily: fonts.mono, fontSize: 12, marginTop: spacing.sm },
  address: { color: colors.textSecondary, fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, marginBottom: spacing.sm },
  severityBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingVertical: 5, paddingHorizontal: spacing.md, borderRadius: radius.sm,
  },
  severityDot: { width: 7, height: 7, borderRadius: 3.5 },
  severityLabel: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 0.4 },
  statChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { color: colors.textMuted, fontFamily: fonts.mono, fontSize: 11 },
  divider: {
    marginHorizontal: spacing.lg,
    borderTopWidth: 1, borderStyle: 'dashed', borderColor: colors.hairlineStrong,
  },
  section: { padding: spacing.lg },
  sectionTitle: {
    fontFamily: fonts.bold, fontSize: 11, color: colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 1.4, marginBottom: spacing.md,
  },
  verifyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  verifyBtnStill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.minorDim, paddingVertical: 8, paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
  },
  verifyBtnStillText: { color: colors.minor, fontFamily: fonts.semibold, fontSize: 13 },
  verifyBtnFixed: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.severeDim, paddingVertical: 8, paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
  },
  verifyBtnFixedText: { color: colors.severe, fontFamily: fonts.semibold, fontSize: 13 },
  verifyCount: { color: colors.textMuted, fontFamily: fonts.monoMedium, fontSize: 13, marginLeft: 'auto' },
  noComments: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 13, textAlign: 'center', paddingVertical: spacing.md },
  commentRow: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.hairline },
  commentAvatar: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.signalDim, justifyContent: 'center', alignItems: 'center',
  },
  commentAvatarText: { color: colors.signal, fontFamily: fonts.bold, fontSize: 11 },
  commentBody: { flex: 1 },
  commentUsername: { color: colors.textPrimary, fontFamily: fonts.semibold, fontSize: 12 },
  commentText: { color: colors.textSecondary, fontFamily: fonts.regular, fontSize: 13, marginTop: 1, lineHeight: 18 },
  commentTime: { color: colors.textMuted, fontFamily: fonts.mono, fontSize: 10, marginTop: 2 },
  commentInputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  commentInput: {
    flex: 1, backgroundColor: colors.surface, borderRadius: radius.md,
    paddingVertical: 10, paddingHorizontal: 14, color: colors.textPrimary, fontSize: 14,
    fontFamily: fonts.regular,
    borderWidth: 1, borderColor: colors.hairline,
  },
  commentSendBtn: {
    backgroundColor: colors.signalDim,
    paddingVertical: 10, paddingHorizontal: 18, borderRadius: radius.md,
  },
  commentSendBtnDisabled: { opacity: 0.4 },
  commentSendText: { color: colors.signal, fontFamily: fonts.bold, fontSize: 13 },
  communityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  captionRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.sm },
  captionText: { flex: 1, color: colors.textSecondary, fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, fontStyle: 'italic' },
  captionPlaceholder: { flex: 1, color: colors.textMuted, fontFamily: fonts.regular, fontSize: 12, fontStyle: 'italic' },
  captionEditBtn: { width: 28, height: 28, borderRadius: radius.sm, backgroundColor: colors.hairline, justifyContent: 'center', alignItems: 'center', marginTop: -2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  modalCard: { backgroundColor: colors.surfaceRaised, borderRadius: radius.lg, padding: spacing.xl, width: '100%', maxWidth: 400, borderWidth: 1, borderColor: colors.hairline },
  modalTitle: { color: colors.textPrimary, fontFamily: fonts.extrabold, fontSize: 16, marginBottom: spacing.md },
  modalInput: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, color: colors.textPrimary, fontFamily: fonts.regular, fontSize: 14, minHeight: 80, textAlignVertical: 'top', borderWidth: 1, borderColor: colors.hairline },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.lg },
  modalCancelBtn: { paddingVertical: 10, paddingHorizontal: spacing.lg, borderRadius: radius.md, backgroundColor: colors.hairline },
  modalCancelText: { color: colors.textPrimary, fontFamily: fonts.semibold, fontSize: 13 },
  modalSaveBtn: { backgroundColor: colors.signal, paddingVertical: 10, paddingHorizontal: spacing.lg, borderRadius: radius.md },
  modalSaveText: { color: colors.onSignal, fontFamily: fonts.semibold, fontSize: 13 },
})
