import { auth } from './firebase.ts';

/**
 * Custom fetch wrapper that automatically appends the current Firebase ID Token 
 * to the headers for API calls and handles automatic token refreshing.
 */
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  
  if (auth.currentUser) {
    try {
      // getIdToken() automatically returns cached token or retrieves a fresh one if expired
      const token = await auth.currentUser.getIdToken();
      headers.set('Authorization', `Bearer ${token}`);
    } catch (err) {
      console.error('apiFetch failed to append Authorization header:', err);
    }
  }

  let response = await fetch(input, { ...init, headers });

  // If we receive a 401 Unauthorized, the token might have expired in the brief instant before,
  // or is invalid. We force refresh the token and retry once.
  if (response.status === 401 && auth.currentUser) {
    try {
      console.warn('apiFetch returned 401 Unauthorized. Force-refreshing Firebase token and retrying...');
      const freshToken = await auth.currentUser.getIdToken(true);
      const retryHeaders = new Headers(init?.headers);
      retryHeaders.set('Authorization', `Bearer ${freshToken}`);
      response = await fetch(input, { ...init, headers: retryHeaders });
    } catch (err) {
      console.error('apiFetch token refresh/retry failed:', err);
    }
  }

  return response;
}
