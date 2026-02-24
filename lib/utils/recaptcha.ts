import { logger } from '@/lib/logger'

/**
 * Verify a reCAPTCHA v3 token against Google's API.
 * In development, skips verification if RECAPTCHA_SECRET_KEY starts with 'dev-skip'.
 */
export async function verifyRecaptcha(token: string): Promise<boolean> {
  const secretKey = process.env.RECAPTCHA_SECRET_KEY

  if (process.env.NODE_ENV === 'development' && secretKey?.startsWith('dev-skip')) {
    logger.info('[DEV] reCAPTCHA verification skipped')
    return true
  }

  if (!secretKey) {
    logger.error('RECAPTCHA_SECRET_KEY is not configured')
    return false
  }

  try {
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret: secretKey, response: token }),
    })

    const data = await response.json()

    if (data.success && data.score >= 0.5) {
      return true
    } else {
      logger.error('reCAPTCHA verification failed:', data['error-codes'])
      return false
    }
  } catch (error) {
    logger.error('Error verifying reCAPTCHA:', error)
    return false
  }
}
