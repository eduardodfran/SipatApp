import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import * as Location from 'expo-location'
import { Ionicons } from '@expo/vector-icons'
import { savePendingPhoto } from '../lib/pendingPhotos'

type Props = {
  onDone: (postId?: string) => void
  onCancel: () => void
}

export default function PhotoCaptureScreen({ onDone, onCancel }: Props) {
  const [permission, requestPermission] = useCameraPermissions()
  const [photo, setPhoto] = useState<string | null>(null)
  const [caption, setCaption] = useState('')
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [saving, setSaving] = useState(false)
  const [capturing, setCapturing] = useState(false)
  const cameraRef = useRef<any>(null)
  const locationGranted = useRef(false)

  useEffect(() => {
    ;(async () => {
      const { status } = await Location.getForegroundPermissionsAsync()
      if (status === 'granted') {
        locationGranted.current = true
        return
      }
      const res = await Location.requestForegroundPermissionsAsync()
      locationGranted.current = res.status === 'granted'
    })()
  }, [])

  const takePicture = async () => {
    if (!cameraRef.current || capturing) return
    setCapturing(true)

    try {
      const photoPromise = cameraRef.current.takePictureAsync({ quality: 0.7 })

      let locPromise: Promise<{ lat: number; lng: number } | null> = Promise.resolve(null)
      if (locationGranted.current) {
        locPromise = Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
          .then((pos) => ({ lat: pos.coords.latitude, lng: pos.coords.longitude }))
          .catch(() => null)
      }

      const [result, loc] = await Promise.all([photoPromise, locPromise])

      setPhoto(result.uri)
      if (loc) setLocation(loc)
    } catch {
      Alert.alert('Error', 'Failed to capture photo.')
    } finally {
      setCapturing(false)
    }
  }

  const handleSavePending = async () => {
    if (!photo || saving) return
    setSaving(true)
    const post = {
      id: `photo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      imageUri: photo,
      caption,
      latitude: location?.lat ?? 0,
      longitude: location?.lng ?? 0,
      createdAt: Date.now(),
      status: 'pending' as const,
    }
    await savePendingPhoto(post)
    setSaving(false)
    onDone(post.id)
  }

  if (!permission) return <View />
  if (!permission.granted) {
    return (
      <View style={styles.permissionWrap}>
        <Ionicons name="camera-outline" size={48} color="#e6a817" />
        <Text style={styles.permissionTitle}>Camera Access Needed</Text>
        <Text style={styles.permissionSub}>Allow Sipat to access your camera to capture road distress</Text>
        <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
          <Text style={styles.permissionBtnText}>Grant Access</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onCancel}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (photo) {
    return (
      <View style={styles.container}>
        <View style={styles.previewHeader}>
          <TouchableOpacity style={styles.previewCloseBtn} onPress={() => { setPhoto(null); setCaption('') }}>
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.previewTitle}>Preview</Text>
          <View style={{ width: 38 }} />
        </View>
        <View style={styles.previewCaptionArea}>
          <TextInput
            style={styles.captionInput}
            placeholder="Add a caption..."
            placeholderTextColor="#52525b"
            value={caption}
            onChangeText={setCaption}
            multiline
            maxLength={280}
            autoFocus
          />
        </View>
        <View style={styles.previewImageWrap}>
          <Image source={{ uri: photo }} style={styles.preview} />
          {!location && (
            <View style={styles.locationBadge}>
              <Ionicons name="location-outline" size={12} color="#f59e0b" />
              <Text style={styles.locationText}>No location</Text>
            </View>
          )}
        </View>
        <View style={styles.previewActions}>
          <TouchableOpacity
            style={styles.retakeBtn}
            onPress={() => { setPhoto(null); setCaption(''); setLocation(null) }}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh" size={18} color="#fff" />
            <Text style={styles.retakeBtnText}>Retake</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSavePending}
            activeOpacity={0.7}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#0c0c14" />
            ) : (
              <Ionicons name="checkmark" size={18} color="#0c0c14" />
            )}
            <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save as Pending'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camera} facing="back">
        <View style={styles.cameraOverlay}>
          <TouchableOpacity style={styles.closeBtn} onPress={onCancel}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          <View style={styles.cameraBottom}>
            <View style={styles.viewfinder} />
            {capturing ? (
              <View style={styles.captureBtn}>
                <ActivityIndicator size="large" color="#e6a817" />
              </View>
            ) : (
              <TouchableOpacity style={styles.captureBtn} onPress={takePicture} activeOpacity={0.8}>
                <View style={styles.captureBtnInner} />
              </TouchableOpacity>
            )}
            <Text style={styles.cameraHint}>
              {capturing ? 'Capturing...' : 'Point at road distress and tap to capture'}
            </Text>
          </View>
        </View>
      </CameraView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0c0c14' },
  camera: { flex: 1 },
  cameraOverlay: { flex: 1, justifyContent: 'space-between' },
  closeBtn: {
    alignSelf: 'flex-end', margin: 20, marginTop: 56,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center',
  },
  cameraBottom: { alignItems: 'center', paddingBottom: 40 },
  viewfinder: {
    width: 200, height: 200, borderWidth: 2, borderColor: 'rgba(230,168,23,0.6)',
    borderRadius: 12, marginBottom: 24,
  },
  captureBtn: {
    width: 72, height: 72, borderRadius: 36, borderWidth: 4,
    borderColor: '#e6a817', justifyContent: 'center', alignItems: 'center',
  },
  captureBtnInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#e6a817' },
  cameraHint: { color: '#a1a1aa', fontSize: 13, marginTop: 12 },

  // Preview
  previewHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingBottom: 12, paddingHorizontal: 16,
    backgroundColor: '#0c0c14',
  },
  previewCloseBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.08)', justifyContent: 'center', alignItems: 'center',
  },
  previewTitle: { color: '#f0f0f0', fontSize: 16, fontWeight: '600' },
  previewCaptionArea: { paddingHorizontal: 16, paddingBottom: 12 },
  captionInput: {
    padding: 14, backgroundColor: '#141420', borderRadius: 12, color: '#f0f0f0',
    fontSize: 14, maxHeight: 100, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  previewImageWrap: { flex: 1, backgroundColor: '#000' },
  preview: { width: '100%', height: '100%', resizeMode: 'contain' },
  locationBadge: {
    position: 'absolute', bottom: 12, left: 12,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)', paddingVertical: 4, paddingHorizontal: 8,
    borderRadius: 6,
  },
  locationText: { color: '#f59e0b', fontSize: 11, fontWeight: '500' },
  previewActions: {
    flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingBottom: 40, paddingTop: 12,
    backgroundColor: '#0c0c14',
  },
  retakeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#27272a', borderRadius: 14, paddingVertical: 14,
  },
  retakeBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  saveBtn: {
    flex: 1.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#06b6d4', borderRadius: 14, paddingVertical: 14,
  },
  saveBtnText: { color: '#0c0c14', fontSize: 14, fontWeight: '700' },

  // Permission
  permissionWrap: {
    flex: 1, backgroundColor: '#0c0c14', justifyContent: 'center', alignItems: 'center', padding: 40,
  },
  permissionTitle: { color: '#f0f0f0', fontSize: 20, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  permissionSub: { color: '#6b7280', fontSize: 14, textAlign: 'center', marginBottom: 24 },
  permissionBtn: {
    backgroundColor: '#e6a817', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 32, marginBottom: 16,
  },
  permissionBtnText: { color: '#0c0c14', fontSize: 15, fontWeight: '700' },
  cancelText: { color: '#6b7280', fontSize: 14 },
})
