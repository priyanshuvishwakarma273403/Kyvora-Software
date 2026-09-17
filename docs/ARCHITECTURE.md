# 🏛️ Kyvora System Architecture

Kyvora is a modern, enterprise-ready, AI-native software engineering ecosystem designed for high-performance development, autonomous agent swarms, and seamless real-time team collaboration.

This document details the architectural layers, inter-service communications, data flows, and state synchronization mechanisms powering the platform.

---

## 🗺️ High-Level System Topology

Kyvora utilizes a **3-Tier Distributed Architecture**:

```mermaid
graph TB
    subgraph Client Tier ["1. Client Tier"]
        KS["💻 Kyvora Studio IDE<br/>(Electron + TypeScript Runtime)"]
        WP["🌐 Kyvora Cloud Portal<br/>(Next.js 15 + React 19 + Turbopack)<br/>https://kyvora-frontend-sand.vercel.app/"]
    end

    subgraph Gateway ["Edge & Security Boundary"]
        LB["Load Balancer / Reverse Proxy"]
        WSS["WebSocket Gateway (/ws-collaboration)"]
        REST["REST API Gateway (/api/v1)"]
    end

    subgraph Service Tier ["2. Backend Engine (Java 21 / Spring Boot 3.2.5)"]
        AUTH["🔐 Auth & RBAC Service<br/>(JJWT 0.12.5)"]
        COLLAB["👥 Real-Time Collaboration Hub<br/>(Session & Delta Manager)"]
        AI_GW["🧠 Multi-Model AI Gateway<br/>(Gemini, OpenRouter, Groq, Ollama)"]
        RAG_ENG["📚 RAG & Semantic Context Engine<br/>(AST & Vector Chunks)"]
        EVENT_BUS["📡 Event Streaming Controller"]
    end

    subgraph Data Tier ["3. Infrastructure & Persistence Tier"]
        VALKEY[("⚡ Valkey / Redis 7.2<br/>Cache & Presence State")]
        KAFKA["📨 Apache Kafka (SASL_SSL)<br/>Distributed Event Log & Alerts"]
        MYSQL[("🗄️ MySQL 8.0<br/>Relational Store + Flyway")]
        SMTP["✉️ Gmail SMTP<br/>Notification Dispatcher"]
    end

    KS -->|WSS (Cursors, Diffs, Chat)| WSS
    KS -->|HTTPS (Auth, RAG, AI)| REST
    WP -->|HTTPS (Profiles, Telemetry)| REST

    WSS --> COLLAB
    REST --> AUTH
    REST --> COLLAB
    REST --> AI_GW
    REST --> RAG_ENG

    COLLAB <--> VALKEY
    COLLAB --> MYSQL
    AUTH <--> VALKEY
    AUTH --> MYSQL

    EVENT_BUS -->|Publish Notifications| KAFKA
    KAFKA -->|Consume Alert Events| EVENT_BUS
    EVENT_BUS --> SMTP
```

---

## 💻 1. The Desktop Client Tier (`Kyvora Studio`)

Kyvora Studio is a specialized, hardware-accelerated desktop IDE built on an Electron and TypeScript foundation with deep system-level optimizations.

### Core Architectural Layers (`src/vs/`)

Kyvora Studio organizes its codebase into distinct, strictly isolated layers:

| Layer | Path | Responsibility |
| :--- | :--- | :--- |
| **Base** | `vs/base/` | Cross-platform utilities, memory management primitives (`Disposable`), collections, and UI DOM helpers. |
| **Platform** | `vs/platform/` | Service declarations and constructor-injected Dependency Injection (DI) infrastructure. |
| **Editor** | `vs/editor/` | Core text modeling, Monaco syntax highlighter, AST tokenization, and language server protocol (LSP) clients. |
| **Workbench** | `vs/workbench/` | Primary shell containing window layouts, sidebars, activity managers, terminal emulators, and panel containers. |
| **Sessions** | `vs/sessions/` | **Specialized Agent Experience Layer** running alongside the workbench for dedicated agent workflows, fixed chrome layouts, and modal overlay editors. |

### Key Custom Subsystems

#### A. Real-Time Collaboration Service (`kyvoraCollaboration`)
- **Location:** `src/vs/workbench/contrib/kyvoraCollaboration/`
- **Engine:** `KyvoraCollaborationService`
- **Protocol:** Bidirectional WebSocket connection directly into the backend hub (`/ws-collaboration`).
- **Synchronized Primitives:**
  - `CURSOR_MOVE`: Renders remote collaborator selections, active line markers, and custom name tags with smooth interpolation.
  - `TEXT_EDIT`: High-frequency delta transmission preserving undo/redo history trees without buffer corruptions.
  - `CHAT_MESSAGE`: Real-time session-bound text messaging with markdown formatting.
  - `TERMINAL_INPUT`: Collaborative CLI terminal execution for pair-debugging.
  - `VOICE_STATUS`: Live participant microphone/audio broadcast state indicator.

