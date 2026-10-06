import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'

export type HazardSignal = 'still' | 'fixed'

export function useVerify({
  contentType,
  contentId,
  enabled = true,
}: {
  contentType: 'photo' | 'pothole'
  contentId: string
  enabled?: boolean
}) {
  const [stillCount, setStillCount] = useState(0)
  const [fixedCount, setFixedCount] = useState(0)
  const [posting, setPosting] = useState<HazardSignal | null>(null)

  const fetchCounts = useCallback(async () => {
    const idParam =
      contentType === 'pothole'
        ? { p_pothole_id: Number(contentId) }
        : { p_photo_id: Number(contentId) }
    const { data } = await supabase.rpc('get_hazard_verification', {
      p_content_type: contentType,
      p_content_id: contentId,
    })
    const row = (Array.isArray(data) ? data[0] : data) as
      | { fixed_count: number; still_count: number }
      | undefined
    if (row) {
      setStillCount(Number(row.still_count ?? 0))
      setFixedCount(Number(row.fixed_count ?? 0))
      return
    }
    // Fallback to legacy comment counts if verifications table not migrated yet
    const rpcGet =
      contentType === 'pothole' ? 'get_detection_comments' : 'get_community_photo_comments'
    const { data: legacy } = await supabase.rpc(rpcGet, idParam)
    if (!legacy) return
    const rows = legacy as { body: string }[]
    const still = rows.filter((r) => r.body === '✅ Still here').length
    const fixedRows = rows.filter((r) => r.body === '✅ Fixed')
    const distinctFixed = new Set(
      (fixedRows as unknown as { user_id?: string }[]).map((r) => r.user_id ?? ''),
    )
    setStillCount(still)
    setFixedCount(distinctFixed.has('') ? fixedRows.length : distinctFixed.size)
  }, [contentType, contentId])

  useEffect(() => {
    if (!enabled) return
    ;(async () => {
      await fetchCounts()
    })()
  }, [enabled, fetchCounts])

  const verify = useCallback(
    async (signal: HazardSignal) => {
      if (posting) return
      setPosting(signal)
      // Consensus vote (last-wins per user). Ignore error if migration not applied yet.
      await supabase
        .rpc('mark_hazard_signal', {
          p_content_type: contentType,
          p_content_id: contentId,
          p_signal: signal,
        })
        .then(
          () => {},
          () => {},
        )
      // Keep discussion thread for transparency
      const rpcPost =
        contentType === 'pothole' ? 'create_detection_comment' : 'create_community_photo_comment'
      await supabase.rpc(rpcPost, {
        ...(contentType === 'pothole'
          ? { p_pothole_id: Number(contentId) }
          : { p_photo_id: Number(contentId) }),
        p_body: signal === 'fixed' ? '✅ Fixed' : '✅ Still here',
      })
      await fetchCounts()
      setPosting(null)
    },
    [contentType, contentId, posting, fetchCounts],
  )

  return { stillCount, fixedCount, posting, verify }
}
