import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import MenuHeader from '../components/MenuHeader'
import { ReviewCard, type ReviewSheet } from '../components/ReviewCard'
import { useReviewQueue, type ReviewItem } from '../lib/useReviewQueue'
import { colors, fonts, radius, spacing } from '../theme/tokens'

const COACH_KEY = '@sipat_review_guide_seen'

type Props = {
  onMenuPress: () => void
  onViewDetail: (item: { type: 'photo' | 'pothole'; data: any }) => void
  onGoFeed: () => void
  onGoMap: () => void
}

export default function ReviewScreen({ onMenuPress, onViewDetail, onGoFeed, onGoMap }: Props) {
  const { items, loading, loadingMore, error, hasMore, loadMore, retry, updateItemVote } =
    useReviewQueue(true)

  const [activeIndex, setActiveIndex] = useState(0)
  const [sheet, setSheet] = useState<ReviewSheet>(null)
  const [pageHeight, setPageHeight] = useState(0)
  const [coachSeen, setCoachSeen] = useState(true)

  // Coach mark — read once; default "seen" avoids a flash before the check resolves.
  useEffect(() => {
    AsyncStorage.getItem(COACH_KEY).then((seen) => setCoachSeen(!!seen))
  }, [])

  const handleRetry = useCallback(() => {
    setActiveIndex(0)
    setSheet(null)
    retry()
  }, [retry])

  const dismissCoach = useCallback(() => {
    setCoachSeen(true)
    AsyncStorage.setItem(COACH_KEY, '1')
  }, [])

  const showFatalError = !!error && items.length === 0 && !loading
  const showEnd = !loading && !showFatalError && items.length > 0 && !hasMore

  const handleAction = useCallback(() => {
    if (!coachSeen) dismissCoach()
  }, [coachSeen, dismissCoach])

  const handleViewDetail = useCallback(
    (item: ReviewItem) => onViewDetail({ type: item.kind, data: item.raw }),
    [onViewDetail],
  )

  // Track the active page while scrolling (not just after momentum ends) so the
  // mount window always runs 2 pages ahead of the finger — no blank flings.
  const updateIndex = useCallback(
    (y: number) => {
      if (pageHeight <= 0) return
      const idx = Math.round(y / pageHeight)
      const clamped = Math.min(
        Math.max(idx, 0),
        Math.max(items.length - 1 + (showEnd ? 1 : 0), 0),
      )
      if (clamped === activeIndex) return
      setSheet(null)
      setActiveIndex(clamped)
    },
    [pageHeight, items.length, showEnd, activeIndex],
  )

  const handleScroll = useCallback(
    (e: { nativeEvent: { contentOffset: { y: number } } }) =>
      updateIndex(e.nativeEvent.contentOffset.y),
    [updateIndex],
  )

  // Prefetch while the user is on one of the last cards
  useEffect(() => {
    if (showFatalError || showEnd) return
    if (hasMore && items.length > 0 && activeIndex >= items.length - 5) void loadMore()
  }, [activeIndex, items.length, hasMore, loadMore, showFatalError, showEnd])

  // Position only — the queue grows via prefetch, so a total would keep jumping.
  const counter =
    items.length === 0
      ? ''
      : activeIndex >= items.length
        ? 'Done'
        : `${activeIndex + 1}`

  // Mount window: current card ± (1 behind, 2 ahead) regardless of queue size.
  const windowStart = activeIndex - 1
  const windowEnd = activeIndex + 2

  const pageStyle = useMemo(
    () => ({ height: pageHeight, backgroundColor: colors.surface }),
    [pageHeight],
  )

  return (
    <View style={styles.container}>
      <MenuHeader
        title="Review"
        onMenuPress={onMenuPress}
        variant="left"
        right={
          counter ? (
            <View style={styles.counterChip}>
              <Text style={styles.counterText}>{counter}</Text>
            </View>
          ) : undefined
        }
      />

      {showFatalError ? (
        <View style={styles.centerWrap}>
          <View style={styles.errorIconWrap}>
            <Ionicons name="cloud-offline-outline" size={30} color={colors.textMuted} />
          </View>
          <Text style={styles.errorTitle}>Couldn&apos;t load the queue</Text>
          <Text style={styles.errorSub}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={handleRetry} activeOpacity={0.7}>
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View
          style={styles.deckWrap}
          onLayout={(e) => setPageHeight(e.nativeEvent.layout.height)}
        >
          {pageHeight <= 0 || loading ? (
            <View style={styles.skeletonWrap}>
              <View style={styles.skeletonCard} />
              <View style={styles.skeletonLineShort} />
              <View style={styles.skeletonLine} />
            </View>
          ) : (
            <ScrollView
              pagingEnabled
              showsVerticalScrollIndicator={false}
              scrollEventThrottle={16}
              onScroll={handleScroll}
              onMomentumScrollEnd={handleScroll}
              keyboardShouldPersistTaps="handled"
            >
              {items.map((item, i) => (
                <View key={item.key} style={pageStyle}>
                  {i >= windowStart && i <= windowEnd && (
                    <ReviewCard
                      item={item}
                      active={i === activeIndex}
                      onAction={handleAction}
                      sheet={i === activeIndex ? sheet : null}
                      onSheetChange={setSheet}
                      onVoteChange={updateItemVote}
                      onViewDetail={handleViewDetail}
                    />
                  )}
                </View>
              ))}

              {showEnd && activeIndex + 2 >= items.length && (
                <View style={pageStyle}>
                  <View style={styles.endWrap}>
                    <View style={styles.endIconWrap}>
                      <Ionicons name="checkmark" size={30} color={colors.minor} />
                    </View>
                    <Text style={styles.endTitle}>You&apos;ve reviewed everything</Text>
                    <Text style={styles.endSub}>
                      New detections appear as the community reports them. Check back later, or
                      browse what&apos;s trending in the feed.
                    </Text>
                    <View style={styles.endBtnRow}>
                      <TouchableOpacity style={styles.endPrimaryBtn} onPress={onGoFeed} activeOpacity={0.7}>
                        <Text style={styles.endPrimaryText}>Open feed</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.endSecondaryBtn} onPress={onGoMap} activeOpacity={0.7}>
                        <Text style={styles.endSecondaryText}>Open map</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )}
            </ScrollView>
          )}

          {/* Loading more indicator */}
          {loadingMore && (
            <View style={styles.loadingMore}>
              <ActivityIndicator size="small" color={colors.signal} />
            </View>
          )}

          {/* Coach mark — anchored to the action rail */}
          {!loading && !showFatalError && !coachSeen && (
            <View style={styles.coachLayer} pointerEvents="box-none">
              <View style={styles.coachCard}>
                <Text style={styles.coachTitle}>Your call</Text>
                <Text style={styles.coachBody}>
                  Vote, then swipe up for the next one. Use Still here or Fixed to verify.
                </Text>
                <TouchableOpacity style={styles.coachBtn} onPress={dismissCoach} activeOpacity={0.7}>
                  <Text style={styles.coachBtnText}>Got it</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  counterChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.signalDim,
    borderWidth: 1,
    borderColor: colors.signalLine,
    minWidth: 56,
    alignItems: 'center',
  },
  counterText: {
    fontFamily: fonts.monoMedium,
    fontSize: 11,
    letterSpacing: 0.8,
    color: colors.signal,
  },

  deckWrap: {
    flex: 1,
  },

  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  errorIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  errorTitle: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.textPrimary,
  },
  errorSub: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
  },
  retryText: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.textSecondary,
  },

  skeletonWrap: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
  },
  skeletonCard: {
    height: '65%',
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  skeletonLineShort: {
    height: 12,
    width: '33%',
    borderRadius: 6,
    backgroundColor: colors.surfaceRaised,
    marginTop: spacing.md,
  },
  skeletonLine: {
    height: 16,
    width: '66%',
    borderRadius: 6,
    backgroundColor: colors.surfaceRaised,
    marginTop: spacing.sm,
  },

  loadingMore: {
    position: 'absolute',
    top: spacing.md,
    left: 0,
    right: 0,
    alignItems: 'center',
  },

  endWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  endIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.minorDim,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  endTitle: {
    marginTop: spacing.lg,
    fontFamily: fonts.bold,
    fontSize: 19,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  endSub: {
    marginTop: spacing.sm,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  endBtnRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  endPrimaryBtn: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    backgroundColor: colors.signal,
  },
  endPrimaryText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.onSignal,
  },
  endSecondaryBtn: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
  },
  endSecondaryText: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.textSecondary,
  },

  coachLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: spacing.sm + 4,
  },
  coachCard: {
    width: 176,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 10,
  },
  coachTitle: {
    fontFamily: fonts.monoMedium,
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: colors.signal,
  },
  coachBody: {
    marginTop: 6,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
  },
  coachBtn: {
    marginTop: spacing.sm,
    paddingVertical: spacing.sm + 1,
    borderRadius: radius.sm,
    backgroundColor: colors.signal,
    alignItems: 'center',
  },
  coachBtnText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.onSignal,
  },
})
