import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'

export type NotificationKind = 'comment' | 'vote_milestone' | 'verify' | 'flip'

export interface AppNotification {
  id: string
  kind: NotificationKind
  content_type: 'pothole' | 'photo'
  content_id: string
  actor_user_id: string | null
  actor_username: string | null
  preview: string
  meta: Record<string, unknown>
  is_read: boolean
  created_at: string
}

const PAGE_LIMIT = 50

const KIND_LABEL: Record<NotificationKind, string> = {
  comment: 'New comment',
  vote_milestone: 'Milestone',
  verify: 'Verification',
  flip: 'Status change',
}

export function kindLabel(kind: NotificationKind): string {
  return KIND_LABEL[kind] ?? 'Notification'
}

export function useNotifications(userId: string) {
  const [items, setItems] = useState<AppNotification[]>([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(false)
  const userRef = useRef(userId)
  userRef.current = userId

  const fetchAll = useCallback(async () => {
    const uid = userRef.current
    if (!uid) {
      setItems([])
      setUnread(0)
      return
    }
    setLoading(true)
    try {
      const [{ data, error }, countRes] = await Promise.all([
        supabase
          .from('notifications')
          .select('*')
          .eq('user_id', uid)
          .order('created_at', { ascending: false })
          .limit(PAGE_LIMIT),
        supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', uid)
          .eq('is_read', false),
      ])
      if (error) {
        console.log('[Notifications] fetch error:', JSON.stringify(error))
        return
      }
      setItems(((data ?? []) as AppNotification[]).map((n) => ({
        ...n,
        meta: (n.meta ?? {}) as Record<string, unknown>,
      })))
      setUnread(countRes.count ?? 0)
    } catch (err) {
      console.log('[Notifications] fetch exception:', JSON.stringify(err))
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial load + live updates (Realtime INSERT) with focus-refetch fallback.
  useEffect(() => {
    fetchAll()
    const uid = userId
    if (!uid) return
    let channel: ReturnType<typeof supabase.channel> | null = null
    try {
      channel = supabase
        .channel(`notifications-${uid}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` },
          () => fetchAll(),
        )
        .subscribe()
    } catch (err) {
      console.log('[Notifications] realtime subscribe failed:', JSON.stringify(err))
    }
    return () => {
      try {
        if (channel) void supabase.removeChannel(channel)
      } catch {}
    }
  }, [userId, fetchAll])

  const markRead = useCallback(async (id: string) => {
    const uid = userRef.current
    if (!uid) return
    setItems((prev) => {
      const target = prev.find((n) => n.id === id)
      if (!target || target.is_read) return prev
      return prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    })
    setUnread((u) => Math.max(0, u - 1))
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .eq('user_id', uid)
    if (error) {
      console.log('[Notifications] markRead error:', JSON.stringify(error))
      fetchAll()
    }
  }, [fetchAll])

  const markAllRead = useCallback(async () => {
    const uid = userRef.current
    if (!uid) return
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })))
    setUnread(0)
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', uid)
      .eq('is_read', false)
    if (error) {
      console.log('[Notifications] markAllRead error:', JSON.stringify(error))
      fetchAll()
    }
  }, [fetchAll])

  return { items, unread, loading, refetch: fetchAll, markRead, markAllRead }
}
