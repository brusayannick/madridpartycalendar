/**
 * Polite HTTP helpers: identify ourselves, retry transient failures,
 * never hammer a host (callers add sleep() between requests).
 */

export const USER_AGENT =
  "MadridPartyCalendarCrawler/1.0 (personal non-commercial event aggregator; respectful crawler)";

const DEFAULT_TIMEOUT_MS = 20_000;
const RETRIES = 2;

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  retries = RETRIES,
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        ...init,
        headers: {
          "User-Agent": USER_AGENT,
          "Accept-Language": "en;q=0.9,es;q=0.8",
          ...(init.headers ?? {}),
        },
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
        redirect: "follow",
      });
      // Retry only on transient server/network errors.
      if (res.status >= 500 || res.status === 429) {
        throw new Error(`HTTP ${res.status} for ${url}`);
      }
      return res;
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export async function fetchJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetchWithRetry(url, init);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return (await res.json()) as T;
}

export async function fetchText(url: string, init: RequestInit = {}): Promise<string> {
  const res = await fetchWithRetry(url, init);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.text();
}
