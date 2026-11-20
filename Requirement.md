# Real-Time Chat Backend (Node.js, TypeScript, PostgreSQL & Firebase Firestore)

## 1. Project Overview

This backend application implements a scalable real-time chat service using Node.js, TypeScript, Express.js, PostgreSQL/MySQL via Prisma ORM, and Firebase Firestore.

It employs a hybrid database pattern:
- **PostgreSQL / MySQL (Prisma ORM)**: Relational data management for user entities, conversation metadata, direct-chat uniqueness guarantees, and membership records.
- **Firebase Firestore**: High-velocity message documents, atomic read receipt maps, and per-user last-seen tracking pointers.

---

## 2. Technology Stack

| Technology | Purpose |
|---|---|
| **Node.js** | Server execution runtime |
| **TypeScript** | Strict compile-time typing and reliability |
| **Express.js** | HTTP REST API framework |
| **PostgreSQL / MySQL** | Structured user, chat, and membership storage |
| **Prisma ORM** | Schema migrations and type-safe database queries |
| **Firebase Firestore** | Message collection and real-time state |
| **Firebase Admin SDK** | Privileged server-side Firestore operations |
| **Zod** | Runtime schema and request payload validation |
| **JSON Web Tokens (JWT)** | Stateless bearer token authentication |
| **Helmet & CORS** | HTTP security headers and cross-origin controls |

---

## 3. Database Architecture & Schema Design

### 3.1 Relational Models (`prisma/schema.prisma`)

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum ChatType {
  DIRECT
  GROUP
}

model User {
  id          String       @id @default(uuid())
  name        String
  email       String       @unique
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt
  memberships ChatMember[]

  @@map("users")
}

model Chat {
  id                  String       @id @default(uuid())
  type                ChatType     @default(DIRECT)
  directKey           String?      @unique // Deterministic sorted pair key ("uuidA:uuidB") preventing duplicate direct chats
  lastMessageText     String?
  lastMessageAt       DateTime?
  lastMessageSenderId String?
  createdAt           DateTime     @default(now())
  updatedAt           DateTime     @updatedAt
  members             ChatMember[]

  @@index([lastMessageAt(sort: Desc)])
  @@map("chats")
}

model ChatMember {
  id       String   @id @default(uuid())
  chatId   String
  userId   String
  joinedAt DateTime @default(now())

  chat Chat @relation(fields: [chatId], references: [id], onDelete: Cascade)
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([chatId, userId])
  @@index([userId])
  @@index([chatId])
  @@map("chat_members")
}
```

---

## 4. Firebase Firestore Data Structures

### 4.1 Messages Collection
* Path: `/chats/{chatId}/messages/{messageId}`
* Schema:
```json
{
  "messageId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "chatId": "chat_uuid",
  "senderId": "user_uuid",
  "text": "Hello, how are you?",
  "createdAt": "2026-11-20T17:00:00.000Z",
  "updatedAt": null,
  "deleted": false,
  "readBy": {
    "user_uuid": {
      "readAt": "2026-11-20T17:00:00.000Z"
    }
  }
}
```

### 4.2 Last Seen Collection
* Path: `/chats/{chatId}/lastSeen/{userId}`
* Schema:
```json
{
  "userId": "user_uuid",
  "lastSeenMessageId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "lastSeenAt": "2026-11-20T17:05:00.000Z"
}
```

---

## 5. API Reference

All requests accept and return standard JSON. Authenticated endpoints require a Bearer token in the `Authorization` header (`Bearer <token>`).

### 5.1 User & Authentication Endpoints

#### `POST /api/v1/users/register` (or `POST /api/v1/users`)
* **Purpose**: Register or create a new user profile.
* **Request**:
  ```json
  {
    "name": "Alex Mercer",
    "email": "alex@example.com"
  }
  ```
* **Response (201 Created)**:
  ```json
  {
    "success": true,
    "message": "User created successfully",
    "data": {
      "user": {
        "id": "uuid",
        "name": "Alex Mercer",
        "email": "alex@example.com",
        "createdAt": "2026-11-20T17:00:00.000Z"
      },
      "token": "jwt_token_string"
    }
  }
  ```

#### `POST /api/v1/users/login`
* **Purpose**: Authenticate by email and retrieve a JWT token.
* **Request**:
  ```json
  {
    "email": "alex@example.com"
  }
  ```

#### `GET /api/v1/users/me`
* **Purpose**: Retrieve current authenticated user profile.
* **Headers**: `Authorization: Bearer <token>`

#### `GET /api/v1/users?search=alex&limit=20`
* **Purpose**: Search registered users to start conversations with (excludes current user).

---

### 5.2 Conversation Management

#### `POST /api/v1/chats` (or `POST /api/v1/chat/create`)
* **Purpose**: Create or fetch an existing direct conversation.
* **Headers**: `Authorization: Bearer <token>`
* **Request**:
  ```json
  {
    "partnerId": "target_user_uuid"
  }
  ```
* **Response (200 OK / 201 Created)**:
  ```json
  {
    "success": true,
    "message": "Chat retrieved successfully",
    "data": {
      "chatId": "chat_uuid",
      "chat": {
        "id": "chat_uuid",
        "type": "DIRECT",
        "members": [...]
      }
    }
  }
  ```

#### `GET /api/v1/chats` (or `GET /api/v1/user/:userId/chats`)
* **Purpose**: List user's conversations sorted by latest message activity (`lastMessageAt DESC`).
* **Headers**: `Authorization: Bearer <token>`
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "chats": [
        {
          "chatId": "chat_uuid",
          "type": "DIRECT",
          "partner": {
            "id": "target_user_uuid",
            "name": "Jane Doe",
            "email": "jane@example.com"
          },
          "lastMessage": {
            "text": "See you tomorrow!",
            "at": "2026-11-20T17:10:00.000Z",
            "senderId": "target_user_uuid"
          },
          "createdAt": "2026-11-20T16:00:00.000Z"
        }
      ]
    }
  }
  ```

