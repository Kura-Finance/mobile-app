import { z } from 'zod';

export const waitlistEntrySchema = z.object({
  id: z.string(),
  email: z.string(),
  product: z.string(),
  name: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
  createdAt: z.string(),
});

export type WaitlistEntry = z.infer<typeof waitlistEntrySchema>;

export const joinWaitlistResponseSchema = z.object({
  entry: waitlistEntrySchema,
  alreadyJoined: z.boolean(),
});

export type JoinWaitlistResponse = z.infer<typeof joinWaitlistResponseSchema>;

export const waitlistStatusResponseSchema = z.object({
  joined: z.boolean(),
  entry: waitlistEntrySchema.nullable(),
});

export type WaitlistStatusResponse = z.infer<typeof waitlistStatusResponseSchema>;

export const waitlistCountResponseSchema = z.object({
  count: z.number(),
});

export type WaitlistCountResponse = z.infer<typeof waitlistCountResponseSchema>;
