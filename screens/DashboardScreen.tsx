import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useEffect, useRef, useState } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { Recording } from '../lib/types'
import { colors, fonts, radius, spacing } from '../theme/tokens'
import Brackets from '../components/Brackets'
import LaneDivider from '../components/LaneDivider'

type Props = {
  recordings: Recording[]
  uploadingIds: Set<string>
  processingId: string | null
  onRecord: () => void
  onDrive: () => void
  onPhoto: () => void
  onMap: () => void
  onUpload: (recording: Recording) => void | Promise<void>
  onProcess: (recording: Recording) => void | Promise<void>
  onDelete: (recording: Recording) => void
  onRefresh: () => void
  refreshing: boolean
  feedRefreshKey: number
  userId: string
  onTabChange: (tab: 'dashboard' | 'feed') => void
  onMenuPress: () => void
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  queued: { label: 'Queued', color: colors.queued, bg: colors.queuedDim },
  processing: { label: 'Processing', color: colors.moderate, bg: colors.moderateDim },
  completed: { label: 'Completed', color: colors.minor, bg: colors.minorDim },
  failed: { label: 'Failed', color: colors.severe, bg: colors.severeDim },
}

// YOLO detection-bracket corners — the app's signature element.
export default function DashboardScreen({
  recordings,
  uploadingIds,
  processingId,
  onRecord,
  onDrive,
  onPhoto,
  onMap,
  onUpload,
  onProcess,
  onDelete,
  onRefresh,
  refreshing,
  feedRefreshKey,
  userId,
  onTabChange,
  onMenuPress,
}: Props) {

  const lastPressRef = useRef<Record<string, number>>({})
  const insets = useSafeAreaInsets()
  const [showQuickStart, setShowQuickStart] = useState(false)

  useEffect(() => {
    AsyncStorage.getItem('@sipat_quickstart_seen').then((seen) => {
      if (!seen) setShowQuickStart(true)
    })
  }, [])

  const dismissQuickStart = () => {
    setShowQuickStart(false)
    AsyncStorage.setItem('@sipat_quickstart_seen', '1')
  }

  const debounce = (key: string) => {
    const now = Date.now()
    if (now - (lastPressRef.current[key] ?? 0) < 500) return false
    lastPressRef.current[key] = now
    return true
  }

  const totalRecordings = recordings.length
  const completed = recordings.filter((r) => r.status === 'completed').length
  const processing = recordings.filter((r) => r.status === 'processing').length
  const failed = recordings.filter((r) => r.status === 'failed').length
  const pending = recordings.filter((r) => r.status === 'queued').length
  const recentRecordings = recordings.slice(0, 3)

  const formatDate = (ts: number) => {
    const d = new Date(ts)
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }

  const formatTime = (ts: number) => {
    const d = new Date(ts)
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  }

  const getGreeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={onMenuPress} style={styles.iconBtn} activeOpacity={0.7}>
            <Ionicons name="menu" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
          <Image source={require('../assets/sipat-logo-main.png')} style={styles.headerLogo} resizeMode="contain" />
          <View>
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <Text style={styles.title}>SIPAT</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={onRefresh} style={styles.iconBtn}>
            {refreshing ? (
              <ActivityIndicator size="small" color={colors.signal} />
            ) : (
              <Ionicons name="refresh" size={18} color={colors.textPrimary} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {showQuickStart && (
          <View style={styles.quickStartCard}>
            <View style={styles.quickStartHeader}>
              <Text style={styles.quickStartTitle}>Welcome to Sipat!</Text>
              <TouchableOpacity onPress={dismissQuickStart} activeOpacity={0.7}>
                <Ionicons name="close" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <View style={styles.quickStartStep}>
              <Text style={styles.quickStartNum}>1</Text>
              <Text style={styles.quickStartText}>Tap Record to start a ride — AI detects potholes automatically</Text>
            </View>
            <View style={styles.quickStartStep}>
              <Text style={styles.quickStartNum}>2</Text>
              <Text style={styles.quickStartText}>Use the menu ☰ to access Feed, Map, and Rides</Text>
            </View>
            <View style={styles.quickStartStep}>
              <Text style={styles.quickStartNum}>3</Text>
              <Text style={styles.quickStartText}>Tap Photo to capture road distress directly</Text>
            </View>
          </View>
        )}

        {/* Hero Stats — detection brackets frame the headline number */}
        <View style={styles.heroSection}>
          <View style={styles.heroCard}>
            <View style={styles.heroGlow} />
            <View style={styles.heroTopRow}>
              <Text style={styles.eyebrow}>Total rides</Text>
              <View style={styles.heroIconWell}>
                <Ionicons name="videocam" size={16} color={colors.signal} />
              </View>
            </View>
            <View style={styles.bracketBox}>
              <Brackets />
              <Text style={styles.heroNumber}>{totalRecordings}</Text>
            </View>
            <Text style={styles.heroSub}>
              {completed} analyzed · {processing + pending} in queue
            </Text>

            {(completed > 0 || processing > 0 || failed > 0) && (
              <View style={styles.heroRow}>
                <View style={styles.heroSmallCard}>
                  <View style={[styles.heroSmallIcon, { backgroundColor: colors.minorDim }]}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.minor} />
                  </View>
                  <Text style={styles.heroSmallNumber}>{completed}</Text>
                  <Text style={styles.heroSmallLabel}>Done</Text>
                </View>
                <View style={styles.heroSmallCard}>
                  <View style={[styles.heroSmallIcon, { backgroundColor: colors.moderateDim }]}>
                    <Ionicons name="sync" size={16} color={colors.moderate} />
                  </View>
                  <Text style={styles.heroSmallNumber}>{processing}</Text>
                  <Text style={styles.heroSmallLabel}>Processing</Text>
                </View>
                <View style={styles.heroSmallCard}>
                  <View style={[styles.heroSmallIcon, { backgroundColor: colors.severeDim }]}>
                    <Ionicons name="alert-circle" size={16} color={colors.severe} />
                  </View>
                  <Text style={styles.heroSmallNumber}>{failed}</Text>
                  <Text style={styles.heroSmallLabel}>Failed</Text>
                </View>
              </View>
            )}
          </View>
        </View>

        <LaneDivider />

        {/* Map Card */}
        {Platform.OS !== 'web' && (
          <View style={styles.mapCardSection}>
            <TouchableOpacity style={styles.mapCard} onPress={onMap} activeOpacity={0.8}>
              <View style={styles.mapCardBg}>
                <View style={styles.mapGridLine1} />
                <View style={styles.mapGridLine2} />
                <View style={styles.mapGridLine3} />
                <View style={styles.mapGridLine4} />
                <View style={styles.mapPin1}>
                  <View style={styles.mapPinDot} />
                </View>
                <View style={styles.mapPin2}>
                  <View style={[styles.mapPinDot, { backgroundColor: colors.severe }]} />
                </View>
                <View style={styles.mapPin3}>
                  <View style={[styles.mapPinDot, { backgroundColor: colors.minor }]} />
                </View>
              </View>
              <View style={styles.mapCardOverlay} />
              <View style={styles.mapCardContent}>
                <View style={styles.mapCardLeft}>
                  <View style={styles.mapCardIcon}>
                    <Ionicons name="map" size={20} color={colors.signalBright} />
                  </View>
                  <View>
                    <Text style={styles.mapCardTitle}>Explore Map</Text>
                    <Text style={styles.mapCardSub}>Potholes near you</Text>
                  </View>
                </View>
                <View style={styles.mapCardBadge}>
                  <Ionicons name="navigate" size={12} color={colors.signalBright} />
                  <Text style={styles.mapCardBadgeText}>Open</Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.eyebrow}>Quick actions</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={onDrive}
              activeOpacity={0.7}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.moderateDim }]}>
                <Ionicons name="navigate" size={22} color={colors.moderate} />
              </View>
              <Text style={styles.actionLabel}>Drive Mode</Text>
              <Text style={styles.actionSub}>Pothole alerts</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={onRefresh}
              activeOpacity={0.7}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.minorDim }]}>
                <Ionicons name="refresh-circle" size={22} color={colors.minor} />
              </View>
              <Text style={styles.actionLabel}>Sync Data</Text>
              <Text style={styles.actionSub}>Refresh status</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => onTabChange('feed')}
              activeOpacity={0.7}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.signalDim }]}>
                <Ionicons name="newspaper" size={22} color={colors.signal} />
              </View>
              <Text style={styles.actionLabel}>Community Feed</Text>
              <Text style={styles.actionSub}>Photos & reports</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Queue Status */}
        {pending > 0 && (
          <View style={styles.queueBanner}>
            <View style={styles.queueLeft}>
              <Ionicons name="time" size={16} color={colors.moderate} />
              <Text style={styles.queueText}>
                {pending} ride{pending !== 1 ? 's' : ''} waiting to upload
              </Text>
            </View>
          </View>
        )}

        <LaneDivider />

        {/* Recent Activity */}
        <View style={styles.section}>
          <Text style={styles.eyebrow}>Recent rides</Text>

          {recentRecordings.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyBracketBox}>
                <Brackets size={16} color="rgba(6, 182, 212, 0.35)" />
                <Ionicons name="bicycle-outline" size={34} color={colors.signal} />
              </View>
              <Text style={styles.emptyTitle}>No rides yet</Text>
              <Text style={styles.emptySub}>
                Tap the red Record button below to start detecting potholes
              </Text>
            </View>
          ) : (
            recentRecordings.map((item, index) => {
              const statusCfg = item.status ? STATUS_CONFIG[item.status] : null
              return (
                <View key={item.id}>
                <View
                  style={[
                    styles.rideCard,
                    index === recentRecordings.length - 1 && styles.rideCardLast,
                  ]}
                >
                  <View style={styles.rideLeft}>
                    <View style={styles.rideIconContainer}>
                      <Ionicons name="bicycle" size={16} color={colors.signal} />
                    </View>
                    <View style={styles.rideInfo}>
                      <Text style={styles.rideDate}>{formatDate(item.timestamp)}</Text>
                      <Text style={styles.rideTime}>{formatTime(item.timestamp)}</Text>
                    </View>
                  </View>
                  <View style={styles.rideRight}>
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

                  {!item.uploaded && (
                    <TouchableOpacity
                      style={styles.rideAction}
                      onPress={() => debounce(`upload-${item.id}`) && onUpload(item)}
                      disabled={uploadingIds.has(item.id)}
                      activeOpacity={0.7}
                    >
                      {uploadingIds.has(item.id) ? (
                        <ActivityIndicator size="small" color={colors.queued} />
                      ) : (
                        <Ionicons name="cloud-upload" size={16} color={colors.queued} />
                      )}
                    </TouchableOpacity>
                  )}
                  {item.uploaded && item.status === 'queued' && (
                    <TouchableOpacity
                      style={styles.rideAction}
                      onPress={() => debounce(`process-${item.id}`) && onProcess(item)}
                      disabled={processingId === item.id}
                      activeOpacity={0.7}
                    >
                      {processingId === item.id ? (
                        <ActivityIndicator size="small" color={colors.minor} />
                      ) : (
                        <Ionicons name="play" size={16} color={colors.minor} />
                      )}
                    </TouchableOpacity>
                  )}
                </View>
                {item.status === 'processing' && item.progressPct != null && item.progressPct >= 0 && (
                  <View style={styles.progressContainer}>
                    <View style={styles.progressBarBg}>
                      <View style={[styles.progressBarFill, { width: `${item.progressPct}%` }]} />
                    </View>
                    <Text style={styles.progressText}>
                      {item.progressMessage || item.progressStage || 'Processing...'}
                    </Text>
                  </View>
                )}
                </View>
              )
            })
          )}
        </View>

        <View style={{ height: insets.bottom + 100 }} />
      </ScrollView>

      {/* Bottom Action Bar */}
      <View style={[styles.bottomBar, { bottom: insets.bottom + spacing.lg }]}>
        <TouchableOpacity style={styles.fabBtn} onPress={onRecord} activeOpacity={0.8}>
          <View style={[styles.fabGlow, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]} />
          <View style={[styles.fabOuter, { backgroundColor: colors.severe }]}>
            <Ionicons name="radio-button-on" size={26} color={colors.onSignal} />
          </View>
          <Text style={styles.fabLabel}>Record</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.fabBtn} onPress={onPhoto} activeOpacity={0.8}>
          <View style={[styles.fabGlow, { backgroundColor: 'rgba(6, 182, 212, 0.15)' }]} />
          <View style={[styles.fabOuter, { backgroundColor: colors.signal }]}>
            <Ionicons name="camera" size={26} color={colors.onSignal} />
          </View>
          <Text style={styles.fabLabel}>Photo</Text>
        </TouchableOpacity>
      </View>
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
    paddingBottom: spacing.xl,
  },

  // Signature elements
  eyebrow: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },

  // Quick-start guide
  quickStartCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  quickStartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  quickStartTitle: {
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    fontSize: 15,
  },
  quickStartStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  quickStartNum: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.signal,
    textAlign: 'center',
    lineHeight: 20,
    fontFamily: fonts.extrabold,
    color: colors.onSignal,
    fontSize: 11,
    overflow: 'hidden',
  },
  quickStartText: {
    flex: 1,
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
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
  headerLogo: {
    width: 34,
    height: 34,
    marginRight: spacing.sm,
  },
  greeting: {
    fontFamily: fonts.semibold,
    color: colors.textMuted,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  title: {
    fontFamily: fonts.extrabold,
    fontSize: 23,
    color: colors.textPrimary,
    letterSpacing: 0.4,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },

  // Hero Section
  heroSection: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  heroCard: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.xl,
  },
  heroGlow: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(6, 182, 212, 0.07)',
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  heroIconWell: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.signalDim,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bracketBox: {
    alignSelf: 'flex-start',
    paddingHorizontal: 22,
    paddingVertical: 6,
  },
  heroNumber: {
    fontFamily: fonts.extrabold,
    color: colors.textPrimary,
    fontSize: 46,
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  heroSub: {
    fontFamily: fonts.medium,
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  heroRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  heroSmallCard: {
    flex: 1,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  heroSmallIcon: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  heroSmallNumber: {
    fontFamily: fonts.monoBold,
    color: colors.textPrimary,
    fontSize: 18,
  },
  heroSmallLabel: {
    fontFamily: fonts.semibold,
    color: colors.textMuted,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 2,
  },

  // Map Card
  mapCardSection: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
  },
  mapCard: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    height: 140,
    position: 'relative',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  mapCardBg: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
  },
  mapGridLine1: {
    position: 'absolute',
    top: 30,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(6, 182, 212, 0.08)',
    transform: [{ rotate: '-12deg' }],
  },
  mapGridLine2: {
    position: 'absolute',
    top: 70,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(6, 182, 212, 0.08)',
    transform: [{ rotate: '-12deg' }],
  },
  mapGridLine3: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 60,
    width: 1,
    backgroundColor: 'rgba(6, 182, 212, 0.06)',
    transform: [{ rotate: '20deg' }],
  },
  mapGridLine4: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 160,
    width: 1,
    backgroundColor: 'rgba(6, 182, 212, 0.06)',
    transform: [{ rotate: '20deg' }],
  },
  mapPin1: {
    position: 'absolute',
    top: 25,
    right: 80,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.signalDim,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapPin2: {
    position: 'absolute',
    top: 55,
    right: 40,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapPin3: {
    position: 'absolute',
    bottom: 35,
    right: 110,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(34, 197, 94, 0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapPinDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.signal,
  },
  mapCardOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(14, 16, 19, 0.45)',
  },
  mapCardContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
  mapCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  mapCardIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.signalDim,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.25)',
  },
  mapCardTitle: {
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    fontSize: 15,
  },
  mapCardSub: {
    fontFamily: fonts.regular,
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  mapCardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.signalDim,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.25)',
  },
  mapCardBadgeText: {
    fontFamily: fonts.bold,
    color: colors.signalBright,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  // Quick Actions
  section: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
  },
  actionsGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  actionCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  actionLabel: {
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
    fontSize: 13,
    marginBottom: 2,
  },
  actionSub: {
    fontFamily: fonts.regular,
    color: colors.textMuted,
    fontSize: 11,
  },

  // Queue Banner
  queueBanner: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.xl,
    backgroundColor: 'rgba(245, 158, 11, 0.06)',
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.14)',
  },
  queueLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  queueText: {
    fontFamily: fonts.semibold,
    color: colors.moderate,
    fontSize: 12,
  },

  // Recent Activity
  rideCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.hairline,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rideCardLast: {
    marginBottom: 0,
  },
  rideLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.md,
  },
  rideIconContainer: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.signalDim,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rideInfo: {
    flex: 1,
  },
  rideDate: {
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
    fontSize: 13,
  },
  rideTime: {
    fontFamily: fonts.mono,
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 1,
  },
  rideRight: {
    marginRight: spacing.sm,
  },
  rideStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: radius.sm,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  rideStatusText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 0.3,
  },
  progressContainer: {
    marginTop: spacing.sm,
  },
  progressBarBg: {
    height: 4,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 4,
    backgroundColor: colors.moderate,
    borderRadius: 2,
  },
  progressText: {
    fontFamily: fonts.monoMedium,
    color: colors.moderate,
    fontSize: 10,
    marginTop: 4,
  },
  rideAction: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.hairline,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Empty State — bracket-framed (signature)
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  emptyBracketBox: {
    width: 72,
    height: 72,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    fontSize: 15,
  },
  emptySub: {
    fontFamily: fonts.regular,
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: spacing.xxl,
  },

  // Bottom Action Bar
  bottomBar: {
    position: 'absolute',
    bottom: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    alignSelf: 'center',
  },
  fabBtn: {
    alignItems: 'center',
    width: 76,
  },
  fabGlow: {
    position: 'absolute',
    top: -4,
    left: 4,
    right: 4,
    height: 76,
    borderRadius: 40,
  },
  fabOuter: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabLabel: {
    fontFamily: fonts.semibold,
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 6,
  },
})
