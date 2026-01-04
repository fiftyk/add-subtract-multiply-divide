/**
 * API Validation Schemas
 *
 * Zod schemas for request validation
 */

import { z } from 'zod';

// Plans API schemas
export const createPlanSchema = z.object({
  request: z.string().min(1, 'Request is required').max(2000, 'Request too long'),
  options: z
    .object({
      enableAutoComplete: z.boolean().optional(),
      maxRetries: z.number().int().min(1).max(10).optional(),
    })
    .optional(),
});

export const refinePlanSchema = z.object({
  instruction: z.string().min(1, 'Instruction is required').max(1000, 'Instruction too long'),
});

// Interactive API schemas
export const createSessionSchema = z
  .object({
    request: z.string().min(1).max(2000).optional(),
    planId: z.string().optional(),
  })
  .refine((data) => data.request || data.planId, {
    message: 'Either request or planId must be provided',
  });

export const confirmSessionSchema = z.object({
  confirmed: z.boolean(),
});

export const submitInputSchema = z.record(z.string(), z.unknown());

export type CreatePlanInput = z.infer<typeof createPlanSchema>;
export type RefinePlanInput = z.infer<typeof refinePlanSchema>;
export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type ConfirmSessionInput = z.infer<typeof confirmSessionSchema>;
export type SubmitInputValues = z.infer<typeof submitInputSchema>;
