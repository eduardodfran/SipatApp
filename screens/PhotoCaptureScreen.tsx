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
import { colors, fonts, radius, spacing } from '../theme/tokens'

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
  const [saved, setSaved] = useState(false)
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
    setSaved(true)
    setTimeout(() => onDone(post.id), 2500)
  }

  if (!permission) return <View />
  if (!permission.granted) {
    return (
      <View style={styles.permissionWrap}>
        <Ionicons name="camera-outline" size={48} color={colors.signal} />
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
        {saved && (
          <View style={styles.successBanner}>
            <Ionicons name="checkmark-circle" size={18} color={colors.textPrimary} />
            <Text style={styles.successBannerText}>Photo saved! Go to Feed to upload.</Text>
          </View>
        )}
        <View style={styles.previewHeader}>
          <TouchableOpacity style={styles.previewCloseBtn} onPress={() => { setPhoto(null); setCaption('') }}>
            <Ionicons name="close" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.previewTitle}>Preview</Text>
          <View style={{ width: 38 }} />
        </View>
        <View style={styles.previewCaptionArea}>
          <TextInput
            style={styles.captionInput}
            placeholder="Add a caption..."
            placeholderTextColor={colors.textMuted}
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
              <Ionicons name="location-outline" size={12} color={colors.moderate} />
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
            <Ionicons name="refresh" size={18} color={colors.textPrimary} />
            <Text style={styles.retakeBtnText}>Retake</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSavePending}
            activeOpacity={0.7}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.onSignal} />
            ) : (
              <Ionicons name="checkmark" size={18} color={colors.onSignal} />
            )}
            <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save as Pending'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camera} facing="back" zoom={0} />
        <View style={styles.cameraOverlay}>
          <TouchableOpacity style={styles.closeBtn} onPress={onCancel}>
            <Ionicons name="close" size={28} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.cameraBottom}>
            <View style={styles.viewfinder} />
            {capturing ? (
              <View style={styles.captureBtn}>
                <ActivityIndicator size="large" color={colors.signal} />
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
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  camera: { flex: 1 },
  cameraOverlay: { ...StyleSheet.absoluteFill, justifyContent: 'space-between' },
  closeBtn: {
    alignSelf: 'flex-end', margin: 20, marginTop: 56,
    width: 40, height: 40, borderRadius: radius.pill,
    backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center',
  },
  cameraBottom: { alignItems: 'center', paddingBottom: 40 },
  viewfinder: {
    width: 200, height: 200, borderWidth: 2, borderColor: 'rgba(6, 182, 212,0.6)',
    borderRadius: radius.md, marginBottom: spacing.xl,
  },
  captureBtn: {
    width: 72, height: 72, borderRadius: radius.pill, borderWidth: 4,
    borderColor: colors.signal, justifyContent: 'center', alignItems: 'center',
  },
  captureBtnInner: { width: 58, height: 58, borderRadius: radius.pill, backgroundColor: colors.signal },
  cameraHint: { color: colors.textSecondary, fontFamily: fonts.regular, fontSize: 13, marginTop: spacing.md },

  // Preview
  previewHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingBottom: spacing.md, paddingHorizontal: spacing.lg,
    backgroundColor: colors.background,
  },
  previewCloseBtn: {
    width: 38, height: 38, borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.08)', justifyContent: 'center', alignItems: 'center',
  },
  previewTitle: { color: colors.textPrimary, fontFamily: fonts.semibold, fontSize: 16 },
  successBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.minor, paddingHorizontal: spacing.lg, paddingTop: 56, paddingBottom: spacing.md,
  },
  successBannerText: { color: colors.textPrimary, fontFamily: fonts.semibold, fontSize: 14 },
  previewCaptionArea: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  captionInput: {
    padding: 14, backgroundColor: colors.surfaceRaised, borderRadius: radius.md, color: colors.textPrimary,
    fontFamily: fonts.regular, fontSize: 14, maxHeight: 100, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  previewImageWrap: { flex: 1, backgroundColor: colors.background },
  preview: { width: '100%', height: '100%', resizeMode: 'contain' },
  locationBadge: {
    position: 'absolute', bottom: 12, left: 12,
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    backgroundColor: 'rgba(0,0,0,0.6)', paddingVertical: spacing.xs, paddingHorizontal: spacing.sm,
    borderRadius: 6,
  },
  locationText: { color: colors.moderate, fontFamily: fonts.medium, fontSize: 11 },
  previewActions: {
    flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: 40, paddingTop: spacing.md,
    backgroundColor: colors.background,
  },
  retakeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.surfaceRaised, borderRadius: radius.md, paddingVertical: 14,
  },
  retakeBtnText: { color: colors.textPrimary, fontFamily: fonts.semibold, fontSize: 14 },
  saveBtn: {
    flex: 1.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.signal, borderRadius: radius.md, paddingVertical: 14,
  },
  saveBtnText: { color: colors.onSignal, fontFamily: fonts.bold, fontSize: 14 },

  // Permission
  permissionWrap: {
    flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', padding: 40,
  },
  permissionTitle: { color: colors.textPrimary, fontFamily: fonts.bold, fontSize: 20, marginTop: spacing.lg, marginBottom: spacing.sm },
  permissionSub: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 14, textAlign: 'center', marginBottom: spacing.xl },
  permissionBtn: {
    backgroundColor: colors.signal, borderRadius: radius.md, paddingVertical: spacing.md, paddingHorizontal: spacing.xxl, marginBottom: spacing.lg,
  },
  permissionBtnText: { color: colors.onSignal, fontFamily: fonts.bold, fontSize: 15 },
  cancelText: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 14 },
})
