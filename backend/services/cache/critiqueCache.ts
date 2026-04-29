import { CritiqueRequest, CritiqueResponse } from "../../../shared/contracts";

interface CachedEntry {
  expiresAt: number;
  response: CritiqueResponse;
}

const cache = new Map<string, CachedEntry>();
const DEFAULT_TTL_MS = 1000 * 60 * 10;

function stableStringify(input: unknown): string {
  if (Array.isArray(input)) return `[${input.map(stableStringify).join(",")}]`;
  if (input && typeof input === "object") {
    const object = input as Record<string, unknown>;
    const keys = Object.keys(object).sort();
    return `{${keys.map((key) => `${key}:${stableStringify(object[key])}`).join(",")}}`;
  }
  return JSON.stringify(input);
}

export function requestHash(request: CritiqueRequest): string {
  return stableStringify({
    mode: request.mode,
    frames: request.frames,
    pluginVersion: request.pluginVersion,
  });
}

export function getCachedCritique(hash: string): CritiqueResponse | null {
  const cached = cache.get(hash);
  if (!cached) return null;
  if (Date.now() > cached.expiresAt) {
    cache.delete(hash);
    return null;
  }
  return cached.response;
}

export function setCachedCritique(hash: string, response: CritiqueResponse, ttlMs = DEFAULT_TTL_MS): void {
  cache.set(hash, {
    response,
    expiresAt: Date.now() + ttlMs,
  });
}
