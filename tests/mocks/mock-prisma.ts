import { testStore } from './store.js';

export const mockPrisma = {
  user: {
    findUnique: async ({ where }: any) => {
      if (where.id) {
        return testStore.users.get(where.id) || null;
      }
      if (where.email) {
        for (const user of testStore.users.values()) {
          if (user.email.toLowerCase() === where.email.toLowerCase()) {
            return user;
          }
        }
      }
      return null;
    },
    findMany: async ({ where }: any = {}) => {
      let list = Array.from(testStore.users.values());
      if (where?.id?.in) {
        list = list.filter((u) => where.id.in.includes(u.id));
      }
      if (where?.AND) {
        for (const cond of where.AND) {
          if (cond?.id?.not) {
            list = list.filter((u) => u.id !== cond.id.not);
          }
        }
      }
      return list;
    },
    create: async ({ data }: any) => {
      const id = data.id || crypto.randomUUID();
      const user = {
        id,
        name: data.name,
        email: data.email,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      testStore.users.set(id, user);
      return user;
    },
  },
  chat: {
    findUnique: async ({ where, include }: any) => {
      let chat: any = null;
      if (where.id) {
        chat = testStore.chats.get(where.id) || null;
      } else if (where.directKey) {
        for (const c of testStore.chats.values()) {
          if (c.directKey === where.directKey) {
            chat = c;
            break;
          }
        }
      }
      if (!chat) return null;

      if (include?.members) {
        const members = Array.from(testStore.chatMembers.values())
          .filter((m) => m.chatId === chat.id)
          .map((m) => ({
            ...m,
            user: testStore.users.get(m.userId)!,
          }));
        return { ...chat, members };
      }
      return chat;
    },
    findMany: async ({ where, include, orderBy }: any) => {
      const userId = where?.members?.some?.userId;
      const userChatIds = new Set(
        Array.from(testStore.chatMembers.values())
          .filter((m) => m.userId === userId)
          .map((m) => m.chatId)
      );

      let list = Array.from(testStore.chats.values()).filter((c) =>
        userChatIds.has(c.id)
      );

      if (include?.members) {
        list = list.map((chat) => {
          const members = Array.from(testStore.chatMembers.values())
            .filter((m) => m.chatId === chat.id)
            .map((m) => ({
              ...m,
              user: testStore.users.get(m.userId)!,
            }));
          return { ...chat, members };
        });
      }

      list.sort((a, b) => {
        const timeA = a.lastMessageAt ? a.lastMessageAt.getTime() : 0;
        const timeB = b.lastMessageAt ? b.lastMessageAt.getTime() : 0;
        return timeB - timeA;
      });

      return list;
    },
    create: async ({ data, include }: any) => {
      const id = data.id || crypto.randomUUID();
      const chat = {
        id,
        type: data.type || 'DIRECT',
        directKey: data.directKey || null,
        lastMessageText: null,
        lastMessageAt: null,
        lastMessageSenderId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      testStore.chats.set(id, chat);

      if (data.members?.create) {
        for (const m of data.members.create) {
          const memberId = crypto.randomUUID();
          testStore.chatMembers.set(memberId, {
            id: memberId,
            chatId: id,
            userId: m.userId,
            joinedAt: new Date(),
          });
        }
      }

      if (include?.members) {
        const members = Array.from(testStore.chatMembers.values())
          .filter((m) => m.chatId === id)
          .map((m) => ({
            ...m,
            user: testStore.users.get(m.userId)!,
          }));
        return { ...chat, members };
      }

      return chat;
    },
    update: async ({ where, data }: any) => {
      const chat = testStore.chats.get(where.id);
      if (!chat) throw new Error('Chat not found');
      Object.assign(chat, data, { updatedAt: new Date() });
      testStore.chats.set(where.id, chat);
      return chat;
    },
  },
  chatMember: {
    findUnique: async ({ where }: any) => {
      const { chatId, userId } = where.chatId_userId;
      for (const m of testStore.chatMembers.values()) {
        if (m.chatId === chatId && m.userId === userId) {
          return m;
        }
      }
      return null;
    },
  },
};
