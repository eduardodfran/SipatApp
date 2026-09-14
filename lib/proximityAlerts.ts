import { supabase } from './supabase'

// Driving Mode proximity alerts — pure logic + data loading.
// Only ACTIVE hazards (activity_status='active', not [HIDDEN]) are candidates,
// so fixed/hidden pins never trigger alerts.

export const WARN_DISTANCE_M = 100
export const URGENT_DISTANCE_M = 30
export const CONE_HALF_ANGLE_DEG = 60
export const MIN_SPEED_MPS = 3
export const ALERT_COOLDOWN_MS = 10_000
export const HAZARD_LOAD_RADIUS_M = 2000
export const HAZARD_REFRESH_MOVE_M = 500
export const HAZARD_REFRESH_MS = 60_000
export const HAZARD_LOAD_LIMIT = 300

export type HazardPoint = {
  id: string
  lat: number
  lng: number
  severity: string
  street: string | null
}

export type DriverPosition = {
  lat: number
  lng: number
  heading: number | null // degrees, null when unknown/stationary
  speed: number | null // m/s, null when unknown
}

export type ProximityAlert = {
  hazard: HazardPoint
  distM: number
  tier: 'warn' | 'urgent'
}

const EARTH_RADIUS_M = 6371000

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a))
}

/** Initial bearing from point A to point B, degrees 0-360. */
export function bearingDeg(fromLat: number, fromLng: number, toLat: number, toLng: number): number {
  const dLng = toRad(toLng - fromLng)
  const y = Math.sin(dLng) * Math.cos(toRad(toLat))
  const x =
    Math.cos(toRad(fromLat)) * Math.sin(toRad(toLat)) -
    Math.sin(toRad(fromLat)) * Math.cos(toRad(toLat)) * Math.cos(dLng)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

/** Smallest angular difference between two headings, degrees 0-180. */
export function angleDiffDeg(a: number, b: number): number {
  const d = Math.abs(((a - b + 540) % 360) - 180)
  return d
}

/**
 * Pick the nearest alertable hazard for this position, or null.
 * Bearing cone applies only when moving with a valid heading;
 * slow/stationary drivers fall back to radial distance.
 */
export function evaluateProximity(
  pos: DriverPosition,
  hazards: HazardPoint[],
  alreadyAlerted: Set<string>,
): ProximityAlert | null {
  const coneActive = pos.speed != null && pos.speed >= MIN_SPEED_MPS && pos.heading != null
  let best: ProximityAlert | null = null

  for (const h of hazards) {
    if (alreadyAlerted.has(h.id)) continue
    const distM = haversineMeters(pos.lat, pos.lng, h.lat, h.lng)
    if (distM > WARN_DISTANCE_M) continue
    if (coneActive) {
      const bearing = bearingDeg(pos.lat, pos.lng, h.lat, h.lng)
      if (angleDiffDeg(bearing, pos.heading as number) > CONE_HALF_ANGLE_DEG) continue
    }
    if (!best || distM < best.distM) {
      best = { hazard: h, distM, tier: distM <= URGENT_DISTANCE_M ? 'urgent' : 'warn' }
    }
  }
  return best
}

/** Bounding-box load of active hazards around a point (server-side filter, no lag). */
export async function loadNearbyHazards(lat: number, lng: number): Promise<HazardPoint[]> {
  const dLat = HAZARD_LOAD_RADIUS_M / 111320
  const dLng = HAZARD_LOAD_RADIUS_M / (111320 * Math.max(0.2, Math.cos(toRad(lat))))

  const base = supabase
    .from('v_unified_potholes')
    .select('pothole_id, consolidated_latitude, consolidated_longitude, worst_severity, street')
    .gte('consolidated_latitude', lat - dLat)
    .lte('consolidated_latitude', lat + dLat)
    .gte('consolidated_longitude', lng - dLng)
    .lte('consolidated_longitude', lng + dLng)
    .not('caption', 'like', '[HIDDEN]%')
    .order('total_detection_hits', { ascending: false })
    .limit(HAZARD_LOAD_LIMIT)

  const withStatus = await base.eq('activity_status', 'active')
  let data = withStatus.data
  if (withStatus.error && /activity_status/i.test(withStatus.error.message ?? '')) {
    // Dev DB without the fixed-verification migration: fall back to caption filter only.
    const fallback = await supabase
      .from('v_unified_potholes')
      .select('pothole_id, consolidated_latitude, consolidated_longitude, worst_severity, street')
      .gte('consolidated_latitude', lat - dLat)
      .lte('consolidated_latitude', lat + dLat)
      .gte('consolidated_longitude', lng - dLng)
      .lte('consolidated_longitude', lng + dLng)
      .not('caption', 'like', '[HIDDEN]%')
      .order('total_detection_hits', { ascending: false })
      .limit(HAZARD_LOAD_LIMIT)
    data = fallback.data
  }

  return ((data ?? []) as Record<string, unknown>[])
    .filter((r) => r.consolidated_latitude != null && r.consolidated_longitude != null)
    .map((r) => ({
      id: String(r.pothole_id),
      lat: Number(r.consolidated_latitude),
      lng: Number(r.consolidated_longitude),
      severity: String(r.worst_severity ?? 'Unknown'),
      street: (r.street as string | null) ?? null,
    }))
}
