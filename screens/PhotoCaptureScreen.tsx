// SipatApp/screens/PhotoCaptureScreen.tsx

import { useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import * as Location from 'expo-location'
import { Ionicons } from '@expo/vector-icons'
import { uploadCommunityPhoto } from '../lib/uploadCommunityPhoto'

type Props = {
  userId: string
  onDone: () => void
  onCancel: () => void
}

export default function PhotoCaptureScreen({ userId, onDone, onCancel }: Props) {
  const [permission, requestPermission] = useCameraPermissions()
  const [photo, setPhoto] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
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

  const handleUpload = async () => {
    if (!photo || !location) return
    setUploading(true)
    try {
      await uploadCommunityPhoto(userId, photo, location.lat, location.lng)
      Alert.alert('Uploaded', 'Your photo has been submitted for review.', [
        { text: 'OK', onPress: onDone },
      ])
    } catch (e: any) {
      Alert.alert('Upload Failed', e.message)
    } finally {
      setUploading(false)
    }
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
        <Image source={{ uri: photo }} style={styles.preview} />
        {uploading ? (
          <View style={styles.uploadingWrap}>
            <ActivityIndicator size="large" color="#e6a817" />
            <Text style={styles.uploadingText}>Uploading...</Text>
          </View>
        ) : (
          <View style={styles.previewActions}>
            <TouchableOpacity style={styles.retakeBtn} onPress={() => setPhoto(null)}>
              <Ionicons name="refresh" size={20} color="#fff" />
              <Text style={styles.retakeBtnText}>Retake</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.uploadBtn} onPress={handleUpload}>
              <Ionicons name="cloud-upload" size={20} color="#0c0c14" />
              <Text style={styles.uploadBtnText}>Submit Photo</Text>
            </TouchableOpacity>
          </View>
        )}
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
  preview: { flex: 1, resizeMode: 'contain' },
  previewActions: {
    flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingBottom: 40,
  },
  retakeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#27272a', borderRadius: 14, paddingVertical: 14,
  },
  retakeBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  uploadBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#e6a817', borderRadius: 14, paddingVertical: 14,
  },
  uploadBtnText: { color: '#0c0c14', fontSize: 15, fontWeight: '700' },
  uploadingWrap: { alignItems: 'center', paddingBottom: 40 },
  uploadingText: { color: '#a1a1aa', fontSize: 14, marginTop: 12 },
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
