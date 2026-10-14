import { File, Paths } from 'expo-file-system'
import {
  uploadAsync,
  FileSystemUploadType,
  type FileSystemAcceptedUploadHttpMethod,
} from 'expo-file-system/legacy'
import { supabase } from './supabase'
import { fetchFastApi } from './fastapi'

const API_TIMEOUT = 30_000

async function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeout?: number } = {},
): Promise<Response> {
  const { timeout = API_TIMEOUT, ...rest } = options
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const response = await globalThis.fetch(url, { ...rest, signal: controller.signal })
    return response
  } finally {
    clearTimeout(timer)
  }
}

export type GpsTrackingPoint = {
  lat: number
  lng: number
  timestamp_seconds: number
  accel_x?: number
  accel_y?: number
  accel_z?: number
  gyro_x?: number
  gyro_y?: number
  gyro_z?: number
}

type RideUploadResult = {
  rideId: string
  videoBucketPath: string
  gpsBucketPath: string
}

export type UploadStage = 'gps' | 'video' | 'finishing'

export type UploadProgress = {
  stage: UploadStage
  /** 1-based attempt number within the current stage. */
  attempt: number
  maxAttempts: number
  elapsedMs: number
  gpsPoints?: number
}

export function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000)
  const mm = Math.floor(s / 60)
  const ss = s % 60
  return `${mm}:${ss.toString().padStart(2, '0')}`
}

function generateRideId(): string {
  const cryptoApi = globalThis.crypto as Crypto | undefined
  if (cryptoApi?.randomUUID) {
    return cryptoApi.randomUUID()
  }

  const template = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'
  return template.replace(/[xy]/g, (character) => {
    const randomValue = (Math.random() * 16) | 0
    const nextValue =
      character === 'x' ? randomValue : (randomValue & 0x3) | 0x8
    return nextValue.toString(16)
  })
}

async function csvUriToGpsTrackingArray(
  csvUri: string,
): Promise<GpsTrackingPoint[]> {
  const csvFile = new File(csvUri)
  const csvText = await csvFile.text()
  const lines = csvText
    .trim()
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)

  if (lines.length < 2) {
    throw new Error(
      'No GPS data in this recording. The file has only a header with zero GPS points. ' +
      'Record a new ride and ensure you are outdoors with GPS signal.',
    )
  }

  const header = lines[0].split(',').map((column) => column.trim())
  const timestampIndex = header.indexOf('timestamp')
  const latitudeIndex = header.indexOf('latitude')
  const longitudeIndex = header.indexOf('longitude')
  const accelXIndex = header.indexOf('accel_x')
  const accelYIndex = header.indexOf('accel_y')
  const accelZIndex = header.indexOf('accel_z')
  const gyroXIndex = header.indexOf('gyro_x')
  const gyroYIndex = header.indexOf('gyro_y')
  const gyroZIndex = header.indexOf('gyro_z')

  if (timestampIndex < 0 || latitudeIndex < 0 || longitudeIndex < 0) {
    throw new Error(
      'CSV file must include timestamp, latitude, and longitude columns',
    )
  }

  const rows = lines.slice(1).map((line, index) => {
    const columns = line.split(',')
    const timestamp = Number(columns[timestampIndex])
    const latitude = Number(columns[latitudeIndex])
    const longitude = Number(columns[longitudeIndex])

    if (
      Number.isNaN(timestamp) ||
      Number.isNaN(latitude) ||
      Number.isNaN(longitude)
    ) {
      throw new Error(`CSV row ${index + 2} contains invalid GPS values`)
    }

    return {
      _rawTimestamp: timestamp,
      timestamp_seconds: 0,
      lat: latitude,
      lng: longitude,
      ...(accelXIndex >= 0 && { accel_x: Number(columns[accelXIndex]) || 0 }),
      ...(accelYIndex >= 0 && { accel_y: Number(columns[accelYIndex]) || 0 }),
      ...(accelZIndex >= 0 && { accel_z: Number(columns[accelZIndex]) || 0 }),
      ...(gyroXIndex >= 0 && { gyro_x: Number(columns[gyroXIndex]) || 0 }),
      ...(gyroYIndex >= 0 && { gyro_y: Number(columns[gyroYIndex]) || 0 }),
      ...(gyroZIndex >= 0 && { gyro_z: Number(columns[gyroZIndex]) || 0 }),
    }
  })

  // Normalize timestamps: convert epoch ms to relative seconds from recording start
  const firstTimestamp = rows[0]?._rawTimestamp ?? 0
  return rows.map(({ _rawTimestamp, ...rest }) => ({
    ...rest,
    timestamp_seconds: (_rawTimestamp - firstTimestamp) / 1000,
  }))
}

