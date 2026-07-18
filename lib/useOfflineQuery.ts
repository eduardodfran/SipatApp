import { useEffect, useState } from 'react'
import { getCached, setCache } from './offlineCache'

interface UseOfflineQueryOptions {
  ttlMs?: number
  staleWhileRevalidate?: boolean
}

export function useOfflineQuery<T>(
  cacheKey: string,
  fetcher: () => Promise<{ data: T | null; error: any }>,
  options?: UseOfflineQueryOptions,
): { data: T | null; loading: boolean; error: any; fromCache: boolean } {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<any>(null)
  const [fromCache, setFromCache] = useState(false)

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      setLoading(true)
      setError(null)

      const cached = await getCached<T>(cacheKey)
      if (cancelled) return

      if (cached) {
        setData(cached.data)
        setFromCache(true)
        setLoading(false)
      }

      const result = await fetcher()
      if (cancelled) return

      if (result.data) {
        setData(result.data)
        setFromCache(false)
        setLoading(false)
        setCache(cacheKey, result.data, options?.ttlMs ?? 300_000)
      } else if (result.error) {
        if (!cached) {
          setError(result.error)
          setLoading(false)
        }
      } else {
        setLoading(false)
      }
    }

    run()

    return () => {
      cancelled = true
    }
  }, [cacheKey])

  return { data, loading, error, fromCache }
}