#### B. Autonomous Multi-Agent Swarm Hub (`kyvoraAgents`)
- **Location:** `src/vs/workbench/contrib/kyvoraAgents/`
- **Engine:** `KyvoraAgentService` & `AgentRegistry`
- **Registry:** Contains 12+ pre-configured, role-specialized autonomous agents (Orchestrator, Planner, Architect, Coder, Backend Coder, Frontend Coder, Tester, Reviewer, Debugger, DevOps, Security Auditor).
- **Coordination Pipelines:**
  - `AutoReviewPipeline`: Triggered on code modifications; runs automated static and security audits.
  - `AutoTestPipeline`: Automatically executes unit and integration tests against local terminal processes.
  - `CollaborationPipeline`: Orchestrates multi-agent task handoffs and conflict-free patch applications.

---

## ⚙️ 2. The Cloud Backend Service (`kyvora-backend`)

The backend engine is engineered in **Java 21** using **Spring Boot 3.2.5** to provide low-latency, enterprise-grade scalability.

### Subsystem Breakdown

### 1. Authentication & Role-Based Access Control (RBAC)
- **Token Format:** Signed JSON Web Tokens (JJWT 0.12.5) with cryptographic HMAC-SHA512 validation.
- **Roles:**
  - `USER`: Standard developer profile, session joining, personal AI queries.
  - `EDITOR`: Multi-session creation, real-time shared buffer editing, terminal access.
  - `ADMIN`: Global user governance, metrics inspection (`/api/v1/admin/users`), audit trail access.
- **Method-Level Security:** Enforced via declarative Spring `@PreAuthorize("hasRole('ADMIN')")` annotations.

### 2. High-Throughput Real-Time Collaboration Hub
- **WebSocket Handler:** `CollaborationWebSocketHandler`
- **Interceptors:** `WebSocketAuthInterceptor` verifies JWT authentication during initial HTTP handshake before upgrading socket protocol.
- **Room Topology:** In-memory, thread-safe concurrent session registries cross-checked with Valkey distributed locks to enable horizontal scaling across container pods.

### 3. Multi-Model AI Gateway & RAG Engine
- **Controller:** `AiGatewayController` & `RagController`
- **Integrated Providers:**
  - **Google Gemini Ultra / Pro** (Deep reasoning, long context analysis)
  - **OpenRouter** (Dynamic multi-model failover)
  - **Groq LPU** (Ultra-fast, sub-second code generation)
  - **HuggingFace & Sambanova** (Specialized open weights)
  - **Local Ollama / LM Studio** (Air-gapped, zero-data-leak offline runtime)
- **RAG Architecture:** Chunks repository source files into semantic embeddings, indexing them into vector space for precise context retrieval when feeding prompt templates to LLMs.

### 4. Event Streaming & Notifications (Kafka + Valkey)
- **Apache Kafka:** Processes asynchronous notifications, audit logs, and cross-node session broadcasts using secure SASL_SSL with SCRAM-SHA-256.
- **Valkey / Redis 7.2:**
  - User profile caching (`kyvora:user:profile:<username>`) with TTL-based invalidation.
  - Live session presence tokens and heartbeat tracking.
- **Alert Dispatcher:** `NotificationConsumer` detects client authentication events and dispatches rich transactional emails via Gmail SMTP.

---

## 🌐 3. The Web Application Portal (`Kyvora-Frontend`)

- **Live URL:** [https://kyvora-frontend-sand.vercel.app/](https://kyvora-frontend-sand.vercel.app/)
- **Technology:** Next.js 15 (Turbopack, App Router), React 19, Tailwind CSS v4, Framer Motion, Lenis.
- **Key Modules:**
  - **Interactive Editor Simulation (`EditorMockup`):** An interactive browser-based preview simulating Kyvora Studio's agentic loop and terminal operations.
  - **Comprehensive Developer Portal (`/docs`):** In-depth guides covering configuration schemas, CLI flags, keyboard maps, and agentic workflows.
  - **System Observability & Downloads (`/status`, `/download`, `/releases`):** Release asset distribution, live service health telemetry, and cloud changelog.

---

## 🔄 End-to-End Data Flow Scenarios

### Scenario A: Real-Time Pair Programming Session
1. **Host Action:** Engineer A clicks **Create Session** in Kyvora Studio.
2. **REST Call:** Studio sends `POST /api/v1/collaboration/sessions` to Spring Boot.
3. **Storage:** Backend creates session row in MySQL, assigns unique `sessionId` + `secretToken`, and caches metadata in Valkey.
4. **Invitation:** Engineer A shares `sessionId` and `secretToken` with Engineer B.
5. **Join Flow:** Engineer B enters credentials. `WebSocketAuthInterceptor` verifies token.
6. **Live Streaming:** Both clients establish bidirectional WebSocket pipes to `/ws-collaboration`.
7. **Sync:** Changes in Engineer A's editor emit `TEXT_EDIT` packets; the backend broadcasts them to Engineer B, who sees instant updates with author color attribution.

### Scenario B: Autonomous Agent Refactoring Cycle
1. **User Request:** User prompts the Orchestrator: *"Refactor user service to support OAuth2"*.
2. **Decomposition:** Orchestrator calls the Planner agent to build a task dependency DAG.
3. **Context Retrieval:** RAG Engine queries semantic embeddings of the workspace to pull relevant files (`User.java`, `SecurityConfig.java`).
4. **Code Generation:** Backend Coder agent generates code diffs using Gemini / Claude.
5. **Validation:** Kyvora's AutoTestPipeline runs local build tasks in a sandboxed terminal.
6. **Review & Commit:** Reviewer agent verifies security standards, and the Git engine generates a Conventional Commit.
