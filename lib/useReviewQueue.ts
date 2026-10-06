import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import { shortAddress } from './address'
import type { VoteState } from './useVote'

const PAGE_SIZE = 10

export interface ReviewItem {
  key: string
  kind: 'pothole' | 'photo'
  id: number
  /** Original feed row — passed through to FeedDetailScreen. */
  raw: PotholeRow | PhotoRow
  imageUrl: string | null
  eyebrow: string
  severity: string | null
  address: string
  reporter: string | null
  time: string
  detail: string
  hot: number
  upvotes: number
  downvotes: number
  userVote: 0 | 1 | -1
}

export interface PotholeRow {
  pothole_id: number
  image_url?: string | null
  worst_severity?: string | null
  reporter_username?: string | null
  latest_activity_at?: string | null
  citizen_first_reported_at?: string | null
  total_detection_hits?: number | null
  detectors_count?: number | null
  hot_score?: number | null
  upvote_count?: number | null
  downvote_count?: number | null
  user_vote?: number | null
  caption?: string | null
  formatted_address?: string | null
  street?: string | null
  barangay?: string | null
  city?: string | null
  province?: string | null
  latitude?: number | null
  longitude?: number | null
}

export interface PhotoRow {
  id: number
  image_url?: string | null
  created_at?: string | null
  detection_status?: string | null
  class_name?: string | null
  confidence?: number | null
  worst_severity?: string | null
  reporter_username?: string | null
  hot_score?: number | null
  upvote_count?: number | null
  downvote_count?: number | null
  user_vote?: number | null
  caption?: string | null
  formatted_address?: string | null
  street?: string | null
  barangay?: string | null
  city?: string | null
  province?: string | null
  latitude?: number | null
  longitude?: number | null
}

const SEVERITIES = ['Severe', 'Moderate', 'Minor', 'Unknown']

function toPotholeItem(p: PotholeRow): ReviewItem {
  return {
    key: `pothole-${p.pothole_id}`,
    kind: 'pothole',
    id: p.pothole_id,
    raw: p,
    imageUrl: p.image_url ?? null,
    eyebrow: `Detection ${p.pothole_id}`,
    severity: p.worst_severity ?? null,
    address: shortAddress(p),
    reporter: p.reporter_username ?? null,
    time: p.latest_activity_at || p.citizen_first_reported_at || '',
    detail: `${p.total_detection_hits ?? 0} detections · ${p.detectors_count ?? 0} detectors`,
    hot: p.hot_score ?? 0,
    upvotes: p.upvote_count ?? 0,
    downvotes: p.downvote_count ?? 0,
    userVote: (p.user_vote ?? 0) as 0 | 1 | -1,
  }
}

function photoStatusLabel(status: string | undefined | null): string {
  if (status === 'processed') return 'Detected'
  if (status === 'manually_tagged') return 'Tagged'
  if (status === 'pending') return 'Analyzing'
  return 'Clear'
}

function toPhotoItem(ph: PhotoRow): ReviewItem {
  const status = photoStatusLabel(ph.detection_status)
  const classified =
    ph.detection_status === 'processed' || ph.detection_status === 'manually_tagged'
  const detail =
    classified && ph.class_name
      ? `${status} · ${ph.class_name}${ph.confidence != null ? ` ${Math.round(ph.confidence * 100)}%` : ''}`
      : status
  const sev = ph.worst_severity
  return {
    key: `photo-${ph.id}`,
    kind: 'photo',
    id: ph.id,
    raw: ph,
    imageUrl: ph.image_url ?? null,
    eyebrow: `Community photo ${ph.id}`,
    severity: sev && SEVERITIES.includes(sev) ? sev : null,
    address: shortAddress(ph),
    reporter: ph.reporter_username ?? null,
    time: ph.created_at ?? '',
    detail,
    hot: ph.hot_score ?? 0,
    upvotes: ph.upvote_count ?? 0,
    downvotes: ph.downvote_count ?? 0,
    userVote: (ph.user_vote ?? 0) as 0 | 1 | -1,
  }
}

function timeMs(iso: string): number {
  const t = new Date(iso).getTime()
  return Number.isNaN(t) ? 0 : t
}

/** Unvoted items from both feed types, merged by hot score (descending). */
function buildBatch(pRows: PotholeRow[], phRows: PhotoRow[]): ReviewItem[] {
  const batch = [
    ...pRows
      // Defense-in-depth (mirrors feed): never queue items hidden via caption prefix.
      .filter((p) => !String(p.caption ?? '').startsWith('[HIDDEN]'))
      .filter((p) => (p.user_vote ?? 0) === 0)
      .map(toPotholeItem),
    ...phRows.filter((ph) => (ph.user_vote ?? 0) === 0).map(toPhotoItem),
  ]
  batch.sort((a, b) => b.hot - a.hot || timeMs(b.time) - timeMs(a.time))
  return batch
}

