import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from './supabase'

export function useReport({
  contentType,
  contentId,
  enabled = true,
}: {
  contentType: 'photo' | 'pothole'
  contentId: string
  enabled?: boolean
}) {
  const [reported, setReported] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (errorTimer.current) clearTimeout(errorTimer.current)
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    ;(async () => {
      const { data } = await supabase.rpc('has_user_reported', {
        p_content_type: contentType,
        p_content_id: contentId,
      })
      if (!cancelled) {
        setReported(!!data)
        setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [contentType, contentId, enabled])

  const fail = useCallback((message: string) => {
    setError(message)
    if (errorTimer.current) clearTimeout(errorTimer.current)
    errorTimer.current = setTimeout(() => setError(null), 3000)
  }, [])

  const report = useCallback(
    async (reason: string): Promise<boolean> => {
      const { error: err } = await supabase.rpc('report_content', {
        p_content_type: contentType,
        p_content_id: contentId,
        p_reason: reason,
      })
      if (err) {
        fail('Report failed')
        return false
      }
      setReported(true)
      return true
    },
    [contentType, contentId, fail],
  )

  const unreport = useCallback(async (): Promise<boolean> => {
    const { error: err } = await supabase.rpc('unreport_content', {
      p_content_type: contentType,
      p_content_id: contentId,
    })
    if (err) {
      fail('Report failed')
      return false
    }
    setReported(false)
    return true
  }, [contentType, contentId, fail])

  return { reported, loading, error, report, unreport }
}