async function getAccessToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session?.access_token) {
    throw new Error('Not authenticated. Please sign in again.')
  }
  return data.session.access_token
}

async function initUpload(
  videoFilename: string,
  gpsFilename: string,
): Promise<{
  ride_id: string
  video_sas_url: string
  gps_sas_url: string
  video_path: string
  gps_path: string
  expires_at: string
}> {
  const token = await getAccessToken()
  const response = await fetchFastApi('/upload/init', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      video_filename: videoFilename,
      gps_filename: gpsFilename,
    }),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.detail || `Init upload failed (${response.status})`)
  }

  return response.json()
}

export type CameraMetadata = {
  video_width?: number
  video_height?: number
  focal_length_35mm?: number
  zoom_factor?: number
}

export type MyRide = {
  id: string
  user_id: string
  video_bucket_path: string
  gps_bucket_path: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  error_log: string | null
  created_at: string
  progress_pct: number | null
  progress_stage: string | null
  progress_message: string | null
}

export async function fetchMyRides(): Promise<MyRide[]> {
  const token = await getAccessToken()
  const response = await fetchFastApi('/rides', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.detail || `Failed to fetch rides (${response.status})`)
  }

  const data = await response.json()
  return data.rides ?? []
}

export async function triggerProcessing(rideId: string): Promise<void> {
  const token = await getAccessToken()
  const response = await fetchFastApi(`/process/${rideId}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(
      body.detail || `Process trigger failed (${response.status})`,
    )
  }
}

async function uploadBlob(sasUrl: string, fileUri: string, mimeType: string, label: string) {
  const UPLOAD_TIMEOUT = 1_800_000

  const uploadPromise = uploadAsync(sasUrl, fileUri, {
    httpMethod: 'PUT' as FileSystemAcceptedUploadHttpMethod,
    uploadType: FileSystemUploadType.BINARY_CONTENT,
    headers: {
      'x-ms-blob-type': 'BlockBlob',
      'Content-Type': mimeType,
    },
  })

  let timeoutId: ReturnType<typeof setTimeout> | null = null
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error(`${label} upload timed out after 30 minutes — connection too slow? Try Wi-Fi.`)),
      UPLOAD_TIMEOUT,
    )
  })

  try {
    const result = await Promise.race([uploadPromise, timeoutPromise])

    if (result.status >= 400) {
      throw new Error(`Upload failed (${result.status}): ${result.body}`)
    }
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

async function uploadBlobWithRetry(
  sasUrl: string,
  fileUri: string,
  mimeType: string,
  opts: {
    label: string
    refreshSas?: () => Promise<{ sasUrl: string }>
    onAttempt?: (attempt: number, maxAttempts: number) => void
  },
) {
  const MAX_RETRIES = 3
  const maxAttempts = MAX_RETRIES + 1
  let lastError: Error | null = null
  let currentSasUrl = sasUrl
  const { label, refreshSas, onAttempt } = opts

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      onAttempt?.(attempt + 1, maxAttempts)
      await uploadBlob(currentSasUrl, fileUri, mimeType, label)
      return
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      if (attempt < MAX_RETRIES) {
        const delay = Math.pow(2, attempt + 1) * 1000
        await new Promise((resolve) => setTimeout(resolve, delay))
        if (refreshSas) {
          try {
            const refreshed = await refreshSas()
            currentSasUrl = refreshed.sasUrl
          } catch {
            // keep using current SAS URL if refresh fails
          }
        }
      }
    }
  }

  throw lastError
}

async function completeUpload(
  rideId: string,
  videoPath: string,
  gpsPath: string,
  cameraMetadata?: CameraMetadata,
) {
  const token = await getAccessToken()
  const body: Record<string, unknown> = {
    ride_id: rideId,
    video_path: videoPath,
    gps_path: gpsPath,
  }
  if (cameraMetadata?.video_width != null) body.video_width = cameraMetadata.video_width
  if (cameraMetadata?.video_height != null) body.video_height = cameraMetadata.video_height
  if (cameraMetadata?.focal_length_35mm != null) body.focal_length_35mm = cameraMetadata.focal_length_35mm
  if (cameraMetadata?.zoom_factor != null) body.zoom_factor = cameraMetadata.zoom_factor
  const response = await fetchFastApi('/upload/complete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(
      body.detail || `Complete upload failed (${response.status})`,
    )
  }
}

async function abortUpload(videoPath: string, gpsPath: string) {
  try {
    const token = await getAccessToken()
    await fetchFastApi('/upload/abort', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        video_path: videoPath,
        gps_path: gpsPath,
      }),
    })
  } catch {
    // best-effort cleanup
  }
}

export async function uploadRideData(
  userId: string,
  videoUri: string,
  csvUri: string,
  cameraMetadata?: CameraMetadata,
  onProgress?: (p: UploadProgress) => void,
): Promise<RideUploadResult> {
  if (!userId?.trim()) {
    throw new Error('userId is required')
  }

  if (!videoUri?.trim()) {
    throw new Error('videoUri is required')
  }

  if (!csvUri?.trim()) {
    throw new Error('csvUri is required')
  }

  const startedAt = Date.now()
  const report = (stage: UploadStage, attempt: number, maxAttempts: number, gpsPoints?: number) =>
    onProgress?.({ stage, attempt, maxAttempts, elapsedMs: Date.now() - startedAt, gpsPoints })

  const rideId = generateRideId()
  const videoFilename = `${rideId}.mp4`
  const gpsFilename = `${rideId}.json`

  const gpsTrackingArray = await csvUriToGpsTrackingArray(csvUri)
  if (gpsTrackingArray.length === 0) {
    throw new Error('CSV file must contain at least one GPS row')
  }
  if (gpsTrackingArray.length < 5) {
    console.log(`[upload] Warning: only ${gpsTrackingArray.length} GPS points — ride may process to nothing.`)
  }

  let initResult = await initUpload(videoFilename, gpsFilename)
  let { video_sas_url, gps_sas_url, video_path, gps_path, expires_at } = initResult

  let videoPath = video_path
  let gpsPath = gps_path
  let gpsDone = false
  // Set once the temp GPS file exists; used to re-sync GPS after SAS refreshes.
  let gpsFileUri = ''

  const checkAndRefreshSas = async () => {
    const expiryTime = new Date(expires_at).getTime()
    const now = Date.now()
    const fiveMinutes = 5 * 60 * 1000
    if (expiryTime - now < fiveMinutes) {
      try {
        const refreshed = await initUpload(videoFilename, gpsFilename)
        video_sas_url = refreshed.video_sas_url
        gps_sas_url = refreshed.gps_sas_url
        expires_at = refreshed.expires_at
        videoPath = refreshed.video_path
        gpsPath = refreshed.gps_path
        return true
      } catch {
        // keep using current SAS URLs and paths if refresh fails
      }
    }
    return false
  }

  // A SAS refresh mints NEW blob paths while GPS already sits at the OLD path.
  // Re-upload the (tiny) GPS file to the current path so completeUpload
  // validates. rideId stays the original throughout.
  const syncGpsToCurrentPaths = async () => {
    if (!gpsDone || !gpsFileUri) return
    await uploadBlobWithRetry(gps_sas_url, gpsFileUri, 'application/json', {
      label: 'GPS',
      onAttempt: (attempt, maxAttempts) => report('gps', attempt, maxAttempts, gpsTrackingArray.length),
    })
  }

  const refreshGpsSas = async () => {
    await checkAndRefreshSas()
    return { sasUrl: gps_sas_url }
  }

  const refreshVideoSas = async () => {
    const refreshed = await checkAndRefreshSas()
    if (refreshed) await syncGpsToCurrentPaths()
    return { sasUrl: video_sas_url }
  }

  const gpsFile = new File(Paths.cache, `sipat_gps_${rideId}.json`)
  try {
    gpsFile.create()
    gpsFile.write(JSON.stringify(gpsTrackingArray))
    gpsFileUri = gpsFile.uri
    await checkAndRefreshSas()
    await uploadBlobWithRetry(gps_sas_url, gpsFile.uri, 'application/json', {
      label: 'GPS',
      refreshSas: refreshGpsSas,
      onAttempt: (attempt, maxAttempts) => report('gps', attempt, maxAttempts, gpsTrackingArray.length),
    })
    gpsDone = true

    const videoFile = new File(videoUri)
    if (!videoFile.exists || videoFile.size === 0) {
      throw new Error(`Video file is empty or missing: ${videoUri}`)
    }
    console.log(`[upload] GPS points: ${gpsTrackingArray.length}, video bytes: ${videoFile.size}`)
    if (await checkAndRefreshSas()) await syncGpsToCurrentPaths()
    await uploadBlobWithRetry(video_sas_url, videoFile.uri, 'video/mp4', {
      label: 'Video',
      refreshSas: refreshVideoSas,
      onAttempt: (attempt, maxAttempts) => report('video', attempt, maxAttempts, gpsTrackingArray.length),
    })

    report('finishing', 1, 1, gpsTrackingArray.length)
    await completeUpload(rideId, videoPath, gpsPath, cameraMetadata)

    return {
      rideId,
      videoBucketPath: videoPath,
      gpsBucketPath: gpsPath,
    }
  } catch (error) {
    await abortUpload(videoPath, gpsPath)
    throw error
  } finally {
    try {
      if (gpsFile.exists) gpsFile.delete()
    } catch {
      // best-effort temp cleanup
    }
  }
}
