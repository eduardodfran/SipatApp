import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from './supabase'

export interface VoteState {
  upvotes: number
  downvotes: number
  userVote: 0 | 1 | -1
}

export type VoteOutcome = 'up' | 'down' | 'removed' | 'error'

export function useVote({
  contentType,
  contentId,
  initialVotes,
}: {
  contentType: 'photo' | 'pothole'
  contentId: string
  initialVotes?: VoteState
}) {
  const seeded = useRef(initialVotes !== undefined)
  const [votes, setVotes] = useState<VoteState>(
    initialVotes ?? { upvotes: 0, downvotes: 0, userVote: 0 },
  )
  const [loading, setLoading] = useState(initialVotes === undefined)
  const [voting, setVoting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (errorTimer.current) clearTimeout(errorTimer.current)
    }
  }, [])

  useEffect(() => {
    if (seeded.current) return
    let cancelled = false
    ;(async () => {
      const { data } = await supabase.rpc('get_content_votes', {
        p_content_type: contentType,
        p_content_id: contentId,
      })
      if (!cancelled && data) {
        const row = Array.isArray(data) ? data[0] : data
        setVotes({
          upvotes: row.upvotes ?? 0,
          downvotes: row.downvotes ?? 0,
          userVote: row.user_vote ?? 0,
        })
      }
      if (!cancelled) setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [contentType, contentId])

  const fail = useCallback((message: string) => {
    setError(message)
    if (errorTimer.current) clearTimeout(errorTimer.current)
    errorTimer.current = setTimeout(() => setError(null), 3000)
  }, [])

  const vote = useCallback(
    async (value: 1 | -1): Promise<VoteOutcome> => {
      if (voting) return 'error'
      const sameVote = votes.userVote === value
      const rpc = sameVote ? 'unvote_content' : 'vote_content'
      const params = sameVote
        ? { p_content_type: contentType, p_content_id: contentId }
        : { p_content_type: contentType, p_content_id: contentId, p_vote_value: value }
      setVoting(true)
      const { data, error: err } = await supabase.rpc(rpc, params)
      setVoting(false)
      if (err) {
        fail('Vote failed')
        return 'error'
      }
      if (data) {
        const row = Array.isArray(data) ? data[0] : data
        setVotes({
          upvotes: row.upvotes ?? 0,
          downvotes: row.downvotes ?? 0,
          userVote: sameVote ? 0 : value,
        })
      }
      return sameVote ? 'removed' : value === 1 ? 'up' : 'down'
    },
    [contentType, contentId, votes.userVote, voting, fail],
  )

  return { votes, loading, voting, error, vote }
}
