import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { kindLabel, useNotifications, type AppNotification } from '../lib/useNotifications'
import { formatRelativeTime } from '../lib/time'
import ScreenHeader from '../components/ScreenHeader'
import { colors, fonts, radius, spacing } from '../theme/tokens'

type Props = {
  userId: string
  onBack: () => void
  onOpenItem: (item: { type: 'photo' | 'pothole'; data: any }) => void
}

const KIND_ICON: Record<AppNotification['kind'], { name: any; color: string }> = {
  comment: { name: 'chatbubble-ellipses-outline', color: colors.signal },
  vote_milestone: { name: 'trending-up-outline', color: colors.minor },
  verify: { name: 'checkmark-circle-outline', color: colors.moderate },
  flip: { name: 'swap-horizontal-outline', color: colors.severe },
}

const PHOTO_SELECT =
  'id, user_id, image_url, created_at, detection_status, worst_severity, caption, title, description, activity_status'
const POTHOLE_SELECT =
  'pothole_id, reporter_user_id, image_url, worst_severity, total_detection_hits, citizen_first_reported_at, caption, title, description, formatted_address, activity_status'

export default function NotificationsScreen({ userId, onBack, onOpenItem }: Props) {
  const { items, loading, refetch, markRead, markAllRead } = useNotifications(userId)
  const [openingId, setOpeningId] = useState<string | null>(null)
  const [myUsername, setMyUsername] = useState<string | null>(null)

  useEffect(() => {
    refetch()
  }, [refetch])

  useEffect(() => {
    if (!userId) return
    supabase
      .from('profiles')
      .select('username')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        if (data) setMyUsername((data as { username: string | null }).username)
      })
  }, [userId])

  const openNotification = useCallback(async (n: AppNotification) => {
    if (openingId) return
    setOpeningId(n.id)
    try {
      if (n.content_type === 'photo') {
        const { data } = await supabase
          .from('community_photos')
          .select(PHOTO_SELECT)
          .eq('id', Number(n.content_id))
          .single()
        if (data) {
          await markRead(n.id)
          onOpenItem({ type: 'photo', data: { ...data, user_id: userId, reporter_username: myUsername } })
          return
        }
      } else {
        const { data } = await supabase
          .from('v_unified_potholes')
          .select(POTHOLE_SELECT)
          .eq('pothole_id', Number(n.content_id))
          .single()
        if (data) {
          await markRead(n.id)
          onOpenItem({ type: 'pothole', data })
          return
        }
      }
      // Post gone (or RLS) — still clear the badge.
      await markRead(n.id)
    } finally {
      setOpeningId(null)
    }
  }, [openingId, markRead, onOpenItem, userId, myUsername])

  const renderItem = useCallback(({ item: n }: { item: AppNotification }) => {
    const icon = KIND_ICON[n.kind]
    const title = n.actor_username
      ? `${n.actor_username} · ${kindLabel(n.kind)}`
      : kindLabel(n.kind)
    return (
      <TouchableOpacity
        style={[styles.row, !n.is_read && styles.rowUnread]}
        onPress={() => openNotification(n)}
        activeOpacity={0.7}
      >
        <View style={[styles.iconWrap, { backgroundColor: `${icon.color}22` }]}>
          <Ionicons name={icon.name} size={18} color={icon.color} />
        </View>
        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {n.preview ? <Text style={styles.preview} numberOfLines={2}>{n.preview}</Text> : null}
          <Text style={styles.time}>{formatRelativeTime(n.created_at)}</Text>
        </View>
        {!n.is_read && <View style={styles.dot} />}
        {openingId === n.id && <ActivityIndicator size="small" color={colors.textMuted} />}
      </TouchableOpacity>
    )
  }, [openNotification, openingId])

  return (
    <View style={styles.container}>
      <ScreenHeader
        onBack={onBack}
        title="Notifications"
        right={
          items.some((n) => !n.is_read) ? (
            <TouchableOpacity onPress={markAllRead} activeOpacity={0.7} style={styles.markAll}>
              <Text style={styles.markAllText}>Mark all read</Text>
            </TouchableOpacity>
          ) : undefined
        }
      />
      {loading && items.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.signal} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="notifications-off-outline" size={40} color={colors.textMuted} />
          <Text style={styles.empty}>No notifications yet</Text>
          <Text style={styles.emptySub}>Comments, milestones, and verifications on your posts will show up here.</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          renderItem={renderItem}
          keyExtractor={(n) => n.id}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.xl, gap: spacing.sm },
  empty: { color: colors.textPrimary, fontFamily: fonts.semibold, fontSize: 15, marginTop: spacing.sm },
  emptySub: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 12, textAlign: 'center', lineHeight: 18 },
  list: { paddingHorizontal: spacing.lg, paddingBottom: 100 },
  markAll: { paddingVertical: 6, paddingHorizontal: 4 },
  markAllText: { color: colors.signal, fontFamily: fonts.semibold, fontSize: 12 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.md, marginBottom: spacing.sm,
    borderWidth: 1, borderColor: colors.hairline,
  },
  rowUnread: { borderColor: colors.signalLine, backgroundColor: colors.signalDim },
  iconWrap: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
  },
  body: { flex: 1 },
  title: { color: colors.textPrimary, fontFamily: fonts.semibold, fontSize: 13 },
  preview: { color: colors.textSecondary, fontFamily: fonts.regular, fontSize: 12, marginTop: 2, lineHeight: 17 },
  time: { color: colors.textMuted, fontFamily: fonts.mono, fontSize: 10, marginTop: 3 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.signal },
})
