import { useRef, useState } from 'react'
import {
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
  const cameraRef = useRef<any>(null)

  const takePicture = async () => {
    if (!cameraRef.current) return

    const { status } = await Location.requestForegroundPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Location Required', 'We need your location to map the distress.')
      return
    }
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
    setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })

    const result = await cameraRef.current.takePictureAsync({ quality: 0.8 })
    setPhoto(result.uri)
  }

  const handleSavePending = async () => {
    if (!photo || !location) return
    const post = {
      id: `photo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      imageUri: photo,
      caption,
      latitude: location.lat,
      longitude: location.lng,
      createdAt: Date.now(),
      status: 'pending' as const,
    }
    await savePendingPhoto(post)
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
        <View style={styles.previewTop}>
          <Image source={{ uri: photo }} style={styles.preview} />
          <TextInput
            style={styles.captionInput}
            placeholder="Add a caption..."
            placeholderTextColor="#52525b"
            value={caption}
            onChangeText={setCaption}
            multiline
            maxLength={280}
          />
        </View>
        <View style={styles.previewActions}>
          <TouchableOpacity style={styles.retakeBtn} onPress={() => { setPhoto(null); setCaption('') }}>
            <Ionicons name="refresh" size={20} color="#fff" />
            <Text style={styles.retakeBtnText}>Retake</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.saveBtn} onPress={handleSavePending}>
            <Ionicons name="save" size={20} color="#0c0c14" />
            <Text style={styles.saveBtnText}>Save as Pending</Text>
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
            <TouchableOpacity style={styles.captureBtn} onPress={takePicture}>
              <View style={styles.captureBtnInner} />
            </TouchableOpacity>
            <Text style={styles.cameraHint}>Point at road distress and tap to capture</Text>
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
  previewTop: { flex: 1 },
  preview: { flex: 1, resizeMode: 'contain' },
  captionInput: {
    marginHorizontal: 16, marginTop: 12, padding: 12,
    backgroundColor: '#141420', borderRadius: 12, color: '#f0f0f0',
    fontSize: 14, maxHeight: 80, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  previewActions: {
    flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 16,
  },
  retakeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#27272a', borderRadius: 14, paddingVertical: 14,
  },
  retakeBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  saveBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#06b6d4', borderRadius: 14, paddingVertical: 14,
  },
  saveBtnText: { color: '#0c0c14', fontSize: 15, fontWeight: '700' },
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
