import { z } from 'zod';

export const createDirectChatSchema = z.object({
  body: z.object({
    partnerId: z.string().uuid('Invalid partner ID format').optional(),
    userBId: z.string().uuid('Invalid user ID format').optional(),
  }).refine((data) => data.partnerId || data.userBId, {
    message: 'Either partnerId or userBId must be provided',
    path: ['partnerId'],
  }),
});

export const chatIdParamSchema = z.object({
  params: z.object({
    chatId: z.string().uuid('Invalid chat ID format'),
  }),
});

export const sendMessageSchema = z.object({
  params: z.object({
    chatId: z.string().uuid('Invalid chat ID format'),
  }),
  body: z.object({
    text: z.string().trim().min(1, 'Message text cannot be empty').max(5000, 'Message cannot exceed 5000 characters'),
  }),
});

export const getMessagesSchema = z.object({
  params: z.object({
    chatId: z.string().uuid('Invalid chat ID format'),
  }),
  query: z.object({
    limit: z.coerce.number().min(1).max(100).default(50),
    before: z.string().trim().optional(),
  }),
});

export const markReadSchema = z.object({
  params: z.object({
    chatId: z.string().uuid('Invalid chat ID format'),
    messageId: z.string().min(1, 'Invalid message ID'),
  }),
});

export const updateLastSeenSchema = z.object({
  params: z.object({
    chatId: z.string().uuid('Invalid chat ID format'),
  }),
  body: z.object({
    messageId: z.string().min(1, 'Message ID is required'),
  }),
});

export const editMessageSchema = z.object({
  params: z.object({
    chatId: z.string().uuid('Invalid chat ID format'),
    messageId: z.string().min(1, 'Invalid message ID'),
  }),
  body: z.object({
    text: z.string().trim().min(1, 'Message text cannot be empty').max(5000, 'Message cannot exceed 5000 characters'),
  }),
});

export const deleteMessageSchema = z.object({
  params: z.object({
    chatId: z.string().uuid('Invalid chat ID format'),
    messageId: z.string().min(1, 'Invalid message ID'),
  }),
});

export const typingStatusSchema = z.object({
  params: z.object({
    chatId: z.string().uuid('Invalid chat ID format'),
  }),
  body: z.object({
    isTyping: z.boolean(),
  }),
});
