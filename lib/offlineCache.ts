import AsyncStorage from '@react-native-async-storage/async-storage'

const CACHE_PREFIX = 'offline_cache:'

export async function getCached<T>(key: string): Promise<{ data: T; timestamp: number } | null> {
  try {
    const raw = await AsyncStorage.getItem(`${CACHE_PREFIX}${key}`)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export async function setCache(key: string, data: unknown, ttlMs = 300_000): Promise<void> {
  try {
    const entry = { data, timestamp: Date.now(), ttlMs }
    await AsyncStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(entry))
  } catch {
    // silently fail — cache is a nice-to-have
  }
}

export async function clearExpired(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys()
    const cacheKeys = keys.filter((k) => k.startsWith(CACHE_PREFIX))
    if (cacheKeys.length === 0) return

    const now = Date.now()
    const entries = await AsyncStorage.multiGet(cacheKeys)
    const toRemove: string[] = []

    for (const [key, raw] of entries) {
      if (!raw) continue
      try {
        const { timestamp, ttlMs } = JSON.parse(raw)
        if (now - timestamp > ttlMs) {
          toRemove.push(key)
        }
      } catch {
        toRemove.push(key)
      }
    }

    if (toRemove.length > 0) {
      await AsyncStorage.multiRemove(toRemove)
    }
  } catch {
    // silently fail
  }
}

export async function clearAll(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys()
    const cacheKeys = keys.filter((k) => k.startsWith(CACHE_PREFIX))
    if (cacheKeys.length > 0) {
      await AsyncStorage.multiRemove(cacheKeys)
    }
  } catch {
    // silently fail
  }
}
