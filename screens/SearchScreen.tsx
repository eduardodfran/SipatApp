import { useState, useCallback, useRef, useEffect } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { colors, fonts, radius, spacing } from '../theme/tokens'
import ScreenHeader from '../components/ScreenHeader'
import Brackets from '../components/Brackets'

type Props = {
  onBack: () => void
  onViewProfile: (userId: string) => void
  onViewPhoto: (item: { type: 'photo'; data: any }) => void
  onViewPothole: (item: { type: 'pothole'; data: any }) => void
}

type Tab = 'users' | 'detections'

type UserResult = {
  id: string
  username: string | null
  full_name: string | null
  avatar_url: string | null
}

type PhotoResult = {
  id: number
  image_url: string
  caption: string | null
  created_at: string
  detection_status: string | null
  reporter_username: string | null
}

type PotholeResult = {
  pothole_id: number
  image_url: string | null
  caption: string | null
  formatted_address: string | null
  worst_severity: string | null
  citizen_first_reported_at: string | null
  reporter_username: string | null
}

export default function SearchScreen({ onBack, onViewProfile, onViewPhoto, onViewPothole }: Props) {
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<Tab>('users')
  const [userResults, setUserResults] = useState<UserResult[]>([])
  const [photoResults, setPhotoResults] = useState<PhotoResult[]>([])
  const [potholeResults, setPotholeResults] = useState<PotholeResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const inputRef = useRef<TextInput>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const search = useCallback(async (q: string, activeTab: Tab) => {
    const trimmed = q.trim()
    if (!trimmed) {
      setUserResults([])
      setPhotoResults([])
      setPotholeResults([])
      setSearched(false)
      return
    }

    setLoading(true)
    setSearched(true)
    try {
      const pattern = `%${trimmed}%`

      if (activeTab === 'users') {
        const { data } = await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url')
          .or(`username.ilike.${pattern},full_name.ilike.${pattern}`)
          .limit(20)
        setUserResults((data ?? []) as UserResult[])
        setPhotoResults([])
        setPotholeResults([])
      } else {
        const [photosRes, potholesRes] = await Promise.all([
          supabase
            .from('community_photos')
            .select('id, image_url, caption, created_at, detection_status, reporter_username')
            .or(`caption.ilike.${pattern},reporter_username.ilike.${pattern}`)
            .eq('activity_status', 'active')
            .order('created_at', { ascending: false })
            .limit(15),
          supabase
            .from('v_unified_potholes')
            .select('pothole_id, image_url, caption, formatted_address, worst_severity, citizen_first_reported_at, reporter_username')
            .or(`caption.ilike.${pattern},formatted_address.ilike.${pattern},reporter_username.ilike.${pattern}`)
            .eq('activity_status', 'active')
            .order('citizen_first_reported_at', { ascending: false, nullsFirst: false })
            .limit(15),
        ])
        setPhotoResults((photosRes.data ?? []) as PhotoResult[])
        setPotholeResults((potholesRes.data ?? []) as PotholeResult[])
        setUserResults([])
      }
    } catch {
    } finally {
      setLoading(false)
    }
  }, [])

  const handleTabChange = useCallback((newTab: Tab) => {
    setTab(newTab)
    if (query.trim()) search(query, newTab)
  }, [query, search])

  const handleClear = useCallback(() => {
    setQuery('')
    setUserResults([])
    setPhotoResults([])
    setPotholeResults([])
    setSearched(false)
    inputRef.current?.focus()
  }, [])

  const handleTextChange = useCallback((text: string) => {
    setQuery(text)
    if (!text.trim()) {
      setUserResults([])
      setPhotoResults([])
      setPotholeResults([])
      setSearched(false)
    }
  }, [])

  const handleSubmit = useCallback(() => {
    search(query, tab)
  }, [query, tab, search])

  const resultCount = tab === 'users' ? userResults.length : photoResults.length + potholeResults.length

  const renderUser = useCallback(({ item }: { item: UserResult }) => (
    <TouchableOpacity style={styles.userRow} onPress={() => onViewProfile(item.id)} activeOpacity={0.7}>
      {item.avatar_url ? (
        <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarPlaceholder]}>
          <Ionicons name="person" size={18} color={colors.textMuted} />
        </View>
      )}
      <View style={styles.userInfo}>
        <Text style={styles.username}>{item.username ?? 'Anonymous'}</Text>
        {item.full_name ? <Text style={styles.fullName}>{item.full_name}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </TouchableOpacity>
  ), [onViewProfile])

  const renderPhoto = useCallback(({ item }: { item: PhotoResult }) => (
    <TouchableOpacity style={styles.detectionRow} onPress={() => onViewPhoto({ type: 'photo', data: item })} activeOpacity={0.7}>
      <Image source={{ uri: item.image_url }} style={styles.detectionThumb} />
      <View style={styles.detectionInfo}>
        <Text style={styles.detectionTitle} numberOfLines={1}>{item.caption ?? 'Community photo'}</Text>
        <Text style={styles.detectionMeta}>{item.reporter_username ?? 'Anonymous'} · {new Date(item.created_at).toLocaleDateString()}</Text>
      </View>
    </TouchableOpacity>
  ), [onViewPhoto])

  const renderPothole = useCallback(({ item }: { item: PotholeResult }) => (
    <TouchableOpacity style={styles.detectionRow} onPress={() => onViewPothole({ type: 'pothole', data: item })} activeOpacity={0.7}>
      {item.image_url ? (
        <Image source={{ uri: item.image_url }} style={styles.detectionThumb} />
      ) : (
        <View style={[styles.detectionThumb, styles.detectionThumbPlaceholder]}>
          <Ionicons name="warning-outline" size={20} color={colors.textMuted} />
        </View>
      )}
      <View style={styles.detectionInfo}>
        <Text style={styles.detectionTitle} numberOfLines={1}>{item.formatted_address ?? item.caption ?? 'Pothole'}</Text>
        <Text style={styles.detectionMeta}>{item.reporter_username ?? 'Anonymous'} · {item.worst_severity ?? '—'}</Text>
      </View>
    </TouchableOpacity>
  ), [onViewPothole])

  const keyExtractor = useCallback((item: any) => {
    if ('pothole_id' in item) return `ph-${item.pothole_id}`
    if ('image_url' in item && 'created_at' in item && 'detection_status' in item) return `pt-${item.id}`
    return `u-${item.id}`
  }, [])

  const ListHeader = useCallback(() => (
    <>
      {searched && !loading && (
        <Text style={styles.resultCount}>{resultCount} result{resultCount !== 1 ? 's' : ''}</Text>
      )}
    </>
  ), [searched, loading, resultCount])

  const detectionData = [
    ...photoResults.map(p => ({ kind: 'photo' as const, payload: p })),
    ...potholeResults.map(p => ({ kind: 'pothole' as const, payload: p })),
  ]

  return (
    <View style={styles.container}>
      <ScreenHeader onBack={onBack}>
        <View style={styles.searchInputWrap}>
          <Ionicons name="search-outline" size={18} color={colors.textMuted} />
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            placeholder={tab === 'users' ? 'Search users...' : 'Search detections...'}
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={handleTextChange}
            onSubmitEditing={handleSubmit}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={handleClear} activeOpacity={0.7}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </ScreenHeader>

      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'users' && styles.tabBtnActive]}
          onPress={() => handleTabChange('users')}
          activeOpacity={0.7}
        >
          <Ionicons name="people-outline" size={14} color={tab === 'users' ? colors.signal : colors.textSecondary} />
          <Text style={[styles.tabText, tab === 'users' && styles.tabTextActive]}>Users</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'detections' && styles.tabBtnActive]}
          onPress={() => handleTabChange('detections')}
          activeOpacity={0.7}
        >
          <Ionicons name="alert-circle-outline" size={14} color={tab === 'detections' ? colors.signal : colors.textSecondary} />
          <Text style={[styles.tabText, tab === 'detections' && styles.tabTextActive]}>Detections</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color={colors.signal} />
        </View>
      ) : !searched ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Brackets size={14} />
            <Ionicons name="search" size={34} color={colors.signal} />
          </View>
          <Text style={styles.emptyTitle}>Search SIPAT</Text>
          <Text style={styles.emptySub}>Find users or road distress reports</Text>
        </View>
      ) : tab === 'users' ? (
        <FlatList
          data={userResults}
          renderItem={renderUser}
          keyExtractor={keyExtractor}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={<View style={styles.emptyState}><Text style={styles.emptySub}>No users found</Text></View>}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
        />
      ) : (
        <FlatList
          data={detectionData}
          renderItem={({ item }) => item.kind === 'photo' ? renderPhoto({ item: item.payload as PhotoResult }) : renderPothole({ item: item.payload as PotholeResult })}
          keyExtractor={(item) => item.kind === 'photo' ? `pt-${(item.payload as PhotoResult).id}` : `ph-${(item.payload as PotholeResult).pothole_id}`}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={<View style={styles.emptyState}><Text style={styles.emptySub}>No detections found</Text></View>}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  searchInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 46,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textPrimary,
    padding: 0,
  },
  tabRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.hairline,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  tabBtnActive: {
    backgroundColor: colors.signalDim,
    borderColor: colors.signalLine,
  },
  tabText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
  tabTextActive: { color: colors.signal },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  resultCount: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 0.6,
    color: colors.textMuted,
    paddingVertical: spacing.sm,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: 120,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.textPrimary,
  },
  emptySub: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  avatar: { width: 40, height: 40, borderRadius: radius.pill },
  avatarPlaceholder: {
    backgroundColor: colors.hairline,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInfo: { flex: 1 },
  username: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.textPrimary,
  },
  fullName: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textMuted,
  },
  detectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  detectionThumb: { width: 48, height: 48, borderRadius: radius.md },
  detectionThumbPlaceholder: {
    backgroundColor: colors.hairline,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detectionInfo: { flex: 1 },
  detectionTitle: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textPrimary,
  },
  detectionMeta: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
})
