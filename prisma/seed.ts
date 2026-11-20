import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { initializeFirebase, getFirestore } from '../src/config/firebase.js';

const prisma = new PrismaClient();

const SEED_USERS = [
  { name: 'Jane Doe', email: 'jane@example.com', isOnline: true },
  { name: 'John Smith', email: 'john@example.com', isOnline: true },
  { name: 'Alice Walker', email: 'alice.walker@example.com', isOnline: true },
  { name: 'Bob Martinez', email: 'bob.martinez@example.com', isOnline: false },
  { name: 'Charlie Brown', email: 'charlie.brown@example.com', isOnline: true },
  { name: 'Diana Prince', email: 'diana.prince@example.com', isOnline: false },
  { name: 'Ethan Hunt', email: 'ethan.hunt@example.com', isOnline: true },
  { name: 'Fiona Gallagher', email: 'fiona.gallagher@example.com', isOnline: false },
  { name: 'George Clark', email: 'george.clark@example.com', isOnline: false },
  { name: 'Hannah Abbott', email: 'hannah.abbott@example.com', isOnline: true },
  { name: 'Ian Wright', email: 'ian.wright@example.com', isOnline: false },
  { name: 'Julia Roberts', email: 'julia.roberts@example.com', isOnline: true },
  { name: 'Kevin Bacon', email: 'kevin.bacon@example.com', isOnline: false },
  { name: 'Laura Croft', email: 'laura.croft@example.com', isOnline: true },
  { name: 'Michael Scott', email: 'michael.scott@example.com', isOnline: true },
  { name: 'Natasha Romanoff', email: 'natasha.romanoff@example.com', isOnline: false },
];

const SAMPLE_DIALOGUES = [
  [
    'Hey, how is the current sprint progressing on your end?',
    'Going really well! Just finished the real-time sync module.',
    'Awesome, let me know if you need any review on the PR.',
  ],
  [
    'Are we still on for the architecture review this afternoon?',
    'Yes, 3:00 PM works perfectly. Sent over the updated diagrams.',
    'Got them, reviewing right now!',
  ],
  [
    'Quick question about the Firestore composite index setup.',
    'Sure! Make sure to index createdAt in descending order.',
    'Thanks! That fixed the query error immediately.',
  ],
  [
    'Hey! Free for a quick coffee break in 10 minutes?',
    'Count me in! Meeting by the cafe downstairs.',
  ],
  [
    'Did you see the new Tailwind frontend layout?',
    'Yes, the Helvetica typography and blue palette look super clean.',
    'Agreed, feels very fast and responsive.',
  ],
  [
    'Can you verify the last seen tracking logic on your device?',
    'Testing it now with John... works seamlessly!',
    'Great, read receipts and presence indicators are verified too.',
  ],
  [
    'Do you have the latest API contract documentation?',
    'Yes, it is updated in Requirement.md with all endpoints.',
    'Perfect, integrating it into the client today.',
  ],
];

async function seed() {
  console.log('🌱 Starting comprehensive database & Firestore seeding...');

  // Initialize Firebase Admin
  initializeFirebase();
  const firestore = getFirestore();

  // 1. Upsert all 16 users in PostgreSQL
  console.log(`📦 Upserting ${SEED_USERS.length} users into PostgreSQL...`);
  const createdUsers: any[] = [];

  for (const u of SEED_USERS) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name },
      create: {
        name: u.name,
        email: u.email,
      },
    });
    createdUsers.push({ ...user, isOnline: u.isOnline });

    // Seed Firestore presence record
    try {
      await firestore.collection('presence').doc(user.id).set(
        {
          userId: user.id,
          isOnline: u.isOnline,
          lastActiveAt: u.isOnline
            ? new Date().toISOString()
            : new Date(Date.now() - Math.floor(Math.random() * 86400000)).toISOString(),
        },
        { merge: true }
      );
    } catch (err) {
      console.warn(`Could not set presence for ${user.email} in Firestore:`, err);
    }
  }

  console.log(`✅ ${createdUsers.length} users active in PostgreSQL & Firestore.`);

  // 2. Generate mesh pairs ensuring EVERY user has at least 4-5 chats
  // Connect each user i to (i + 1), (i + 2), (i + 3) -> gives each user exactly 6 chats!
  const pairSet = new Set<string>();
  const pairsToCreate: { userA: any; userB: any }[] = [];

  const n = createdUsers.length;
  for (let i = 0; i < n; i++) {
    for (const offset of [1, 2, 3]) {
      const j = (i + offset) % n;
      const key = [createdUsers[i].id, createdUsers[j].id].sort().join(':');
      if (!pairSet.has(key)) {
        pairSet.add(key);
        pairsToCreate.push({
          userA: createdUsers[i],
          userB: createdUsers[j],
        });
      }
    }
  }

  console.log(`💬 Creating ${pairsToCreate.length} conversations (each user has 6 chats)...`);

  let count = 0;
  for (const pair of pairsToCreate) {
    count++;
    const directKey = [pair.userA.id, pair.userB.id].sort().join(':');

    // 1. Upsert Chat in PostgreSQL
    let chat = await prisma.chat.findUnique({
      where: { directKey },
    });

    if (!chat) {
      chat = await prisma.chat.create({
        data: {
          type: 'DIRECT',
          directKey,
          members: {
            create: [{ userId: pair.userA.id }, { userId: pair.userB.id }],
          },
        },
      });
    }

    // 2. Pick a dialogue
    const dialogue = SAMPLE_DIALOGUES[count % SAMPLE_DIALOGUES.length];

    let lastMsgText = '';
    let lastMsgSenderId = '';
    let lastMsgAt = new Date();

    for (let mIdx = 0; mIdx < dialogue.length; mIdx++) {
      const text = dialogue[mIdx];
      const sender = mIdx % 2 === 0 ? pair.userA : pair.userB;
      const messageId = uuidv4();
      const msgTime = new Date(Date.now() - (dialogue.length - mIdx) * 120000 - count * 60000);
      const iso = msgTime.toISOString();

      try {
        await firestore
          .collection('chats')
          .doc(chat.id)
          .collection('messages')
          .doc(messageId)
          .set({
            messageId,
            chatId: chat.id,
            senderId: sender.id,
            text,
            createdAt: iso,
            updatedAt: null,
            deleted: false,
            readBy: {
              [sender.id]: { readAt: iso },
            },
          });

        lastMsgText = text;
        lastMsgSenderId = sender.id;
        lastMsgAt = msgTime;
      } catch (err) {
        // Continue if any rate limit
      }
    }

    // 3. Update SQL lastMessage preview for instant inbox ordering
    if (lastMsgText) {
      await prisma.chat.update({
        where: { id: chat.id },
        data: {
          lastMessageText: lastMsgText,
          lastMessageAt: lastMsgAt,
          lastMessageSenderId: lastMsgSenderId,
        },
      });
    }
  }

  // 3. Verify chat counts per user
  console.log('🔍 Verifying chat count per user:');
  for (const user of createdUsers) {
    const chatCount = await prisma.chatMember.count({
      where: { userId: user.id },
    });
    console.log(`   • ${user.name.padEnd(20)}: ${chatCount} chats`);
  }

  console.log('🎉 Seeding completed successfully! All users have at least 4-5 chats.');
}

seed()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
