import { z } from 'zod';

const textPartSchema = z.object({
  type: z.enum(['text']),
  text: z.string().min(1).max(2000),
});

const filePartSchema = z.object({
  type: z.enum(['file']),
  mediaType: z.enum(['image/jpeg', 'image/png']),
  name: z.string().min(1).max(100),
  url: z.string().url(),
});

const partSchema = z.union([textPartSchema, filePartSchema]);

export const postRequestBodySchema = z.object({
  id: z.string().uuid(),
  message: z.object({
    id: z.string().uuid(),
    role: z.enum(['user']),
    parts: z.array(partSchema),
  }),
  selectedModelId: z.string(),
  apiType: z.enum(['gateway-chat', 'openai-responses']),
  previousResponseId: z.string().optional(),
  selectedVisibilityType: z.enum(['public', 'private']),
  vectorStoreIds: z.array(z.string()).optional(),
  fileFilters: z.record(z.unknown()).optional(),
  instructions: z.string().optional(),
  toolChoice: z
    .union([
      z.literal('auto'),
      z.object({ type: z.literal('tool'), toolName: z.string() }),
    ])
    .optional(),
});

export type PostRequestBody = z.infer<typeof postRequestBodySchema>;
