import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

export type DetectionComment = {
  id: string
  body: string
  created_at: string
  user_id: string
  username: string | null
  avatar_url: string | null
}

export function useDetectionComments(potholeId: string | null) {
  const [comments, setComments] = useState<DetectionComment[]>([])
  const [loading, setLoading] = useState(false)
  const [posting, setPosting] = useState(false)

  const fetchComments = useCallback(() => {
    if (potholeId === null) {
      setComments([])
      return
    }

    let cancelled = false
    setLoading(true)

    supabase
      .rpc('get_detection_comments', { p_pothole_id: parseInt(potholeId, 10) })
      .then(({ data, error }) => {
        if (cancelled) return
        setLoading(false)
        if (error) {
          console.log('[Comments] RPC error:', JSON.stringify(error))
          return
        }
        setComments((data ?? []) as DetectionComment[])
      }, (err) => {
        if (cancelled) return
        setLoading(false)
        console.log('[Comments] RPC exception:', JSON.stringify(err))
      })

    return () => { cancelled = true }
  }, [potholeId])

  useEffect(() => {
    const cleanup = fetchComments()
    return cleanup
  }, [fetchComments])

  const postComment = useCallback(async (body: string) => {
    if (potholeId === null || !body.trim()) return null

    setPosting(true)
    try {
      const { data, error } = await supabase
        .rpc('create_detection_comment', {
          p_pothole_id: parseInt(potholeId, 10),
          p_body: body.trim(),
        })

      if (error) {
        console.log('[Comments] Post error:', JSON.stringify(error))
        return null
      }

      const newComment = (data as DetectionComment[])?.[0] ?? null
      if (newComment) {
        setComments((prev) => [...prev, newComment])
      }
      return newComment
    } catch (err) {
      console.log('[Comments] Post exception:', JSON.stringify(err))
      return null
    } finally {
      setPosting(false)
    }
  }, [potholeId])

  return { comments, loading, posting, postComment }
}
