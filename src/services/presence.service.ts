import { getFirestore } from '../config/firebase.js';
import { prisma } from '../config/database.js';
import { ChatService } from './chat.service.js';

export interface UserPresence {
  userId: string;
  isOnline: boolean;
  lastActiveAt: string;
}

export interface TypingUser {
  userId: string;
  name: string;
  isTyping: boolean;
  updatedAt: string;
}

export class PresenceService {
  /**
   * Heartbeat / update user online status
   */
  static async updatePresence(userId: string, isOnline: boolean): Promise<UserPresence> {
    const firestore = getFirestore();
    const nowIso = new Date().toISOString();

    const data = {
      userId,
      isOnline,
      lastActiveAt: nowIso,
    };

    await firestore.collection('presence').doc(userId).set(data, { merge: true });
    return data;
  }

  /**
   * Get single user presence (considered offline if last active > 60s ago)
   */
  static async getUserPresence(userId: string): Promise<UserPresence> {
    const firestore = getFirestore();
    const doc = await firestore.collection('presence').doc(userId).get();

    if (!doc.exists) {
      return {
        userId,
        isOnline: false,
        lastActiveAt: new Date(0).toISOString(),
      };
    }

    const data = doc.data() as UserPresence;
    const lastActiveTime = new Date(data.lastActiveAt).getTime();
    const isRecent = Date.now() - lastActiveTime < 60_000; // 60s threshold

    return {
      userId,
      isOnline: data.isOnline && isRecent,
      lastActiveAt: data.lastActiveAt,
    };
  }

  /**
   * Batch get presence for multiple users
   */
  static async getUsersPresence(userIds: string[]): Promise<Record<string, UserPresence>> {
    const results: Record<string, UserPresence> = {};
    if (userIds.length === 0) return results;

    const firestore = getFirestore();
    await Promise.all(
      userIds.map(async (id) => {
        results[id] = await this.getUserPresence(id);
      })
    );

    return results;
  }

  /**
   * Set typing status for a user in a specific chat
   */
  static async setTypingStatus(chatId: string, userId: string, isTyping: boolean): Promise<void> {
    await ChatService.verifyMembership(chatId, userId);

    const firestore = getFirestore();
    const nowIso = new Date().toISOString();

    await firestore
      .collection('chats')
      .doc(chatId)
      .collection('typing')
      .doc(userId)
      .set({
        userId,
        isTyping,
        updatedAt: nowIso,
      });
  }

  /**
   * Get currently typing users in a chat (excluding caller, expires after 6s)
   */
  static async getTypingUsers(chatId: string, excludeUserId: string): Promise<TypingUser[]> {
    await ChatService.verifyMembership(chatId, excludeUserId);

    const firestore = getFirestore();
    const snapshot = await firestore
      .collection('chats')
      .doc(chatId)
      .collection('typing')
      .get();

    if (snapshot.empty) return [];

    const now = Date.now();
    const typingDocs = snapshot.docs
      .map((d) => d.data() as { userId: string; isTyping: boolean; updatedAt: string })
      .filter((d) => {
        if (d.userId === excludeUserId) return false;
        if (!d.isTyping) return false;
        const updatedTime = new Date(d.updatedAt).getTime();
        return now - updatedTime < 6000; // Only valid if updated in last 6 seconds
      });

    if (typingDocs.length === 0) return [];

    // Hydrate user names from database
    const userIds = typingDocs.map((t) => t.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true },
    });

    const nameMap = new Map(users.map((u) => [u.id, u.name]));

    return typingDocs.map((t) => ({
      userId: t.userId,
      name: nameMap.get(t.userId) || 'Someone',
      isTyping: true,
      updatedAt: t.updatedAt,
    }));
  }
}
