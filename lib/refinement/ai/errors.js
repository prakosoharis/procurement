export class AiProviderError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "AiProviderError";
    this.code = code;
  }
}

export function assertNonEmptyText(value, fieldName) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new AiProviderError("INVALID_INPUT", `${fieldName} is required.`);
  }
  return value.trim();
}
