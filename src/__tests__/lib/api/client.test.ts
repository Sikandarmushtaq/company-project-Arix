/**
 * API Client Tests
 *
 * Unit tests for the API client covering CSRF token handling, request headers,
 * session expiration detection, error handling, cookie credentials, and token caching.
 *
 * @module __tests__/lib/api/client
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================================
// Because client.ts captures module-level state (sessionExpired, cachedToken,
// cacheInitialized), we need to re-import a fresh module for many tests.
// We use vi.resetModules() + dynamic import to achieve this.
// ============================================================

/** Helper: create a mock Response object */
function mockResponse(
  body: unknown,
  init: { status?: number; ok?: boolean; headers?: Record<string, string> } = {}
): Response {
  const { status = 200, ok = true, headers: headerInit = {} } = init;
  const headersObj = new Headers(headerInit);
  return {
    ok,
    status,
    headers: headersObj,
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(typeof body === 'string' ? body : JSON.stringify(body)),
    blob: vi.fn().mockResolvedValue(new Blob([JSON.stringify(body)])),
  } as unknown as Response;
}

/** Helper: dynamically import a fresh client module */
async function importFreshClient() {
  vi.resetModules();
  const mod = await import('@/lib/api/client');
  return mod;
}

describe('API Client', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock;

    // Reset document.cookie
    Object.defineProperty(document, 'cookie', {
      writable: true,
      value: '',
    });

    // Reset localStorage mock
    (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================
  // 1. CSRF Token Handling
  // ============================================================
  describe('CSRF token handling', () => {
    it('should read csrf_token from document.cookie and attach as X-CSRF-Token header', async () => {
      const { apiClient } = await importFreshClient();
      document.cookie = 'other=abc; csrf_token=my-csrf-token-123; session=xyz';

      fetchMock.mockResolvedValue(mockResponse({ data: 'ok' }));

      await apiClient.get('/test');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [, options] = fetchMock.mock.calls[0];
      expect(options.headers['X-CSRF-Token']).toBe('my-csrf-token-123');
    });

    it('should not include X-CSRF-Token header when no csrf_token cookie exists', async () => {
      const { apiClient } = await importFreshClient();
      document.cookie = 'other=abc; session=xyz';

      fetchMock.mockResolvedValue(mockResponse({ data: 'ok' }));

      await apiClient.get('/test');

      const [, options] = fetchMock.mock.calls[0];
      expect(options.headers['X-CSRF-Token']).toBeUndefined();
    });

    it('should handle csrf_token as the only cookie', async () => {
      const { apiClient } = await importFreshClient();
      document.cookie = 'csrf_token=solo-token';

      fetchMock.mockResolvedValue(mockResponse({ data: 'ok' }));

      await apiClient.get('/test');

      const [, options] = fetchMock.mock.calls[0];
      expect(options.headers['X-CSRF-Token']).toBe('solo-token');
    });

    it('should handle empty cookie string', async () => {
      const { apiClient } = await importFreshClient();
      document.cookie = '';

      fetchMock.mockResolvedValue(mockResponse({ data: 'ok' }));

      await apiClient.get('/test');

      const [, options] = fetchMock.mock.calls[0];
      expect(options.headers['X-CSRF-Token']).toBeUndefined();
    });
  });

  // ============================================================
  // 2. Request Headers
  // ============================================================
  describe('request headers', () => {
    it('should set Content-Type to application/json for JSON requests', async () => {
      const { apiClient } = await importFreshClient();
      fetchMock.mockResolvedValue(mockResponse({ data: 'ok' }));

      await apiClient.get('/test');

      const [, options] = fetchMock.mock.calls[0];
      expect(options.headers['Content-Type']).toBe('application/json');
    });

    it('should set Authorization header with Bearer token from localStorage', async () => {
      const { apiClient } = await importFreshClient();
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(
        JSON.stringify({ state: { token: 'test-jwt-token' } })
      );

      fetchMock.mockResolvedValue(mockResponse({ data: 'ok' }));

      await apiClient.get('/test');

      const [, options] = fetchMock.mock.calls[0];
      expect(options.headers['Authorization']).toBe('Bearer test-jwt-token');
    });

    it('should not set Authorization header when no token in localStorage', async () => {
      const { apiClient } = await importFreshClient();
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);

      fetchMock.mockResolvedValue(mockResponse({ data: 'ok' }));

      await apiClient.get('/test');

      const [, options] = fetchMock.mock.calls[0];
      expect(options.headers['Authorization']).toBeUndefined();
    });

    it('should include both Authorization and X-CSRF-Token when both are available', async () => {
      const { apiClient } = await importFreshClient();
      document.cookie = 'csrf_token=csrf-abc';
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(
        JSON.stringify({ state: { token: 'jwt-xyz' } })
      );

      fetchMock.mockResolvedValue(mockResponse({ data: 'ok' }));

      await apiClient.post('/test', { key: 'value' });

      const [, options] = fetchMock.mock.calls[0];
      expect(options.headers['Authorization']).toBe('Bearer jwt-xyz');
      expect(options.headers['X-CSRF-Token']).toBe('csrf-abc');
      expect(options.headers['Content-Type']).toBe('application/json');
    });

    it('should merge custom headers with default headers', async () => {
      const { apiClient } = await importFreshClient();
      fetchMock.mockResolvedValue(mockResponse({ data: 'ok' }));

      await apiClient.get('/test', {
        headers: { 'X-Custom-Header': 'custom-value' },
      });

      const [, options] = fetchMock.mock.calls[0];
      expect(options.headers['X-Custom-Header']).toBe('custom-value');
      expect(options.headers['Content-Type']).toBe('application/json');
    });

    it('should not set Content-Type for blob responseType', async () => {
      const { apiClient } = await importFreshClient();
      fetchMock.mockResolvedValue(mockResponse(new Blob(['data'])));

      await apiClient.get('/test', { responseType: 'blob' });

      const [, options] = fetchMock.mock.calls[0];
      expect(options.headers['Content-Type']).toBeUndefined();
    });
  });

  // ============================================================
  // 3. Session Expiration Detection
  // ============================================================
  describe('session expiration detection', () => {
    it('should throw SessionExpiredError on 401 with SESSION_EXPIRED code', async () => {
      const { apiClient, SessionExpiredError } = await importFreshClient();
      fetchMock.mockResolvedValue(
        mockResponse(
          { error: { code: 'SESSION_EXPIRED', message: 'Session has expired' } },
          { status: 401, ok: false }
        )
      );

      await expect(apiClient.get('/users')).rejects.toThrow(SessionExpiredError);
    });

    it('should dispatch session-expired event on first expiration', async () => {
      const { apiClient } = await importFreshClient();
      const eventSpy = vi.fn();
      window.addEventListener('app:session-expired', eventSpy);

      fetchMock.mockResolvedValue(
        mockResponse(
          { error: { code: 'SESSION_EXPIRED', message: 'Session expired' } },
          { status: 401, ok: false }
        )
      );

      await expect(apiClient.get('/users')).rejects.toThrow();
      expect(eventSpy).toHaveBeenCalledTimes(1);

      window.removeEventListener('app:session-expired', eventSpy);
    });

    it('should dispatch session-expired event only once on repeated expired requests', async () => {
      const { apiClient } = await importFreshClient();
      const eventSpy = vi.fn();
      window.addEventListener('app:session-expired', eventSpy);

      fetchMock.mockResolvedValue(
        mockResponse(
          { error: { code: 'SESSION_EXPIRED', message: 'Session expired' } },
          { status: 401, ok: false }
        )
      );

      // First request triggers the event
      await expect(apiClient.get('/users')).rejects.toThrow();
      // Second request fast-fails without hitting server
      await expect(apiClient.get('/other')).rejects.toThrow();

      expect(eventSpy).toHaveBeenCalledTimes(1);
      // Second request should not have called fetch (fast-fail)
      expect(fetchMock).toHaveBeenCalledTimes(1);

      window.removeEventListener('app:session-expired', eventSpy);
    });

    it('should fast-fail subsequent requests after session expiration', async () => {
      const { apiClient, SessionExpiredError } = await importFreshClient();

      fetchMock.mockResolvedValue(
        mockResponse(
          { error: { code: 'SESSION_EXPIRED', message: 'Session expired' } },
          { status: 401, ok: false }
        )
      );

      // First call triggers expiration
      await expect(apiClient.get('/users')).rejects.toThrow(SessionExpiredError);

      // Subsequent calls fast-fail without calling fetch
      fetchMock.mockClear();
      await expect(apiClient.get('/users')).rejects.toThrow(SessionExpiredError);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('should allow auth endpoints even after session expiration', async () => {
      const { apiClient } = await importFreshClient();

      // First: trigger session expiration
      fetchMock.mockResolvedValue(
        mockResponse(
          { error: { code: 'SESSION_EXPIRED', message: 'Session expired' } },
          { status: 401, ok: false }
        )
      );
      await expect(apiClient.get('/users')).rejects.toThrow();

      // Auth endpoints should still work (not fast-fail)
      fetchMock.mockResolvedValue(mockResponse({ token: 'new-token' }));
      const result = await apiClient.post('/auth/login', {
        email: 'test@test.com',
        password: 'pass',
      });
      expect(result).toEqual({ token: 'new-token' });
    });

    it('should not throw SessionExpiredError for 401 without SESSION_EXPIRED code', async () => {
      const { apiClient, SessionExpiredError } = await importFreshClient();
      fetchMock.mockResolvedValue(
        mockResponse(
          { error: { code: 'INVALID_TOKEN', message: 'Token is invalid' } },
          { status: 401, ok: false }
        )
      );

      await expect(apiClient.get('/users')).rejects.toThrow('Token is invalid');
      await expect(apiClient.get('/users')).rejects.not.toThrow(SessionExpiredError);
    });

    it('should not treat 401 on auth endpoints as session expiration', async () => {
      const { apiClient, SessionExpiredError } = await importFreshClient();
      fetchMock.mockResolvedValue(
        mockResponse(
          { error: { code: 'SESSION_EXPIRED', message: 'Session expired' } },
          { status: 401, ok: false }
        )
      );

      // Auth endpoint 401 should not trigger session expiration flow
      await expect(apiClient.post('/auth/login', {})).rejects.toThrow('Session expired');
      await expect(apiClient.post('/auth/login', {})).rejects.not.toThrow(SessionExpiredError);
    });

    it('should resume normal operation after markSessionValid()', async () => {
      const { apiClient, markSessionValid, SessionExpiredError } = await importFreshClient();

      // Trigger session expiration
      fetchMock.mockResolvedValue(
        mockResponse(
          { error: { code: 'SESSION_EXPIRED', message: 'Session expired' } },
          { status: 401, ok: false }
        )
      );
      await expect(apiClient.get('/users')).rejects.toThrow(SessionExpiredError);

      // Mark session as valid
      markSessionValid();

      // Should now call fetch again instead of fast-failing
      fetchMock.mockResolvedValue(mockResponse({ data: 'ok' }));
      const result = await apiClient.get('/users');
      expect(result).toEqual({ data: 'ok' });
    });
  });

  // ============================================================
  // 4. Error Handling
  // ============================================================
  describe('error handling', () => {
    it('should throw with error.message from structured error response', async () => {
      const { apiClient } = await importFreshClient();
      fetchMock.mockResolvedValue(
        mockResponse(
          { error: { code: 'VALIDATION_ERROR', message: 'Invalid input' } },
          { status: 400, ok: false }
        )
      );

      await expect(apiClient.post('/users', {})).rejects.toThrow('Invalid input');
    });

    it('should throw with top-level message when error.message is absent', async () => {
      const { apiClient } = await importFreshClient();
      fetchMock.mockResolvedValue(
        mockResponse({ message: 'Something went wrong' }, { status: 500, ok: false })
      );

      await expect(apiClient.get('/users')).rejects.toThrow('Something went wrong');
    });

    it('should fallback to HTTP status code when no message in body', async () => {
      const { apiClient } = await importFreshClient();
      fetchMock.mockResolvedValue(mockResponse(null, { status: 500, ok: false }));
      // json() will return null since body is null
      fetchMock.mockResolvedValue({
        ok: false,
        status: 500,
        headers: new Headers(),
        json: vi.fn().mockResolvedValue(null),
      } as unknown as Response);

      await expect(apiClient.get('/users')).rejects.toThrow('HTTP 500');
    });

    it('should handle network errors (fetch rejects)', async () => {
      const { apiClient } = await importFreshClient();
      fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

      await expect(apiClient.get('/users')).rejects.toThrow('Failed to fetch');
    });

    it('should handle JSON parse failure in error response', async () => {
      const { apiClient } = await importFreshClient();
      fetchMock.mockResolvedValue({
        ok: false,
        status: 502,
        headers: new Headers(),
        json: vi.fn().mockRejectedValue(new Error('Invalid JSON')),
      } as unknown as Response);

      await expect(apiClient.get('/users')).rejects.toThrow('HTTP 502');
    });

    it('should include validation details in error message', async () => {
      const { apiClient } = await importFreshClient();
      fetchMock.mockResolvedValue(
        mockResponse(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Validation failed',
              details: [
                { field: 'email', message: 'must be a valid email' },
                { field: 'password', message: 'must be at least 8 characters' },
              ],
            },
          },
          { status: 422, ok: false }
        )
      );

      await expect(apiClient.post('/users', {})).rejects.toThrow(
        'Validation failed (email: must be a valid email, password: must be at least 8 characters)'
      );
    });

    it('should throw simple HTTP error for blob request failures', async () => {
      const { apiClient } = await importFreshClient();
      fetchMock.mockResolvedValue({
        ok: false,
        status: 404,
        headers: new Headers(),
      } as unknown as Response);

      await expect(apiClient.get('/files/123', { responseType: 'blob' })).rejects.toThrow(
        'HTTP 404'
      );
    });

    it('should handle 204 No Content response', async () => {
      const { apiClient } = await importFreshClient();
      fetchMock.mockResolvedValue({
        ok: true,
        status: 204,
        headers: new Headers(),
        json: vi.fn(),
        text: vi.fn(),
      } as unknown as Response);

      const result = await apiClient.delete('/users/1');
      expect(result).toEqual({});
    });
  });

  // ============================================================
  // 5. Auth Token via Cookie (credentials: 'include')
  // ============================================================
  describe('credentials include for httpOnly cookie transport', () => {
    it('should set credentials to include on GET requests', async () => {
      const { apiClient } = await importFreshClient();
      fetchMock.mockResolvedValue(mockResponse({ data: 'ok' }));

      await apiClient.get('/test');

      const [, options] = fetchMock.mock.calls[0];
      expect(options.credentials).toBe('include');
    });

    it('should set credentials to include on POST requests', async () => {
      const { apiClient } = await importFreshClient();
      fetchMock.mockResolvedValue(mockResponse({ data: 'ok' }));

      await apiClient.post('/test', { key: 'value' });

      const [, options] = fetchMock.mock.calls[0];
      expect(options.credentials).toBe('include');
    });

    it('should set credentials to include on PUT requests', async () => {
      const { apiClient } = await importFreshClient();
      fetchMock.mockResolvedValue(mockResponse({ data: 'ok' }));

      await apiClient.put('/test', { key: 'value' });

      const [, options] = fetchMock.mock.calls[0];
      expect(options.credentials).toBe('include');
    });

    it('should set credentials to include on PATCH requests', async () => {
      const { apiClient } = await importFreshClient();
      fetchMock.mockResolvedValue(mockResponse({ data: 'ok' }));

      await apiClient.patch('/test', { key: 'value' });

      const [, options] = fetchMock.mock.calls[0];
      expect(options.credentials).toBe('include');
    });

    it('should set credentials to include on DELETE requests', async () => {
      const { apiClient } = await importFreshClient();
      fetchMock.mockResolvedValue(mockResponse({ data: 'ok' }));

      await apiClient.delete('/test');

      const [, options] = fetchMock.mock.calls[0];
      expect(options.credentials).toBe('include');
    });

    it('should set credentials to include on upload requests', async () => {
      const { apiClient } = await importFreshClient();
      fetchMock.mockResolvedValue(mockResponse({ data: 'ok' }));

      const formData = new FormData();
      formData.append('file', new Blob(['test']), 'test.txt');
      await apiClient.upload('/upload', formData);

      const [, options] = fetchMock.mock.calls[0];
      expect(options.credentials).toBe('include');
    });

    it('should set credentials to include on downloadBlob requests', async () => {
      const { apiClient } = await importFreshClient();
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-disposition': 'attachment; filename="test.csv"' }),
        blob: vi.fn().mockResolvedValue(new Blob(['data'])),
      } as unknown as Response);

      await apiClient.downloadBlob('/export', { ids: [1, 2] });

      const [, options] = fetchMock.mock.calls[0];
      expect(options.credentials).toBe('include');
    });
  });

  // ============================================================
  // 6. Token Cache
  // ============================================================
  describe('token cache', () => {
    it('should cache the token and not re-parse localStorage on subsequent requests', async () => {
      const { apiClient } = await importFreshClient();
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(
        JSON.stringify({ state: { token: 'cached-token' } })
      );

      fetchMock.mockResolvedValue(mockResponse({ data: 'ok' }));

      // First request initializes the cache
      await apiClient.get('/test1');
      // Second request should use cached value
      await apiClient.get('/test2');

      // localStorage.getItem should only be called once (on cache init)
      expect(window.localStorage.getItem).toHaveBeenCalledTimes(1);

      // Both requests should have the token
      expect(fetchMock.mock.calls[0][1].headers['Authorization']).toBe('Bearer cached-token');
      expect(fetchMock.mock.calls[1][1].headers['Authorization']).toBe('Bearer cached-token');
    });

    it('should invalidate cache and re-read from localStorage when invalidateTokenCache is called', async () => {
      const { apiClient, invalidateTokenCache } = await importFreshClient();

      // Initial token
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(
        JSON.stringify({ state: { token: 'old-token' } })
      );
      fetchMock.mockResolvedValue(mockResponse({ data: 'ok' }));

      await apiClient.get('/test1');
      expect(fetchMock.mock.calls[0][1].headers['Authorization']).toBe('Bearer old-token');

      // Update stored token and invalidate cache
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(
        JSON.stringify({ state: { token: 'new-token' } })
      );
      invalidateTokenCache();

      await apiClient.get('/test2');
      expect(fetchMock.mock.calls[1][1].headers['Authorization']).toBe('Bearer new-token');
    });

    it('should clear cached token when clearTokenCache is called', async () => {
      const { apiClient, clearTokenCache } = await importFreshClient();

      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(
        JSON.stringify({ state: { token: 'some-token' } })
      );
      fetchMock.mockResolvedValue(mockResponse({ data: 'ok' }));

      await apiClient.get('/test1');
      expect(fetchMock.mock.calls[0][1].headers['Authorization']).toBe('Bearer some-token');

      clearTokenCache();

      await apiClient.get('/test2');
      expect(fetchMock.mock.calls[1][1].headers['Authorization']).toBeUndefined();
    });

    it('should handle localStorage returning malformed JSON', async () => {
      const { apiClient } = await importFreshClient();
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('not-json');

      fetchMock.mockResolvedValue(mockResponse({ data: 'ok' }));

      await apiClient.get('/test');

      const [, options] = fetchMock.mock.calls[0];
      expect(options.headers['Authorization']).toBeUndefined();
    });

    it('should handle localStorage with missing token field', async () => {
      const { apiClient } = await importFreshClient();
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(
        JSON.stringify({ state: { user: { id: 1 } } })
      );

      fetchMock.mockResolvedValue(mockResponse({ data: 'ok' }));

      await apiClient.get('/test');

      const [, options] = fetchMock.mock.calls[0];
      expect(options.headers['Authorization']).toBeUndefined();
    });

    it('should update cache when storage event fires for auth-storage key', async () => {
      const { apiClient } = await importFreshClient();

      // Initial token
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(
        JSON.stringify({ state: { token: 'first-token' } })
      );
      fetchMock.mockResolvedValue(mockResponse({ data: 'ok' }));

      // Initialize the cache with first request
      await apiClient.get('/test1');
      expect(fetchMock.mock.calls[0][1].headers['Authorization']).toBe('Bearer first-token');

      // Simulate storage event from another tab
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(
        JSON.stringify({ state: { token: 'updated-token' } })
      );
      window.dispatchEvent(new StorageEvent('storage', { key: 'auth-storage' }));

      await apiClient.get('/test2');
      expect(fetchMock.mock.calls[1][1].headers['Authorization']).toBe('Bearer updated-token');
    });

    it('should not update cache for storage events on unrelated keys', async () => {
      const { apiClient } = await importFreshClient();

      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(
        JSON.stringify({ state: { token: 'original-token' } })
      );
      fetchMock.mockResolvedValue(mockResponse({ data: 'ok' }));

      // Initialize cache
      await apiClient.get('/test1');

      // Simulate storage event for a different key
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(
        JSON.stringify({ state: { token: 'should-not-use' } })
      );
      window.dispatchEvent(new StorageEvent('storage', { key: 'some-other-key' }));

      await apiClient.get('/test2');
      // Should still use the original cached token
      expect(fetchMock.mock.calls[1][1].headers['Authorization']).toBe('Bearer original-token');
    });
  });

  // ============================================================
  // 7. Session Expired Event Subscription
  // ============================================================
  describe('session expired event subscription', () => {
    it('should call handler when session expired event fires', async () => {
      const { onSessionExpired, dispatchSessionExpired } = await importFreshClient();
      const handler = vi.fn();

      const cleanup = onSessionExpired(handler);
      dispatchSessionExpired();

      expect(handler).toHaveBeenCalledTimes(1);
      cleanup();
    });

    it('should remove handler after cleanup is called', async () => {
      const { onSessionExpired, dispatchSessionExpired } = await importFreshClient();
      const handler = vi.fn();

      const cleanup = onSessionExpired(handler);
      cleanup();
      dispatchSessionExpired();

      expect(handler).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // 8. URL Construction and Query Params
  // ============================================================
  describe('URL construction and query params', () => {
    it('should construct correct URL with base path', async () => {
      const { apiClient } = await importFreshClient();
      fetchMock.mockResolvedValue(mockResponse({ data: 'ok' }));

      await apiClient.get('/users');

      const [url] = fetchMock.mock.calls[0];
      expect(url).toBe('/api/proxy/users');
    });

    it('should append query parameters to URL', async () => {
      const { apiClient } = await importFreshClient();
      fetchMock.mockResolvedValue(mockResponse({ data: 'ok' }));

      await apiClient.get('/users', {
        params: { page: 1, limit: 20, search: 'john' },
      });

      const [url] = fetchMock.mock.calls[0];
      expect(url).toContain('/api/proxy/users?');
      expect(url).toContain('page=1');
      expect(url).toContain('limit=20');
      expect(url).toContain('search=john');
    });

    it('should exclude undefined params', async () => {
      const { apiClient } = await importFreshClient();
      fetchMock.mockResolvedValue(mockResponse({ data: 'ok' }));

      await apiClient.get('/users', {
        params: { page: 1, search: undefined },
      });

      const [url] = fetchMock.mock.calls[0];
      expect(url).toContain('page=1');
      expect(url).not.toContain('search');
    });

    it('should handle boolean params', async () => {
      const { apiClient } = await importFreshClient();
      fetchMock.mockResolvedValue(mockResponse({ data: 'ok' }));

      await apiClient.get('/users', {
        params: { active: true },
      });

      const [url] = fetchMock.mock.calls[0];
      expect(url).toContain('active=true');
    });
  });

  // ============================================================
  // 9. HTTP Methods
  // ============================================================
  describe('HTTP methods', () => {
    it('should send GET request', async () => {
      const { apiClient } = await importFreshClient();
      fetchMock.mockResolvedValue(mockResponse({ users: [] }));

      const result = await apiClient.get('/users');

      const [, options] = fetchMock.mock.calls[0];
      expect(options.method).toBe('GET');
      expect(result).toEqual({ users: [] });
    });

    it('should send POST request with JSON body', async () => {
      const { apiClient } = await importFreshClient();
      fetchMock.mockResolvedValue(mockResponse({ id: 1 }));

      const result = await apiClient.post('/users', { name: 'John' });

      const [, options] = fetchMock.mock.calls[0];
      expect(options.method).toBe('POST');
      expect(options.body).toBe(JSON.stringify({ name: 'John' }));
      expect(result).toEqual({ id: 1 });
    });

    it('should send PUT request with JSON body', async () => {
      const { apiClient } = await importFreshClient();
      fetchMock.mockResolvedValue(mockResponse({ updated: true }));

      await apiClient.put('/users/1', { name: 'Jane' });

      const [, options] = fetchMock.mock.calls[0];
      expect(options.method).toBe('PUT');
      expect(options.body).toBe(JSON.stringify({ name: 'Jane' }));
    });

    it('should send PATCH request with JSON body', async () => {
      const { apiClient } = await importFreshClient();
      fetchMock.mockResolvedValue(mockResponse({ updated: true }));

      await apiClient.patch('/users/1', { name: 'Jane' });

      const [, options] = fetchMock.mock.calls[0];
      expect(options.method).toBe('PATCH');
      expect(options.body).toBe(JSON.stringify({ name: 'Jane' }));
    });

    it('should send DELETE request', async () => {
      const { apiClient } = await importFreshClient();
      fetchMock.mockResolvedValue(mockResponse({}, { status: 200 }));

      await apiClient.delete('/users/1');

      const [, options] = fetchMock.mock.calls[0];
      expect(options.method).toBe('DELETE');
    });

    it('should send DELETE request with body data', async () => {
      const { apiClient } = await importFreshClient();
      fetchMock.mockResolvedValue(mockResponse({}));

      await apiClient.delete('/users', { data: { ids: [1, 2, 3] } });

      const [, options] = fetchMock.mock.calls[0];
      expect(options.method).toBe('DELETE');
      expect(options.body).toBe(JSON.stringify({ ids: [1, 2, 3] }));
    });

    it('should send POST without body when data is undefined', async () => {
      const { apiClient } = await importFreshClient();
      fetchMock.mockResolvedValue(mockResponse({ ok: true }));

      await apiClient.post('/action');

      const [, options] = fetchMock.mock.calls[0];
      expect(options.method).toBe('POST');
      expect(options.body).toBeUndefined();
    });
  });

  // ============================================================
  // 10. Response Types
  // ============================================================
  describe('response types', () => {
    it('should return JSON by default', async () => {
      const { apiClient } = await importFreshClient();
      const responseData = { users: [{ id: 1, name: 'John' }] };
      fetchMock.mockResolvedValue(mockResponse(responseData));

      const result = await apiClient.get('/users');
      expect(result).toEqual(responseData);
    });

    it('should return blob when responseType is blob', async () => {
      const { apiClient } = await importFreshClient();
      const blobData = new Blob(['file content']);
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        blob: vi.fn().mockResolvedValue(blobData),
      } as unknown as Response);

      const result = await apiClient.get('/files/1', { responseType: 'blob' });
      expect(result).toBe(blobData);
    });

    it('should return text when responseType is text', async () => {
      const { apiClient } = await importFreshClient();
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        text: vi.fn().mockResolvedValue('plain text response'),
      } as unknown as Response);

      const result = await apiClient.get('/health', { responseType: 'text' });
      expect(result).toBe('plain text response');
    });
  });

  // ============================================================
  // 11. Upload Method
  // ============================================================
  describe('upload', () => {
    it('should send FormData without Content-Type header (browser sets multipart boundary)', async () => {
      const { apiClient } = await importFreshClient();
      fetchMock.mockResolvedValue(mockResponse({ fileId: 'abc' }));

      const formData = new FormData();
      formData.append('file', new Blob(['data']), 'test.txt');

      await apiClient.upload('/upload', formData);

      const [, options] = fetchMock.mock.calls[0];
      expect(options.method).toBe('POST');
      expect(options.body).toBe(formData);
      // Content-Type should NOT be set (browser handles multipart boundary)
      expect(options.headers['Content-Type']).toBeUndefined();
    });

    it('should include Authorization and CSRF headers on upload', async () => {
      const { apiClient } = await importFreshClient();
      document.cookie = 'csrf_token=upload-csrf';
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(
        JSON.stringify({ state: { token: 'upload-token' } })
      );
      fetchMock.mockResolvedValue(mockResponse({ fileId: 'abc' }));

      const formData = new FormData();
      await apiClient.upload('/upload', formData);

      const [, options] = fetchMock.mock.calls[0];
      expect(options.headers['Authorization']).toBe('Bearer upload-token');
      expect(options.headers['X-CSRF-Token']).toBe('upload-csrf');
    });

    it('should throw on upload failure with error message', async () => {
      const { apiClient } = await importFreshClient();
      fetchMock.mockResolvedValue(
        mockResponse({ error: { message: 'File too large' } }, { status: 413, ok: false })
      );

      const formData = new FormData();
      await expect(apiClient.upload('/upload', formData)).rejects.toThrow('File too large');
    });
  });

  // ============================================================
  // 12. Download Blob Method
  // ============================================================
  describe('downloadBlob', () => {
    it('should return blob and filename from Content-Disposition header', async () => {
      const { apiClient } = await importFreshClient();
      const blobData = new Blob(['csv,data']);
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({
          'content-disposition': 'attachment; filename="export.csv"',
        }),
        blob: vi.fn().mockResolvedValue(blobData),
      } as unknown as Response);

      const result = await apiClient.downloadBlob('/export', { format: 'csv' });

      expect(result.blob).toBe(blobData);
      expect(result.filename).toBe('export.csv');
    });

    it('should use default filename "download" when Content-Disposition is absent', async () => {
      const { apiClient } = await importFreshClient();
      const blobData = new Blob(['data']);
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        blob: vi.fn().mockResolvedValue(blobData),
      } as unknown as Response);

      const result = await apiClient.downloadBlob('/export');

      expect(result.filename).toBe('download');
    });

    it('should throw on downloadBlob failure', async () => {
      const { apiClient } = await importFreshClient();
      fetchMock.mockResolvedValue(
        mockResponse({ message: 'Not found' }, { status: 404, ok: false })
      );

      await expect(apiClient.downloadBlob('/export/999')).rejects.toThrow('Not found');
    });
  });
});
