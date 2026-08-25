const requiredBaseVariables = ["DATABASE_URL", "AUTH_SECRET"];
const googleDriveVariables = [
  "GOOGLE_DRIVE_CLIENT_ID",
  "GOOGLE_DRIVE_CLIENT_SECRET",
  "GOOGLE_DRIVE_REDIRECT_URI",
  "GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY",
];

function present(value) {
  return typeof value === "string" && value.trim() !== "";
}

function positiveInteger(value) {
  if (!present(value)) return true;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 3_072;
}

export function validateEnvironment(environment = process.env, { requireAiProviders = false } = {}) {
  const errors = [];
  const warnings = [];

  for (const variable of requiredBaseVariables) {
    if (!present(environment[variable])) errors.push(`${variable} is required.`);
  }

  if (environment.STORAGE_PROVIDER === "google-drive") {
    for (const variable of googleDriveVariables) {
      if (!present(environment[variable])) errors.push(`${variable} is required when STORAGE_PROVIDER=google-drive.`);
    }
  }

  const triggerProjectConfigured = present(environment.TRIGGER_PROJECT_ID);
  const triggerSecretConfigured = present(environment.TRIGGER_SECRET_KEY);
  if (triggerProjectConfigured !== triggerSecretConfigured) {
    errors.push("TRIGGER_PROJECT_ID and TRIGGER_SECRET_KEY must be configured together.");
  }

  const anthropicConfigured = present(environment.ANTHROPIC_API_KEY);
  const openAiConfigured = present(environment.OPENAI_API_KEY);
  if (requireAiProviders && !anthropicConfigured) errors.push("ANTHROPIC_API_KEY is required for AI smoke tests.");
  if (requireAiProviders && !openAiConfigured) errors.push("OPENAI_API_KEY is required for AI smoke tests.");
  if (!positiveInteger(environment.OPENAI_EMBEDDING_DIMENSIONS)) {
    errors.push("OPENAI_EMBEDDING_DIMENSIONS must be a positive integer no greater than 3072.");
  }
  const supportedProviders = ["anthropic-api", "zai", "gemini"];
  const provider = (environment.AI_PROVIDER || "anthropic-api").trim().toLowerCase();
  const zaiConfigured = present(environment.ZAI_API_KEY);
  const geminiConfigured = present(environment.GEMINI_API_KEY);
  if (provider === "claude-max-agent") {
    errors.push("AI_PROVIDER=claude-max-agent has no deployable runtime: Claude subscription credentials may not be used to serve application users. Use AI_PROVIDER=anthropic-api, AI_PROVIDER=zai, or AI_PROVIDER=gemini.");
  } else if (!supportedProviders.includes(provider)) {
    errors.push(`AI_PROVIDER "${provider}" is not supported. Supported: ${supportedProviders.join(", ")}.`);
  } else if (provider === "anthropic-api" && !anthropicConfigured) {
    warnings.push("AI_PROVIDER=anthropic-api requires ANTHROPIC_API_KEY before Chatbot or Refinement can run.");
  } else if (provider === "zai" && !zaiConfigured) {
    warnings.push("AI_PROVIDER=zai requires ZAI_API_KEY before Chatbot or Refinement can run.");
  } else if (provider === "gemini" && !geminiConfigured) {
    warnings.push("AI_PROVIDER=gemini requires GEMINI_API_KEY before Chatbot or Refinement can run.");
  }

  if (!anthropicConfigured) warnings.push("Anthropic refinement analysis is not configured.");
  if (!openAiConfigured) warnings.push("OpenAI embeddings are not configured.");

  return { valid: errors.length === 0, errors, warnings };
}