interface FeedResponse<T> {
  rows: T[]
  rawCount: number
  error: string | null
}

async function fetchPotholes(offset: number): Promise<FeedResponse<PotholeRow>> {
  const { data, error } = await supabase.rpc('get_feed_potholes', {
    p_offset: offset,
    p_limit: PAGE_SIZE,
  })
  const rows = (data ?? []) as PotholeRow[]
  return { rows, rawCount: rows.length, error: error?.message ?? null }
}

async function fetchPhotos(offset: number): Promise<FeedResponse<PhotoRow>> {
  const { data, error } = await supabase.rpc('get_feed_photos', {
    p_offset: offset,
    p_limit: PAGE_SIZE,
  })
  const rows = (data ?? []) as PhotoRow[]
  return { rows, rawCount: rows.length, error: error?.message ?? null }
}

export function useReviewQueue(enabled: boolean) {
  const [items, setItems] = useState<ReviewItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState({ potholes: false, photos: false })
  const [reloadKey, setReloadKey] = useState(0)

  const offsets = useRef({ potholes: 0, photos: 0 })

  const loadInitial = useCallback(async () => {
    try {
      const [p, ph] = await Promise.all([fetchPotholes(0), fetchPhotos(0)])
      const errors = [p.error, ph.error].filter(Boolean) as string[]
      setError(errors.length ? errors.join(' / ') : null)
      setItems(buildBatch(p.rows, ph.rows))
      setHasMore({
        potholes: p.rawCount === PAGE_SIZE,
        photos: ph.rawCount === PAGE_SIZE,
      })
      offsets.current = { potholes: p.rawCount, photos: ph.rawCount }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load the review queue')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    const run = async () => {
      if (cancelled) return
      await loadInitial()
    }
    run()
    return () => {
      cancelled = true
    }
  }, [enabled, loadInitial, reloadKey])

  const retry = useCallback(() => {
    setLoading(true)
    setError(null)
    setReloadKey((k) => k + 1)
  }, [])

  // Write a card's vote state back into the queue so windowed-out cards
  // re-seed correctly when they remount (useVote never refetches).
  const updateItemVote = useCallback((key: string, votes: VoteState) => {
    setItems((prev) => {
      const idx = prev.findIndex((it) => it.key === key)
      if (idx === -1) return prev
      const it = prev[idx]
      if (
        it.upvotes === votes.upvotes &&
        it.downvotes === votes.downvotes &&
        it.userVote === votes.userVote
      ) {
        return prev
      }
      const next = [...prev]
      next[idx] = { ...it, ...votes }
      return next
    })
  }, [])

  const loadMore = useCallback(async () => {
    if (loadingMore || loading) return
    const needPotholes = hasMore.potholes
    const needPhotos = hasMore.photos
    if (!needPotholes && !needPhotos) return
    setLoadingMore(true)
    try {
      const [p, ph] = await Promise.all([
        needPotholes
          ? fetchPotholes(offsets.current.potholes)
          : Promise.resolve<FeedResponse<PotholeRow>>({ rows: [], rawCount: 0, error: null }),
        needPhotos
          ? fetchPhotos(offsets.current.photos)
          : Promise.resolve<FeedResponse<PhotoRow>>({ rows: [], rawCount: 0, error: null }),
      ])
      const errors = [needPotholes ? p.error : null, needPhotos ? ph.error : null].filter(
        Boolean,
      ) as string[]
      if (errors.length) {
        setError(errors.join(' / '))
        return
      }
      const batch = buildBatch(p.rows, ph.rows)
      if (needPotholes) offsets.current.potholes += p.rawCount
      if (needPhotos) offsets.current.photos += ph.rawCount
      setHasMore({
        potholes: needPotholes ? p.rawCount === PAGE_SIZE : false,
        photos: needPhotos ? ph.rawCount === PAGE_SIZE : false,
      })
      setItems((prev) => {
        const seen = new Set(prev.map((i) => i.key))
        const fresh = batch.filter((i) => !seen.has(i.key))
        return [...prev, ...fresh]
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load the review queue')
    } finally {
      setLoadingMore(false)
    }
  }, [hasMore, loading, loadingMore])

  const moreAvailable = hasMore.potholes || hasMore.photos

  return {
    items,
    loading,
    loadingMore,
    error,
    hasMore: moreAvailable,
    loadMore,
    retry,
    updateItemVote,
  }
}
