import { memo, useCallback, useEffect, useRef, useState } from 'react'
import {
  AccessibilityInfo,
  Animated,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useVote, type VoteState } from '../lib/useVote'
import { useReport } from '../lib/useReport'
import { useVerify } from '../lib/useVerify'
import { formatRelativeTime } from '../lib/time'
import { colors, fonts, radius, spacing } from '../theme/tokens'
import ReviewCommentsSheet from './ReviewCommentsSheet'
import ReportSheet from './ReportSheet'
import type { ReviewItem } from '../lib/useReviewQueue'

export type ReviewSheet = 'comments' | 'report' | null

type StampTone = 'up' | 'down' | 'removed' | 'still' | 'fixed' | 'reported'

interface Stamp {
  id: number
  label: string
  tone: StampTone
}

const TONES: Record<StampTone, { fg: string; dim: string; line: string }> = {
  up: { fg: colors.minor, dim: colors.minorDim, line: 'rgba(34,197,94,0.5)' },
  still: { fg: colors.minor, dim: colors.minorDim, line: 'rgba(34,197,94,0.5)' },
  down: { fg: colors.severe, dim: colors.severeDim, line: 'rgba(239,68,68,0.5)' },
  fixed: { fg: colors.severe, dim: colors.severeDim, line: 'rgba(239,68,68,0.5)' },
  removed: { fg: '#FAFAFA', dim: 'rgba(255,255,255,0.12)', line: 'rgba(255,255,255,0.5)' },
  reported: { fg: colors.moderate, dim: colors.moderateDim, line: 'rgba(245,158,11,0.5)' },
}

const SEVERITY_COLORS: Record<string, string> = {
  Severe: colors.severe,
  Moderate: colors.moderate,
  Minor: colors.minor,
  Unknown: colors.textMuted,
}

const BOTTOM_FADE = ['0.05', '0.1', '0.18', '0.28', '0.4', '0.55', '0.7', '0.85']
const TOP_FADE = ['0.4', '0.3', '0.2', '0.1', '0.05']

function EdgeFade({ edge }: { edge: 'top' | 'bottom' }) {
  const ops = edge === 'top' ? TOP_FADE : BOTTOM_FADE
  return (
    <View
      pointerEvents="none"
      style={[
        styles.fade,
        edge === 'top' ? { top: 0 } : { bottom: 0 },
        { height: ops.length * 22 },
      ]}
    >
      {ops.map((op, i) => (
        <View key={i} style={[styles.fadeBand, { backgroundColor: `rgba(0,0,0,${op})` }]} />
      ))}
    </View>
  )
}

function RailButton({
  label,
  count,
  tone,
  active = false,
  disabled = false,
  onPress,
  children,
}: {
  label: string
  count?: number
  tone?: StampTone
  active?: boolean
  disabled?: boolean
  onPress: () => void
  children: React.ReactNode
}) {
  const t = tone ? TONES[tone] : null
  const captionColor = active && t ? t.fg : 'rgba(255,255,255,0.55)'
  return (
    <View style={styles.railItem}>
      <TouchableOpacity
        style={[
          styles.railBtn,
          active && t ? { backgroundColor: t.dim, borderColor: t.line } : null,
          disabled && styles.railBtnDisabled,
        ]}
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected: active, disabled }}
      >
        {children}
      </TouchableOpacity>
      <View style={styles.railCaptionRow}>
        <Text
          style={[styles.railCaption, { color: captionColor }, disabled && styles.railCaptionDim]}
        >
          {label}
        </Text>
        {count != null && count > 0 && (
          <Text style={[styles.railCount, { color: captionColor }]}>{count}</Text>
        )}
      </View>
    </View>
  )
}

