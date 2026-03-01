/**
 * Extracts a JSON object from a response that may contain markdown fences
 * or surrounding prose. Used when responseMimeType: 'application/json' is
 * not sent (preview models produce better output in free-text mode).
 */
export function extractJsonFromText(raw: string): string {
  const trimmed = raw.trim();

  // Already clean JSON — starts with { or [
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return trimmed;
  }

  // Strip markdown fences: ```json ... ``` or ``` ... ```
  const fenceMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/i);
  if (fenceMatch) {
    return fenceMatch[1].trim();
  }

  // Try to find the outermost { ... } block
  const firstBrace = raw.indexOf('{');
  const lastBrace = raw.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return raw.slice(firstBrace, lastBrace + 1);
  }

  // Fallback — return as-is and let the caller's JSON.parse handle the error
  return trimmed;
}
