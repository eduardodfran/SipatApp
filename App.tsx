import 'react-native-get-random-values'
import 'react-native-url-polyfill/auto'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, Platform, Text, TouchableOpacity, View } from 'react-native'
import { User } from '@supabase/supabase-js'
import * as SplashScreen from 'expo-splash-screen'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from './lib/supabase'
import { fetchFastApi } from './lib/fastapi'
import LoginScreen from './screens/LoginScreen'
import DashboardScreen from './screens/DashboardScreen'
import CameraScreen from './screens/CameraScreen'
import MapVerificationScreen from './screens/MapVerificationScreen'
import DistressListScreen from './screens/DistressListScreen'
import PhotoCaptureScreen from './screens/PhotoCaptureScreen'
import FeedScreen from './screens/FeedScreen'
import FeedDetailScreen from './screens/FeedDetailScreen'
import OnboardingScreen from './screens/OnboardingScreen'
import RidesScreen from './screens/RidesScreen'
import ProfileScreen from './screens/ProfileScreen'
import PublicProfileScreen from './screens/PublicProfileScreen'
import AppSidebar from './components/AppSidebar'
import type { Recording } from './lib/types'
import { FASTAPI_URL } from './lib/env'
import { fetchMyRides, triggerProcessing, uploadRideData } from './lib/uploadRideData'

SplashScreen.preventAutoHideAsync()

type Screen = 'onboarding' | 'login' | 'dashboard' | 'feed' | 'feeddetail' | 'camera' | 'photo' | 'map' | 'distress' | 'rides' | 'profile' | 'publicprofile'

