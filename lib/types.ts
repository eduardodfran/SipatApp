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
