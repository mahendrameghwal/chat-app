import { v4 as uuidv4 } from 'uuid';
import { getFirestore } from '../config/firebase.js';
import { prisma } from '../config/database.js';
import { ChatService } from './chat.service.js';
import { AppError } from '../utils/response.js';
import { FirestoreMessage } from '../types/index.js';

export class MessageService {
  /**
   * Send a new message to an existing conversation
   */
  static async sendMessage(chatId: string, senderId: string, text: string) {
    await ChatService.verifyMembership(chatId, senderId);

    const messageId = uuidv4();
    const now = new Date();
    const createdAtIso = now.toISOString();

    const messageData: FirestoreMessage = {
      messageId,
      chatId,
      senderId,
      text,
      createdAt: createdAtIso,
      updatedAt: null,
      deleted: false,
      readBy: {
        [senderId]: {
          readAt: createdAtIso,
        },
      },
    };

    const firestore = getFirestore();

    // 1. Save message to Firestore
    await firestore
      .collection('chats')
      .doc(chatId)
      .collection('messages')
      .doc(messageId)
      .set(messageData);

    // 2. Update SQL Chat with lastMessage metadata for inbox ordering
    const previewText = text.length > 100 ? `${text.substring(0, 97)}...` : text;
    await prisma.chat.update({
      where: { id: chatId },
      data: {
        lastMessageText: previewText,
        lastMessageAt: now,
        lastMessageSenderId: senderId,
      },
    });

    return {
      messageId,
      chatId,
      senderId,
      text,
      createdAt: createdAtIso,
    };
  }

  /**
   * Edit an existing message (author only, cannot edit deleted messages)
   */
  static async editMessage(
    chatId: string,
    messageId: string,
    userId: string,
    newText: string
  ) {
    await ChatService.verifyMembership(chatId, userId);

    const firestore = getFirestore();
    const messageRef = firestore
      .collection('chats')
      .doc(chatId)
      .collection('messages')
      .doc(messageId);

    const docSnapshot = await messageRef.get();
    if (!docSnapshot.exists) {
      throw new AppError('Message not found', 404);
    }

    const messageData = docSnapshot.data() as FirestoreMessage;

    if (messageData.deleted) {
      throw new AppError('Cannot edit a deleted message', 400);
    }

    if (messageData.senderId !== userId) {
      throw new AppError('You can only edit your own messages', 403);
    }

    const updatedAt = new Date().toISOString();

    await messageRef.update({
      text: newText,
      updatedAt,
    });

    // If this was the last message, update SQL preview as well
    const previewText = newText.length > 100 ? `${newText.substring(0, 97)}...` : newText;
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      select: { lastMessageSenderId: true, lastMessageAt: true },
    });

    if (chat && chat.lastMessageSenderId === userId) {
      await prisma.chat.update({
        where: { id: chatId },
        data: { lastMessageText: previewText },
      });
    }

    return {
      messageId,
      chatId,
      senderId: userId,
      text: newText,
      createdAt: messageData.createdAt,
      updatedAt,
      deleted: false,
    };
  }

  /**
   * Soft-delete a message (author only, sets deleted: true)
   */
  static async deleteMessage(chatId: string, messageId: string, userId: string) {
    await ChatService.verifyMembership(chatId, userId);

    const firestore = getFirestore();
    const messageRef = firestore
      .collection('chats')
      .doc(chatId)
      .collection('messages')
      .doc(messageId);

    const docSnapshot = await messageRef.get();
    if (!docSnapshot.exists) {
      throw new AppError('Message not found', 404);
    }

    const messageData = docSnapshot.data() as FirestoreMessage;

    if (messageData.senderId !== userId) {
      throw new AppError('You can only delete your own messages', 403);
    }

    if (messageData.deleted) {
      return {
        messageId,
        chatId,
        deleted: true,
        message: 'Message already deleted',
      };
    }

    const updatedAt = new Date().toISOString();
    const placeholderText = 'This message was deleted';

    await messageRef.update({
      deleted: true,
      text: placeholderText,
      updatedAt,
    });

    // Update SQL preview if this was the latest message
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      select: { lastMessageSenderId: true },
    });

    if (chat && chat.lastMessageSenderId === userId) {
      await prisma.chat.update({
        where: { id: chatId },
        data: { lastMessageText: placeholderText },
      });
    }

    return {
      messageId,
      chatId,
      deleted: true,
      text: placeholderText,
      updatedAt,
    };
  }

  /**
   * Retrieve messages with reverse-chronological pagination
   */
  static async getMessages(
    chatId: string,
    userId: string,
    limit = 50,
    beforeCursor?: string
  ) {
    await ChatService.verifyMembership(chatId, userId);

    const firestore = getFirestore();
    let query = firestore
      .collection('chats')
      .doc(chatId)
      .collection('messages')
      .orderBy('createdAt', 'desc')
      .limit(limit);

    if (beforeCursor) {
      query = query.startAfter(beforeCursor);
    }

    const snapshot = await query.get();

    if (snapshot.empty) {
      return {
        messages: [],
        limit,
        hasMore: false,
      };
    }

    const messages = snapshot.docs.map((doc) => doc.data() as FirestoreMessage);
    const chronologicalMessages = [...messages].reverse();
    const oldestInBatch = messages[messages.length - 1];
    const hasMore = messages.length === limit;

    return {
      messages: chronologicalMessages,
      limit,
      hasMore,
      nextCursor: hasMore && oldestInBatch ? oldestInBatch.createdAt : null,
    };
  }

  /**
   * Mark a message as read by the user
   */
  static async markMessageAsRead(chatId: string, messageId: string, userId: string) {
    await ChatService.verifyMembership(chatId, userId);

    const firestore = getFirestore();
    const messageRef = firestore
      .collection('chats')
      .doc(chatId)
      .collection('messages')
      .doc(messageId);

    const doc = await messageRef.get();
    if (!doc.exists) {
      throw new AppError('Message not found', 404);
    }

    const readAt = new Date().toISOString();

    await messageRef.update({
      [`readBy.${userId}`]: { readAt },
    });

    await firestore
      .collection('chats')
      .doc(chatId)
      .collection('lastSeen')
      .doc(userId)
      .set(
        {
          userId,
          lastSeenMessageId: messageId,
          lastSeenAt: readAt,
        },
        { merge: true }
      );

    return {
      messageId,
      userId,
      readAt,
    };
  }

  /**
   * Update the user's last seen pointer in a conversation
   */
  static async updateLastSeen(chatId: string, userId: string, messageId: string) {
    await ChatService.verifyMembership(chatId, userId);

    const firestore = getFirestore();
    const messageDoc = await firestore
      .collection('chats')
      .doc(chatId)
      .collection('messages')
      .doc(messageId)
      .get();

    if (!messageDoc.exists) {
      throw new AppError('Message not found in this chat', 404);
    }

    const lastSeenAt = new Date().toISOString();

    await firestore
      .collection('chats')
      .doc(chatId)
      .collection('lastSeen')
      .doc(userId)
      .set({
        userId,
        lastSeenMessageId: messageId,
        lastSeenAt,
      });

    return {
      userId,
      lastSeenMessageId: messageId,
      lastSeenAt,
    };
  }
}
