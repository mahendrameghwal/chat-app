import { Request } from 'express';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export interface FirestoreMessage {
  messageId: string;
  chatId: string;
  senderId: string;
  text: string;
  createdAt: string; // ISO string
  updatedAt?: string | null;
  deleted: boolean;
  readBy?: Record<string, { readAt: string }>;
}

export interface FirestoreLastSeen {
  userId: string;
  lastSeenMessageId: string;
  lastSeenAt: string; // ISO string
}
