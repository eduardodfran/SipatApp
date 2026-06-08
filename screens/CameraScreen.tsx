import { useRef, useState } from 'react'
import {
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import * as Location from 'expo-location'
import { Ionicons } from '@expo/vector-icons'
import type { Recording } from '../lib/types'

type Props = {
  onFinish: (recording: Recording) => void
  onCancel: () => void
}

export default function CameraScreen({ onFinish, onCancel }: Props) {
  const [permission, requestPermission] = useCameraPermissions()
  const [recording, setRecording] = useState(false)
  const [videoUri, setVideoUri] = useState<string | null>(null)
  const cameraRef = useRef<CameraView>(null)
  const gpsDataRef = useRef<Location.LocationObject[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  if (!permission) return null
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

  const startRecording = async () => {
    const locPerm = await Location.requestForegroundPermissionsAsync()
    if (!locPerm.granted) {
      Alert.alert('Location Required', 'GPS data is needed for processing.')
      return
    }

    if (!cameraRef.current) return
    gpsDataRef.current = []

    timerRef.current = setInterval(async () => {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      })
      gpsDataRef.current.push(loc)
    }, 1000)

    try {
      const result = await cameraRef.current.recordAsync({
        maxDuration: 300,
        quality: '720p',
      })
      if (result?.uri) {
        setVideoUri(result.uri)
      }
    } catch (err: any) {
      Alert.alert('Recording failed', err?.message ?? 'Unknown error')
    }
    setRecording(false)
    if (timerRef.current) clearInterval(timerRef.current)
  }

  const stopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    cameraRef.current?.stopRecording()
    setRecording(false)
  }

  const saveRecording = async () => {
    if (!videoUri) return

    try {
      const gpsPoints = gpsDataRef.current.map((loc, idx) => ({
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
        timestamp_seconds: idx,
      }))

      const csvHeader = 'timestamp_seconds,latitude,longitude'
      const csvRows = gpsPoints.map(
        (p) => `${p.timestamp_seconds},${p.lat},${p.lng}`,
      )
      const csvContent = [csvHeader, ...csvRows].join('\n')

      const id = `rec_${Date.now()}`
      onFinish({
        id,
        videoUri,
        csvUri: `data:text/csv;base64,${btoa(csvContent)}`,
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
          <Ionicons name="checkmark-circle" size={64} color="#4caf50" />
          <Text style={styles.previewTitle}>Recording Complete</Text>
          <Text style={styles.previewSub}>
            {gpsDataRef.current.length} GPS points collected
          </Text>
          <View style={styles.previewActions}>
            <TouchableOpacity
              style={[styles.previewBtn, styles.discardBtn]}
              onPress={discardRecording}
            >
              <Ionicons name="trash-outline" size={18} color="#ff4444" />
              <Text style={[styles.previewBtnText, { color: '#ff4444' }]}>
                Discard
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.previewBtn, styles.saveBtn]}
              onPress={saveRecording}
            >
              <Ionicons name="checkmark-outline" size={18} color="#fff" />
              <Text style={[styles.previewBtnText, { color: '#fff' }]}>
                Save Ride
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        mode="video"
        videoQuality="720p"
        audio={false}
      >
        <View style={styles.cameraOverlay}>
          <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>

          <View style={styles.bottomRow}>
            <View style={styles.timerBadge}>
              <Ionicons
                name={recording ? 'radio-button-on' : 'radio-button-off'}
                size={14}
                color={recording ? '#ff4444' : '#888'}
              />
              <Text style={styles.timerText}>
                {recording ? 'Recording...' : 'Ready'}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.recordBtn}
              onPress={recording ? stopRecording : startRecording}
            >
              <View
                style={[
                  styles.recordInner,
                  recording && styles.recordInnerActive,
                ]}
              />
            </TouchableOpacity>

            <View style={{ width: 60 }} />
          </View>
        </View>
      </CameraView>
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
    flex: 1,
    justifyContent: 'space-between',
    padding: 24,
    paddingTop: 60,
  },
  cancelBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 40,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
  },
  timerText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  recordBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#ff4444',
  },
  recordInnerActive: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#ff4444',
  },
  permissionText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 40,
  },
  permissionBtn: {
    backgroundColor: '#4363d8',
    padding: 16,
    borderRadius: 12,
    margin: 40,
    alignItems: 'center',
  },
  permissionBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  previewOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  previewTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    marginTop: 16,
  },
  previewSub: {
    color: '#888',
    fontSize: 14,
    marginTop: 4,
  },
  previewActions: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 32,
  },
  previewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
  },
  discardBtn: {
    backgroundColor: 'rgba(255,68,68,0.1)',
  },
  saveBtn: {
    backgroundColor: '#4363d8',
  },
  previewBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
})
