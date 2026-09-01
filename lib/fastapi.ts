import { AZURE_URL, LOCAL_URL } from './env'

const AZURE_TIMEOUT = 3_000
const LOCAL_PROBE_TIMEOUT = 5_000
const FALLBACK_TIMEOUT = 30_000
const PHOTO_UPLOAD_TIMEOUT = 120_000

let preferAzure: boolean | null = null
let lastProbeMs = 0
const PROBE_TTL_MS = 60_000

function fetchWithTimeout(url: string, options: RequestInit = {}, timeout: number): Promise<Response> {
  const opts = { ...options }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out after ${timeout / 1000}s — ${url}`)), timeout)
    fetch(url, opts as any).then(resolve, reject).finally(() => clearTimeout(timer))
  })
}

async function probeUrl(url: string, timeout: number): Promise<boolean> {
  try {
    await fetchWithTimeout(`${url}/health/ready`, { method: 'GET' }, timeout)
    return true
  } catch {
    return false
  }
}

function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError) return true
  if (err instanceof Error && /timed out|fetch failed|network|unreachable|eos|end of stream/i.test(err.message)) return true
  return false
}

function getTimeoutForPath(path: string): number {
  if (path.includes('/community-photo')) return PHOTO_UPLOAD_TIMEOUT
  return FALLBACK_TIMEOUT
}

async function determinePreferredUrl(): Promise<'azure' | 'local'> {
  const [azureOk, localOk] = await Promise.all([
    probeUrl(AZURE_URL, AZURE_TIMEOUT),
    probeUrl(LOCAL_URL, LOCAL_PROBE_TIMEOUT),
  ])
  if (azureOk) {
    console.log('[fetchFastApi] probed Azure — reachable')
    return 'azure'
  }
  if (localOk) {
    console.log('[fetchFastApi] probed Azure — unreachable, local OK')
    return 'local'
  }
  console.warn('[fetchFastApi] both Azure and local unreachable during probe')
  return 'local'
}

export async function fetchFastApi(path: string, options: RequestInit & { timeout?: number } = {}): Promise<Response> {
  const timeout = options.timeout ?? getTimeoutForPath(path)
  const { timeout: _ignored, ...rest } = options as RequestInit & { timeout?: number }

  const now = Date.now()
  if (preferAzure === null || now - lastProbeMs > PROBE_TTL_MS) {
    const preferred = await determinePreferredUrl()
    preferAzure = preferred === 'azure'
    lastProbeMs = now
  }

  const primaryUrl = preferAzure ? AZURE_URL : LOCAL_URL
  const fallbackUrl = preferAzure ? LOCAL_URL : AZURE_URL

  try {
    return await fetchWithTimeout(`${primaryUrl}${path}`, rest, timeout)
  } catch (err) {
    if (!isNetworkError(err)) throw err

    console.log(`[fetchFastApi] ${primaryUrl} failed (${(err as Error).message}), trying ${fallbackUrl}`)
    const resp = await fetchWithTimeout(`${fallbackUrl}${path}`, rest, timeout)
    preferAzure = !preferAzure
    lastProbeMs = now
    console.log(`[fetchFastApi] switched to ${preferAzure ? 'Azure' : 'local'}`)
    return resp
  }
}

/** Reset cached preference so next call re-probes Azure vs local. */
export function resetFastApiPreference(): void {
  preferAzure = null
  console.log('[fetchFastApi] preference reset — will re-probe on next call')
}
