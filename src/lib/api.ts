/**
 * Custom fetch wrapper that automatically appends the current custom JWT Token 
 * from localStorage to the headers for API calls.
 */
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  
  const token = localStorage.getItem('token');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(input, { ...init, headers });

  // If we receive a 401, we might want to clear the stale token from localStorage.
  if (response.status === 401) {
    console.warn('apiFetch returned 401 Unauthorized. Clearing token.');
    // Don't forcefully clear instantly if it might be an in-progress transition,
    // but the auth context will handle redirects.
  }

  return response;
}
