import { useState, useCallback, useEffect } from 'react'
import { View, TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { colors, fonts, radius, spacing } from '../theme/tokens'

type Props = {
  contentType: 'photo' | 'pothole'
  contentId: string
  initialUpvotes?: number
  initialDownvotes?: number
  initialUserVote?: number
  onVoteChange?: (upvotes: number, downvotes: number, userVote: number) => void
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
          onVoteChange?.(row?.upvotes ?? 0, row?.downvotes ?? 0, row?.user_vote ?? 0)
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
          onVoteChange?.(row?.upvotes ?? 0, row?.downvotes ?? 0, row?.user_vote ?? 0)
        }
      } catch (err) {
        console.log('[VoteButtons] vote error:', err)
      } finally {
        setLoading(false)
      }
    },
    [contentType, contentId, userVote, loading, onVoteChange],
  )

  const scoreColor = score > 0 ? colors.signal : score < 0 ? colors.severe : colors.textMuted

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color={colors.textMuted} />
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
          color={userVote === 1 ? colors.signal : colors.textSecondary}
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
          color={userVote === -1 ? colors.severe : colors.textSecondary}
        />
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  voteButton: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.hairline,
    borderWidth: 1,
    borderColor: colors.hairline,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeUpvote: {
    backgroundColor: colors.signalDim,
    borderColor: colors.signalLine,
  },
  activeDownvote: {
    backgroundColor: colors.severeDim,
    borderColor: colors.hairlineStrong,
  },
  score: {
    fontFamily: fonts.monoMedium,
    fontSize: 12,
    minWidth: 32,
    textAlign: 'center',
  },
})
