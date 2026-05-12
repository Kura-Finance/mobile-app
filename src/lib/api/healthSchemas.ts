/**
 * Standalone schema for `/health`.
 *
 * Pulled out of `system.ts` so unit tests can import it without triggering
 * the RN-specific `Logger` / `client` import graph.
 */

import { z } from 'zod';

export const healthResponseSchema = z.object({
  status: z.string(),
  timestamp: z.string(),
  uptime: z.number(),
  environment: z.string(),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;
