import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useDetectionComments } from '../lib/useDetectionComments'
import { useCommunityPhotoComments } from '../lib/useCommunityPhotoComments'
import { validateComment, MAX_COMMENT_LENGTH, COMMENT_COOLDOWN_MS } from '../lib/spamDetection'
import { formatRelativeTime } from '../lib/time'
import { colors, fonts, radius, spacing } from '../theme/tokens'

interface ReviewCommentsSheetProps {
  open: boolean
  potholeId: number | null
  photoId: number | null
  onClose: () => void
  onCommented: () => void
}

function SheetCommentItem({
  comment,
}: {
  comment: { body: string; created_at: string; username: string | null }
}) {
  const isVerify = comment.body.startsWith('✅')
  const initial = (comment.username ?? '?')[0].toUpperCase()
  return (
    <View style={[styles.commentRow, isVerify && styles.commentRowVerify]}>
      <View style={styles.commentAvatar}>
        <Text style={styles.commentAvatarText}>{initial}</Text>
      </View>
      <View style={styles.commentBody}>
        <View style={styles.commentHead}>
          <Text style={styles.commentUsername}>{comment.username ?? 'Anonymous'}</Text>
          <Text style={styles.commentTime}>{formatRelativeTime(comment.created_at)}</Text>
        </View>
        <Text style={[styles.commentText, isVerify && styles.commentTextVerify]}>
          {comment.body}
        </Text>
      </View>
    </View>
  )
}

export default function ReviewCommentsSheet({
  open,
  potholeId,
  photoId,
  onClose,
  onCommented,
}: ReviewCommentsSheetProps) {
  const [input, setInput] = useState('')
  const [error, setError] = useState('')
  const [cooldown, setCooldown] = useState(0)

  // Hooks gated on `open` — background deck cards never fetch comments
  const potholeComments = useDetectionComments(open && potholeId != null ? String(potholeId) : null)
  const photoComments = useCommunityPhotoComments(open ? photoId : null)

  const isPothole = potholeId != null
  const { comments, loading, posting, postComment } = isPothole ? potholeComments : photoComments

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((prev) => prev - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const handlePost = async () => {
    if (!input.trim() || cooldown > 0 || posting) return
    setError('')
    const result = validateComment(input)
    if (!result.ok) {
      setError(result.error!)
      return
    }
    const newComment = await postComment(input)
    if (!newComment) {
      setError('Could not post — try again')
      return
    }
    setInput('')
    setCooldown(COMMENT_COOLDOWN_MS / 1000)
    onCommented()
  }

  const count = comments.length
  const tooLong = input.length > MAX_COMMENT_LENGTH * 0.9

  return (
    <Modal
      visible={open}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.backdropTouch} />
        </TouchableWithoutFeedback>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetWrap}
        >
          <View style={styles.sheet}>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>
                {loading
                  ? 'Comments'
                  : count > 0
                    ? `${count} comment${count !== 1 ? 's' : ''}`
                    : 'Comments'}
              </Text>
              <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
                <Ionicons name="close" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.list}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {loading && (
                <View style={styles.loadingWrap}>
                  <ActivityIndicator size="small" color={colors.signal} />
                </View>
              )}

              {!loading && count === 0 && (
                <Text style={styles.empty}>No comments yet — start the thread</Text>
              )}

              {!loading &&
                count > 0 &&
                comments.map((c) => <SheetCommentItem key={c.id} comment={c} />)}
            </ScrollView>

            <View style={styles.composer}>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  value={input}
                  onChangeText={(text) => {
                    setInput(text)
                    setError('')
                  }}
                  placeholder={cooldown > 0 ? `Wait ${cooldown}s...` : 'Write a comment...'}
                  placeholderTextColor={colors.textMuted}
                  maxLength={MAX_COMMENT_LENGTH}
                  returnKeyType="send"
                  onSubmitEditing={handlePost}
                />
                <TouchableOpacity
                  style={[
                    styles.sendBtn,
                    (posting || !input.trim() || cooldown > 0) && styles.sendBtnDisabled,
                  ]}
                  onPress={handlePost}
                  disabled={posting || !input.trim() || cooldown > 0}
                  activeOpacity={0.7}
                >
                  <Text style={styles.sendText}>
                    {posting ? '...' : cooldown > 0 ? `${cooldown}s` : 'Send'}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.counterRow}>
                <Text style={[styles.counter, tooLong && styles.counterWarn]}>
                  {input.length}/{MAX_COMMENT_LENGTH}
                </Text>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  backdropTouch: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheetWrap: {
    width: '100%',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth: 1,
    borderColor: colors.hairline,
    maxHeight: '75%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  headerTitle: {
    fontFamily: fonts.monoMedium,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    backgroundColor: colors.hairline,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    flexGrow: 0,
    flexShrink: 1,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  loadingWrap: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  empty: {
    textAlign: 'center',
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 11,
    paddingVertical: spacing.lg,
  },
  commentRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  commentRowVerify: {
    opacity: 0.7,
  },
  commentAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.surfaceRaised,
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentAvatarText: {
    color: colors.textMuted,
    fontFamily: fonts.bold,
    fontSize: 10,
  },
  commentBody: {
    flex: 1,
  },
  commentHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  commentUsername: {
    color: colors.textPrimary,
    fontFamily: fonts.semibold,
    fontSize: 11,
  },
  commentTime: {
    color: colors.textMuted,
    fontFamily: fonts.mono,
    fontSize: 10,
  },
  commentText: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  commentTextVerify: {
    color: colors.minor,
  },
  composer: {
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  error: {
    color: colors.severe,
    fontFamily: fonts.medium,
    fontSize: 11,
    marginBottom: spacing.xs,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    color: colors.textPrimary,
    fontFamily: fonts.regular,
    fontSize: 13,
  },
  sendBtn: {
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.signal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
  sendText: {
    color: colors.onSignal,
    fontFamily: fonts.bold,
    fontSize: 11,
  },
  counterRow: {
    alignItems: 'flex-end',
    marginTop: spacing.xs,
  },
  counter: {
    color: colors.textMuted,
    fontFamily: fonts.mono,
    fontSize: 10,
  },
  counterWarn: {
    color: colors.moderate,
  },
})
