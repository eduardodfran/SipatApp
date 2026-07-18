import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export type DistressType = {
  class_name: string
  detection_count: number
  avg_confidence: number
  worst_severity: string
  sample_image_url: string | null
}

const SEVERITY_ORDER: Record<string, number> = { minor: 0, moderate: 1, severe: 2 }

export function friendlyClassName(name: string): string {
  switch (name) {
    case 'D00': return 'Longitudinal Crack'
    case 'D01': return 'Transverse Crack'
    case 'D10': return 'Alligator Crack'
    case 'D11': return 'Alligator Crack'
    case 'D20': return 'Complex Crack'
    case 'D40': return 'Pothole'
    case 'D50': return 'Repair'
    default: return name
  }
}

export function useDistressSummary() {
  const [distresstypes, setDistresstypes] = useState<DistressType[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    supabase
      .from('raw_detections')
      .select('class_name, confidence, severity, image_url')
      .not('class_name', 'is', null)
      .not('class_name', 'in', '("D43","D44")')
      .limit(500)
      .then(({ data, error }) => {
        if (cancelled) return
        setLoading(false)
        if (error) {
          console.log('[DistressSummary] query error:', JSON.stringify(error))
          return
        }
        const rows = (data ?? []) as {
          class_name: string
          confidence: number
          severity: string
          image_url: string | null
        }[]

        const grouped: Record<string, { count: number; totalConf: number; worstSev: string; bestImage: string | null }> = {}

        for (const row of rows) {
          const name = row.class_name
          if (!grouped[name]) {
            grouped[name] = { count: 0, totalConf: 0, worstSev: 'minor', bestImage: null }
          }
          const g = grouped[name]
          g.count++
          g.totalConf += row.confidence ?? 0
          if ((SEVERITY_ORDER[row.severity] ?? 0) > (SEVERITY_ORDER[g.worstSev] ?? 0)) {
            g.worstSev = row.severity
          }
          if (!g.bestImage && row.image_url) {
            g.bestImage = row.image_url
          }
        }

        const result: DistressType[] = Object.entries(grouped)
          .map(([name, g]) => ({
            class_name: name,
            detection_count: g.count,
            avg_confidence: g.count > 0 ? g.totalConf / g.count : 0,
            worst_severity: g.worstSev,
            sample_image_url: g.bestImage,
          }))
          .sort((a, b) => b.detection_count - a.detection_count)

        console.log(`[DistressSummary] Found ${result.length} distress types from ${rows.length} rows`)
        setDistresstypes(result)
      }, (err) => {
        if (cancelled) return
        setLoading(false)
        console.log('[DistressSummary] query exception:', JSON.stringify(err))
      })

    return () => { cancelled = true }
  }, [])

  return { distresstypes, loading }
}
