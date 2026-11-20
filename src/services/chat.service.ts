import { Prisma } from '@prisma/client';
import { prisma } from '../config/database.js';
import { AppError } from '../utils/response.js';

export class ChatService {
  /**
   * Helper to compute a deterministic conversation key for 1-to-1 direct chats
   */
  static getDirectKey(userA: string, userB: string): string {
    return [userA, userB].sort().join(':');
  }

  /**
   * Create or fetch an existing direct conversation atomically
   */
  static async getOrCreateDirectChat(userAId: string, userBId: string) {
    if (userAId === userBId) {
      throw new AppError('Cannot create a direct conversation with yourself', 400);
    }

    // Verify both users exist
    const users = await prisma.user.findMany({
      where: { id: { in: [userAId, userBId] } },
      select: { id: true },
    });

    if (users.length !== 2) {
      throw new AppError('One or both specified users do not exist', 404);
    }

    const directKey = this.getDirectKey(userAId, userBId);

    // 1. Check if chat already exists
    const existingChat = await prisma.chat.findUnique({
      where: { directKey },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    if (existingChat) {
      return {
        chatId: existingChat.id,
        isNew: false,
        chat: existingChat,
      };
    }

    // 2. Create new direct chat with race condition safety
    try {
      const newChat = await prisma.chat.create({
        data: {
          type: 'DIRECT',
          directKey,
          members: {
            create: [{ userId: userAId }, { userId: userBId }],
          },
        },
        include: {
          members: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
      });

      return {
        chatId: newChat.id,
        isNew: true,
        chat: newChat,
      };
    } catch (error) {
      // Handle race condition: if another thread created it at the same moment
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const raceChat = await prisma.chat.findUnique({
          where: { directKey },
          include: {
            members: {
              include: {
                user: { select: { id: true, name: true, email: true } },
              },
            },
          },
        });

        if (raceChat) {
          return {
            chatId: raceChat.id,
            isNew: false,
            chat: raceChat,
          };
        }
      }
      throw error;
    }
  }

  /**
   * Verify that a user is an active member of a chat
   */
  static async verifyMembership(chatId: string, userId: string): Promise<boolean> {
    const membership = await prisma.chatMember.findUnique({
      where: {
        chatId_userId: {
          chatId,
          userId,
        },
      },
    });

    if (!membership) {
      throw new AppError('User is not a member of this chat', 403);
    }

    return true;
  }

  /**
   * List all chats for a user, sorted by last message activity
   */
  static async getUserChats(userId: string) {
    const chats = await prisma.chat.findMany({
      where: {
        members: {
          some: {
            userId,
          },
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: [
        { lastMessageAt: { sort: 'desc', nulls: 'last' } },
        { createdAt: 'desc' },
      ],
    });

    // Hydrate response with partner info for direct chats
    return chats.map((chat) => {
      const partnerMember = chat.members.find((m) => m.userId !== userId);
      return {
        chatId: chat.id,
        type: chat.type,
        directKey: chat.directKey,
        partner: partnerMember ? partnerMember.user : null,
        members: chat.members.map((m) => m.user),
        memberIds: chat.members.map((m) => m.userId),
        lastMessage: chat.lastMessageText
          ? {
              text: chat.lastMessageText,
              at: chat.lastMessageAt,
              senderId: chat.lastMessageSenderId,
            }
          : null,
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt,
      };
    });
  }

  /**
   * Get single chat details with member list
   */
  static async getChatById(chatId: string, userId: string) {
    await this.verifyMembership(chatId, userId);

    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!chat) {
      throw new AppError('Chat not found', 404);
    }

    return chat;
  }
}
