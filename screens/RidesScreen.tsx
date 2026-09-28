import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useEffect, useRef, useState, useCallback } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import type { Recording } from '../lib/types'
import { colors, fonts, radius, spacing } from '../theme/tokens'
import MenuHeader from '../components/MenuHeader'
import Brackets from '../components/Brackets'

type Props = {
  recordings: Recording[]
  uploadingIds: Set<string>
  processingId: string | null
  onUpload: (recording: Recording) => void | Promise<void>
  onProcess: (recording: Recording) => void | Promise<void>
  onDelete: (recording: Recording) => void
  onRefresh: () => void
  refreshing: boolean
  onMenuPress: () => void
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  queued: { label: 'Queued', color: colors.queued, bg: colors.queuedDim },
  processing: { label: 'Processing', color: colors.moderate, bg: colors.moderateDim },
  completed: { label: 'Completed', color: colors.minor, bg: colors.minorDim },
  failed: { label: 'Failed', color: colors.severe, bg: colors.severeDim },
}

export default function RidesScreen({
  recordings,
  uploadingIds,
  processingId,
  onUpload,
  onProcess,
  onDelete,
  onRefresh,
  refreshing,
  onMenuPress,
}: Props) {
  const [detectionCounts, setDetectionCounts] = useState<Record<string, number>>({})

  const fetchDetectionCounts = useCallback(async (rides: Recording[]) => {
    const completedRides = rides.filter((r) => r.status === 'completed' && r.rideId)
    if (completedRides.length === 0) return

    const counts: Record<string, number> = {}
    await Promise.all(
      completedRides.map(async (r) => {
        const { count } = await supabase
          .from('raw_detections')
          .select('id', { count: 'exact', head: true })
          .eq('ride_id', r.rideId!)
        counts[r.rideId!] = count ?? 0
      })
    )
    setDetectionCounts(counts)
  }, [])

  useEffect(() => {
    onRefresh()
  }, [])

  useEffect(() => {
    fetchDetectionCounts(recordings)
  }, [recordings, fetchDetectionCounts])

  const lastPressRef = useRef<Record<string, number>>({})
  const debounce = (key: string) => {
    const now = Date.now()
    if (now - (lastPressRef.current[key] ?? 0) < 500) return false
    lastPressRef.current[key] = now
    return true
  }

  const sorted = [...recordings].sort((a, b) => b.timestamp - a.timestamp)

  const formatDate = (ts: number) => {
    const d = new Date(ts)
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const formatTime = (ts: number) => {
    const d = new Date(ts)
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  }

  const confirmDelete = (item: Recording) => {
    Alert.alert(
      'Delete Ride',
      'Are you sure you want to delete this ride? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => onDelete(item) },
      ],
    )
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <MenuHeader
        title="Rides"
        onMenuPress={onMenuPress}
        right={
          <TouchableOpacity onPress={onRefresh} style={styles.iconBtn}>
            {refreshing ? (
              <ActivityIndicator size="small" color={colors.signal} />
            ) : (
              <Ionicons name="refresh" size={18} color={colors.textPrimary} />
            )}
          </TouchableOpacity>
        }
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {sorted.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Brackets size={14} />
              <Ionicons name="bicycle-outline" size={34} color={colors.signal} />
            </View>
            <Text style={styles.emptyTitle}>No rides yet</Text>
            <Text style={styles.emptySub}>
              Record a ride from the dashboard to see it here
            </Text>
          </View>
        ) : (
          sorted.map((item) => {
            const isProcessing = item.status === 'processing'
            const hasProgress = isProcessing && item.progressPct != null && item.progressPct >= 0
            const statusCfg = item.status ? STATUS_CONFIG[item.status] : null
            const detCount = item.rideId ? detectionCounts[item.rideId] : undefined
            const noDetections = item.status === 'completed' && detCount === 0

            return (
              <View key={item.id} style={styles.rideCard}>
                {/* Top info row */}
                <View style={styles.rideTopRow}>
                  <View style={styles.rideLeft}>
                    <View style={styles.rideIconContainer}>
                      <Ionicons
                        name={isProcessing ? 'sync' : 'bicycle'}
                        size={18}
                        color={isProcessing ? colors.moderate : colors.signal}
                      />
                    </View>
                    <View style={styles.rideInfo}>
                      <Text style={styles.rideDate}>{formatDate(item.timestamp)}</Text>
                      <Text style={styles.rideTime}>{formatTime(item.timestamp)}</Text>
                    </View>
                  </View>
                  <View style={styles.rideRight}>
                    {noDetections && (
                      <View style={[styles.noDetBadge, { backgroundColor: colors.moderateDim }]}>
                        <Ionicons name="eye-off" size={10} color={colors.moderate} />
                        <Text style={[styles.noDetText, { color: colors.moderate }]}>No Detections</Text>
                      </View>
                    )}
                    {statusCfg ? (
                      <View style={[styles.rideStatus, { backgroundColor: statusCfg.bg }]}>
                        <View style={[styles.statusDot, { backgroundColor: statusCfg.color }]} />
                        <Text style={[styles.rideStatusText, { color: statusCfg.color }]}>
                          {statusCfg.label}
                        </Text>
                      </View>
                    ) : (
                      <View style={[styles.rideStatus, { backgroundColor: colors.moderateDim }]}>
                        <View style={[styles.statusDot, { backgroundColor: colors.moderate }]} />
                        <Text style={[styles.rideStatusText, { color: colors.moderate }]}>Local</Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Progress section — shown when processing */}
                {hasProgress && (
                  <View style={styles.progressSection}>
                    <View style={styles.progressBarBg}>
                      <View
                        style={[styles.progressBarFill, { width: `${item.progressPct ?? 0}%` }]}
                      />
                      <View style={styles.progressPercentage}>
                        <Text style={styles.progressPctText}>
                          {Math.round(item.progressPct ?? 0)}%
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.progressMessageText}>
                      {item.progressMessage || item.progressStage || 'Processing ride...'}
                    </Text>
                  </View>
                )}

                {/* Action buttons row */}
                <View style={styles.actionsRow}>
                  {!item.uploaded && (
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: colors.queuedDim }]}
                      onPress={() => debounce(`upload-${item.id}`) && onUpload(item)}
                      disabled={uploadingIds.has(item.id)}
                      activeOpacity={0.7}
                    >
                      {uploadingIds.has(item.id) ? (
                        <ActivityIndicator size="small" color={colors.queued} />
                      ) : (
                        <>
                          <Ionicons name="cloud-upload" size={15} color={colors.queued} />
                          <Text style={[styles.actionBtnText, { color: colors.queued }]}>Upload</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                  {item.uploaded && item.status !== 'completed' && (
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: colors.minorDim }]}
                      onPress={() => debounce(`process-${item.id}`) && onProcess(item)}
                      disabled={processingId === item.id}
                      activeOpacity={0.7}
                    >
                      {processingId === item.id ? (
                        <ActivityIndicator size="small" color={colors.minor} />
                      ) : (
                        <>
                          <Ionicons
                            name={item.status === 'failed' || item.status === 'processing' ? 'reload' : 'play'}
                            size={15}
                            color={colors.minor}
                          />
                          <Text style={[styles.actionBtnText, { color: colors.minor }]}>
                            {item.status === 'failed' || item.status === 'processing' ? 'Retry' : 'Process'}
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: colors.severeDim }]}
                    onPress={() => confirmDelete(item)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="trash-outline" size={15} color={colors.severe} />
                    <Text style={[styles.actionBtnText, { color: colors.severe }]}>Delete</Text>
                  </TouchableOpacity>
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
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.hairline,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.hairline,
  },

  // Ride Card
  rideCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  rideTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rideLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.md,
  },
  rideIconContainer: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.signalDim,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rideInfo: {
    flex: 1,
  },
  rideDate: {
    color: colors.textPrimary,
    fontFamily: fonts.semibold,
    fontSize: 13,
  },
  rideTime: {
    color: colors.textMuted,
    fontFamily: fonts.mono,
    fontSize: 11,
    marginTop: 2,
  },
  rideRight: { alignItems: 'flex-end', gap: 4 },
  noDetBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: 3, paddingHorizontal: spacing.sm, borderRadius: radius.sm,
  },
  noDetText: { fontSize: 10, fontFamily: fonts.bold, letterSpacing: 0.3 },
  rideStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  rideStatusText: {
    fontSize: 10,
    fontFamily: fonts.bold,
    letterSpacing: 0.4,
  },

  // Progress Section
  progressSection: {
    marginTop: spacing.lg,
  },
  progressBarBg: {
    height: 30,
    backgroundColor: colors.moderateDim,
    borderRadius: radius.sm,
    overflow: 'hidden',
    justifyContent: 'center',
    position: 'relative',
  },
  progressBarFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.moderate,
    borderRadius: radius.sm,
  },
  progressPercentage: {
    position: 'absolute',
    right: spacing.sm,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  progressPctText: {
    color: colors.background,
    fontSize: 12,
    fontFamily: fonts.extrabold,
  },
  progressMessageText: {
    color: colors.moderate,
    fontSize: 11,
    fontFamily: fonts.semibold,
    marginTop: 6,
  },

  // Actions
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.md,
  },
  actionBtnText: {
    fontSize: 12,
    fontFamily: fonts.bold,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.semibold,
    fontSize: 15,
  },
  emptySub: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
})
