import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import * as Location from 'expo-location'
import { Audio } from 'expo-av'
import { File, Paths } from 'expo-file-system'
import { Accelerometer, Gyroscope } from 'expo-sensors'
import { Ionicons } from '@expo/vector-icons'
import type { Recording } from '../lib/types'

type Props = {
  onFinish: (recording: Recording) => void
  onCancel: () => void
  onViewRides: () => void
  segmentCount: number
  uploadResult?: { status: 'success' | 'error'; processStarted?: boolean; message?: string } | null
}

const SEGMENT_DURATION_MS = 300_000 // 5 minutes
const GAP_DURATION_MS = 1_500 // 1.5s gap between segments

export default function CameraScreen({ onFinish, onCancel, onViewRides, segmentCount, uploadResult }: Props) {
  const [permission, requestPermission] = useCameraPermissions()
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [segment, setSegment] = useState(1)
  const [status, setStatus] = useState<'idle' | 'recording' | 'waitingForNext' | 'waitingForGps' | 'uploading' | 'done' | 'error'>('idle')
  const [gpsActive, setGpsActive] = useState(false)
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null)
  const [gpsFresh, setGpsFresh] = useState(false)

  const cameraRef = useRef<any>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const segmentStartTime = useRef(0)
  const gpsLocations = useRef<Array<{ lat: number; lng: number; ts: number }>>([])
  const gpsSubRef = useRef<Location.LocationSubscription | null>(null)
  const accelSubRef = useRef<{ remove(): void } | null>(null)
  const gyroSubRef = useRef<{ remove(): void } | null>(null)
  const imuData = useRef<Array<{ ax: number; ay: number; az: number; gx: number; gy: number; gz: number; ts: number }>>([])
  const isCancelled = useRef(false)
  const stoppedManually = useRef(false)

  // Start GPS + IMU tracking
  useEffect(() => {
    ;(async () => {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('GPS Required', 'Location permission is needed for road hazard mapping.', [
          { text: 'Cancel', onPress: onCancel },
        ])
        return
      }

      setGpsActive(true)
      try {
        gpsSubRef.current = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: 2000 },
          (loc) => {
            setGpsAccuracy(loc.coords.accuracy)
            setGpsFresh(true)
            gpsLocations.current.push({
              lat: loc.coords.latitude,
              lng: loc.coords.longitude,
              ts: Date.now(),
            })
          }
        )
      } catch {
        Alert.alert('GPS Error', 'Failed to start GPS tracking. Recording will continue without GPS.')
      }

      // Start IMU sensors (accelerometer + gyroscope)
      Accelerometer.setUpdateInterval(100) // 10 Hz
      accelSubRef.current = Accelerometer.addListener((data) => {
        imuData.current.push({
          ax: data.x,
          ay: data.y,
          az: data.z,
          gx: 0,
          gy: 0,
          gz: 0,
          ts: Date.now(),
        })
      })

      Gyroscope.setUpdateInterval(100) // 10 Hz
      gyroSubRef.current = Gyroscope.addListener((data) => {
        const now = Date.now()
        const last = imuData.current[imuData.current.length - 1]
        if (last && now - last.ts < 50) {
          // Update gyro on existing entry (matched timestamp)
          last.gx = data.x
          last.gy = data.y
          last.gz = data.z
        } else {
          // No matching accel sample yet, create new entry
          imuData.current.push({ ax: 0, ay: 0, az: 0, gx: data.x, gy: data.y, gz: data.z, ts: now })
        }
      })
    })()

    return () => {
      gpsSubRef.current?.remove()
      accelSubRef.current?.remove()
      gyroSubRef.current?.remove()
    }
  }, [])

  // Mark GPS as stale after 15s without a fix
  useEffect(() => {
    const freshness = setInterval(() => {
      const last = gpsLocations.current[gpsLocations.current.length - 1]
      setGpsFresh(!!last && Date.now() - last.ts < 15_000)
    }, 5_000)
    return () => clearInterval(freshness)
  }, [])

  // Timer
  useEffect(() => {
    if (status === 'recording') {
      timerRef.current = setInterval(() => {
        setElapsed((prev) => {
          const segElapsed = Date.now() - segmentStartTime.current
          if (segElapsed >= SEGMENT_DURATION_MS) return SEGMENT_DURATION_MS / 1000
          return Math.floor(segElapsed / 1000)
        })
      }, 200)
    } else if (status === 'waitingForNext' || status === 'waitingForGps') {
      // Timer freezes during gap / GPS wait
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [status])

  const saveGpsToFile = async (startTime: number, endTime: number, segmentNum: number) => {
    const points = gpsLocations.current.filter((p) => p.ts >= startTime && p.ts <= endTime)
    const imuPoints = imuData.current.filter((p) => p.ts >= startTime && p.ts <= endTime)

    if (points.length === 0) {
      Alert.alert(
        'No GPS Data',
        `Segment ${segmentNum} recorded without GPS signal. It will still upload, but hazards in this segment cannot be mapped.`,
      )
    }

    const csvHeader = 'timestamp,latitude,longitude,accel_x,accel_y,accel_z,gyro_x,gyro_y,gyro_z\n'
    const csvRows = points.map((p) => {
      // Find closest IMU sample by timestamp
      let closest = imuPoints[0]
      let minDiff = Infinity
      for (const imu of imuPoints) {
        const diff = Math.abs(imu.ts - p.ts)
        if (diff < minDiff) {
          minDiff = diff
          closest = imu
        }
      }
      const imu = minDiff < 500 ? closest : null // 500ms tolerance
      const ax = imu ? imu.ax.toFixed(6) : '0'
      const ay = imu ? imu.ay.toFixed(6) : '0'
      const az = imu ? imu.az.toFixed(6) : '0'
      const gx = imu ? imu.gx.toFixed(6) : '0'
      const gy = imu ? imu.gy.toFixed(6) : '0'
      const gz = imu ? imu.gz.toFixed(6) : '0'
      return `${p.ts},${p.lat},${p.lng},${ax},${ay},${az},${gx},${gy},${gz}`
    }).join('\n')
    const fileName = `gps_segment_${segmentNum}_${Date.now()}.csv`
    const file = new File(Paths.document, fileName)
    file.create({ intermediates: true })
    file.write(csvHeader + csvRows)
    return file.uri
  }

  const acquireGpsFix = async (): Promise<{ lat: number; lng: number } | null> => {
    try {
      const fix = await Promise.race([
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 12_000)),
      ])
      if (!fix) return null
      return { lat: fix.coords.latitude, lng: fix.coords.longitude }
    } catch {
      return null
    }
  }

  const startRecording = async () => {
    if (!cameraRef.current) return

    // Request audio permission for video recording
    const audioPerm = await Audio.requestPermissionsAsync()
    if (!audioPerm.granted) {
      Alert.alert('Audio Required', 'Microphone permission is needed to record video with audio.', [
        { text: 'OK' },
      ])
      return
    }

    isCancelled.current = false
    stoppedManually.current = false
    const lastKnown = gpsLocations.current[gpsLocations.current.length - 1] ?? null
    const hadFreshFix = !!lastKnown && Date.now() - lastKnown.ts < 15_000
    segmentStartTime.current = Date.now()
    gpsLocations.current = []
    setElapsed(0)
    setSegment(1)
    setRecording(true)

    // GPS fix gate: wait for a fix before recording so the segment has data
    if (!hadFreshFix) {
      setStatus('waitingForGps')
      const fix = await acquireGpsFix()
      if (isCancelled.current) return
      if (fix) {
        gpsLocations.current.push({ ...fix, ts: segmentStartTime.current })
        setGpsFresh(true)
      } else {
        setRecording(false)
        setStatus('idle')
        Alert.alert(
          'No GPS Signal',
          'GPS is required to record road hazards. Please move to an open area and try again.',
          [{ text: 'OK' }],
        )
        return
      }
    } else {
      // Seed the last known fix so the segment never starts empty
      gpsLocations.current.push({ ...lastKnown, ts: segmentStartTime.current })
      setStatus('recording')
    }

    try {
      const video = await cameraRef.current.recordAsync({ maxDuration: SEGMENT_DURATION_MS / 1000 })
      if (isCancelled.current) return

      // Segment finished, save GPS
      const segEnd = segmentStartTime.current + SEGMENT_DURATION_MS
      const csvPath = await saveGpsToFile(segmentStartTime.current, segEnd, 1)

      const recording: Recording = {
        id: `rec_${Date.now()}`,
        videoUri: video.uri,
        csvUri: csvPath || '',
        timestamp: Date.now(),
        uploaded: false,
      }

      // Upload this segment immediately
      onFinish(recording)

      if (segmentCount > 1 && !stoppedManually.current) {
        // Gap before next segment
        setStatus('waitingForNext')
        setElapsed(SEGMENT_DURATION_MS / 1000)

        await new Promise((r) => setTimeout(r, GAP_DURATION_MS))
        if (stoppedManually.current) return

        startNextSegment(2)
      } else {
        setStatus('done')
      }
    } catch (e: any) {
      if (isCancelled.current) return
      console.error('Recording error:', e)
      Alert.alert('Recording Error', 'Failed to record video. Please try again.')
      setStatus('idle')
      setRecording(false)
    }
  }

  const startNextSegment = async (segNum: number) => {
    if (isCancelled.current) return

    // GPS gate: verify GPS is still available before starting next segment
    const lastKnown = gpsLocations.current[gpsLocations.current.length - 1] ?? null
    const hadFreshFix = !!lastKnown && Date.now() - lastKnown.ts < 15_000

    if (!hadFreshFix) {
      setStatus('waitingForGps')
      const fix = await acquireGpsFix()
      if (isCancelled.current) return
      if (fix) {
        gpsLocations.current.push({ ...fix, ts: Date.now() })
        setGpsFresh(true)
      } else {
        setStatus('idle')
        Alert.alert(
          'GPS Signal Lost',
          'GPS is required to continue recording. Segment recording stopped.',
          [{ text: 'OK' }],
        )
        return
      }
    }

    setSegment(segNum)
    setElapsed(0)
    segmentStartTime.current = Date.now()
    setStatus('recording')

    try {
      const video = await cameraRef.current.recordAsync({ maxDuration: SEGMENT_DURATION_MS / 1000 })
      if (isCancelled.current) return

      const segEnd = segmentStartTime.current + SEGMENT_DURATION_MS
      const csvPath = await saveGpsToFile(segmentStartTime.current, segEnd, segNum)

      const recording: Recording = {
        id: `rec_${Date.now()}`,
        videoUri: video.uri,
        csvUri: csvPath,
        timestamp: Date.now(),
        uploaded: false,
      }

      // Upload this segment immediately
      onFinish(recording)

      if (segNum < segmentCount && !stoppedManually.current) {
        setStatus('waitingForNext')
        setElapsed(SEGMENT_DURATION_MS / 1000)
        await new Promise((r) => setTimeout(r, GAP_DURATION_MS))
        if (stoppedManually.current) return
        startNextSegment(segNum + 1)
      } else {
        setStatus('done')
      }
    } catch (e: any) {
      if (isCancelled.current) return
      console.error('Recording error:', e)
      setStatus('idle')
      setRecording(false)
    }
  }

  const stopRecording = () => {
    stoppedManually.current = true
    if (cameraRef.current) {
      cameraRef.current.stopRecording()
    }
    setRecording(false)
    setStatus('uploading')
  }

  const handleCancel = () => {
    isCancelled.current = true
    if (cameraRef.current && recording) {
      cameraRef.current.stopRecording()
    }
    gpsSubRef.current?.remove()
    onCancel()
  }

  // Transition to done/error when uploadResult arrives
  useEffect(() => {
    if (status !== 'uploading') return
    if (uploadResult) {
      setStatus(uploadResult.status === 'success' ? 'done' : 'error')
    }
  }, [uploadResult, status])

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#06b6d4" />
      </View>
    )
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Ionicons name="camera-outline" size={64} color="#71717a" />
        <Text style={styles.permTitle}>Camera Access Required</Text>
        <Text style={styles.permSub}>Grant camera permission to record road hazards</Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelLink} onPress={handleCancel}>
          <Text style={styles.cancelLinkText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const progress = status === 'recording'
    ? (Date.now() - segmentStartTime.current) / SEGMENT_DURATION_MS
    : status === 'waitingForNext'
    ? 1
    : 0

  return (
    <View style={styles.container}>
      <CameraView style={styles.camera} ref={cameraRef} mode="video" videoQuality="720p">
        {/* Header overlay */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleCancel} style={styles.headerBtn}>
            <Ionicons name="close" size={24} color="#fafafa" />
          </TouchableOpacity>

          <View style={styles.segmentBadge}>
            <Text style={styles.segmentText}>
              Segment {segment}/{segmentCount}
            </Text>
          </View>

          <View style={[styles.gpsBadge, gpsFresh && styles.gpsActive]}>
            <View style={[styles.gpsDot, gpsFresh && styles.gpsDotActive]} />
            <Text style={styles.gpsText}>
              {gpsFresh
                ? `GPS${gpsAccuracy ? ` ${Math.round(gpsAccuracy)}m` : ''}`
                : 'GPS searching...'}
            </Text>
          </View>
        </View>

        {/* Timer */}
        {status !== 'idle' && (
          <View style={styles.timerContainer}>
            <Text style={styles.timer}>{formatTime(elapsed)}</Text>
            {status === 'waitingForNext' && (
              <Text style={styles.waitingText}>Preparing next segment...</Text>
            )}
            {status === 'waitingForGps' && (
              <Text style={styles.waitingText}>Waiting for GPS signal...</Text>
            )}
          </View>
        )}

        {/* Progress bar */}
        {status === 'recording' && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBarBg}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${Math.min(progress * 100, 100)}%` },
                ]}
              />
            </View>
          </View>
        )}

        {/* Controls */}
        <View style={styles.controls}>
          {status === 'idle' ? (
            <TouchableOpacity style={styles.recordBtn} onPress={startRecording}>
              <View style={styles.recordBtnOuter}>
                <View style={styles.recordBtnInner} />
              </View>
            </TouchableOpacity>
          ) : status === 'recording' ? (
            <TouchableOpacity style={styles.recordBtn} onPress={stopRecording}>
              <View style={styles.recordBtnOuter}>
                <View style={styles.stopBtn} />
              </View>
            </TouchableOpacity>
          ) : status === 'waitingForNext' || status === 'waitingForGps' ? (
            <View style={styles.recordBtn}>
              <ActivityIndicator size={28} color="#fafafa" />
            </View>
          ) : null}
        </View>

        {/* Uploading overlay */}
        {status === 'uploading' && (
          <View style={styles.uploadOverlay}>
            <View style={styles.uploadCard}>
              <ActivityIndicator size="large" color="#06b6d4" />
              <Text style={styles.uploadTitle}>Saving recording...</Text>
              <Text style={styles.uploadSub}>Please wait</Text>
            </View>
          </View>
        )}

        {/* Success card */}
        {status === 'done' && uploadResult?.status === 'success' && (
          <View style={styles.uploadOverlay}>
            <View style={styles.resultCard}>
              <View style={styles.successIcon}>
                <Ionicons name="checkmark" size={32} color="#22c55e" />
              </View>
              <Text style={styles.resultTitle}>Recording saved!</Text>
              <Text style={styles.resultSub}>
                {uploadResult.processStarted
                  ? 'Your ride is being processed.'
                  : 'Your ride was uploaded successfully.'}
              </Text>
              <TouchableOpacity style={styles.resultBtnPrimary} onPress={onViewRides}>
                <Ionicons name="car" size={18} color="#0c0c14" />
                <Text style={styles.resultBtnPrimaryText}>View Rides</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.resultBtnSecondary}
                onPress={() => {
                  setStatus('idle')
                  setElapsed(0)
                  setSegment(1)
                }}
              >
                <Text style={styles.resultBtnSecondaryText}>Record Again</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Error card */}
        {status === 'error' && (
          <View style={styles.uploadOverlay}>
            <View style={styles.resultCard}>
              <View style={styles.errorIcon}>
                <Ionicons name="close" size={32} color="#ef4444" />
              </View>
              <Text style={styles.resultTitle}>Upload failed</Text>
              <Text style={styles.resultSub}>{uploadResult?.message ?? 'Something went wrong.'}</Text>
              <TouchableOpacity
                style={styles.resultBtnPrimary}
                onPress={() => {
                  setStatus('idle')
                  setElapsed(0)
                  setSegment(1)
                }}
              >
                <Ionicons name="refresh" size={18} color="#0c0c14" />
                <Text style={styles.resultBtnPrimaryText}>Try Again</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.resultBtnSecondary} onPress={handleCancel}>
                <Text style={styles.resultBtnSecondaryText}>Discard</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </CameraView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  center: {
    flex: 1,
    backgroundColor: '#0c0c14',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  camera: {
    flex: 1,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 48,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  headerBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  segmentBadge: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  segmentText: {
    color: '#fafafa',
    fontSize: 13,
    fontWeight: '600',
  },
  gpsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  gpsActive: {
    backgroundColor: 'rgba(34,197,94,0.2)',
  },
  gpsDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#71717a',
  },
  gpsDotActive: {
    backgroundColor: '#22c55e',
  },
  gpsText: {
    color: '#fafafa',
    fontSize: 12,
    fontWeight: '600',
  },
  timerContainer: {
    position: 'absolute',
    top: '40%',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  timer: {
    color: '#fafafa',
    fontSize: 48,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  waitingText: {
    color: '#f59e0b',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
  progressContainer: {
    position: 'absolute',
    bottom: 120,
    left: 32,
    right: 32,
  },
  progressBarBg: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 4,
    backgroundColor: '#ef4444',
    borderRadius: 2,
  },
  controls: {
    position: 'absolute',
    bottom: 48,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  recordBtn: {
    width: 72,
    height: 72,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordBtnOuter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#fafafa',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordBtnInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#ef4444',
  },
  stopBtn: {
    width: 24,
    height: 24,
    borderRadius: 4,
    backgroundColor: '#fafafa',
  },
  permTitle: {
    color: '#fafafa',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
  },
  permSub: {
    color: '#71717a',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  permBtn: {
    marginTop: 24,
    backgroundColor: '#06b6d4',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  permBtnText: {
    color: '#0c0c14',
    fontSize: 15,
    fontWeight: '700',
  },
  cancelLink: {
    marginTop: 16,
  },
  cancelLinkText: {
    color: '#71717a',
    fontSize: 14,
  },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadCard: {
    backgroundColor: '#1c1c1e',
    borderRadius: 20,
    paddingHorizontal: 40,
    paddingVertical: 36,
    alignItems: 'center',
    gap: 12,
  },
  uploadTitle: {
    color: '#fafafa',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 8,
  },
  uploadSub: {
    color: '#71717a',
    fontSize: 14,
  },
  resultCard: {
    backgroundColor: '#1c1c1e',
    borderRadius: 20,
    paddingHorizontal: 32,
    paddingVertical: 36,
    alignItems: 'center',
    gap: 8,
    width: 280,
  },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(34,197,94,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  errorIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(239,68,68,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  resultTitle: {
    color: '#fafafa',
    fontSize: 20,
    fontWeight: '700',
    marginTop: 4,
  },
  resultSub: {
    color: '#a1a1aa',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
  },
  resultBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#06b6d4',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 24,
    width: '100%',
    justifyContent: 'center',
    marginTop: 4,
  },
  resultBtnPrimaryText: {
    color: '#0c0c14',
    fontSize: 15,
    fontWeight: '700',
  },
  resultBtnSecondary: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 4,
  },
  resultBtnSecondaryText: {
    color: '#71717a',
    fontSize: 14,
    fontWeight: '600',
  },
})
