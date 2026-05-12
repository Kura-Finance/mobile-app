/**
 * System endpoints (non-`/api` mounted).
 *
 *   GET /health → `{ status, timestamp, uptime, environment }`
 *
 * Not envelope-wrapped on the backend; `requestJson` passes the raw payload
 * straight through when no `success` boolean is present.
 */

import { requestJson } from './client';
import { KuraNetworkError } from './errors';
import { healthResponseSchema, type HealthResponse } from './healthSchemas';

export { healthResponseSchema };
export type { HealthResponse };

export interface HealthPingResult {
  ok: boolean;
  status?: string;
  uptime?: number;
  environment?: string;
  /** Round-trip latency in ms (best-effort). */
  latencyMs: number;
  error?: string;
}

/**
 * Best-effort health ping. Resolves rather than throwing so callers can use it
 * for an "is the backend reachable?" banner without try/catch boilerplate.
 *
 * @param timeoutMs aborts the request after this many ms (default 5000).
 */
export async function pingHealth(timeoutMs: number = 5000): Promise<HealthPingResult> {
  const start = Date.now();
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    const controller = new AbortController();
    timer = setTimeout(() => controller.abort(), timeoutMs);
    const raw = await requestJson<unknown>('/health', {
      method: 'GET',
      apiName: 'HealthApi',
      skipAuth: true,
      signal: controller.signal,
    });
    const parsed = healthResponseSchema.parse(raw);
    return {
      ok: parsed.status === 'healthy',
      status: parsed.status,
      uptime: parsed.uptime,
      environment: parsed.environment,
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    const message =
      error instanceof KuraNetworkError
        ? error.message
        : error instanceof Error
          ? error.message
          : String(error);
    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: message,
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
