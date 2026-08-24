import { AiServiceError } from '../errors.js';

// Shared transport-error translation. Both providers speak HTTP through an
// official SDK that exposes a numeric `status`, so branch on that rather than
// on message text, and keep the provider's own wording out of what is thrown.
export function translateHttpError(error, providerName = 'AI provider') {
  if (error instanceof AiServiceError) return error;

  const status = Number(error?.status);
  if (status === 401 || status === 403) return new AiServiceError('AI_AUTHENTICATION_FAILED', `${providerName} rejected the configured credentials.`, { cause: error });
  if (status === 429) return new AiServiceError('AI_RATE_LIMITED', `${providerName} rate limit reached.`, { cause: error, retryable: true });
  if (status === 400) return new AiServiceError('AI_INVALID_INPUT', error?.message || `${providerName} rejected the request.`, { cause: error });
  if (status >= 500) return new AiServiceError('AI_PROVIDER_UNAVAILABLE', `${providerName} returned a server error.`, { cause: error, retryable: true });

  const name = error?.name || '';
  if (name.includes('Timeout') || error?.code === 'ETIMEDOUT') {
    return new AiServiceError('AI_TIMEOUT', `${providerName} request timed out.`, { cause: error, retryable: true });
  }
  if (name.includes('Connection')) {
    return new AiServiceError('AI_PROVIDER_UNAVAILABLE', `${providerName} connection failed.`, { cause: error, retryable: true });
  }
  return new AiServiceError('AI_PROVIDER_UNAVAILABLE', error?.message || `Unknown ${providerName} failure.`, { cause: error });
}
