import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { colors, fonts, radius, spacing } from '../theme/tokens'

type Props = {
  contentType: 'photo' | 'pothole'
  contentId: string
  onReported?: (reportCount: number) => void
}

const REPORT_REASONS = [
  { label: 'Spam', value: 'spam' },
  { label: 'Inappropriate content', value: 'inappropriate' },
  { label: 'Not a pothole', value: 'not_pothole' },
  { label: 'Duplicate', value: 'duplicate' },
  { label: 'Other', value: 'other' },
] as const

export default function ReportButton({ contentType, contentId, onReported }: Props) {
  const [reported, setReported] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.rpc('has_user_reported', {
      p_content_type: contentType,
      p_content_id: contentId,
    }).then(({ data }) => {
      if (data === true) setReported(true)
    })
  }, [contentType, contentId])

  const handleReport = useCallback(() => {
    if (reported) {
      Alert.alert('Unreport', 'Remove your report for this content?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unreport',
          style: 'destructive',
          onPress: async () => {
            setLoading(true)
            const { error } = await supabase.rpc('unreport_content', {
              p_content_type: contentType,
              p_content_id: contentId,
            })
            setLoading(false)
            if (!error) setReported(false)
          },
        },
      ])
      return
    }

    Alert.alert('Report Content', 'Why are you reporting this?', [
      ...REPORT_REASONS.map((reason) => ({
        text: reason.label,
        onPress: () => submitReport(reason.value),
      })),
      { text: 'Cancel', style: 'cancel' },
    ])
  }, [reported, contentType, contentId])

  const submitReport = async (reason: string) => {
    setLoading(true)
    const { data, error } = await supabase.rpc('report_content', {
      p_content_type: contentType,
      p_content_id: contentId,
      p_reason: reason,
    })
    setLoading(false)
    if (error) {
      Alert.alert('Error', error.message.includes('Not authenticated') ? 'You need to sign in to report content.' : 'Could not submit report. Please try again.')
      return
    }
    setReported(true)
    const row = Array.isArray(data) ? data[0] : data
    if (row && typeof row === 'object' && 'report_count' in row) {
      onReported?.((row as { report_count: number }).report_count)
    }
  }

  return (
    <TouchableOpacity
      style={[styles.button, reported && styles.reported]}
      onPress={handleReport}
      disabled={loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator size="small" color={reported ? colors.severe : colors.textSecondary} />
      ) : (
        <Ionicons name="flag" size={14} color={reported ? colors.severe : colors.textSecondary} />
      )}
      <Text style={[styles.text, reported && styles.reportedText]}>
        {reported ? 'Reported' : 'Report'}
      </Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.hairline,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  reported: {
    backgroundColor: colors.severeDim,
    borderColor: colors.hairlineStrong,
  },
  text: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.textSecondary,
  },
  reportedText: {
    color: colors.severe,
  },
})
