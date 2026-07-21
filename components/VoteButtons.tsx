import { useState, useCallback, useEffect } from 'react'
import { View, TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'

type Props = {
  contentType: 'photo' | 'pothole'
  contentId: string
  initialUpvotes?: number
  initialDownvotes?: number
  initialUserVote?: number
  onVoteChange?: (score: number) => void
}

export default function VoteButtons({
  contentType,
  contentId,
  initialUpvotes = 0,
  initialDownvotes = 0,
  initialUserVote = 0,
  onVoteChange,
}: Props) {
  const [upvotes, setUpvotes] = useState(initialUpvotes)
  const [downvotes, setDownvotes] = useState(initialDownvotes)
  const [userVote, setUserVote] = useState(initialUserVote)
  const [loading, setLoading] = useState(false)

  const score = upvotes - downvotes

  useEffect(() => {
    setUpvotes(initialUpvotes)
    setDownvotes(initialDownvotes)
    setUserVote(initialUserVote)
  }, [initialUpvotes, initialDownvotes, initialUserVote])

  const handleVote = useCallback(
    async (voteValue: 1 | -1) => {
      if (loading) return
      setLoading(true)
      try {
        if (userVote === voteValue) {
          const { data, error } = await supabase.rpc('unvote_content', {
            p_content_type: contentType,
            p_content_id: contentId,
          })
          if (error) throw error
          const row = Array.isArray(data) ? data[0] : data
          setUpvotes(row?.upvotes ?? 0)
          setDownvotes(row?.downvotes ?? 0)
          setUserVote(row?.user_vote ?? 0)
          onVoteChange?.(row?.net_score ?? 0)
        } else {
          const { data, error } = await supabase.rpc('vote_content', {
            p_content_type: contentType,
            p_content_id: contentId,
            p_vote_value: voteValue,
          })
          if (error) throw error
          const row = Array.isArray(data) ? data[0] : data
          setUpvotes(row?.upvotes ?? 0)
          setDownvotes(row?.downvotes ?? 0)
          setUserVote(row?.user_vote ?? 0)
          onVoteChange?.(row?.net_score ?? 0)
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false)
      }
    },
    [contentType, contentId, userVote, loading, onVoteChange],
  )

  const scoreColor = score > 0 ? '#22c55e' : score < 0 ? '#ef4444' : '#6b7280'

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color="#6b7280" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.voteButton, userVote === 1 && styles.activeUpvote]}
        onPress={() => handleVote(1)}
        activeOpacity={0.7}
      >
        <Ionicons
          name="arrow-up"
          size={16}
          color={userVote === 1 ? '#22c55e' : '#6b7280'}
        />
      </TouchableOpacity>

      <Text style={[styles.score, { color: scoreColor }]}>{score}</Text>

      <TouchableOpacity
        style={[styles.voteButton, userVote === -1 && styles.activeDownvote]}
        onPress={() => handleVote(-1)}
        activeOpacity={0.7}
      >
        <Ionicons
          name="arrow-down"
          size={16}
          color={userVote === -1 ? '#ef4444' : '#6b7280'}
        />
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  voteButton: {
    padding: 4,
    borderRadius: 4,
  },
  activeUpvote: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
  },
  activeDownvote: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  score: {
    fontSize: 12,
    fontWeight: '600',
    minWidth: 24,
    textAlign: 'center',
  },
})
