import 'react-native-url-polyfill/auto'
import 'react-native-get-random-values'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, Platform, Text, TouchableOpacity, View } from 'react-native'
import { User } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { fetchFastApi, resetFastApiPreference } from './lib/fastapi'
import LoginScreen from './screens/LoginScreen'
import DashboardScreen from './screens/DashboardScreen'
import CameraScreen from './screens/CameraScreen'
import MapVerificationScreen from './screens/MapVerificationScreen'
import type { Recording } from './lib/types'
import { FASTAPI_URL } from './lib/env'
import { fetchMyRides, triggerProcessing, uploadRideData } from './lib/uploadRideData'

type Screen = 'login' | 'dashboard' | 'camera' | 'map'

export default function App() {
  const [screen, setScreen] = useState<Screen | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user ?? null
      setUser(u)
      setScreen(u ? 'dashboard' : 'login')
    })
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const u = session?.user ?? null
        setUser(u)
        setScreen(u ? 'dashboard' : 'login')
      },
    )
    return () => listener?.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!user) return
    ;(async () => {
      try {
        const rides = await fetchMyRides()
        const serverRecordings: Recording[] = rides.map((r) => ({
          id: r.id,
          rideId: r.id,
          videoUri: r.video_bucket_path,
          csvUri: r.gps_bucket_path,
          timestamp: new Date(r.created_at).getTime(),
          uploaded: true,
          status: r.status,
          errorLog: r.error_log ?? undefined,
          storagePaths: { video: r.video_bucket_path, gps: r.gps_bucket_path },
        }))
        setRecordings((prev) => {
          const local = prev.filter((r) => !r.uploaded)
          return [...serverRecordings, ...local]
        })
      } catch {
        // silently fail — user can pull-to-refresh later
      }
    })()
  }, [user])

  // Poll for status updates while any ride is processing
  const pollInterval = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    const hasProcessing = recordings.some((r) => r.status === 'processing')
    if (hasProcessing && !pollInterval.current) {
      pollInterval.current = setInterval(async () => {
        try {
          const rides = await fetchMyRides()
          setRecordings((prev) =>
            prev.map((r) => {
              if (!r.uploaded) return r
              const updated = rides.find((s) => s.id === r.rideId)
              if (!updated || updated.status === r.status) return r
              return { ...r, status: updated.status, errorLog: updated.error_log ?? undefined }
            }),
          )
        } catch {
          // keep current state on error
        }
      }, 4000)
    }
    if (!hasProcessing && pollInterval.current) {
      clearInterval(pollInterval.current)
      pollInterval.current = null
    }
    return () => {
      if (pollInterval.current) {
        clearInterval(pollInterval.current)
        pollInterval.current = null
      }
    }
  }, [recordings])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    resetFastApiPreference()
    try {
      const rides = await fetchMyRides()
      const serverRecordings: Recording[] = rides.map((r) => ({
        id: r.id,
        rideId: r.id,
        videoUri: r.video_bucket_path,
        csvUri: r.gps_bucket_path,
        timestamp: new Date(r.created_at).getTime(),
        uploaded: true,
        status: r.status,
        errorLog: r.error_log ?? undefined,
        storagePaths: { video: r.video_bucket_path, gps: r.gps_bucket_path },
      }))
      setRecordings((prev) => {
        const local = prev.filter((r) => !r.uploaded)
        return [...serverRecordings, ...local]
      })
    } catch {
      // silently fail
    } finally {
      setRefreshing(false)
    }
  }, [])

  const addRecording = useCallback((rec: Recording) => {
    setRecordings((prev) => [rec, ...prev])
  }, [])

  const handleDeleteRecording = useCallback(
    async (recording: Recording) => {
      if (recording.rideId) {
        try {
          const token = (await supabase.auth.getSession()).data.session?.access_token
          await fetchFastApi(`/rides/${recording.rideId}`, {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          })
        } catch {
          // best-effort
        }
      }
      setRecordings((prev) => prev.filter((r) => r.id !== recording.id))
    },
    [],
  )

  const handleUploadRecording = useCallback(
    async (recording: Recording) => {
      if (!user) {
        Alert.alert('Upload Failed', 'You must be signed in to upload a recording.')
        return
      }
      if (recording.uploaded) return

      setUploadingId(recording.id)
      try {
        const uploaded = await uploadRideData(user.id, recording.videoUri, recording.csvUri)

        setRecordings((prev) =>
          prev.map((item) =>
            item.id === recording.id
              ? {
                  ...item,
                  uploaded: true,
                  rideId: uploaded.rideId,
                  status: 'queued',
                  storagePaths: { video: uploaded.videoBucketPath, gps: uploaded.gpsBucketPath },
                }
              : item,
          ),
        )

        Alert.alert('Upload Complete', 'Your ride has been uploaded to Azure.')
      } catch (error: any) {
        Alert.alert('Upload Failed', error?.message ?? 'Unknown error')
      } finally {
        setUploadingId(null)
      }
    },
    [user],
  )

  const handleProcessRecording = useCallback(
    async (recording: Recording) => {
      if (!recording.rideId) {
        Alert.alert('Cannot Process', 'Ride must be uploaded first.')
        return
      }

      setProcessingId(recording.id)
      try {
        await triggerProcessing(recording.rideId)
        setRecordings((prev) =>
          prev.map((item) =>
            item.id === recording.id ? { ...item, status: 'processing' } : item,
          ),
        )
        Alert.alert('Processing Started', 'Ride is being processed in the background.')
      } catch (error: any) {
        Alert.alert('Process Failed', error?.message ?? 'Unknown error')
      } finally {
        setProcessingId(null)
      }
    },
    [],
  )

  if (!screen) return null

  return (
    <>
      {screen === 'login' && <LoginScreen />}
      {screen === 'dashboard' && (
        <DashboardScreen
          recordings={recordings}
          uploadingId={uploadingId}
          processingId={processingId}
          onRefresh={handleRefresh}
          refreshing={refreshing}
          onRecord={() => setScreen('camera')}
          onMap={() => setScreen('map')}
          onUpload={handleUploadRecording}
          onProcess={handleProcessRecording}
          onDelete={handleDeleteRecording}
        />
      )}
      {screen === 'camera' && (
        <CameraScreen
          onFinish={(rec) => {
            addRecording(rec)
            setScreen('dashboard')
          }}
          onCancel={() => setScreen('dashboard')}
        />
      )}
      {screen === 'map' && Platform.OS !== 'web' && (
        <MapVerificationScreen
          recordings={recordings}
          onBack={() => setScreen('dashboard')}
        />
      )}
      {screen === 'map' && Platform.OS === 'web' && (
        <View style={{ flex: 1, backgroundColor: '#0a0a1a', justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#666', fontSize: 16 }}>Map view is not available on web.</Text>
          <TouchableOpacity onPress={() => setScreen('dashboard')} style={{ marginTop: 16, padding: 12, backgroundColor: '#4363d8', borderRadius: 10 }}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>Go Back</Text>
          </TouchableOpacity>
        </View>
      )}
    </>
  )
}
