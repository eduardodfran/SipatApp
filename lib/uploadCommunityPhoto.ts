import { supabase } from './supabase'
import { FASTAPI_URL } from './env'

export type UploadResult = {
  photoId: number
  imageUrl: string
}

export async function uploadCommunityPhoto(
  userId: string,
  imageUri: string,
  latitude: number,
  longitude: number,
  caption?: string,
): Promise<UploadResult> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')

  const formData = new FormData()
  formData.append('image', {
    uri: imageUri,
    type: 'image/jpeg',
    name: 'photo.jpg',
  } as any)
  formData.append('latitude', String(latitude))
  formData.append('longitude', String(longitude))
  if (caption) formData.append('caption', caption)

  const resp = await fetch(`${FASTAPI_URL}/community-photo/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: formData,
  })

  if (!resp.ok) {
    const err = await resp.text()
    throw new Error(`Upload failed: ${err}`)
  }

  const data = await resp.json()
  return { photoId: data.photo_id, imageUrl: data.image_url }
}
