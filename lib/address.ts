/** Structural type so shortAddress works for potholes and community photos alike. */
export interface Addressable {
  formatted_address?: string | null
  street?: string | null
  barangay?: string | null
  city?: string | null
  province?: string | null
  region?: string | null
  country?: string | null
  consolidated_latitude?: number | null
  consolidated_longitude?: number | null
  latitude?: number | null
  longitude?: number | null
}

/** Short address for compact displays (deck cards, map labels). */
export function shortAddress(p: Addressable): string {
  if (p.formatted_address) {
    const parts = p.formatted_address.split(',')
    if (parts.length >= 2) return `${parts[0].trim()}, ${parts[1].trim()}`
    return parts[0].trim()
  }
  if (p.city && p.province) return `${p.city}, ${p.province}`
  if (p.city) return p.city
  if (p.barangay) return p.barangay
  const lat = p.consolidated_latitude ?? p.latitude
  const lng = p.consolidated_longitude ?? p.longitude
  if (lat != null && lng != null) return `${lat.toFixed(3)}, ${lng.toFixed(3)}`
  return 'Location pending'
}
