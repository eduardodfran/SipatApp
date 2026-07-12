export type Recording = {
  id: string
  rideId?: string
  videoUri: string
  csvUri: string
  timestamp: number
  uploaded: boolean
  status?: 'queued' | 'processing' | 'completed' | 'failed'
  errorLog?: string
  storagePaths?: {
    video: string
    gps: string
  }
}

export type CommunityPhoto = {
  id: number
  user_id: string
  image_url: string
  latitude: number
  longitude: number
  street: string | null
  barangay: string | null
  city: string | null
  formatted_address: string | null
  detection_status: 'pending' | 'processed' | 'no_detection'
  worst_severity: string | null
  confidence: number | null
  class_name: string | null
  created_at: string
  reporter_username: string | null
}
