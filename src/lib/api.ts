/**
 * Thin fetch wrapper for authenticated calls. Cookies are same-origin, and
 * state-changing staff requests attach the session CSRF token as a header.
 */
export interface ApiFetchOptions extends RequestInit {
  csrfToken?: string;
}

export async function apiFetch(url: string, options: ApiFetchOptions = {}): Promise<Response> {
  const { csrfToken, headers, ...rest } = options;
  const merged = new Headers(headers);
  if (csrfToken) merged.set('x-csrf-token', csrfToken);
  if (rest.body && !merged.has('Content-Type')) merged.set('Content-Type', 'application/json');
  return fetch(url, { ...rest, headers: merged, credentials: 'same-origin' });
}

/** Best-effort human-readable error message from a failed response. */
export async function readApiError(res: Response, fallback = 'Something went wrong. Please try again.'): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    return data?.error || fallback;
  } catch {
    return fallback;
  }
}
