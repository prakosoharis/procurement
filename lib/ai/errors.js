// Single error taxonomy for the AI layer. Provider-specific SDK errors are
// translated into these codes so Chatbot and Refinement never branch on an
// Anthropic, OpenAI, or Agent SDK error shape.

const messages = Object.freeze({
  AI_DISABLED: 'Fitur AI sedang dinonaktifkan.',
  AI_NOT_CONFIGURED: 'Layanan AI belum dikonfigurasi di environment ini.',
  AI_UNSUPPORTED_PROVIDER: 'Layanan AI belum dikonfigurasi di environment ini.',
  AI_INVALID_INPUT: 'Permintaan ke layanan AI tidak valid.',
  AI_CONTEXT_TOO_LARGE: 'Konteks permintaan terlalu besar untuk diproses.',
  AI_AUTHENTICATION_FAILED: 'Layanan AI sedang tidak tersedia. Coba lagi nanti.',
  AI_RATE_LIMITED: 'Layanan AI sedang sibuk. Coba lagi beberapa saat lagi.',
  AI_TIMEOUT: 'Layanan AI tidak merespons tepat waktu. Coba lagi nanti.',
  AI_INVALID_OUTPUT: 'Layanan AI mengembalikan hasil yang tidak dapat diproses.',
  AI_PROVIDER_UNAVAILABLE: 'Layanan AI sedang tidak tersedia. Coba lagi nanti.'
});

// AiEvent.eventType values that correspond to a failure code. Codes absent from
// this map are recorded on AiUsage only.
const eventTypes = Object.freeze({
  AI_RATE_LIMITED: 'RATE_LIMITED',
  AI_INVALID_OUTPUT: 'INVALID_OUTPUT',
  AI_AUTHENTICATION_FAILED: 'PROVIDER_FAILURE',
  AI_TIMEOUT: 'PROVIDER_FAILURE',
  AI_PROVIDER_UNAVAILABLE: 'PROVIDER_FAILURE'
});

export class AiServiceError extends Error {
  constructor(code, internalMessage, { cause = null, retryable = false } = {}) {
    super(internalMessage || code);
    this.name = 'AiServiceError';
    this.code = code;
    this.retryable = retryable;
    // Safe to show a user; never contains provider payloads or credentials.
    this.userMessage = messages[code] || messages.AI_PROVIDER_UNAVAILABLE;
    this.eventType = eventTypes[code] || null;
    if (cause) this.cause = cause;
  }
}

export function isAiServiceError(error) {
  return error instanceof AiServiceError;
}

// HTTP status for the route handlers. Configuration problems are 503 rather
// than 500 so monitoring can distinguish a missing key from a crash.
export const aiErrorStatus = Object.freeze({
  AI_DISABLED: 503,
  AI_NOT_CONFIGURED: 503,
  AI_UNSUPPORTED_PROVIDER: 503,
  AI_INVALID_INPUT: 400,
  AI_CONTEXT_TOO_LARGE: 413,
  AI_AUTHENTICATION_FAILED: 503,
  AI_RATE_LIMITED: 429,
  AI_TIMEOUT: 504,
  AI_INVALID_OUTPUT: 502,
  AI_PROVIDER_UNAVAILABLE: 503
});

export function assertText(value, fieldName) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new AiServiceError('AI_INVALID_INPUT', `${fieldName} is required.`);
  }
  return value.trim();
}
