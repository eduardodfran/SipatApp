import { useState, useEffect, useCallback } from 'react'
import {
  ActivityIndicator,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'

type ProfileData = {
  id: string
  username: string | null
  full_name: string | null
  avatar_url: string | null
}

type UserPhoto = {
  id: number
  image_url: string
  created_at: string
  detection_status: string
  worst_severity: string | null
}

type UserPothole = {
  pothole_id: number
  image_url: string | null
  worst_severity: string | null
  total_detection_hits: number
  citizen_first_reported_at: string | null
  caption: string | null
  formatted_address: string | null
}

type Props = {
  userId: string
  onBack: () => void
  onViewPhoto?: (item: any) => void
  onViewPothole?: (item: any) => void
}

export default function PublicProfileScreen({ userId, onBack, onViewPhoto, onViewPothole }: Props) {
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [photos, setPhotos] = useState<UserPhoto[]>([])
  const [potholes, setPotholes] = useState<UserPothole[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'photos' | 'potholes'>('photos')

  const loadProfile = useCallback(async () => {
    setLoading(true)
    try {
      const [profileRes, photosRes, potholesRes] = await Promise.all([
        supabase.from('profiles').select('id, username, full_name, avatar_url').eq('id', userId).single(),
        supabase.from('community_photos')
          .select('id, image_url, created_at, detection_status, worst_severity')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase.from('v_unified_potholes')
          .select('pothole_id, image_url, worst_severity, total_detection_hits, citizen_first_reported_at, caption, formatted_address')
          .eq('reporter_user_id', userId)
          .order('citizen_first_reported_at', { ascending: false, nullsFirst: false })
          .limit(50),
      ])

      if (profileRes.data) setProfile(profileRes.data)
      if (photosRes.data) setPhotos(photosRes.data)
      if (potholesRes.data) setPotholes(potholesRes.data)
    } catch {
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  const displayName = profile?.username || profile?.full_name || 'User'
  const initial = displayName.charAt(0).toUpperCase()
  const photoCount = photos.length
  const potholeCount = potholes.length

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={22} color="#e0e0e0" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={{ width: 38 }} />
        </View>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#e6a817" />
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color="#e0e0e0" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView style={styles.scroll}>
        <View style={styles.profileSection}>
          <View style={styles.avatarCircle}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarInitial}>{initial}</Text>
            )}
          </View>
          <Text style={styles.displayName}>{displayName}</Text>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{photoCount}</Text>
              <Text style={styles.statLabel}>Photos</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{potholeCount}</Text>
              <Text style={styles.statLabel}>Detections</Text>
            </View>
          </View>
        </View>

        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'photos' && styles.tabActive]}
            onPress={() => setActiveTab('photos')}
            activeOpacity={0.7}
          >
            <Ionicons name="camera" size={16} color={activeTab === 'photos' ? '#e6a817' : '#6b7280'} />
            <Text style={[styles.tabText, activeTab === 'photos' && styles.tabTextActive]}>Photos</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'potholes' && styles.tabActive]}
            onPress={() => setActiveTab('potholes')}
            activeOpacity={0.7}
          >
            <Ionicons name="warning" size={16} color={activeTab === 'potholes' ? '#e6a817' : '#6b7280'} />
            <Text style={[styles.tabText, activeTab === 'potholes' && styles.tabTextActive]}>Detections</Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'photos' && (
          <View style={styles.gridSection}>
            {photos.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="camera-outline" size={40} color="#2a2a3a" />
                <Text style={styles.emptyText}>No photos yet</Text>
              </View>
            ) : (
              photos.map((photo) => (
                <TouchableOpacity
                  key={photo.id}
                  style={styles.gridItem}
                  activeOpacity={0.7}
                  onPress={() => onViewPhoto?.({ type: 'photo', data: { ...photo, user_id: userId, reporter_username: profile?.username } })}
                >
                  <Image source={{ uri: photo.image_url }} style={styles.gridImage} />
                  <View style={styles.gridOverlay}>
                    <Text style={styles.gridDate}>
                      {new Date(photo.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {activeTab === 'potholes' && (
          <View style={styles.listSection}>
            {potholes.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="warning-outline" size={40} color="#2a2a3a" />
                <Text style={styles.emptyText}>No detections yet</Text>
              </View>
            ) : (
              potholes.map((p) => {
                const sevColor = p.worst_severity === 'Severe' ? '#dc2626' : p.worst_severity === 'Moderate' ? '#f59e0b' : '#22c55e'
                return (
                  <TouchableOpacity
                    key={p.pothole_id}
                    style={styles.potholeCard}
                    activeOpacity={0.7}
                    onPress={() => onViewPothole?.({ type: 'pothole', data: { ...p, reporter_username: profile?.username, reporter_user_id: userId } })}
                  >
                    {p.image_url && <Image source={{ uri: p.image_url }} style={styles.potholeImage} />}
                    <View style={styles.potholeInfo}>
                      <View style={styles.potholeTop}>
                        <View style={[styles.severityDot, { backgroundColor: sevColor }]} />
                        <Text style={styles.severityText}>{p.worst_severity ?? 'Unknown'}</Text>
                        <Text style={styles.potholeHits}>{p.total_detection_hits} hit{p.total_detection_hits !== 1 ? 's' : ''}</Text>
                      </View>
                      {p.caption && <Text style={styles.potholeCaption} numberOfLines={1}>{p.caption}</Text>}
                      {p.formatted_address && <Text style={styles.potholeAddress} numberOfLines={1}>{p.formatted_address}</Text>}
                    </View>
                  </TouchableOpacity>
                )
              })
            )}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0c0c14' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 56 : 36,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  headerTitle: { color: '#f0f0f0', fontSize: 16, fontWeight: '700' },
  scroll: { flex: 1 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  profileSection: { alignItems: 'center', paddingVertical: 24 },
  avatarCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(230, 168, 23, 0.12)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: 'rgba(230, 168, 23, 0.25)',
    marginBottom: 12, overflow: 'hidden',
  },
  avatarImage: { width: 80, height: 80, borderRadius: 40 },
  avatarInitial: { color: '#e6a817', fontSize: 32, fontWeight: '800' },
  displayName: { color: '#f0f0f0', fontSize: 20, fontWeight: '700' },
  statsRow: {
    flexDirection: 'row', alignItems: 'center', gap: 24, marginTop: 16,
  },
  statItem: { alignItems: 'center' },
  statNumber: { color: '#f0f0f0', fontSize: 18, fontWeight: '700' },
  statLabel: { color: '#6b7280', fontSize: 12, fontWeight: '500', marginTop: 2 },
  statDivider: { width: 1, height: 24, backgroundColor: 'rgba(255,255,255,0.06)' },
  tabRow: {
    flexDirection: 'row', marginHorizontal: 20, gap: 8, marginBottom: 16,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)',
  },
  tabActive: { backgroundColor: 'rgba(230, 168, 23, 0.08)', borderColor: 'rgba(230, 168, 23, 0.15)' },
  tabText: { color: '#6b7280', fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: '#e6a817' },
  gridSection: { paddingHorizontal: 20 },
  gridItem: {
    width: '100%', height: 200, borderRadius: 14, overflow: 'hidden',
    marginBottom: 10, backgroundColor: '#141420',
  },
  gridImage: { width: '100%', height: '100%' },
  gridOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 10, backgroundColor: 'rgba(0,0,0,0.5)',
  },
  gridDate: { color: '#e0e0e0', fontSize: 11, fontWeight: '600' },
  listSection: { paddingHorizontal: 20 },
  potholeCard: {
    flexDirection: 'row', backgroundColor: '#141420', borderRadius: 14,
    overflow: 'hidden', marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)',
  },
  potholeImage: { width: 90, height: 90 },
  potholeInfo: { flex: 1, padding: 12, justifyContent: 'center' },
  potholeTop: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  severityDot: { width: 7, height: 7, borderRadius: 3.5 },
  severityText: { color: '#f0f0f0', fontSize: 12, fontWeight: '700' },
  potholeHits: { color: '#6b7280', fontSize: 11, marginLeft: 'auto' },
  potholeCaption: { color: '#a1a1aa', fontSize: 11, fontStyle: 'italic', marginTop: 2 },
  potholeAddress: { color: '#52525b', fontSize: 10, marginTop: 2 },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { color: '#374151', fontSize: 13, marginTop: 8 },
})
