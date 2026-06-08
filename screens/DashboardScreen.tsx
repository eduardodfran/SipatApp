import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import type { Recording } from '../lib/types'

type Props = {
  recordings: Recording[]
  uploadingId: string | null
  processingId: string | null
  onRecord: () => void
  onMap: () => void
  onUpload: (recording: Recording) => void | Promise<void>
  onProcess: (recording: Recording) => void | Promise<void>
  onDelete: (recording: Recording) => void
  onRefresh: () => void
  refreshing: boolean
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  queued: { label: 'Queued', color: '#7bb7ff', bg: 'rgba(67, 99, 216, 0.14)' },
  processing: { label: 'Processing', color: '#ffc107', bg: 'rgba(255, 193, 7, 0.1)' },
  completed: { label: 'Completed', color: '#4caf50', bg: 'rgba(76, 175, 80, 0.1)' },
  failed: { label: 'Failed', color: '#ff4444', bg: 'rgba(255, 68, 68, 0.1)' },
}

export default function DashboardScreen({
  recordings,
  uploadingId,
  processingId,
  onRecord,
  onMap,
  onUpload,
  onProcess,
  onDelete,
  onRefresh,
  refreshing,
}: Props) {
  const handleLogout = () => {
    supabase.auth.signOut()
  }

  const formatDate = (ts: number) => {
    const d = new Date(ts)
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const formatTime = (ts: number) => {
    const d = new Date(ts)
    return d.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Good morning</Text>
          <Text style={styles.title}>Dashboard</Text>
        </View>
        <View style={styles.headerRight}>
          {Platform.OS !== 'web' && (
            <TouchableOpacity onPress={onMap} style={styles.mapBtn}>
              <Ionicons name="map-outline" size={18} color="#fff" />
              <Text style={styles.mapBtnText}>Map</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn}>
            {refreshing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="refresh-outline" size={18} color="#fff" />
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <Ionicons name="log-out-outline" size={18} color="#ff6b6b" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats card */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{recordings.length}</Text>
          <Text style={styles.statLabel}>Recordings</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>
            {recordings.filter((r) => r.status === 'completed').length}
          </Text>
          <Text style={styles.statLabel}>Processed</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>
            {recordings.filter((r) => r.status === 'queued').length}
          </Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
      </View>

      {/* List */}
      {recordings.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="camera-outline" size={48} color="#333" />
          <Text style={styles.emptyTitle}>No recordings yet</Text>
          <Text style={styles.emptySub}>
            Tap the record button below to start
          </Text>
        </View>
      ) : (
        <FlatList
          data={recordings}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const statusCfg = item.status ? STATUS_CONFIG[item.status] : null
            const canProcess = item.uploaded && (item.status === 'queued' || item.status === 'failed')
            const isProcessing = processingId === item.id

            return (
              <View style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={styles.cardDate}>
                    <Text style={styles.cardDay}>
                      {formatDate(item.timestamp)}
                    </Text>
                    <Text style={styles.cardTimeLabel}>
                      {formatTime(item.timestamp)}
                    </Text>
                  </View>
                  <View style={styles.cardBadgeGroup}>
                    {statusCfg ? (
                      <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg }]}>
                        <Text style={[styles.statusBadgeText, { color: statusCfg.color }]}>
                          {statusCfg.label}
                        </Text>
                      </View>
                    ) : (
                      <View style={[styles.statusBadge, styles.uploadBadgePending]}>
                        <Text style={[styles.statusBadgeText, { color: '#ffc107' }]}>
                          Local
                        </Text>
                      </View>
                    )}
                    <TouchableOpacity
                      onPress={() =>
                        Alert.alert(
                          'Delete Recording',
                          'Remove this recording from the list?',
                          [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Delete',
                              style: 'destructive',
                              onPress: () => onDelete(item),
                            },
                          ],
                        )
                      }
                      style={styles.deleteBtn}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="trash-outline" size={16} color="#ff4444" />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.cardFiles}>
                  <View style={styles.fileRow}>
                    <Ionicons name="videocam-outline" size={14} color="#888" />
                    <Text style={styles.cardPath} numberOfLines={1}>
                      {item.uploaded
                        ? item.storagePaths?.video?.split('/').pop() ?? 'video.mp4'
                        : item.videoUri.split('/').pop() ?? 'video.mp4'}
                    </Text>
                  </View>
                  <View style={styles.fileRow}>
                    <Ionicons
                      name="document-text-outline"
                      size={14}
                      color="#888"
                    />
                    <Text style={styles.cardPath} numberOfLines={1}>
                      {item.uploaded
                        ? item.storagePaths?.gps?.split('/').pop() ?? 'data.json'
                        : item.csvUri.split('/').pop() ?? 'data.csv'}
                    </Text>
                  </View>
                </View>

                {/* Error log for failed rides */}
                {item.status === 'failed' && item.errorLog && (
                  <TouchableOpacity
                    onPress={() => Alert.alert('Error Details', item.errorLog ?? '')}
                    style={styles.errorRow}
                  >
                    <Ionicons name="warning-outline" size={14} color="#ff4444" />
                    <Text style={styles.errorText} numberOfLines={1}>
                      {item.errorLog}
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Actions */}
                {!item.uploaded && (
                  <TouchableOpacity
                    style={[styles.actionButton, uploadingId === item.id && styles.actionButtonDisabled]}
                    onPress={() => onUpload(item)}
                    disabled={uploadingId === item.id}
                    activeOpacity={0.8}
                  >
                    {uploadingId === item.id ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Ionicons name="cloud-upload-outline" size={16} color="#fff" />
                    )}
                    <Text style={styles.actionButtonText}>
                      {uploadingId === item.id ? 'Uploading...' : 'Upload to Azure'}
                    </Text>
                  </TouchableOpacity>
                )}

                {canProcess && (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.processButton, isProcessing && styles.actionButtonDisabled]}
                    onPress={() => onProcess(item)}
                    disabled={isProcessing}
                    activeOpacity={0.8}
                  >
                    {isProcessing ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Ionicons name="play-circle-outline" size={16} color="#fff" />
                    )}
                    <Text style={styles.actionButtonText}>
                      {isProcessing ? 'Processing...' : 'Process Ride'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )
          }}
        />
      )}

      {/* Record FAB */}
      <TouchableOpacity
        style={styles.recordFab}
        onPress={onRecord}
        activeOpacity={0.8}
      >
        <View style={styles.fabOuter}>
          <View style={styles.fabInner} />
        </View>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a1a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingTop: 60,
    paddingBottom: 8,
    paddingHorizontal: 24,
  },
  greeting: {
    color: '#666',
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 2,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.3,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  mapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(67, 99, 216, 0.15)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    gap: 6,
  },
  mapBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  refreshBtn: {
    padding: 8,
  },
  logoutBtn: {
    padding: 8,
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#13133a',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  statNumber: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  statLabel: {
    color: '#666',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  list: {
    paddingHorizontal: 24,
    paddingTop: 4,
    paddingBottom: 140,
  },
  card: {
    backgroundColor: '#13133a',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardDate: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  cardDay: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  cardTimeLabel: {
    color: '#888',
    fontSize: 12,
  },
  cardBadgeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  uploadBadgePending: {
    backgroundColor: 'rgba(255, 193, 7, 0.1)',
  },
  deleteBtn: {
    padding: 4,
  },
  cardFiles: {
    gap: 6,
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardPath: {
    color: '#666',
    fontSize: 12,
    flex: 1,
  },
  errorRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 68, 68, 0.08)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  errorText: {
    color: '#ff4444',
    fontSize: 11,
    flex: 1,
  },
  actionButton: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#4363d8',
    borderRadius: 12,
    paddingVertical: 12,
  },
  processButton: {
    backgroundColor: '#2e7d32',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  actionButtonDisabled: {
    opacity: 0.6,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 80,
  },
  emptyTitle: {
    color: '#444',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 12,
  },
  emptySub: {
    color: '#333',
    fontSize: 13,
    marginTop: 4,
  },
  recordFab: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(67, 99, 216, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabOuter: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#4363d8',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4363d8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  fabInner: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fff',
  },
})