export const ReviewCard = memo(function ReviewCard({
  item,
  active,
  onAction,
  sheet,
  onSheetChange,
  onVoteChange,
  onViewDetail,
  onViewProfile,
}: {
  item: ReviewItem
  active: boolean
  onAction: () => void
  sheet: ReviewSheet
  onSheetChange: (s: ReviewSheet) => void
  onVoteChange: (key: string, votes: VoteState) => void
  onViewDetail: (item: ReviewItem) => void
  onViewProfile?: (userId: string) => void
}) {
  const contentType = item.kind
  const contentId = String(item.id)

  const { votes, voting, error: voteError, vote } = useVote({
    contentType,
    contentId,
    initialVotes: { upvotes: item.upvotes, downvotes: item.downvotes, userVote: item.userVote },
  })
  const { reported, error: reportError, report, unreport } = useReport({
    contentType,
    contentId,
    enabled: active,
  })
  const { stillCount, fixedCount, posting, verify } = useVerify({
    contentType,
    contentId,
    enabled: active,
  })

  const [stamp, setStamp] = useState<Stamp | null>(null)
  const [reportSubmitting, setReportSubmitting] = useState(false)
  const stampAnim = useRef(new Animated.Value(0)).current
  const stampTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reduceMotion = useRef(false)

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      reduceMotion.current = v
    })
    return () => {
      if (stampTimer.current) clearTimeout(stampTimer.current)
    }
  }, [])

  const flash = useCallback(
    (label: string, tone: StampTone) => {
      setStamp((prev) => ({ id: (prev?.id ?? 0) + 1, label, tone }))
      stampAnim.setValue(0)
      if (reduceMotion.current) {
        Animated.timing(stampAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }).start()
      } else {
        Animated.spring(stampAnim, {
          toValue: 1,
          friction: 5,
          tension: 130,
          useNativeDriver: true,
        }).start()
      }
      if (stampTimer.current) clearTimeout(stampTimer.current)
      stampTimer.current = setTimeout(() => setStamp(null), 850)
      onAction()
    },
    [stampAnim, onAction],
  )

  const doVote = useCallback(
    async (value: 1 | -1) => {
      const outcome = await vote(value)
      if (outcome === 'up') flash('Upvoted', 'up')
      else if (outcome === 'down') flash('Downvoted', 'down')
      else if (outcome === 'removed') flash('Vote removed', 'removed')
      else onAction()
    },
    [vote, flash, onAction],
  )

  const doVerify = useCallback(
    async (signal: 'still' | 'fixed') => {
      await verify(signal)
      flash(signal === 'still' ? 'Still here' : 'Fixed', signal)
    },
    [verify, flash],
  )

  const toggleReport = useCallback(() => {
    if (reported) {
      unreport().then((ok) => {
        if (ok) onAction()
      })
    } else {
      onSheetChange('report')
    }
  }, [reported, unreport, onSheetChange, onAction])

  const submitReport = useCallback(
    async (reason: string) => {
      if (reportSubmitting) return
      setReportSubmitting(true)
      const ok = await report(reason)
      setReportSubmitting(false)
      if (ok) {
        onSheetChange(null)
        flash('Reported', 'reported')
      }
    },
    [report, reportSubmitting, onSheetChange, flash],
  )

  const reporterName = item.reporter ?? (item.kind === 'pothole' ? 'Auto-detected' : 'Anonymous')
  const inlineError = voteError || reportError

  // Persist vote state into the queue — seeds correct when this card remounts
  // after being windowed out (the deck unmounts off-window cards).
  useEffect(() => {
    if (
      votes.upvotes !== item.upvotes ||
      votes.downvotes !== item.downvotes ||
      votes.userVote !== item.userVote
    ) {
      onVoteChange(item.key, votes)
    }
  }, [votes, item, onVoteChange])
  const sevColor = item.severity ? SEVERITY_COLORS[item.severity] ?? colors.textMuted : null
  const stampTone = stamp ? TONES[stamp.tone] : null

  const stampOpacity = stampAnim
  const stampScale = stampAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] })

  return (
    <View style={styles.card}>
      {/* Media */}
      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={styles.media} resizeMode="cover" />
      ) : (
        <View style={styles.mediaPlaceholder}>
          <Ionicons name="warning-outline" size={48} color="rgba(239,68,68,0.3)" />
        </View>
      )}
      <EdgeFade edge="top" />
      <EdgeFade edge="bottom" />

      {/* Eyebrow + severity */}
      <View style={styles.eyebrowRow}>
        <Text style={styles.eyebrow}>{item.eyebrow}</Text>
        {item.severity && sevColor && (
          <View style={[styles.severityChip, { backgroundColor: 'rgba(0,0,0,0.45)', borderColor: sevColor }]}>
            <View style={[styles.severityDot, { backgroundColor: sevColor }]} />
            <Text style={[styles.severityText, { color: sevColor }]}>{item.severity}</Text>
          </View>
        )}
      </View>

      {/* Action rail */}
      <View style={styles.rail}>
        <RailButton
          label="Upvote"
          count={votes.upvotes}
          tone="up"
          active={votes.userVote === 1}
          disabled={voting}
          onPress={() => doVote(1)}
        >
          <Ionicons
            name="arrow-up"
            size={20}
            color={votes.userVote === 1 ? TONES.up.fg : 'rgba(255,255,255,0.85)'}
          />
        </RailButton>
        <RailButton
          label="Downvote"
          count={votes.downvotes}
          tone="down"
          active={votes.userVote === -1}
          disabled={voting}
          onPress={() => doVote(-1)}
        >
          <Ionicons
            name="arrow-down"
            size={20}
            color={votes.userVote === -1 ? TONES.down.fg : 'rgba(255,255,255,0.85)'}
          />
        </RailButton>
        <RailButton label="Comment" onPress={() => onSheetChange('comments')}>
          <Ionicons name="chatbubble-ellipses-outline" size={19} color="rgba(255,255,255,0.85)" />
        </RailButton>
        <RailButton
          label="Still here"
          count={stillCount}
          tone="still"
          disabled={posting !== null}
          onPress={() => doVerify('still')}
        >
          <Ionicons name="checkmark" size={22} color="rgba(255,255,255,0.85)" />
        </RailButton>
        <RailButton
          label="Fixed"
          count={fixedCount}
          tone="fixed"
          disabled={posting !== null}
          onPress={() => doVerify('fixed')}
        >
          <Ionicons name="close" size={22} color="rgba(255,255,255,0.85)" />
        </RailButton>
        <RailButton
          label={reported ? 'Undo report' : 'Report'}
          tone="reported"
          active={reported}
          onPress={toggleReport}
        >
          <Ionicons
            name="flag-outline"
            size={19}
            color={reported ? TONES.reported.fg : 'rgba(255,255,255,0.85)'}
          />
        </RailButton>
      </View>

      {/* Verdict stamp (signature moment) */}
      {stamp && stampTone && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.stampWrap,
            { opacity: stampOpacity, transform: [{ scale: stampScale }] },
          ]}
        >
          <View
            style={[
              styles.stamp,
              { borderColor: stampTone.fg },
            ]}
          >
            <Text style={[styles.stampText, { color: stampTone.fg }]}>{stamp.label}</Text>
          </View>
        </Animated.View>
      )}

      {/* Inline action errors */}
      {inlineError && (
        <View style={styles.errorPill}>
          <Text style={styles.errorText}>{inlineError}</Text>
        </View>
      )}

      {/* Meta */}
      <View style={styles.meta}>
        <Text style={styles.metaDetail}>{item.detail}</Text>
        {item.title ? <Text style={styles.metaTitle} numberOfLines={1}>{item.title}</Text> : null}
        {item.description ? <Text style={styles.metaDescription} numberOfLines={2}>{item.description}</Text> : null}
        <Text style={styles.metaAddress}>{item.address}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.metaReporter}>{reporterName}</Text>
          <Text style={styles.metaDot}>·</Text>
          <Text style={styles.metaTime}>{item.time ? formatRelativeTime(item.time) : ''}</Text>
          <TouchableOpacity style={styles.detailsBtn} onPress={() => onViewDetail(item)} activeOpacity={0.7}>
            <Text style={styles.detailsText}>Details</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Report sheet */}
      <ReportSheet
        visible={active && sheet === 'report'}
        mode="reasons"
        title="Report content"
        subtitle="Why are you reporting this?"
        error={reportError}
        submitting={reportSubmitting}
        onSelectReason={submitReport}
        onCancel={() => onSheetChange(null)}
      />

      {/* Comments sheet */}
      <ReviewCommentsSheet
        open={active && sheet === 'comments'}
        potholeId={item.kind === 'pothole' ? item.id : null}
        photoId={item.kind === 'photo' ? item.id : null}
        onClose={() => onSheetChange(null)}
        onCommented={onAction}
        onViewProfile={onViewProfile}
      />
    </View>
  )
})

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  media: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  mediaPlaceholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(239,68,68,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fade: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  fadeBand: {
    height: 22,
  },

  eyebrowRow: {
    position: 'absolute',
    top: spacing.lg,
    left: spacing.lg,
    right: 84,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  eyebrow: {
    fontFamily: fonts.monoMedium,
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.75)',
  },
  severityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  severityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  severityText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },

  rail: {
    position: 'absolute',
    right: spacing.sm + 4,
    top: '50%',
    transform: [{ translateY: '-50%' }],
    alignItems: 'center',
    gap: 10,
  },
  railItem: {
    alignItems: 'center',
    gap: 4,
  },
  railBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  railBtnDisabled: {
    opacity: 0.5,
  },
  railCaptionRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
  },
  railCaption: {
    fontFamily: fonts.monoMedium,
    fontSize: 8,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    lineHeight: 10,
  },
  railCount: {
    fontFamily: fonts.monoBold,
    fontSize: 10,
    letterSpacing: 0,
  },
  railCaptionDim: {
    opacity: 0.5,
  },

  stampWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '36%',
    alignItems: 'center',
    zIndex: 20,
  },
  stamp: {
    borderWidth: 3,
    paddingHorizontal: 20,
    paddingVertical: 8,
    transform: [{ rotate: '-7deg' }],
  },
  stampText: {
    fontFamily: fonts.monoBold,
    fontSize: 26,
    letterSpacing: 5,
    textTransform: 'uppercase',
  },

  errorPill: {
    position: 'absolute',
    right: 76,
    top: '50%',
    marginTop: -14,
    maxWidth: 150,
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.4)',
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
    zIndex: 15,
  },
  errorText: {
    color: colors.severe,
    fontFamily: fonts.medium,
    fontSize: 10,
  },

  meta: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    paddingTop: 48,
    zIndex: 10,
  },
  metaDetail: {
    fontFamily: fonts.monoMedium,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.65)',
  },
  metaTitle: {
    marginTop: 6,
    fontFamily: fonts.bold,
    fontSize: 16,
    lineHeight: 21,
    color: '#FFFFFF',
  },
  metaDescription: {
    marginTop: 2,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 17,
    color: 'rgba(255,255,255,0.75)',
  },
  metaAddress: {
    marginTop: 6,
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: '#FFFFFF',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 6,
  },
  metaReporter: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
  },
  metaDot: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
  },
  metaTime: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
  },
  detailsBtn: {
    marginLeft: 'auto',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  detailsText: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.signal,
  },
})
