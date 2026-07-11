import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export type Hazard = {
  pothole_id: number
  worst_severity: string
  total_detection_hits: number
  consolidated_latitude: number
  consolidated_longitude: number
  street: string | null
  barangay: string | null
  city: string | null
  province: string | null
  region: string | null
  country: string | null
  formatted_address: string | null
  citizen_first_reported_at: string
}

export function useCommunityHazards() {
  const [hazards, setHazards] = useState<Hazard[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    supabase
      .from('v_unified_potholes')
      .select(
        'pothole_id, worst_severity, total_detection_hits, consolidated_latitude, consolidated_longitude, street, barangay, city, province, region, country, formatted_address, citizen_first_reported_at',
      )
      .order('citizen_first_reported_at', { ascending: false })
      .limit(200)
      .then(({ data, error }) => {
        if (cancelled) return
        setLoading(false)
        if (error) {
          console.log('[CommunityHazards] query error:', JSON.stringify(error))
          return
        }
        setHazards((data ?? []) as Hazard[])
      })

    return () => {
      cancelled = true
    }
  }, [])

  return { hazards, loading }
}
