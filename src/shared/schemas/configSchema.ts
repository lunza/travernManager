import { z } from 'zod';

export const configSchema = z.object({
  model_name: z.string().optional(),
  api_url: z.string().optional(),
  api_key: z.string().optional(),
  streaming: z.boolean().optional(),
  max_tokens: z.number().optional(),
  temperature: z.number().optional()
});
