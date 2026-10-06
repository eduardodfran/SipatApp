import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { colors, fonts, radius, spacing } from '../theme/tokens'
import ReportSheet from './ReportSheet'

type Props = {
  contentType: 'photo' | 'pothole'
  contentId: string
  onReported?: (reportCount: number) => void
}

export default function ReportButton({ contentType, contentId, onReported }: Props) {
  const [reported, setReported] = useState(false)
  const [sheet, setSheet] = useState<'reasons' | 'confirm' | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase.rpc('has_user_reported', {
      p_content_type: contentType,
      p_content_id: contentId,
    }).then(({ data }) => {
      if (data === true) setReported(true)
    })
  }, [contentType, contentId])

  const handleReport = useCallback(() => {
    setError(null)
    setSheet('reasons')
  }, [])

  const submitReport = async (reason: string) => {
    if (submitting) return
    setSubmitting(true)
    setError(null)
    const { data, error: err } = await supabase.rpc('report_content', {
      p_content_type: contentType,
      p_content_id: contentId,
      p_reason: reason,
    })
    setSubmitting(false)
    if (err) {
      setError(
        err.message.includes('Not authenticated')
          ? 'You need to sign in to report content.'
          : 'Could not submit report. Please try again.',
      )
      return
    }
    setSheet(null)
    setReported(true)
    const row = Array.isArray(data) ? data[0] : data
    if (row && typeof row === 'object' && 'report_count' in row) {
      onReported?.((row as { report_count: number }).report_count)
    }
  }

  const confirmUnreport = async () => {
    if (submitting) return
    setSubmitting(true)
    setError(null)
    const { error: err } = await supabase.rpc('unreport_content', {
      p_content_type: contentType,
      p_content_id: contentId,
    })
    setSubmitting(false)
    if (err) {
      setError('Could not remove report. Please try again.')
      return
    }
    setSheet(null)
    setReported(false)
  }

  return (
    <>
      <TouchableOpacity
        style={[styles.button, reported && styles.reported]}
        onPress={reported ? () => { setError(null); setSheet('confirm') } : handleReport}
        disabled={submitting}
        activeOpacity={0.7}
      >
        {submitting ? (
          <ActivityIndicator size="small" color={reported ? colors.severe : colors.textSecondary} />
        ) : (
          <Ionicons name="flag" size={14} color={reported ? colors.severe : colors.textSecondary} />
        )}
        <Text style={[styles.text, reported && styles.reportedText]}>
          {reported ? 'Reported' : 'Report'}
        </Text>
      </TouchableOpacity>

      <ReportSheet
        visible={sheet === 'reasons'}
        mode="reasons"
        title="Report content"
        subtitle="Why are you reporting this?"
        error={error}
        submitting={submitting}
        onSelectReason={submitReport}
        onCancel={() => { setSheet(null); setError(null) }}
      />
      <ReportSheet
        visible={sheet === 'confirm'}
        mode="confirm"
        title="Remove your report?"
        subtitle="This content will no longer be flagged by you."
        confirmLabel="Remove"
        error={error}
        submitting={submitting}
        onConfirm={confirmUnreport}
        onCancel={() => { setSheet(null); setError(null) }}
      />
    </>
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
