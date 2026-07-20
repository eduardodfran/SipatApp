import { useEffect, useRef, useState } from 'react'
import {
  Alert,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera'
import * as Location from 'expo-location'
import { File, Paths } from 'expo-file-system'
import { Ionicons } from '@expo/vector-icons'
import type { Recording } from '../lib/types'

type Props = {
  onFinish: (recording: Recording) => void
  onCancel: () => void
}

function gpsStatus(accuracy: number | null): { label: string; color: string } {
  if (accuracy === null) return { label: 'No GPS', color: '#dc2626' }
  if (accuracy <= 10) return { label: 'GPS', color: '#22c55e' }
  if (accuracy <= 30) return { label: 'GPS', color: '#4ade80' }
  if (accuracy <= 100) return { label: 'GPS', color: '#f59e0b' }
  return { label: 'GPS', color: '#f97316' }
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function CameraScreen({ onFinish, onCancel }: Props) {
  const [permission, requestPermission] = useCameraPermissions()
  const [micPerm, requestMicPermission] = useMicrophonePermissions()
  const [recording, setRecording] = useState(false)
  const [videoUri, setVideoUri] = useState<string | null>(null)
  const [gpsCount, setGpsCount] = useState(0)
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null)
  const [elapsed, setElapsed] = useState(0)

  const [recordingGpsCount, setRecordingGpsCount] = useState(0)

  const cameraRef = useRef<CameraView>(null)
  const gpsDataRef = useRef<Location.LocationObject[]>([])
  const locationSubRef = useRef<Location.LocationSubscription | null>(null)
  const recordingRef = useRef(false)
  const recordingStartTimeRef = useRef<number | null>(null)
  const lastPreRecordPointRef = useRef<Location.LocationObject | null>(null)

  useEffect(() => {
    ;(async () => {
      const locPerm = await Location.requestForegroundPermissionsAsync()
      if (!locPerm.granted) return

      const sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 1000, distanceInterval: 1 },
        (loc) => {
          gpsDataRef.current.push(loc)
          lastPreRecordPointRef.current = loc
          setGpsCount(gpsDataRef.current.length)
          if (recordingRef.current) {
            setRecordingGpsCount((c) => c + 1)
          }
          if (loc.coords.accuracy != null) setGpsAccuracy(loc.coords.accuracy)
        },
      )
      locationSubRef.current = sub
    })()

    return () => {
      locationSubRef.current?.remove()
    }
  }, [])

  useEffect(() => {
    recordingRef.current = recording
    if (!recording) { setElapsed(0); return }
    const interval = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => clearInterval(interval)
  }, [recording])

  if (!permission || !micPerm) return null
  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>Camera permission required</Text>
        <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
          <Text style={styles.permissionBtnText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    )
  }
  if (!micPerm.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>Microphone permission required for video recording</Text>
        <TouchableOpacity style={styles.permissionBtn} onPress={requestMicPermission}>
          <Text style={styles.permissionBtnText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const startRecording = async () => {
    if (!cameraRef.current) return

    recordingStartTimeRef.current = Date.now()
    setRecordingGpsCount(0)
    setRecording(true)

    try {
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
        .then((loc) => { gpsDataRef.current.push(loc); setGpsCount(gpsDataRef.current.length) })
        .catch(() => {})
    } catch {}

    try {
      const result = await cameraRef.current.recordAsync({
        maxDuration: 300,
      })
      if (result?.uri) {
        setVideoUri(result.uri)
      }
    } catch (err: any) {
      if (!recordingRef.current) return
      Alert.alert('Recording failed', err?.message ?? 'Unknown error')
    }
    setRecording(false)
  }

  const stopRecording = () => {
    cameraRef.current?.stopRecording()
    setRecording(false)
  }

  const saveRecording = async () => {
    if (!videoUri) return

    if (gpsDataRef.current.length === 0) {
      Alert.alert('No GPS Data', 'No GPS points were recorded. Try again with a clear sky view or outdoors.')
      return
    }

    try {
      const startTime = recordingStartTimeRef.current!
      let gpsPoints = gpsDataRef.current
        .filter((loc) => loc.timestamp >= startTime)
        .map((loc) => ({
          lat: loc.coords.latitude,
          lng: loc.coords.longitude,
          timestamp_seconds: (loc.timestamp - startTime) / 1000,
        }))

      if (gpsPoints.length === 0 && lastPreRecordPointRef.current) {
        const loc = lastPreRecordPointRef.current
        gpsPoints = [{
          lat: loc.coords.latitude,
          lng: loc.coords.longitude,
          timestamp_seconds: 0,
        }]
      }

      if (gpsPoints.length === 0) {
        Alert.alert('No GPS Data', 'No GPS points were recorded. Try again with a clear sky view or outdoors.')
        return
      }

      const csvHeader = 'timestamp,latitude,longitude'
      const csvRows = gpsPoints.map(
        (p) => `${p.timestamp_seconds},${p.lat},${p.lng}`,
      )
      const csvContent = [csvHeader, ...csvRows].join('\n')

      const id = `rec_${Date.now()}`
      const csvFile = new File(Paths.cache, `${id}.csv`)
      csvFile.create()
      csvFile.write(csvContent)
      onFinish({
        id,
        videoUri,
        csvUri: csvFile.uri,
        timestamp: Date.now(),
        uploaded: false,
      })
    } catch (err: any) {
      Alert.alert('Save failed', err?.message ?? 'Error saving recording')
    }
  }

  const discardRecording = () => {
    setVideoUri(null)
  }

  if (videoUri) {
    return (
      <View style={styles.container}>
        <View style={styles.previewOverlay}>
          <View style={styles.previewIcon}>
            <Ionicons name="checkmark-circle" size={72} color="#22c55e" />
          </View>
          <Text style={styles.previewTitle}>Recording Complete</Text>
          <View style={styles.previewStats}>
            <View style={styles.previewStatItem}>
              <Ionicons name="time-outline" size={16} color="#6b7280" />
              <Text style={styles.previewStatText}>{formatTime(elapsed)}</Text>
            </View>
            <View style={styles.previewStatDot} />
            <View style={styles.previewStatItem}>
              <Ionicons name="locate" size={16} color="#6b7280" />
              <Text style={styles.previewStatText}>{recordingGpsCount} pts</Text>
            </View>
          </View>
          <View style={styles.previewActions}>
            <TouchableOpacity
              style={[styles.previewBtn, styles.discardBtn]}
              onPress={discardRecording}
            >
              <Ionicons name="trash-outline" size={18} color="#dc2626" />
              <Text style={styles.discardBtnText}>Discard</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.previewBtn, styles.saveBtn]}
              onPress={saveRecording}
            >
              <Ionicons name="checkmark-outline" size={18} color="#0c0c14" />
              <Text style={styles.saveBtnText}>Save Ride</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    )
  }

  const gps = gpsStatus(gpsAccuracy)

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        mode="video"
        videoQuality="1080p"
        videoStabilizationMode="auto"
      />
      <View style={styles.cameraOverlay}>
        <View style={styles.topRow}>
          <TouchableOpacity style={styles.topBtn} onPress={onCancel}>
            <Ionicons name="close" size={26} color="#f0f0f0" />
          </TouchableOpacity>

          <View style={[styles.gpsBadge, { borderColor: gps.color }]}>
            <View style={[styles.gpsDot, { backgroundColor: gps.color }]} />
            <Ionicons name="locate" size={13} color={gps.color} />
            <Text style={[styles.gpsLabel, { color: gps.color }]}>{gps.label}</Text>
            {gpsAccuracy != null && (
              <Text style={styles.gpsAccuracy}>{Math.round(gpsAccuracy)}m</Text>
            )}
            {gpsCount > 0 && (
              <Text style={styles.gpsCount}>{gpsCount}pts</Text>
            )}
          </View>
        </View>

        <View style={styles.bottomSection}>
          {recording && (
            <View style={styles.recordingBadge}>
              <View style={styles.recordingDot} />
              <Text style={styles.elapsedText}>{formatTime(elapsed)}</Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.recordBtn}
            onPress={recording ? stopRecording : startRecording}
            activeOpacity={0.8}
          >
            <View
              style={[
                styles.recordInner,
                recording && styles.recordInnerActive,
              ]}
            />
          </TouchableOpacity>

          {recording && (
            <View style={styles.gpsCountBadge}>
              <Ionicons name="locate" size={14} color="#22c55e" />
              <Text style={styles.gpsCountText}>{recordingGpsCount} GPS</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 48,
  },
  topBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gpsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1,
  },
  gpsDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  gpsLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  gpsAccuracy: {
    fontSize: 11,
    color: '#aaa',
    fontWeight: '500',
  },
  gpsCount: {
    fontSize: 11,
    color: '#f0f0f0',
    fontWeight: '600',
    marginLeft: 2,
  },
  recordingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#dc2626',
  },
  elapsedText: {
    color: '#f0f0f0',
    fontSize: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  bottomSection: {
    alignItems: 'center',
    paddingBottom: Platform.OS === 'ios' ? 50 : 36,
    gap: 14,
  },
  recordBtn: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#dc2626',
  },
  recordInnerActive: {
    width: 30,
    height: 30,
    borderRadius: 5,
    backgroundColor: '#dc2626',
  },
  gpsCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
  },
  gpsCountText: {
    color: '#f0f0f0',
    fontSize: 13,
    fontWeight: '600',
  },
  permissionText: {
    color: '#f0f0f0',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 40,
  },
  permissionBtn: {
    backgroundColor: '#e6a817',
    padding: 16,
    borderRadius: 12,
    margin: 40,
    alignItems: 'center',
  },
  permissionBtnText: {
    color: '#0c0c14',
    fontWeight: '700',
    fontSize: 16,
  },
  previewOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#0c0c14',
  },
  previewIcon: {
    marginBottom: 8,
  },
  previewTitle: {
    color: '#f0f0f0',
    fontSize: 24,
    fontWeight: '700',
  },
  previewStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
  },
  previewStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  previewStatText: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '500',
  },
  previewStatDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#374151',
  },
  previewActions: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 40,
  },
  previewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
  },
  discardBtn: {
    backgroundColor: 'rgba(222, 38, 38, 0.1)',
  },
  discardBtnText: {
    color: '#dc2626',
    fontSize: 15,
    fontWeight: '700',
  },
  saveBtn: {
    backgroundColor: '#e6a817',
  },
  saveBtnText: {
    color: '#0c0c14',
    fontSize: 15,
    fontWeight: '700',
  },
})
