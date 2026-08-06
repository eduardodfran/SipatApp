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

type Props = {
  recordings: Recording[]
  uploadingIds: Set<string>
  processingId: string | null
  onRecord: () => void
  onPhoto: () => void
  onMap: () => void
  onDistress: () => void
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
  queued: { label: 'Queued', color: '#60a5fa', bg: 'rgba(37, 99, 235, 0.12)' },
  processing: { label: 'Processing', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
  completed: { label: 'Completed', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)' },
  failed: { label: 'Failed', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' },
}

export default function DashboardScreen({
  recordings,
  uploadingIds,
  processingId,
  onRecord,
  onPhoto,
  onMap,
  onDistress,
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
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={onMenuPress} style={styles.menuBtn} activeOpacity={0.7}>
            <Ionicons name="menu" size={22} color="#fafafa" />
          </TouchableOpacity>
          <Image source={require('../assets/sipat-logo-main.png')} style={styles.headerLogo} resizeMode="contain" />
          <View>
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <Text style={styles.title}>Sipat</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={onRefresh} style={styles.iconBtn}>
            {refreshing ? (
              <ActivityIndicator size="small" color="#06b6d4" />
            ) : (
              <Ionicons name="refresh" size={20} color="#fafafa" />
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
                <Ionicons name="close" size={18} color="#71717a" />
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

        {/* Hero Stats */}
        <View style={styles.heroSection}>
          <View style={styles.heroCard}>
            <View style={styles.heroGlow} />
            <View style={styles.heroCardContent}>
              <View style={styles.heroIconRow}>
                <View style={styles.heroIcon}>
                  <Ionicons name="videocam" size={22} color="#06b6d4" />
                </View>
              </View>
              <Text style={styles.heroNumber}>{totalRecordings}</Text>
              <Text style={styles.heroLabel}>Total Rides</Text>
            </View>
          </View>

          {(completed > 0 || processing > 0 || failed > 0) && (
            <View style={styles.heroRow}>
              <View style={[styles.heroSmallCard, { borderColor: 'rgba(34, 197, 94, 0.15)' }]}>
                <View style={[styles.heroSmallIcon, { backgroundColor: 'rgba(34, 197, 94, 0.12)' }]}>
                  <Ionicons name="checkmark-circle" size={18} color="#22c55e" />
                </View>
                <Text style={styles.heroSmallNumber}>{completed}</Text>
                <Text style={styles.heroSmallLabel}>Done</Text>
              </View>
              <View style={[styles.heroSmallCard, { borderColor: 'rgba(245, 158, 11, 0.15)' }]}>
                <View style={[styles.heroSmallIcon, { backgroundColor: 'rgba(245, 158, 11, 0.12)' }]}>
                  <Ionicons name="sync" size={18} color="#f59e0b" />
                </View>
                <Text style={styles.heroSmallNumber}>{processing}</Text>
                <Text style={styles.heroSmallLabel}>Processing</Text>
              </View>
              <View style={[styles.heroSmallCard, { borderColor: 'rgba(239, 68, 68, 0.15)' }]}>
                <View style={[styles.heroSmallIcon, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}>
                  <Ionicons name="alert-circle" size={18} color="#ef4444" />
                </View>
                <Text style={styles.heroSmallNumber}>{failed}</Text>
                <Text style={styles.heroSmallLabel}>Failed</Text>
              </View>
            </View>
          )}
        </View>

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
                  <View style={[styles.mapPinDot, { backgroundColor: '#ef4444' }]} />
                </View>
                <View style={styles.mapPin3}>
                  <View style={[styles.mapPinDot, { backgroundColor: '#22c55e' }]} />
                </View>
              </View>
              <View style={styles.mapCardOverlay} />
              <View style={styles.mapCardContent}>
                <View style={styles.mapCardLeft}>
                  <View style={styles.mapCardIcon}>
                    <Ionicons name="map" size={20} color="#fafafa" />
                  </View>
                  <View>
                    <Text style={styles.mapCardTitle}>Explore Map</Text>
                    <Text style={styles.mapCardSub}>Potholes near you</Text>
                  </View>
                </View>
                <View style={styles.mapCardBadge}>
                  <Ionicons name="navigate" size={14} color="#60a5fa" />
                  <Text style={styles.mapCardBadgeText}>Open</Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={onRefresh}
              activeOpacity={0.7}
            >
              <View style={[styles.actionIcon, { backgroundColor: 'rgba(34, 197, 94, 0.12)' }]}>
                <Ionicons name="refresh-circle" size={24} color="#22c55e" />
              </View>
              <Text style={styles.actionLabel}>Sync Data</Text>
              <Text style={styles.actionSub}>Refresh status</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={onDistress}
              activeOpacity={0.7}
            >
              <View style={[styles.actionIcon, { backgroundColor: 'rgba(6, 182, 212, 0.12)' }]}>
                <Ionicons name="warning" size={24} color="#06b6d4" />
              </View>
              <Text style={styles.actionLabel}>All Detections</Text>
              <Text style={styles.actionSub}>View all hazards</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Queue Status */}
        {pending > 0 && (
          <View style={styles.queueBanner}>
            <View style={styles.queueLeft}>
              <Ionicons name="time" size={18} color="#f59e0b" />
              <Text style={styles.queueText}>
                {pending} ride{pending !== 1 ? 's' : ''} waiting to upload
              </Text>
            </View>
          </View>
        )}

        {/* Recent Activity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Rides</Text>

          {recentRecordings.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons name="bicycle-outline" size={40} color="rgba(6, 182, 212, 0.4)" />
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
                      <Ionicons name="bicycle" size={18} color="#06b6d4" />
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
                      <View style={[styles.rideStatus, { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}>
                        <View style={[styles.statusDot, { backgroundColor: '#f59e0b' }]} />
                        <Text style={[styles.rideStatusText, { color: '#f59e0b' }]}>Local</Text>
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
                        <ActivityIndicator size="small" color="#2563eb" />
                      ) : (
                        <Ionicons name="cloud-upload" size={16} color="#2563eb" />
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
                        <ActivityIndicator size="small" color="#22c55e" />
                      ) : (
                        <Ionicons name="play" size={16} color="#22c55e" />
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
      <View style={[styles.bottomBar, { bottom: insets.bottom + 16 }]}>
        <TouchableOpacity style={styles.fabBtn} onPress={onRecord} activeOpacity={0.8}>
          <View style={[styles.fabGlow, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]} />
          <View style={[styles.fabOuter, { backgroundColor: '#ef4444' }]}>
            <Ionicons name="radio-button-on" size={26} color="#0c0c14" />
          </View>
          <Text style={styles.fabLabel}>Record</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.fabBtn} onPress={onPhoto} activeOpacity={0.8}>
          <View style={[styles.fabGlow, { backgroundColor: 'rgba(6, 182, 212, 0.15)' }]} />
          <View style={[styles.fabOuter, { backgroundColor: '#06b6d4' }]}>
            <Ionicons name="camera" size={26} color="#0c0c14" />
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
    backgroundColor: '#0c0c14',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },

  // Quick-start guide
  quickStartCard: {
    marginHorizontal: 16, marginTop: 12,
    backgroundColor: '#18181b', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  quickStartHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12,
  },
  quickStartTitle: { color: '#fafafa', fontSize: 15, fontWeight: '700' },
  quickStartStep: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8,
  },
  quickStartNum: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#06b6d4', textAlign: 'center', lineHeight: 20,
    color: '#0c0c14', fontSize: 11, fontWeight: '800', overflow: 'hidden',
  },
  quickStartText: { flex: 1, color: '#a1a1aa', fontSize: 13, lineHeight: 18 },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 12,
    paddingHorizontal: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    marginRight: 4,
  },
  headerLogo: {
    width: 36,
    height: 36,
    marginRight: 8,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(6, 182, 212, 0.25)',
  },
  greeting: {
    color: '#71717a',
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fafafa',
    letterSpacing: -0.5,
    marginTop: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },

  // Hero Section
  heroSection: {
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  heroCard: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.1)',
  },
  heroGlow: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(6, 182, 212, 0.08)',
  },
  heroCardContent: {
    padding: 20,
  },
  heroIconRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroNumber: {
    color: '#fafafa',
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: -1,
  },
  heroLabel: {
    color: '#71717a',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  heroRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  heroSmallCard: {
    flex: 1,
    backgroundColor: '#18181b',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  heroSmallIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  heroSmallNumber: {
    color: '#fafafa',
    fontSize: 20,
    fontWeight: '700',
  },
  heroSmallLabel: {
    color: '#71717a',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },

  // Map Card
  mapCardSection: {
    paddingHorizontal: 20,
    marginTop: 16,
  },
  mapCard: {
    borderRadius: 20,
    overflow: 'hidden',
    height: 150,
    position: 'relative',
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.2)',
  },
  mapCardBg: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  mapGridLine1: {
    position: 'absolute',
    top: 30,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
    transform: [{ rotate: '-12deg' }],
  },
  mapGridLine2: {
    position: 'absolute',
    top: 70,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
    transform: [{ rotate: '-12deg' }],
  },
  mapGridLine3: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 60,
    width: 1,
    backgroundColor: 'rgba(37, 99, 235, 0.06)',
    transform: [{ rotate: '20deg' }],
  },
  mapGridLine4: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 160,
    width: 1,
    backgroundColor: 'rgba(37, 99, 235, 0.06)',
    transform: [{ rotate: '20deg' }],
  },
  mapPin1: {
    position: 'absolute',
    top: 25,
    right: 80,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(6, 182, 212, 0.2)',
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
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
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
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapPinDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#06b6d4',
  },
  mapCardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(12, 12, 20, 0.4)',
  },
  mapCardContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
  },
  mapCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  mapCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(37, 99, 235, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.3)',
  },
  mapCardTitle: {
    color: '#fafafa',
    fontSize: 18,
    fontWeight: '700',
  },
  mapCardSub: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  mapCardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.25)',
  },
  mapCardBadgeText: {
    color: '#60a5fa',
    fontSize: 12,
    fontWeight: '700',
  },

  // Quick Actions
  section: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  sectionTitle: {
    color: '#fafafa',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 14,
  },
  actionsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  actionCard: {
    flex: 1,
    backgroundColor: '#18181b',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  actionIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  actionLabel: {
    color: '#fafafa',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  actionSub: {
    color: '#71717a',
    fontSize: 11,
    fontWeight: '400',
  },

  // Queue Banner
  queueBanner: {
    marginHorizontal: 20,
    marginTop: 20,
    backgroundColor: 'rgba(245, 158, 11, 0.06)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.12)',
  },
  queueLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  queueText: {
    color: '#f59e0b',
    fontSize: 13,
    fontWeight: '600',
  },

  // Recent Activity
  rideCard: {
    backgroundColor: '#18181b',
    borderRadius: 14,
    padding: 14,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
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
    gap: 12,
  },
  rideIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rideInfo: {
    flex: 1,
  },
  rideDate: {
    color: '#fafafa',
    fontSize: 14,
    fontWeight: '600',
  },
  rideTime: {
    color: '#71717a',
    fontSize: 12,
    marginTop: 1,
  },
  rideRight: {
    marginRight: 8,
  },
  rideStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  rideStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  progressContainer: {
    marginTop: 8,
  },
  progressBarBg: {
    height: 4,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 4,
    backgroundColor: '#f59e0b',
    borderRadius: 2,
  },
  progressText: {
    color: '#f59e0b',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 4,
  },
  rideAction: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#18181b',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    color: '#fafafa',
    fontSize: 16,
    fontWeight: '700',
  },
  emptySub: {
    color: '#71717a',
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 40,
  },

  // Bottom Action Bar
  bottomBar: {
    position: 'absolute',
    bottom: 16,
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
    color: '#a1a1aa',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 6,
  },
})
