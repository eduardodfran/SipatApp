import AsyncStorage from '@react-native-async-storage/async-storage'
import type { LocalPhotoPost } from './types'

const STORAGE_KEY = '@sipat_photo_posts'

export async function loadPendingPhotos(): Promise<LocalPhotoPost[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as LocalPhotoPost[]
  } catch {
    return []
  }
}

export async function savePendingPhoto(post: LocalPhotoPost): Promise<void> {
  const posts = await loadPendingPhotos()
  posts.unshift(post)
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(posts))
}

export async function updatePhotoPost(
  id: string,
  updates: Partial<LocalPhotoPost>,
): Promise<void> {
  const posts = await loadPendingPhotos()
  const idx = posts.findIndex((p) => p.id === id)
  if (idx === -1) return
  posts[idx] = { ...posts[idx], ...updates }
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(posts))
}

export async function deletePhotoPost(id: string): Promise<void> {
  const posts = await loadPendingPhotos()
  const filtered = posts.filter((p) => p.id !== id)
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
}
