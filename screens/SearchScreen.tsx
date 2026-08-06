import { useState, useCallback, useRef, useEffect } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'

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
            .order('created_at', { ascending: false })
            .limit(15),
          supabase
            .from('v_unified_potholes')
            .select('pothole_id, image_url, caption, formatted_address, worst_severity, citizen_first_reported_at, reporter_username')
            .or(`caption.ilike.${pattern},formatted_address.ilike.${pattern},reporter_username.ilike.${pattern}`)
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
          <Ionicons name="person" size={18} color="#71717a" />
        </View>
      )}
      <View style={styles.userInfo}>
        <Text style={styles.username}>{item.username ?? 'Anonymous'}</Text>
        {item.full_name ? <Text style={styles.fullName}>{item.full_name}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color="#3f3f46" />
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
          <Ionicons name="warning-outline" size={20} color="#71717a" />
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
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color="#fafafa" />
        </TouchableOpacity>
        <View style={styles.searchInputWrap}>
          <Ionicons name="search-outline" size={18} color="#71717a" />
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            placeholder={tab === 'users' ? 'Search users...' : 'Search detections...'}
            placeholderTextColor="#52525b"
            value={query}
            onChangeText={handleTextChange}
            onSubmitEditing={handleSubmit}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={handleClear} activeOpacity={0.7}>
              <Ionicons name="close-circle" size={18} color="#52525b" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'users' && styles.tabBtnActive]}
          onPress={() => handleTabChange('users')}
          activeOpacity={0.7}
        >
          <Ionicons name="people-outline" size={14} color={tab === 'users' ? '#0c0c14' : '#71717a'} />
          <Text style={[styles.tabText, tab === 'users' && styles.tabTextActive]}>Users</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'detections' && styles.tabBtnActive]}
          onPress={() => handleTabChange('detections')}
          activeOpacity={0.7}
        >
          <Ionicons name="alert-circle-outline" size={14} color={tab === 'detections' ? '#0c0c14' : '#71717a'} />
          <Text style={[styles.tabText, tab === 'detections' && styles.tabTextActive]}>Detections</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color="#06b6d4" />
        </View>
      ) : !searched ? (
        <View style={styles.emptyState}>
          <Ionicons name="search" size={40} color="#27272a" />
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
  container: { flex: 1, backgroundColor: '#0c0c14' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingTop: Platform.OS === 'ios' ? 56 : 36, paddingBottom: 10, paddingHorizontal: 16,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.06)', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  searchInputWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.06)', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  searchInput: {
    flex: 1, color: '#fafafa', fontSize: 15, padding: 0,
  },
  tabRow: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 10,
  },
  tabBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  tabBtnActive: {
    backgroundColor: '#06b6d4', borderColor: '#06b6d4',
  },
  tabText: { color: '#71717a', fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: '#0c0c14' },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingHorizontal: 16, paddingBottom: 40 },
  resultCount: { color: '#52525b', fontSize: 12, fontWeight: '500', paddingVertical: 8 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 120, gap: 8 },
  emptyTitle: { color: '#fafafa', fontSize: 17, fontWeight: '700' },
  emptySub: { color: '#52525b', fontSize: 13 },
  userRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarPlaceholder: {
    backgroundColor: 'rgba(255,255,255,0.06)', justifyContent: 'center', alignItems: 'center',
  },
  userInfo: { flex: 1 },
  username: { color: '#fafafa', fontSize: 15, fontWeight: '600' },
  fullName: { color: '#71717a', fontSize: 13 },
  detectionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  detectionThumb: { width: 48, height: 48, borderRadius: 10 },
  detectionThumbPlaceholder: {
    backgroundColor: 'rgba(255,255,255,0.06)', justifyContent: 'center', alignItems: 'center',
  },
  detectionInfo: { flex: 1 },
  detectionTitle: { color: '#fafafa', fontSize: 14, fontWeight: '500' },
  detectionMeta: { color: '#71717a', fontSize: 12, marginTop: 2 },
})
