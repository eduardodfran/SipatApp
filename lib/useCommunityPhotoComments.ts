import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { validateComment } from './spamDetection'

export interface PhotoComment {
  id: string
  body: string
  created_at: string
  username: string | null
  user_id: string | null
}

/** Fetches when photoId is non-null; pass null to gate the query (background cards never fetch). */
export function useCommunityPhotoComments(photoId: number | null) {
  const [comments, setComments] = useState<PhotoComment[]>([])
  const [loading, setLoading] = useState(false)
  const [posting, setPosting] = useState(false)

  const fetchComments = useCallback(() => {
    if (photoId === null) {
      setComments([])
      return
    }

    let cancelled = false
    setLoading(true)

    ;(async () => {
      try {
        const { data, error } = await supabase.rpc('get_community_photo_comments', {
          p_photo_id: photoId,
        })
        if (cancelled) return
        setLoading(false)
        if (error) {
          console.log('[PhotoComments] RPC error:', JSON.stringify(error))
          return
        }
        setComments((data ?? []) as PhotoComment[])
      } catch (err) {
        if (cancelled) return
        setLoading(false)
        console.log('[PhotoComments] RPC exception:', JSON.stringify(err))
      }
    })()

    return () => {
      cancelled = true
    }
  }, [photoId])

  useEffect(() => {
    const cleanup = fetchComments()
    return cleanup
  }, [fetchComments])

  // Silent reconcile after a post — mirrors FeedScreen's post → reload pattern.
  const reload = useCallback(() => {
    if (photoId === null) return
    supabase
      .rpc('get_community_photo_comments', { p_photo_id: photoId })
      .then(({ data }) => {
        setComments((data ?? []) as PhotoComment[])
      })
  }, [photoId])

  const postComment = useCallback(
    async (body: string) => {
      if (photoId === null || !body.trim()) return null

      const validation = validateComment(body)
      if (!validation.ok) return null

      setPosting(true)
      try {
        const { data, error } = await supabase.rpc('create_community_photo_comment', {
          p_photo_id: photoId,
          p_body: body.trim(),
        })

        if (error) {
          console.log('[PhotoComments] Post error:', JSON.stringify(error))
          return null
        }

        const newComment = (data as PhotoComment[])?.[0] ?? null
        if (newComment) {
          setComments((prev) => [...prev, newComment])
        }
        reload()
        return newComment
      } catch (err) {
        console.log('[PhotoComments] Post exception:', JSON.stringify(err))
        return null
      } finally {
        setPosting(false)
      }
    },
    [photoId, reload],
  )

  return { comments, loading, posting, postComment }
}
