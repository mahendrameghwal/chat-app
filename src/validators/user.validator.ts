import { z } from 'zod';

export const createUserSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters'),
    email: z.string().trim().email('Invalid email address'),
  }),
});

export const loginUserSchema = z.object({
  body: z.object({
    email: z.string().trim().email('Invalid email address'),
  }),
});

export const searchUserSchema = z.object({
  query: z.object({
    search: z.string().trim().optional(),
    limit: z.coerce.number().min(1).max(50).default(20),
    offset: z.coerce.number().min(0).default(0),
  }),
});

export const userIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid user ID format'),
  }),
});

export const presenceSchema = z.object({
  body: z.object({
    isOnline: z.boolean(),
  }),
});
