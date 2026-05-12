import { describe, expect, test } from 'vitest';
import { healthResponseSchema } from '../healthSchemas';

describe('healthResponseSchema', () => {
  test('parses healthy response', () => {
    const out = healthResponseSchema.parse({
      status: 'healthy',
      timestamp: '2026-05-13T00:00:00Z',
      uptime: 3600.5,
      environment: 'production',
    });
    expect(out.status).toBe('healthy');
    expect(out.uptime).toBe(3600.5);
  });

  test('rejects missing status', () => {
    expect(() =>
      healthResponseSchema.parse({
        timestamp: '2026-05-13T00:00:00Z',
        uptime: 1,
        environment: 'dev',
      }),
    ).toThrow();
  });

  test('rejects non-string status', () => {
    expect(() =>
      healthResponseSchema.parse({
        status: 1,
        timestamp: '2026-05-13T00:00:00Z',
        uptime: 1,
        environment: 'dev',
      }),
    ).toThrow();
  });
});
