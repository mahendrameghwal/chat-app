import { Response, NextFunction } from 'express';
import { ChatService } from '../services/chat.service.js';
import { PresenceService } from '../services/presence.service.js';
import { AuthenticatedRequest } from '../types/index.js';
import { sendSuccess } from '../utils/response.js';

export const createOrGetChat = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUserId = req.user!.id;
    const partnerId = req.body.partnerId || req.body.userBId;

    const result = await ChatService.getOrCreateDirectChat(currentUserId, partnerId);
    const statusCode = result.isNew ? 201 : 200;
    const message = result.isNew
      ? 'Chat conversation created successfully'
      : 'Chat retrieved successfully';

    sendSuccess(res, { chatId: result.chatId, chat: result.chat }, message, statusCode);
  } catch (error) {
    next(error);
  }
};

export const getUserChats = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const rawUserId = req.params.userId;
    const targetUserId = (Array.isArray(rawUserId) ? rawUserId[0] : rawUserId) || req.user!.id;
    const chats = await ChatService.getUserChats(targetUserId);

    // Enrich partner presence in chats
    const partnerIds = chats
      .map((c) => c.partner?.id)
      .filter((id): id is string => Boolean(id));

    const presenceMap = await PresenceService.getUsersPresence(partnerIds);

    const enrichedChats = chats.map((chat) => ({
      ...chat,
      partner: chat.partner
        ? {
            ...chat.partner,
            presence: presenceMap[chat.partner.id] || { isOnline: false },
          }
        : null,
    }));

    sendSuccess(res, { chats: enrichedChats }, 'Chats retrieved successfully');
  } catch (error) {
    next(error);
  }
};

export const getChatById = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const rawChatId = req.params.chatId;
    const chatId = Array.isArray(rawChatId) ? rawChatId[0] : rawChatId;
    const chat = await ChatService.getChatById(chatId, req.user!.id);
    sendSuccess(res, chat, 'Chat details retrieved');
  } catch (error) {
    next(error);
  }
};

export const setTypingStatus = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const rawChatId = req.params.chatId;
    const chatId = Array.isArray(rawChatId) ? rawChatId[0] : rawChatId;
    const { isTyping } = req.body;

    await PresenceService.setTypingStatus(chatId, req.user!.id, isTyping);
    sendSuccess(res, { chatId, isTyping }, 'Typing status updated');
  } catch (error) {
    next(error);
  }
};

export const getTypingUsers = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const rawChatId = req.params.chatId;
    const chatId = Array.isArray(rawChatId) ? rawChatId[0] : rawChatId;

    const typingUsers = await PresenceService.getTypingUsers(chatId, req.user!.id);
    sendSuccess(res, { typingUsers }, 'Typing users retrieved');
  } catch (error) {
    next(error);
  }
};
