import { aiConfig } from './config.js';
import { AiServiceError } from './errors.js';
import { createAnthropicApiProvider } from './providers/anthropic-api-provider.js';

// The only place AI_PROVIDER is read. Chatbot and Refinement receive a provider
// through AIService and never learn which implementation answered, so moving
// between runtimes stays a configuration change.

const builders = Object.freeze({
  'anthropic-api': (config, environment) => createAnthropicApiProvider({
    apiKey: environment.ANTHROPIC_API_KEY,
    model: config.model || undefined,
    timeoutMs: config.requestTimeoutMs
  }),

  // Reserved. Anthropic's Legal and compliance policy restricts Free/Pro/Max
  // OAuth credentials to Claude Code and claude.ai and does not permit routing
  // application requests through them, so this identifier intentionally has no
  // deployable implementation. See docs/TECHNICAL-GUIDE.md.
  'claude-max-agent': () => {
    throw new AiServiceError(
      'AI_UNSUPPORTED_PROVIDER',
      'AI_PROVIDER=claude-max-agent is not a supported runtime: Claude subscription credentials may not be used to serve application users. Use AI_PROVIDER=anthropic-api.'
    );
  }
});

export function supportedAiProviders() {
  return Object.keys(builders);
}

export function getAiProvider({ environment = process.env, config = aiConfig(environment) } = {}) {
  const build = builders[config.provider];
  if (!build) {
    throw new AiServiceError('AI_UNSUPPORTED_PROVIDER', `AI_PROVIDER "${config.provider}" is not supported. Supported: ${supportedAiProviders().join(', ')}.`);
  }
  return build(config, environment);
}