---

### 5.3 Messaging & Real-Time Sync

#### `POST /api/v1/chats/:chatId/messages` (or `POST /api/v1/chat/:chatId/message/send`)
* **Purpose**: Send a message in a conversation.
* **Headers**: `Authorization: Bearer <token>`
* **Request**:
  ```json
  {
    "text": "Hello there!"
  }
  ```
* **Response (201 Created)**:
  ```json
  {
    "success": true,
    "message": "Message sent successfully",
    "data": {
      "messageId": "msg_uuid",
      "chatId": "chat_uuid",
      "senderId": "authenticated_user_uuid",
      "text": "Hello there!",
      "createdAt": "2026-11-20T17:12:00.000Z"
    }
  }
  ```

#### `GET /api/v1/chats/:chatId/messages?limit=50&before=<timestamp>`
* **Purpose**: Fetch paginated messages in ascending chronological order for client display.
* **Headers**: `Authorization: Bearer <token>`
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "messages": [
        {
          "messageId": "msg_1",
          "senderId": "user_1",
          "text": "Hi",
          "createdAt": "2026-11-20T17:00:00.000Z"
        },
        {
          "messageId": "msg_2",
          "senderId": "user_2",
          "text": "Hello!",
          "createdAt": "2026-11-20T17:01:00.000Z"
        }
      ],
      "limit": 50,
      "hasMore": false,
      "nextCursor": null
    }
  }
  ```

#### `POST /api/v1/chats/:chatId/messages/:messageId/read` (or `/chat/:chatId/message/:messageId/read`)
* **Purpose**: Mark a specific message as read.
* **Headers**: `Authorization: Bearer <token>`

#### `POST /api/v1/chats/:chatId/lastseen` (or `/chat/:chatId/lastseen`)
* **Purpose**: Update user's last seen message pointer in the conversation.
* **Headers**: `Authorization: Bearer <token>`
* **Request**:
  ```json
  {
    "messageId": "msg_uuid"
  }
  ```

---

## 6. Directory Structure

```
chat-backend/
├── src/
│   ├── config/
│   │   ├── database.ts        # PrismaClient singleton
│   │   ├── env.ts             # Zod-validated environment config
│   │   └── firebase.ts        # Firebase Admin SDK initialization
│   ├── controllers/
│   │   ├── chat.controller.ts
│   │   ├── message.controller.ts
│   │   └── user.controller.ts
│   ├── middlewares/
│   │   ├── auth.middleware.ts       # JWT Bearer token validator
│   │   ├── error.middleware.ts      # Centralized exception handler
│   │   └── validation.middleware.ts # Zod validator
│   ├── routes/
│   │   ├── chat.routes.ts
│   │   ├── index.ts
│   │   └── user.routes.ts
│   ├── services/
│   │   ├── chat.service.ts
│   │   ├── message.service.ts
│   │   └── user.service.ts
│   ├── types/
│   │   └── index.ts
│   ├── utils/
│   │   └── response.ts
│   ├── app.ts                 # Express setup
│   └── server.ts              # Entry point
├── prisma/
│   └── schema.prisma          # PostgreSQL / MySQL relational schema
├── .env.example
├── package.json
└── tsconfig.json
```
