export const MAX_COMMENT_LENGTH = 500
export const COMMENT_COOLDOWN_MS = 5000

const BLOCKED_WORDS = [
  'spam', 'buy now', 'click here', 'free money', 'earn fast',
  'work from home guaranteed', 'act now', 'limited time offer',
  'congratulations you won', 'claim your prize', 'nigerian prince',
  'crypto investment guaranteed', 'double your money', 'risk free profit',
]

export function validateComment(body: string): { ok: boolean; error?: string } {
  const trimmed = body.trim()

  if (!trimmed) {
    return { ok: false, error: 'Comment cannot be empty.' }
  }

  if (trimmed.length > MAX_COMMENT_LENGTH) {
    return { ok: false, error: `Comment too long. Max ${MAX_COMMENT_LENGTH} characters.` }
  }

  const lower = trimmed.toLowerCase()
  for (const word of BLOCKED_WORDS) {
    if (lower.includes(word)) {
      return { ok: false, error: 'Comment blocked: contains prohibited content.' }
    }
  }

  return { ok: true }
}
