import { Response, NextFunction } from 'express';
import { MessageService } from '../services/message.service.js';
import { AuthenticatedRequest } from '../types/index.js';
import { sendSuccess } from '../utils/response.js';

const getParamString = (val: string | string[]): string =>
  Array.isArray(val) ? val[0] : val;

export const sendMessage = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const chatId = getParamString(req.params.chatId);
    const { text } = req.body;
    const senderId = req.user!.id;

    const message = await MessageService.sendMessage(chatId, senderId, text);
    sendSuccess(res, message, 'Message sent successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const editMessage = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const chatId = getParamString(req.params.chatId);
    const messageId = getParamString(req.params.messageId);
    const { text } = req.body;
    const userId = req.user!.id;

    const message = await MessageService.editMessage(chatId, messageId, userId, text);
    sendSuccess(res, message, 'Message edited successfully');
  } catch (error) {
    next(error);
  }
};

export const deleteMessage = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const chatId = getParamString(req.params.chatId);
    const messageId = getParamString(req.params.messageId);
    const userId = req.user!.id;

    const result = await MessageService.deleteMessage(chatId, messageId, userId);
    sendSuccess(res, result, 'Message deleted successfully');
  } catch (error) {
    next(error);
  }
};

export const getMessages = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const chatId = getParamString(req.params.chatId);
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const beforeCursor = req.query.before as string | undefined;
    const userId = req.user!.id;

    const result = await MessageService.getMessages(chatId, userId, limit, beforeCursor);
    sendSuccess(res, result, 'Messages retrieved successfully');
  } catch (error) {
    next(error);
  }
};

export const markAsRead = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const chatId = getParamString(req.params.chatId);
    const messageId = getParamString(req.params.messageId);
    const userId = req.user!.id;

    const result = await MessageService.markMessageAsRead(chatId, messageId, userId);
    sendSuccess(res, result, 'Message marked as read');
  } catch (error) {
    next(error);
  }
};

export const updateLastSeen = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const chatId = getParamString(req.params.chatId);
    const { messageId } = req.body;
    const userId = req.user!.id;

    const result = await MessageService.updateLastSeen(chatId, userId, messageId);
    sendSuccess(res, result, 'Last seen updated successfully');
  } catch (error) {
    next(error);
  }
};
