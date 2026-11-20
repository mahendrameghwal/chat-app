import { Router } from 'express';
import {
  createOrGetChat,
  getUserChats,
  getChatById,
  setTypingStatus,
  getTypingUsers,
} from '../controllers/chat.controller.js';
import {
  sendMessage,
  editMessage,
  deleteMessage,
  getMessages,
  markAsRead,
  updateLastSeen,
} from '../controllers/message.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { validateRequest } from '../middlewares/validation.middleware.js';
import {
  createDirectChatSchema,
  chatIdParamSchema,
  sendMessageSchema,
  getMessagesSchema,
  markReadSchema,
  updateLastSeenSchema,
  editMessageSchema,
  deleteMessageSchema,
  typingStatusSchema,
} from '../validators/chat.validator.js';

const router = Router();

// All chat routes require authentication
router.use(authenticate);

// 1. Direct chat creation / retrieval
router.post('/create', validateRequest(createDirectChatSchema), createOrGetChat);
router.post('/', validateRequest(createDirectChatSchema), createOrGetChat);

// 2. Chat list for authenticated user
router.get('/', getUserChats);
router.get('/:chatId', validateRequest(chatIdParamSchema), getChatById);

// 3. Typing indicator routes
router.post('/:chatId/typing', validateRequest(typingStatusSchema), setTypingStatus);
router.get('/:chatId/typing', validateRequest(chatIdParamSchema), getTypingUsers);

// 4. Send message
router.post('/:chatId/message/send', validateRequest(sendMessageSchema), sendMessage);
router.post('/:chatId/messages', validateRequest(sendMessageSchema), sendMessage);

// 5. Edit message (PUT)
router.put('/:chatId/message/:messageId', validateRequest(editMessageSchema), editMessage);
router.put('/:chatId/messages/:messageId', validateRequest(editMessageSchema), editMessage);

// 6. Delete message (DELETE - soft delete)
router.delete('/:chatId/message/:messageId', validateRequest(deleteMessageSchema), deleteMessage);
router.delete('/:chatId/messages/:messageId', validateRequest(deleteMessageSchema), deleteMessage);

// 7. Retrieve messages
router.get('/:chatId/messages', validateRequest(getMessagesSchema), getMessages);

// 8. Read receipt
router.post(
  '/:chatId/message/:messageId/read',
  validateRequest(markReadSchema),
  markAsRead
);
router.post(
  '/:chatId/messages/:messageId/read',
  validateRequest(markReadSchema),
  markAsRead
);

// 9. Last seen update
router.post(
  '/:chatId/lastseen',
  validateRequest(updateLastSeenSchema),
  updateLastSeen
);

export default router;
