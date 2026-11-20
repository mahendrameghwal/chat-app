// In-memory data store for integration tests
export interface MockUser {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MockChat {
  id: string;
  type: 'DIRECT' | 'GROUP';
  directKey: string | null;
  lastMessageText: string | null;
  lastMessageAt: Date | null;
  lastMessageSenderId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MockChatMember {
  id: string;
  chatId: string;
  userId: string;
  joinedAt: Date;
}

export class InMemoryTestStore {
  users: Map<string, MockUser> = new Map();
  chats: Map<string, MockChat> = new Map();
  chatMembers: Map<string, MockChatMember> = new Map();
  // Firestore collections: "chats/{chatId}/messages" -> Map<messageId, doc>
  firestoreDocs: Map<string, Map<string, any>> = new Map();

  reset() {
    this.users.clear();
    this.chats.clear();
    this.chatMembers.clear();
    this.firestoreDocs.clear();
  }

  // Helper for Firestore collection path
  getCollection(path: string) {
    if (!this.firestoreDocs.has(path)) {
      this.firestoreDocs.set(path, new Map());
    }
    return this.firestoreDocs.get(path)!;
  }
}

export const testStore = new InMemoryTestStore();
