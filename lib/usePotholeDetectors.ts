import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export type Detector = {
  user_id: string
  username: string | null
  full_name: string | null
  detected_at: string
}

export function usePotholeDetectors(lat: number | null, lng: number | null) {
  const [detectors, setDetectors] = useState<Detector[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (lat === null || lng === null) {
      setDetectors([])
      return
    }

    let cancelled = false
    setLoading(true)

    supabase
      .rpc('get_pothole_detectors', { p_lat: lat, p_lng: lng })
      .then(({ data, error }) => {
        if (cancelled) return
        setLoading(false)
        if (error) {
          console.log('[Detectors] RPC error:', JSON.stringify(error))
          return
        }
        const result = (data ?? []) as Detector[]
        console.log(`[Detectors] Found ${result.length} detectors at (${lat}, ${lng})`)
        setDetectors(result)
      }, (err) => {
        if (cancelled) return
        setLoading(false)
        console.log('[Detectors] RPC exception:', JSON.stringify(err))
      })

    return () => { cancelled = true }
  }, [lat, lng])

  return { detectors, loading }
}
