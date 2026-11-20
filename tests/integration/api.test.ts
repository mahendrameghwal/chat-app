import { jest } from '@jest/globals';
import request from 'supertest';
import { testStore } from '../mocks/store.js';
import { mockPrisma } from '../mocks/mock-prisma.js';
import { mockFirestore } from '../mocks/mock-firestore.js';

// Mock database and firebase before importing the Express app
jest.unstable_mockModule('../../src/config/database.js', () => ({
  prisma: mockPrisma,
}));

jest.unstable_mockModule('../../src/config/firebase.js', () => ({
  getFirestore: () => mockFirestore,
  initializeFirebase: () => mockFirestore,
}));

const { default: app } = await import('../../src/app.js');

describe('Full Chat App Integration Test Suite', () => {
  beforeEach(() => {
    testStore.reset();
  });

  describe('1. Health Check APIs', () => {
    it('should return 200 OK from /health', async () => {
      const res = await request(app).get('/health');
      expect([200, 302]).toContain(res.status);
    });

    it('should return healthy status from /api/v1/health', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('healthy');
    });
  });

  describe('2. User & Authentication Flows', () => {
    it('should register a new user and return a JWT token', async () => {
      const res = await request(app)
        .post('/api/v1/users/register')
        .send({ name: 'Alice Smith', email: 'alice@example.com' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.name).toBe('Alice Smith');
      expect(res.body.data.token).toBeDefined();
    });

    it('should login an existing user', async () => {
      // Register first
      await request(app)
        .post('/api/v1/users/register')
        .send({ name: 'Bob Jones', email: 'bob@example.com' });

      const res = await request(app)
        .post('/api/v1/users/login')
        .send({ email: 'bob@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
    });

    it('should fetch authenticated user profile at /me', async () => {
      const reg = await request(app)
        .post('/api/v1/users/register')
        .send({ name: 'Charlie', email: 'charlie@example.com' });

      const token = reg.body.data.token;

      const me = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${token}`);

      expect(me.status).toBe(200);
      expect(me.body.data.email).toBe('charlie@example.com');
    });
  });

  describe('3. Chat Conversation Lifecycle & Deduplication', () => {
    let aliceToken: string;
    let aliceId: string;
    let bobToken: string;
    let bobId: string;

    beforeEach(async () => {
      const a = await request(app)
        .post('/api/v1/users/register')
        .send({ name: 'Alice', email: 'alice@chat.com' });
      aliceToken = a.body.data.token;
      aliceId = a.body.data.user.id;

      const b = await request(app)
        .post('/api/v1/users/register')
        .send({ name: 'Bob', email: 'bob@chat.com' });
      bobToken = b.body.data.token;
      bobId = b.body.data.user.id;
    });

    it('should create a direct chat between Alice and Bob', async () => {
      const res = await request(app)
        .post('/api/v1/chats')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ partnerId: bobId });

      expect([200, 201]).toContain(res.status);
      expect(res.body.success).toBe(true);
      expect(res.body.data.chatId).toBeDefined();
    });

    it('should prevent duplicate direct chats (deduplication)', async () => {
      // 1. Alice creates chat with Bob
      const first = await request(app)
        .post('/api/v1/chats')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ partnerId: bobId });

      const firstChatId = first.body.data.chatId;

      // 2. Bob calls create with Alice
      const second = await request(app)
        .post('/api/v1/chats')
        .set('Authorization', `Bearer ${bobToken}`)
        .send({ partnerId: aliceId });

      expect(second.status).toBe(200);
      expect(second.body.data.chatId).toBe(firstChatId);
    });

    it('should prevent a user from chatting with themselves', async () => {
      const res = await request(app)
        .post('/api/v1/chats')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ partnerId: aliceId });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should list conversations with hydrated partner information', async () => {
      await request(app)
        .post('/api/v1/chats')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ partnerId: bobId });

      const res = await request(app)
        .get('/api/v1/chats')
        .set('Authorization', `Bearer ${aliceToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.chats.length).toBe(1);
      expect(res.body.data.chats[0].partner.id).toBe(bobId);
    });
  });

  describe('4. Messaging, Edit & Soft-Delete Flow', () => {
    let aliceToken: string;
    let aliceId: string;
    let bobToken: string;
    let bobId: string;
    let charlieToken: string;
    let chatId: string;

    beforeEach(async () => {
      const a = await request(app)
        .post('/api/v1/users/register')
        .send({ name: 'Alice', email: 'alice@msg.com' });
      aliceToken = a.body.data.token;
      aliceId = a.body.data.user.id;

      const b = await request(app)
        .post('/api/v1/users/register')
        .send({ name: 'Bob', email: 'bob@msg.com' });
      bobToken = b.body.data.token;
      bobId = b.body.data.user.id;

      const c = await request(app)
        .post('/api/v1/users/register')
        .send({ name: 'Charlie', email: 'charlie@msg.com' });
      charlieToken = c.body.data.token;

      const chatRes = await request(app)
        .post('/api/v1/chats')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ partnerId: bobId });
      chatId = chatRes.body.data.chatId;
    });

    it('should allow members to send messages and retrieve them chronologically', async () => {
      // 1. Alice sends message
      const sendRes = await request(app)
        .post(`/api/v1/chats/${chatId}/messages`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ text: 'Hello Bob!' });

      expect(sendRes.status).toBe(201);
      expect(sendRes.body.data.text).toBe('Hello Bob!');
      expect(sendRes.body.data.messageId).toBeDefined();

      // 2. Bob retrieves messages
      const getRes = await request(app)
        .get(`/api/v1/chats/${chatId}/messages`)
        .set('Authorization', `Bearer ${bobToken}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.data.messages.length).toBe(1);
      expect(getRes.body.data.messages[0].text).toBe('Hello Bob!');
    });

    it('should reject non-members attempting to send messages (403 Forbidden)', async () => {
      const res = await request(app)
        .post(`/api/v1/chats/${chatId}/messages`)
        .set('Authorization', `Bearer ${charlieToken}`)
        .send({ text: 'I am not in this chat!' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should allow author to edit a message (PUT)', async () => {
      // 1. Alice sends message
      const sendRes = await request(app)
        .post(`/api/v1/chats/${chatId}/messages`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ text: 'Original text' });

      const messageId = sendRes.body.data.messageId;

      // 2. Alice edits message
      const editRes = await request(app)
        .put(`/api/v1/chats/${chatId}/messages/${messageId}`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ text: 'Updated text!' });

      expect(editRes.status).toBe(200);
      expect(editRes.body.success).toBe(true);
      expect(editRes.body.data.text).toBe('Updated text!');
      expect(editRes.body.data.updatedAt).toBeDefined();
    });

    it('should prevent non-authors from editing a message (403 Forbidden)', async () => {
      // 1. Alice sends message
      const sendRes = await request(app)
        .post(`/api/v1/chats/${chatId}/messages`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ text: 'Alice message' });

      const messageId = sendRes.body.data.messageId;

      // 2. Bob tries to edit Alice message
      const editRes = await request(app)
        .put(`/api/v1/chats/${chatId}/messages/${messageId}`)
        .set('Authorization', `Bearer ${bobToken}`)
        .send({ text: 'Bob is hacking your message' });

      expect(editRes.status).toBe(403);
      expect(editRes.body.success).toBe(false);
    });

    it('should allow author to soft-delete a message (DELETE)', async () => {
      // 1. Alice sends message
      const sendRes = await request(app)
        .post(`/api/v1/chats/${chatId}/messages`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ text: 'Message to delete' });

      const messageId = sendRes.body.data.messageId;

      // 2. Alice deletes message
      const delRes = await request(app)
        .delete(`/api/v1/chats/${chatId}/messages/${messageId}`)
        .set('Authorization', `Bearer ${aliceToken}`);

      expect(delRes.status).toBe(200);
      expect(delRes.body.data.deleted).toBe(true);
      expect(delRes.body.data.text).toBe('This message was deleted');

      // 3. Attempting to edit a deleted message returns 400
      const editRes = await request(app)
        .put(`/api/v1/chats/${chatId}/messages/${messageId}`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ text: 'Try to edit deleted' });

      expect(editRes.status).toBe(400);
    });
  });

  describe('5. Read Receipts & Last Seen Tracking', () => {
    let aliceToken: string;
    let bobToken: string;
    let bobId: string;
    let chatId: string;
    let messageId: string;

    beforeEach(async () => {
      const a = await request(app)
        .post('/api/v1/users/register')
        .send({ name: 'Alice', email: 'alice@receipt.com' });
      aliceToken = a.body.data.token;

      const b = await request(app)
        .post('/api/v1/users/register')
        .send({ name: 'Bob', email: 'bob@receipt.com' });
      bobToken = b.body.data.token;
      bobId = b.body.data.user.id;

      const chatRes = await request(app)
        .post('/api/v1/chats')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ partnerId: bobId });
      chatId = chatRes.body.data.chatId;

      const sendRes = await request(app)
        .post(`/api/v1/chats/${chatId}/messages`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ text: 'Check receipts' });
      messageId = sendRes.body.data.messageId;
    });

    it('should mark message as read and update readBy map', async () => {
      const res = await request(app)
        .post(`/api/v1/chats/${chatId}/messages/${messageId}/read`)
        .set('Authorization', `Bearer ${bobToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.messageId).toBe(messageId);
      expect(res.body.data.readAt).toBeDefined();
    });

    it('should update last seen pointer in chat', async () => {
      const res = await request(app)
        .post(`/api/v1/chats/${chatId}/lastseen`)
        .set('Authorization', `Bearer ${bobToken}`)
        .send({ messageId });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.lastSeenMessageId).toBe(messageId);
    });
  });

  describe('6. Online Presence & Typing Indicators', () => {
    let aliceToken: string;
    let aliceId: string;
    let bobToken: string;
    let bobId: string;
    let chatId: string;

    beforeEach(async () => {
      const a = await request(app)
        .post('/api/v1/users/register')
        .send({ name: 'Alice', email: 'alice@status.com' });
      aliceToken = a.body.data.token;
      aliceId = a.body.data.user.id;

      const b = await request(app)
        .post('/api/v1/users/register')
        .send({ name: 'Bob', email: 'bob@status.com' });
      bobToken = b.body.data.token;
      bobId = b.body.data.user.id;

      const chatRes = await request(app)
        .post('/api/v1/chats')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ partnerId: bobId });
      chatId = chatRes.body.data.chatId;
    });

    it('should update and retrieve user online presence', async () => {
      // 1. Update presence to online
      const updateRes = await request(app)
        .post('/api/v1/users/presence')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ isOnline: true });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.isOnline).toBe(true);

      // 2. Fetch Alice's presence
      const getRes = await request(app)
        .get(`/api/v1/users/${aliceId}/presence`)
        .set('Authorization', `Bearer ${bobToken}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.data.isOnline).toBe(true);
    });

    it('should set and retrieve typing status in chat', async () => {
      // 1. Alice starts typing
      const typingRes = await request(app)
        .post(`/api/v1/chats/${chatId}/typing`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ isTyping: true });

      expect(typingRes.status).toBe(200);
      expect(typingRes.body.data.isTyping).toBe(true);

      // 2. Bob checks who is typing (should see Alice)
      const getTypingRes = await request(app)
        .get(`/api/v1/chats/${chatId}/typing`)
        .set('Authorization', `Bearer ${bobToken}`);

      expect(getTypingRes.status).toBe(200);
      expect(getTypingRes.body.data.typingUsers.length).toBe(1);
      expect(getTypingRes.body.data.typingUsers[0].userId).toBe(aliceId);

      // 3. Alice stops typing
      await request(app)
        .post(`/api/v1/chats/${chatId}/typing`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ isTyping: false });

      const afterStopRes = await request(app)
        .get(`/api/v1/chats/${chatId}/typing`)
        .set('Authorization', `Bearer ${bobToken}`);

      expect(afterStopRes.body.data.typingUsers.length).toBe(0);
    });
  });
});
