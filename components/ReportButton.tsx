import { useCallback, useState } from 'react'
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'

type Props = {
  contentType: 'photo' | 'pothole'
  contentId: string
  onReported?: (reportCount: number) => void
}

const REPORT_REASONS = [
  'Spam',
  'Inappropriate content',
  'Not a pothole',
  'Duplicate',
  'Other',
] as const

export default function ReportButton({ contentType, contentId, onReported }: Props) {
  const [reported, setReported] = useState(false)
  const [loading, setLoading] = useState(false)

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
        text: reason,
        onPress: () => submitReport(reason),
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
    if (!error) {
      setReported(true)
      const row = Array.isArray(data) ? data[0] : data
      if (row && typeof row === 'object' && 'report_count' in row) {
        onReported?.((row as { report_count: number }).report_count)
      }
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
        <ActivityIndicator size="small" color={reported ? '#ef4444' : '#6b7280'} />
      ) : (
        <Ionicons name="flag" size={14} color={reported ? '#ef4444' : '#6b7280'} />
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
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: 'transparent',
  },
  reported: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  text: {
    fontSize: 12,
    color: '#6b7280',
  },
  reportedText: {
    color: '#ef4444',
  },
})
