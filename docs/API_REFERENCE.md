# 🔌 Kyvora API & Network Protocol Specification

The Kyvora backend engine provides a high-performance **REST API** (`/api/v1`) alongside a real-time **WebSocket Gateway** (`/ws-collaboration`).

- **Base URL (Local):** `http://localhost:8080/api/v1`
- **Base WebSocket (Local):** `ws://localhost:8080/ws-collaboration`
- **Security:** Bearer JWT in the `Authorization: Bearer <token>` header.

---

## 🔐 1. Authentication & Account Management

### Sign Up
Create a new user account with an optional role request (`USER`, `EDITOR`, `ADMIN`).

- **Endpoint:** `POST /api/v1/auth/signup`
- **Request Body:**
  ```json
  {
    "username": "developer_pro",
    "email": "dev@kyvora.io",
    "password": "SecurePassword123!",
    "role": "EDITOR"
  }
  ```
- **Response (`201 Created`):**
  ```json
  {
    "status": "success",
    "message": "User registered successfully",
    "userId": "usr_991823a"
  }
  ```

---

### User Login
Authenticates user credentials and issues a signed JWT token.

- **Endpoint:** `POST /api/v1/auth/login`
- **Headers:** Optional `X-Client-Type: kyvora-studio` (triggers Kafka audit event & notification alert).
- **Request Body:**
  ```json
  {
    "username": "developer_pro",
    "password": "SecurePassword123!"
  }
  ```
- **Response (`200 OK`):**
  ```json
  {
    "token": "eyJhbGciOiJIUzUxMiJ9...",
    "type": "Bearer",
    "username": "developer_pro",
    "role": "ROLE_EDITOR",
    "expiresIn": 86400000
  }
  ```

---

### Current User Profile (Valkey Cached)
Fetches profile information. The backend checks **Valkey / Redis** cache first (`kyvora:user:profile:<username>`); on a cache miss, it reads from MySQL and warms the cache.

- **Endpoint:** `GET /api/v1/users/profile`
- **Headers:** `Authorization: Bearer <token>`
- **Response (`200 OK`):**
  ```json
  {
    "username": "developer_pro",
    "email": "dev@kyvora.io",
    "role": "ROLE_EDITOR",
    "createdAt": "2026-09-17T12:00:00Z",
    "dataSource": "Valkey Cache"
  }
  ```

---

## 👥 2. Real-Time Collaboration Sessions

### Create Collaboration Session
Creates a new collaboration room and returns the credentials needed for collaborators to join.

- **Endpoint:** `POST /api/v1/collaboration/sessions`
- **Headers:** `Authorization: Bearer <token>`
- **Request Body:**
  ```json
  {
    "sessionName": "Feature Sprint: Vector Indexing",
    "isPrivate": true
  }
  ```
- **Response (`201 Created`):**
  ```json
  {
    "sessionId": "sess_8941fbc8",
    "sessionName": "Feature Sprint: Vector Indexing",
    "secretToken": "sec_77bca908234fed",
    "hostUsername": "developer_pro",
    "createdAt": "2026-09-17T12:05:00Z"
  }
  ```

---

### Join Collaboration Session
Validates the room ID and secret token before permitting entry.

- **Endpoint:** `POST /api/v1/collaboration/sessions/join`
- **Headers:** `Authorization: Bearer <token>`
- **Request Body:**
  ```json
  {
    "sessionId": "sess_8941fbc8",
    "secretToken": "sec_77bca908234fed"
  }
  ```
- **Response (`200 OK`):**
  ```json
  {
    "status": "connected",
    "sessionId": "sess_8941fbc8",
    "participants": [
      { "username": "developer_pro", "role": "HOST", "color": "#8A2BE2" },
      { "username": "guest_dev", "role": "PARTICIPANT", "color": "#00CED1" }
    ]
  }
  ```

---

## 🧠 3. AI Gateway & Code Generation

### Stream Code Completions / Chat
Dispatches prompts through the multi-model AI routing engine.

- **Endpoint:** `POST /api/v1/ai/completions`
- **Headers:** `Authorization: Bearer <token>`
- **Request Body:**
  ```json
  {
    "model": "claude-3-5-sonnet",
    "prompt": "Implement a thread-safe circular buffer in TypeScript with full JSDoc comments.",
    "stream": false,
    "temperature": 0.2
  }
  ```
- **Response (`200 OK`):**
  ```json
  {
    "model": "claude-3-5-sonnet",
    "content": "```typescript\nexport class CircularBuffer<T> {\n  // Implementation...\n}\n```",
    "usage": {
      "promptTokens": 45,
      "completionTokens": 320
    }
  }
  ```

---

## 📚 4. RAG & Codebase Semantic Context

### Query Semantic Workspace Graph
Returns relevant code snippets and AST symbols based on vector similarity search.

- **Endpoint:** `POST /api/v1/rag/query`
- **Headers:** `Authorization: Bearer <token>`
- **Request Body:**
  ```json
  {
    "query": "Where is the WebSocket auth handshake verified?",
    "topK": 3
  }
  ```
- **Response (`200 OK`):**
  ```json
  {
    "matches": [
      {
        "file": "src/main/java/com/kyvora/backend/websocket/WebSocketAuthInterceptor.java",
        "score": 0.94,
        "lineRange": [18, 45],
        "contentSnippet": "public boolean beforeHandshake(ServerHttpRequest request, ...)"
      }
    ]
  }
  ```

---

## 🛡️ 5. Admin Endpoints (`ADMIN` Role Required)

### List All Users
- **Endpoint:** `GET /api/v1/admin/users`
- **Headers:** `Authorization: Bearer <admin_token>`
- **Response:**
  - `200 OK`: Array of user records with roles, session activities, and timestamps.
  - `403 Forbidden`: Returned immediately if called by a user with only `USER` or `EDITOR` role.

---

## ⚡ 6. WebSocket Protocol Specification (`/ws-collaboration`)

Connect with: `ws://localhost:8080/ws-collaboration?token=<JWT_TOKEN>`

### Outgoing & Incoming Packet Structure
All packets share this baseline envelope:

```typescript
interface KyvoraSocketPacket<T = any> {
  type: 'CURSOR_MOVE' | 'TEXT_EDIT' | 'CHAT_MESSAGE' | 'TERMINAL_INPUT' | 'VOICE_STATUS';
  sessionId: string;
  username: string;
  payload: T;
}
```
