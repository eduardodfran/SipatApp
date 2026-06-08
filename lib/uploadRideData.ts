import { File, Paths } from 'expo-file-system'
import { fetch } from 'expo/fetch'
import { supabase } from './supabase'
import { FASTAPI_URL } from './env'

export type GpsTrackingPoint = {
  lat: number
  lng: number
  timestamp_seconds: number
}

type RideUploadResult = {
  rideId: string
  videoBucketPath: string
  gpsBucketPath: string
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
    throw new Error('CSV file must contain a header and at least one data row')
  }

  const header = lines[0].split(',').map((column) => column.trim())
  const timestampIndex = header.indexOf('timestamp')
  const latitudeIndex = header.indexOf('latitude')
  const longitudeIndex = header.indexOf('longitude')

  if (timestampIndex < 0 || latitudeIndex < 0 || longitudeIndex < 0) {
    throw new Error(
      'CSV file must include timestamp, latitude, and longitude columns',
    )
  }

  return lines.slice(1).map((line, index) => {
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
      timestamp_seconds: timestamp,
      lat: latitude,
      lng: longitude,
    }
  })
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
  const response = await fetch(`${FASTAPI_URL}/upload/init`, {
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

export type MyRide = {
  id: string
  user_id: string
  video_bucket_path: string
  gps_bucket_path: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  error_log: string | null
  created_at: string
}

export async function fetchMyRides(): Promise<MyRide[]> {
  const token = await getAccessToken()
  const response = await fetch(`${FASTAPI_URL}/rides`, {
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
  const response = await fetch(`${FASTAPI_URL}/process/${rideId}`, {
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

async function uploadBlob(sasUrl: string, file: File) {
  const response = await fetch(sasUrl, {
    method: 'PUT',
    headers: {
      'x-ms-blob-type': 'BlockBlob',
    },
    body: file,
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`Upload failed (${response.status}): ${text}`)
  }
}

async function completeUpload(
  rideId: string,
  videoPath: string,
  gpsPath: string,
) {
  const token = await getAccessToken()
  const response = await fetch(`${FASTAPI_URL}/upload/complete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      ride_id: rideId,
      video_path: videoPath,
      gps_path: gpsPath,
    }),
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
    await fetch(`${FASTAPI_URL}/upload/abort`, {
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

  const rideId = generateRideId()
  const videoFilename = `${rideId}.mp4`
  const gpsFilename = `${rideId}.json`

  const gpsTrackingArray = await csvUriToGpsTrackingArray(csvUri)
  if (gpsTrackingArray.length === 0) {
    throw new Error('CSV file must contain at least one GPS row')
  }

  const { video_sas_url, gps_sas_url, video_path, gps_path } = await initUpload(
    videoFilename,
    gpsFilename,
  )

  let videoPath = video_path
  let gpsPath = gps_path

  try {
    const gpsFile = new File(Paths.cache, `sipat_gps_${rideId}.json`)
    gpsFile.create()
    gpsFile.write(JSON.stringify(gpsTrackingArray))
    await uploadBlob(gps_sas_url, gpsFile)
    gpsFile.delete()

    const videoFile = new File(videoUri)
    if (!videoFile.exists || videoFile.size === 0) {
      throw new Error(`Video file is empty or missing: ${videoUri}`)
    }
    await uploadBlob(video_sas_url, videoFile)

    await completeUpload(rideId, videoPath, gpsPath)

    return {
      rideId,
      videoBucketPath: videoPath,
      gpsBucketPath: gpsPath,
    }
  } catch (error) {
    await abortUpload(videoPath, gpsPath)
    throw error
  }
}
