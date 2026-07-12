import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { useCommunityHazards } from '../lib/useCommunityHazards'
import CommunityHazardsSection from '../components/CommunityHazardsSection'
import type { Recording } from '../lib/types'

type Props = {
  recordings: Recording[]
  uploadingId: string | null
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
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  queued: { label: 'Queued', color: '#7bb7ff', bg: 'rgba(37, 99, 235, 0.12)' },
  processing: { label: 'Processing', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
  completed: { label: 'Completed', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)' },
  failed: { label: 'Failed', color: '#dc2626', bg: 'rgba(222, 38, 38, 0.1)' },
}

export default function DashboardScreen({
  recordings,
  uploadingId,
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
}: Props) {
  const handleLogout = () => {
    supabase.auth.signOut()
  }

  const totalRecordings = recordings.length
  const completed = recordings.filter((r) => r.status === 'completed').length
  const processing = recordings.filter((r) => r.status === 'processing').length
  const failed = recordings.filter((r) => r.status === 'failed').length
  const pending = recordings.filter((r) => r.status === 'queued').length
  const recentRecordings = recordings.slice(0, 3)
  const { hazards, loading: hazardsLoading } = useCommunityHazards()

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
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.avatarCircle}>
            <Ionicons name="shield-checkmark" size={18} color="#e6a817" />
          </View>
          <View>
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <Text style={styles.title}>Sipat</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={onRefresh} style={styles.iconBtn}>
            {refreshing ? (
              <ActivityIndicator size="small" color="#e6a817" />
            ) : (
              <Ionicons name="refresh" size={20} color="#e0e0e0" />
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout} style={styles.iconBtn}>
            <Ionicons name="log-out" size={20} color="#dc2626" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Stats */}
        <View style={styles.heroSection}>
          <View style={styles.heroCard}>
            <View style={styles.heroGlow} />
            <View style={styles.heroCardContent}>
              <View style={styles.heroIconRow}>
                <View style={styles.heroIcon}>
                  <Ionicons name="videocam" size={22} color="#e6a817" />
                </View>
                <View style={styles.heroTrend}>
                  <Ionicons name="trending-up" size={14} color="#22c55e" />
                  <Text style={styles.heroTrendText}>Active</Text>
                </View>
              </View>
              <Text style={styles.heroNumber}>{totalRecordings}</Text>
              <Text style={styles.heroLabel}>Total Rides</Text>
            </View>
          </View>

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
            <View style={[styles.heroSmallCard, { borderColor: 'rgba(222, 38, 38, 0.15)' }]}>
              <View style={[styles.heroSmallIcon, { backgroundColor: 'rgba(222, 38, 38, 0.12)' }]}>
                <Ionicons name="alert-circle" size={18} color="#dc2626" />
              </View>
              <Text style={styles.heroSmallNumber}>{failed}</Text>
              <Text style={styles.heroSmallLabel}>Failed</Text>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            {Platform.OS !== 'web' && (
              <TouchableOpacity style={styles.actionCard} onPress={onMap} activeOpacity={0.7}>
                <View style={[styles.actionIcon, { backgroundColor: 'rgba(37, 99, 235, 0.12)' }]}>
                  <Ionicons name="map" size={24} color="#2563eb" />
                </View>
                <Text style={styles.actionLabel}>View Map</Text>
                <Text style={styles.actionSub}>Potholes near you</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.actionCard} onPress={onRecord} activeOpacity={0.7}>
              <View style={[styles.actionIcon, { backgroundColor: 'rgba(222, 38, 38, 0.12)' }]}>
                <Ionicons name="radio-button-on" size={24} color="#dc2626" />
              </View>
              <Text style={styles.actionLabel}>Record Ride</Text>
              <Text style={styles.actionSub}>Capture potholes</Text>
            </TouchableOpacity>
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
              <View style={[styles.actionIcon, { backgroundColor: 'rgba(230, 168, 23, 0.12)' }]}>
                <Ionicons name="warning" size={24} color="#e6a817" />
              </View>
              <Text style={styles.actionLabel}>Distress</Text>
              <Text style={styles.actionSub}>All detections</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionCard} onPress={onPhoto} activeOpacity={0.7}>
              <View style={[styles.actionIcon, { backgroundColor: 'rgba(6, 182, 212, 0.12)' }]}>
                <Ionicons name="camera" size={24} color="#06b6d4" />
              </View>
              <Text style={styles.actionLabel}>Report Distress</Text>
              <Text style={styles.actionSub}>Snap a photo</Text>
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
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Rides</Text>
            {totalRecordings > 3 && (
              <Text style={styles.sectionLink}>View all</Text>
            )}
          </View>

          {recentRecordings.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons name="bicycle-outline" size={40} color="#2a2a3a" />
              </View>
              <Text style={styles.emptyTitle}>No rides yet</Text>
              <Text style={styles.emptySub}>
                Start recording to detect potholes on your route
              </Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={onRecord} activeOpacity={0.8}>
                <Ionicons name="radio-button-on" size={16} color="#0c0c14" />
                <Text style={styles.emptyBtnText}>Start Recording</Text>
              </TouchableOpacity>
            </View>
          ) : (
            recentRecordings.map((item, index) => {
              const statusCfg = item.status ? STATUS_CONFIG[item.status] : null
              return (
                <View
                  key={item.id}
                  style={[
                    styles.rideCard,
                    index === recentRecordings.length - 1 && styles.rideCardLast,
                  ]}
                >
                  <View style={styles.rideLeft}>
                    <View style={styles.rideIconContainer}>
                      <Ionicons name="bicycle" size={18} color="#e6a817" />
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
                      onPress={() => onUpload(item)}
                      disabled={uploadingId === item.id}
                      activeOpacity={0.7}
                    >
                      {uploadingId === item.id ? (
                        <ActivityIndicator size="small" color="#2563eb" />
                      ) : (
                        <Ionicons name="cloud-upload" size={16} color="#2563eb" />
                      )}
                    </TouchableOpacity>
                  )}
                  {item.uploaded && item.status === 'queued' && (
                    <TouchableOpacity
                      style={styles.rideAction}
                      onPress={() => onProcess(item)}
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
              )
            })
          )}
        </View>

        {/* Address Analytics */}
        <View style={styles.section}>
          <CommunityHazardsSection hazards={hazards} loading={hazardsLoading} />
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom Action Bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.fabBtn} onPress={onRecord} activeOpacity={0.8}>
          <View style={[styles.fabGlow, { backgroundColor: 'rgba(222, 38, 38, 0.15)' }]} />
          <View style={[styles.fabOuter, { backgroundColor: '#dc2626' }]}>
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

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 56,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(230, 168, 23, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(230, 168, 23, 0.25)',
  },
  greeting: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#f0f0f0',
    letterSpacing: -0.5,
    marginTop: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
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
    backgroundColor: '#141420',
    borderWidth: 1,
    borderColor: 'rgba(230, 168, 23, 0.1)',
  },
  heroGlow: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(230, 168, 23, 0.08)',
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
    backgroundColor: 'rgba(230, 168, 23, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroTrend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  heroTrendText: {
    color: '#22c55e',
    fontSize: 11,
    fontWeight: '700',
  },
  heroNumber: {
    color: '#f0f0f0',
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: -1,
  },
  heroLabel: {
    color: '#6b7280',
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
    backgroundColor: '#141420',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
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
    color: '#f0f0f0',
    fontSize: 20,
    fontWeight: '700',
  },
  heroSmallLabel: {
    color: '#6b7280',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },

  // Quick Actions
  section: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    color: '#f0f0f0',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 14,
  },
  sectionLink: {
    color: '#e6a817',
    fontSize: 13,
    fontWeight: '600',
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionCard: {
    width: '31%',
    backgroundColor: '#141420',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
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
    color: '#f0f0f0',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  actionSub: {
    color: '#4b5563',
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
    backgroundColor: '#141420',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
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
    backgroundColor: 'rgba(230, 168, 23, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rideInfo: {
    flex: 1,
  },
  rideDate: {
    color: '#f0f0f0',
    fontSize: 14,
    fontWeight: '600',
  },
  rideTime: {
    color: '#6b7280',
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
  rideAction: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#141420',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
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
    color: '#f0f0f0',
    fontSize: 16,
    fontWeight: '700',
  },
  emptySub: {
    color: '#4b5563',
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#e6a817',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 14,
    marginTop: 20,
  },
  emptyBtnText: {
    color: '#0c0c14',
    fontSize: 14,
    fontWeight: '700',
  },

  // Bottom Action Bar
  bottomBar: {
    position: 'absolute',
    bottom: 36,
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
