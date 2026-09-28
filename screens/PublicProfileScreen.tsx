import { useState, useEffect, useCallback } from 'react'
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import ScreenHeader from '../components/ScreenHeader'
import Brackets from '../components/Brackets'
import { colors, fonts, radius, spacing } from '../theme/tokens'

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
          .eq('activity_status', 'active')
          .order('created_at', { ascending: false })
          .limit(50),
        supabase.from('v_unified_potholes')
          .select('pothole_id, image_url, worst_severity, total_detection_hits, citizen_first_reported_at, caption, formatted_address')
          .eq('reporter_user_id', userId)
          .eq('activity_status', 'active')
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

  const renderEmpty = (icon: any, label: string) => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <Brackets size={14} />
        <Ionicons name={icon} size={32} color={colors.signal} />
      </View>
      <Text style={styles.emptyTitle}>{label}</Text>
    </View>
  )

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader onBack={onBack} title="Profile" />
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.signal} />
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <ScreenHeader onBack={onBack} title="Profile" />

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
            <Ionicons name="camera" size={16} color={activeTab === 'photos' ? colors.signal : colors.textMuted} />
            <Text style={[styles.tabText, activeTab === 'photos' && styles.tabTextActive]}>Photos</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'potholes' && styles.tabActive]}
            onPress={() => setActiveTab('potholes')}
            activeOpacity={0.7}
          >
            <Ionicons name="warning" size={16} color={activeTab === 'potholes' ? colors.signal : colors.textMuted} />
            <Text style={[styles.tabText, activeTab === 'potholes' && styles.tabTextActive]}>Detections</Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'photos' && (
          <View style={styles.gridSection}>
            {photos.length === 0 ? (
              renderEmpty('camera-outline', 'No photos yet')
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
              renderEmpty('warning-outline', 'No detections yet')
            ) : (
              potholes.map((p) => {
                const sevColor = p.worst_severity === 'Severe' ? colors.severe : p.worst_severity === 'Moderate' ? colors.moderate : colors.minor
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
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  profileSection: { alignItems: 'center', paddingVertical: spacing.xl },
  avatarCircle: {
    width: 80, height: 80, borderRadius: radius.pill,
    backgroundColor: colors.signalDim,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: colors.signalLine,
    marginBottom: spacing.md, overflow: 'hidden',
  },
  avatarImage: { width: 80, height: 80, borderRadius: radius.pill },
  avatarInitial: { color: colors.signal, fontFamily: fonts.extrabold, fontSize: 32 },
  displayName: { color: colors.textPrimary, fontFamily: fonts.extrabold, fontSize: 20, letterSpacing: -0.2 },
  statsRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xl, marginTop: spacing.lg,
  },
  statItem: { alignItems: 'center' },
  statNumber: { color: colors.textPrimary, fontFamily: fonts.monoBold, fontSize: 18 },
  statLabel: {
    color: colors.textMuted, fontFamily: fonts.semibold, fontSize: 10,
    textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 2,
  },
  statDivider: { width: 1, height: 24, backgroundColor: colors.hairline },
  tabRow: {
    flexDirection: 'row', marginHorizontal: spacing.lg, gap: spacing.sm, marginBottom: spacing.lg,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: radius.md,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.hairline,
  },
  tabActive: { backgroundColor: colors.signalDim, borderColor: colors.signalLine },
  tabText: { color: colors.textMuted, fontFamily: fonts.semibold, fontSize: 13 },
  tabTextActive: { color: colors.signal },
  gridSection: { paddingHorizontal: spacing.lg },
  gridItem: {
    width: '100%', height: 200, borderRadius: radius.lg, overflow: 'hidden',
    marginBottom: spacing.sm, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.hairline,
  },
  gridImage: { width: '100%', height: '100%' },
  gridOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: spacing.sm, backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  gridDate: { color: colors.textPrimary, fontFamily: fonts.mono, fontSize: 11 },
  listSection: { paddingHorizontal: spacing.lg },
  potholeCard: {
    flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.lg,
    overflow: 'hidden', marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.hairline,
  },
  potholeImage: { width: 90, height: 90 },
  potholeInfo: { flex: 1, padding: spacing.md, justifyContent: 'center' },
  potholeTop: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  severityDot: { width: 7, height: 7, borderRadius: 3.5 },
  severityText: { color: colors.textPrimary, fontFamily: fonts.bold, fontSize: 12, letterSpacing: 0.4 },
  potholeHits: { color: colors.textMuted, fontFamily: fonts.mono, fontSize: 11, marginLeft: 'auto' },
  potholeCaption: { color: colors.textSecondary, fontFamily: fonts.regular, fontSize: 11, fontStyle: 'italic', marginTop: 2 },
  potholeAddress: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 10, marginTop: 2 },
  emptyState: {
    alignItems: 'center', paddingVertical: spacing.xxl,
    backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.hairline,
  },
  emptyIcon: {
    width: 72, height: 72, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.lg,
  },
  emptyTitle: { color: colors.textPrimary, fontFamily: fonts.semibold, fontSize: 15 },
})
