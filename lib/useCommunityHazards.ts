import { supabase } from './supabase'
import { useOfflineQuery } from './useOfflineQuery'

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
  const { data, loading } = useOfflineQuery<Hazard[]>(
    'community_hazards',
    async () => {
      const { data, error } = await supabase
        .from('v_unified_potholes')
        .select(
          'pothole_id, worst_severity, total_detection_hits, consolidated_latitude, consolidated_longitude, street, barangay, city, province, region, country, formatted_address, citizen_first_reported_at',
        )
        .order('citizen_first_reported_at', { ascending: false })
        .limit(200)

      if (error) {
        console.log('[CommunityHazards] query error:', JSON.stringify(error))
        return { data: null, error }
      }

      return { data: (data ?? []) as Hazard[], error: null }
    },
    { ttlMs: 300_000 },
  )

  return { hazards: data ?? [], loading }
}
