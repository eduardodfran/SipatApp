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
import { useEffect, useRef } from 'react'
import { Ionicons } from '@expo/vector-icons'
import type { Recording } from '../lib/types'

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
  queued: { label: 'Queued', color: '#7bb7ff', bg: 'rgba(37, 99, 235, 0.12)' },
  processing: { label: 'Processing', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
  completed: { label: 'Completed', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)' },
  failed: { label: 'Failed', color: '#dc2626', bg: 'rgba(222, 38, 38, 0.1)' },
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
  useEffect(() => {
    onRefresh()
  }, [])

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

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={onMenuPress} style={styles.menuBtn} activeOpacity={0.7}>
            <Ionicons name="menu" size={22} color="#e0e0e0" />
          </TouchableOpacity>
          <Text style={styles.title}>Rides</Text>
        </View>
        <TouchableOpacity onPress={onRefresh} style={styles.iconBtn}>
          {refreshing ? (
            <ActivityIndicator size="small" color="#e6a817" />
          ) : (
            <Ionicons name="refresh" size={20} color="#e0e0e0" />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {sorted.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="bicycle-outline" size={40} color="#2a2a3a" />
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

            return (
              <View key={item.id} style={styles.rideCard}>
                {/* Top info row */}
                <View style={styles.rideTopRow}>
                  <View style={styles.rideLeft}>
                    <View style={styles.rideIconContainer}>
                      <Ionicons
                        name={isProcessing ? 'sync' : 'bicycle'}
                        size={18}
                        color={isProcessing ? '#f59e0b' : '#e6a817'}
                      />
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
                      style={styles.actionBtn}
                      onPress={() => debounce(`upload-${item.id}`) && onUpload(item)}
                      disabled={uploadingIds.has(item.id)}
                      activeOpacity={0.7}
                    >
                      {uploadingIds.has(item.id) ? (
                        <ActivityIndicator size="small" color="#2563eb" />
                      ) : (
                        <>
                          <Ionicons name="cloud-upload" size={16} color="#2563eb" />
                          <Text style={[styles.actionBtnText, { color: '#2563eb' }]}>Upload</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                  {item.uploaded && item.status !== 'completed' && (
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => debounce(`process-${item.id}`) && onProcess(item)}
                      disabled={processingId === item.id}
                      activeOpacity={0.7}
                    >
                      {processingId === item.id ? (
                        <ActivityIndicator size="small" color="#22c55e" />
                      ) : (
                        <>
                          <Ionicons
                            name={item.status === 'failed' || item.status === 'processing' ? 'reload' : 'play'}
                            size={16}
                            color="#22c55e"
                          />
                          <Text style={[styles.actionBtnText, { color: '#22c55e' }]}>
                            {item.status === 'failed' || item.status === 'processing' ? 'Retry' : 'Process'}
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => confirmDelete(item)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="trash-outline" size={16} color="#dc2626" />
                    <Text style={[styles.actionBtnText, { color: '#dc2626' }]}>Delete</Text>
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
    backgroundColor: '#0c0c14',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 20,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 56 : 36,
    paddingBottom: 12,
    paddingHorizontal: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#f0f0f0',
    letterSpacing: -0.5,
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

  // Ride Card
  rideCard: {
    backgroundColor: '#141420',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
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
  rideRight: {},
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

  // Progress Section
  progressSection: {
    marginTop: 14,
  },
  progressBarBg: {
    height: 32,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderRadius: 8,
    overflow: 'hidden',
    justifyContent: 'center',
    position: 'relative',
  },
  progressBarFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#f59e0b',
    borderRadius: 8,
  },
  progressPercentage: {
    position: 'absolute',
    right: 8,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  progressPctText: {
    color: '#0c0c14',
    fontSize: 12,
    fontWeight: '800',
  },
  progressMessageText: {
    color: '#f59e0b',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 6,
  },

  // Actions
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.04)',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
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
})
