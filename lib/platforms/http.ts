export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string | number,
  ) {
    super(message);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function messageFrom(body: any): string | undefined {
  if (!body || typeof body !== 'object') return undefined;
  if (typeof body.error === 'string') {
    return body.error_description ? `${body.error}: ${body.error_description}` : body.error;
  }
  if (body.error?.message) return String(body.error.message);
  if (body.error_message) return String(body.error_message);
  return undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function codeFrom(body: any): string | number | undefined {
  if (!body || typeof body !== 'object') return undefined;
  if (typeof body.error === 'string') return body.error;
  return body.error?.code ?? body.code;
}

/**
 * Holt JSON von einer API. Wirft bei Fehlern eine verständliche Meldung,
 * z. B. "TikTok (401): access_token_invalid". Schlüssel/Token landen nie in der Meldung.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function requestJson<T = any>(label: string, url: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, cache: 'no-store', signal: AbortSignal.timeout(25_000) });
  } catch (e) {
    throw new ApiError(`${label}: keine Verbindung (${e instanceof Error ? e.message : e})`);
  }
  const text = await res.text();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    // keine JSON-Antwort
  }
  if (!res.ok) {
    const msg = messageFrom(body) || text.slice(0, 200) || res.statusText;
    throw new ApiError(`${label} (${res.status}): ${msg}`, res.status, codeFrom(body));
  }
  return body as T;
}
