/**
 * Unified fetch wrapper for the Kura backend.
 *
 * Responsibilities:
 *   - Resolve URL via {@link resolveRequestUrl}
 *   - Attach `X-Client-Type: mobile`
 *   - Attach `Authorization: Bearer <token>` from {@link getAuthToken} when present
 *   - Unwrap the Phase 3 envelope `{ success, data, error, meta? }` so callers
 *     receive `data` directly
 *   - Throw {@link KuraApiError} (or {@link KuraNetworkError}) on any failure,
 *     including `success: false` envelopes that come with HTTP 200
 *
 * Mobile MUST go through the JWT path; we never read or set cookies.
 *
 * @see WebClient/app/lib/httpClient.ts for the reference implementation.
 */

import Logger from '../../shared/utils/Logger';
import { resolveRequestUrl } from './baseUrl';
import { KuraApiError, KuraNetworkError } from './errors';

const CLIENT_TYPE = 'mobile';

type AuthTokenProvider = () => string | null | Promise<string | null>;

let authTokenProvider: AuthTokenProvider | null = null;

/**
 * Register a token provider used by every authenticated request.
 *
 * The store (see useAppStore hydration) calls this once on bootstrap so that
 * lib code never reaches into the store directly.
 */
export function setAuthTokenProvider(provider: AuthTokenProvider | null): void {
  authTokenProvider = provider;
}

async function getAuthToken(): Promise<string | null> {
  if (!authTokenProvider) return null;
  try {
    return await authTokenProvider();
  } catch (error) {
    Logger.warn('ApiClient', 'Auth token provider threw', { error: String(error) });
    return null;
  }
}

/** Current JWT for authenticated backend requests (null when signed out). */
export async function readAuthToken(): Promise<string | null> {
  return getAuthToken();
}

interface EnvelopeError {
  code?: string;
  message?: string;
  details?: unknown;
}

interface Envelope {
  success?: boolean;
  data?: unknown;
  error?: EnvelopeError | string;
  message?: string;
  meta?: unknown;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseEnvelopeError(payload: Envelope | null, status: number): KuraApiError {
  const fallbackMessage = `Request failed with status ${status}`;

  if (!payload) {
    return new KuraApiError({
      code: 'INTERNAL_ERROR',
      message: fallbackMessage,
      status,
    });
  }

  const errField = payload.error;
  if (typeof errField === 'object' && errField !== null) {
    const errObj = errField as Record<string, unknown>;
    const { code, message, details, ...rest } = errObj;
    const mergedDetails =
      details !== undefined && details !== null
        ? details
        : Object.keys(rest).length > 0
          ? rest
          : undefined;

    return new KuraApiError({
      code: (typeof code === 'string' && code) || 'INTERNAL_ERROR',
      message: (typeof message === 'string' && message) || fallbackMessage,
      status,
      details: mergedDetails,
    });
  }

  if (typeof errField === 'string' && errField.trim()) {
    return new KuraApiError({
      code: 'INTERNAL_ERROR',
      message: errField,
      status,
    });
  }

  if (typeof payload.message === 'string' && payload.message.trim()) {
    return new KuraApiError({
      code: 'INTERNAL_ERROR',
      message: payload.message,
      status,
    });
  }

  return new KuraApiError({
    code: 'INTERNAL_ERROR',
    message: fallbackMessage,
    status,
  });
}

function unwrapEnvelope<T>(payload: unknown): T {
  if (!isObject(payload)) {
    return payload as T;
  }
  if (typeof (payload as Envelope).success !== 'boolean') {
    return payload as T;
  }
  return (((payload as Envelope).data ?? {}) as T);
}

export interface RequestOptions extends Omit<RequestInit, 'headers'> {
  /** Logical name for logs (e.g. 'AuthAPI'). */
  apiName?: string;
  /** Override or extend default headers. */
  headers?: HeadersInit;
  /** Skip attaching the auth token even when one is available. */
  skipAuth?: boolean;
  /**
   * HTTP statuses the caller handles as part of normal flow (e.g. a 409
   * "endorsement_required" the UI recovers from). These still throw, but are
   * logged at debug level instead of warn to avoid alarming log noise.
   */
  expectedStatuses?: number[];
}

export async function requestJson<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { apiName = 'API', skipAuth, headers: extraHeaders, expectedStatuses, ...init } = options;
  const url = resolveRequestUrl(path);
  const headers = new Headers(extraHeaders ?? {});

  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }
  headers.set('X-Client-Type', CLIENT_TYPE);

  if (!skipAuth) {
    const token = await getAuthToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  // Request tracing — uncomment for debugging a specific flow
  // Logger.debug(apiName, 'Request', { method: init.method || 'GET', url, hasAuth: headers.has('Authorization') });

  let response: Response;
  try {
    response = await fetch(url, { ...init, headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    Logger.error(apiName, 'Network error', { url, message });
    throw new KuraNetworkError(message);
  }

  const raw = await response.text();
  let parsed: Envelope | null = null;
  if (raw) {
    try {
      parsed = JSON.parse(raw) as Envelope;
    } catch {
      parsed = null;
    }
  }

  if (!response.ok) {
    const apiError = parseEnvelopeError(parsed, response.status);
    const meta = {
      url,
      status: response.status,
      code: apiError.code,
      message: apiError.message,
      details: apiError.details,
    };
    if (expectedStatuses?.includes(response.status)) {
      Logger.debug(apiName, 'Response error (handled)', meta);
    } else if (response.status === 401 && !headers.has('Authorization')) {
      Logger.debug(apiName, 'Response error (no auth token)', meta);
    } else {
      Logger.warn(apiName, 'Response error', meta);
    }
    throw apiError;
  }

  if (parsed && parsed.success === false) {
    const apiError = parseEnvelopeError(parsed, response.status);
    Logger.warn(apiName, 'Envelope success=false', {
      url,
      code: apiError.code,
      message: apiError.message,
      details: apiError.details,
    });
    throw apiError;
  }

  const data = unwrapEnvelope<T>(parsed ?? {});
  return data;
}

/**
 * Convenience wrapper that maps {@link KuraApiError} for endpoints where 404
 * means "this user has not configured the resource yet" rather than a bug.
 */
export async function requestJsonAllowing<T>(
  path: string,
  options: RequestOptions,
  recover: (error: KuraApiError) => T | Promise<T> | null,
): Promise<T> {
  try {
    return await requestJson<T>(path, options);
  } catch (error) {
    if (error instanceof KuraApiError) {
      const recovered = await recover(error);
      if (recovered !== null) {
        return recovered;
      }
    }
    throw error;
  }
}