export default function App() {
  const [screen, setScreen] = useState<Screen | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [feedRefreshKey, setFeedRefreshKey] = useState(0)

  useEffect(() => {
    ;(async () => {
      try {
        const onboardingSeen = await AsyncStorage.getItem('@sipat_onboarding_seen')

        const { data } = await supabase.auth.getSession()
        const u = data.session?.user ?? null
        setUser(u)

        if (!onboardingSeen) {
          setScreen('onboarding')
        } else {
          setScreen(u ? 'dashboard' : 'login')
        }
      } catch {
        setScreen('login')
      } finally {
        await SplashScreen.hideAsync()
      }
    })()

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const u = session?.user ?? null
        setUser(u)
        setScreen((prev) => {
          if (prev === 'onboarding') return prev
          return u ? 'dashboard' : 'login'
        })
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
          progressPct: r.progress_pct ?? 0,
          progressStage: r.progress_stage ?? '',
          progressMessage: r.progress_message ?? '',
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
          console.log(`[poll] fetched ${rides.length} rides`)
          setRecordings((prev) =>
            prev.map((r) => {
              if (!r.uploaded) return r
              const updated = rides.find((s) => s.id === r.rideId)
              if (!updated) return r
              if (updated.status !== r.status) {
                console.log(`[poll] ride ${r.rideId?.slice(0,8)} status: ${r.status} → ${updated.status}`)
              }
              if (updated.status === r.status && r.status !== 'processing') return r
              return {
                ...r,
                status: updated.status,
                errorLog: updated.error_log ?? undefined,
                progressPct: updated.progress_pct ?? r.progressPct,
                progressStage: updated.progress_stage ?? r.progressStage,
                progressMessage: updated.progress_message ?? r.progressMessage,
              }
            }),
          )
        } catch (e) {
          console.log(`[poll] fetchMyRides failed: ${e}`)
        }
      }, 2000)
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
        progressPct: r.progress_pct ?? 0,
        progressStage: r.progress_stage ?? '',
        progressMessage: r.progress_message ?? '',
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

  const [sidebarVisible, setSidebarVisible] = useState(false)
  const [detailItem, setDetailItem] = useState<{ type: 'photo'; data: any } | { type: 'pothole'; data: any } | null>(null)
  const [focusItem, setFocusItem] = useState<{ type: 'photo' | 'pothole'; id: number | string } | null>(null)
  const [publicProfileUserId, setPublicProfileUserId] = useState<string | null>(null)

  const handleViewOnMap = useCallback((item: { type: 'photo'; data: any } | { type: 'pothole'; data: any }) => {
    const id = item.type === 'photo' ? item.data.id : item.data.pothole_id
    setFocusItem({ type: item.type, id })
    setScreen('map')
  }, [])

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

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

  return (
    <>
      {screen === 'onboarding' && (
        <OnboardingScreen
          onDone={() => {
            setScreen('login')
          }}
        />
      )}
      {screen === 'login' && <LoginScreen />}
      {screen === 'dashboard' && (
        <DashboardScreen
          recordings={recordings}
          uploadingId={uploadingId}
          processingId={processingId}
          onRefresh={handleRefresh}
          refreshing={refreshing}
          onRecord={() => setScreen('camera')}
          onPhoto={() => setScreen('photo')}
          onMap={() => setScreen('map')}
          onDistress={() => setScreen('distress')}
          onUpload={handleUploadRecording}
          onProcess={handleProcessRecording}
          onDelete={handleDeleteRecording}
          feedRefreshKey={feedRefreshKey}
          userId={user?.id ?? ''}
          onTabChange={(tab) => setScreen(tab)}
          onMenuPress={() => setSidebarVisible(true)}
        />
      )}
      {screen === 'rides' && (
        <RidesScreen
          recordings={recordings}
          uploadingId={uploadingId}
          processingId={processingId}
          onUpload={handleUploadRecording}
          onProcess={handleProcessRecording}
          onDelete={handleDeleteRecording}
          onRefresh={handleRefresh}
          refreshing={refreshing}
          onMenuPress={() => setSidebarVisible(true)}
        />
      )}
      {screen === 'feed' && (
        <FeedScreen
          feedRefreshKey={feedRefreshKey}
          userId={user?.id ?? ''}
          onTabChange={(tab) => setScreen(tab)}
          onPhoto={() => setScreen('photo')}
          onMenuPress={() => setSidebarVisible(true)}
          onViewDetail={(item) => {
            setDetailItem(item)
            setScreen('feeddetail')
          }}
          onViewOnMap={handleViewOnMap}
          onViewProfile={(uid) => { setPublicProfileUserId(uid); setScreen('publicprofile') }}
        />
      )}
      {screen === 'feeddetail' && detailItem && (
        <FeedDetailScreen
          item={detailItem}
          onBack={() => setScreen('feed')}
          onViewOnMap={handleViewOnMap}
          onViewProfile={(uid) => { setPublicProfileUserId(uid); setScreen('publicprofile') }}
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
      {screen === 'photo' && (
        <PhotoCaptureScreen
          onDone={() => {
            setFeedRefreshKey((k) => k + 1)
            setScreen('dashboard')
          }}
          onCancel={() => setScreen('dashboard')}
        />
      )}
      {screen === 'map' && Platform.OS !== 'web' && (
        <MapVerificationScreen
          onBack={() => { setFocusItem(null); setScreen('dashboard') }}
          focusItem={focusItem}
          onViewFeedItem={(item) => { setDetailItem(item); setScreen('feeddetail') }}
        />
      )}
      {screen === 'map' && Platform.OS === 'web' && (
        <View style={{ flex: 1, backgroundColor: '#0c0c14', justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#6b7280', fontSize: 16 }}>Map view is not available on web.</Text>
          <TouchableOpacity onPress={() => setScreen('dashboard')} style={{ marginTop: 16, padding: 12, backgroundColor: '#e6a817', borderRadius: 10 }}>
            <Text style={{ color: '#0c0c14', fontWeight: '700' }}>Go Back</Text>
          </TouchableOpacity>
        </View>
      )}
      {screen === 'distress' && (
        <DistressListScreen onBack={() => setScreen('dashboard')} />
      )}
      {screen === 'profile' && user && (
        <ProfileScreen user={user} onBack={() => setScreen('dashboard')} />
      )}
      {screen === 'publicprofile' && publicProfileUserId && (
        <PublicProfileScreen
          userId={publicProfileUserId}
          onBack={() => setScreen('feed')}
          onViewPhoto={(item) => { setDetailItem(item); setScreen('feeddetail') }}
          onViewPothole={(item) => { setDetailItem(item); setScreen('feeddetail') }}
        />
      )}

      <AppSidebar
        visible={sidebarVisible}
        activeTab={screen === 'feed' ? 'feed' : screen === 'rides' ? 'rides' : 'dashboard'}
        user={user}
        onClose={() => setSidebarVisible(false)}
        onTabChange={(tab) => setScreen(tab)}
        onLogout={handleLogout}
        onProfilePress={() => setScreen('profile')}
      />
    </>
  )
}
