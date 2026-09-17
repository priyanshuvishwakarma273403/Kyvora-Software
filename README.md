<div align="center">

# ⚡ KYVORA

### The Next-Generation AI-Native IDE & Real-Time Collaborative Development Ecosystem

[![Live Web Portal](https://img.shields.io/badge/Hosted%20Portal-kyvora--frontend--sand.vercel.app-8A2BE2?style=for-the-badge&logo=vercel&logoColor=white)](https://kyvora-frontend-sand.vercel.app/)
[![License: MIT](https://img.shields.io/badge/License-MIT-00C853?style=for-the-badge)](LICENSE)
[![Version](https://img.shields.io/badge/Release-v1.0.0-blueviolet?style=for-the-badge)](releases/)
[![Java](https://img.shields.io/badge/Backend-Java%2021%20%7C%20Spring%20Boot%203.2.5-orange?style=for-the-badge&logo=openjdk&logoColor=white)](kyvora-backend/)
[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2015%20%7C%20React%2019-black?style=for-the-badge&logo=next.js&logoColor=white)](Kyvora-Frontend/)
[![Electron](https://img.shields.io/badge/Desktop%20Studio-Electron%20%7C%20TypeScript-47848F?style=for-the-badge&logo=electron&logoColor=white)](kyvora/)

<br/>

[**🌐 Live Cloud Web Portal**](https://kyvora-frontend-sand.vercel.app/) • [**📥 Download Studio (.exe)**](#-downloads--releases) • [**📖 Documentation Suite**](#-comprehensive-documentation-suite) • [**🏛️ System Architecture**](docs/ARCHITECTURE.md) • [**👥 Collaboration Guide**](docs/COLLABORATION_GUIDE.md)

</div>

---

## 🌟 Executive Overview

Conventional code editors treat your project files as isolated text buffers, leaving developers to mentally manage cross-file dependencies and manually fix syntax bugs.

**Kyvora** fundamentally reimagines software engineering. It is an end-to-end, enterprise-grade engineering ecosystem combining:

1. **💻 Kyvora Studio IDE:** A high-performance hardware-accelerated desktop application featuring dedicated Agent Windows (`vs/sessions`), semantic AST codebase indexing, and real-time pairing hubs.
2. **⚙️ Kyvora Cloud Backend:** A reactive **Java 21 / Spring Boot 3.2.5** microservice cluster managing live WebSocket delta sync, Apache Kafka event streaming, Valkey in-memory caching, and multi-model AI routing.
3. **🌐 Kyvora Web Portal:** A modern **Next.js 15 + React 19** showcase and dashboard platform deployed on Vercel ([https://kyvora-frontend-sand.vercel.app/](https://kyvora-frontend-sand.vercel.app/)) featuring an interactive browser editor simulator and documentation center.

---

## ✨ Key Pillars & Capabilities

```
  ┌────────────────────────────────────────────────────────────────────────┐
  │                               KYVORA CORE                              │
  └────────────────────────────────────────────────────────────────────────┘
          │                                  │                        │
          ▼                                  ▼                        ▼
  ┌─────────────────────┐          ┌───────────────────┐    ┌─────────────────────┐
  │ 🧠 CONTEXT GRAPH    │          │ 🤖 AGENT SWARMS   │    │ 👥 REAL-TIME PAIR   │
  │ • Incremental AST   │          │ • 12+ Agent Roles │    │ • Multi-Cursor Sync │
  │ • Semantic Vectors  │          │ • Self-Correction │    │ • Delta Buffer Edit │
  │ • Cross-File Types  │          │ • Terminal Loops  │    │ • Chat & Voice P2P  │
  └─────────────────────┘          └───────────────────┘    └─────────────────────┘
```

### 🧠 1. Deep Codebase Context Graph
- **Workspace AST Parsing:** Rather than feeding blind file truncations into an LLM, Kyvora compiles an in-memory graph of all classes, methods, endpoints, and types across your workspace.
- **Dependency Tracking:** Automatically traces how backend schema migrations impact frontend interfaces, ensuring zero-breakage refactoring.

### 🤖 2. Autonomous Multi-Agent Swarms
- **12+ Specialized Roles:** Orchestrator, Planner, Architect, Fullstack/Backend/Frontend Coders, Tester, Reviewer, Debugger, and Security Auditor.
- **Closed Execution Loops:** Agents don't just recommend code; they execute terminal commands, run test runners, parse stack traces, and self-correct errors autonomously before requesting review.

### 👥 3. Enterprise Real-Time Collaboration Hub
- **Live Multi-Cursor Pairing:** Smooth remote cursor interpolation and color-coded user name tags.
- **Delta Buffer Synchronization:** Low-latency buffer sync over WebSockets preserving local undo/redo histories.
- **Integrated Team Workspace:** Real-time room chat, shared terminal sessions for remote debugging, and peer voice activity indicators.

### ⚡ 4. Multi-Model AI Routing & Local Privacy
- **Universal LLM Gateway:** Unified routing across Anthropic Claude 3.5 Sonnet / Opus, OpenAI GPT-4o, Google Gemini Ultra, and ultra-fast Groq LPU.
- **Offline & Air-Gapped Mode:** Zero-leak local inference support via Ollama or LM Studio.

### 🛡️ 5. Enterprise Security & Sandboxing
- **Role-Based Access Control (RBAC):** Granular permissions for `USER`, `EDITOR`, and `ADMIN` profiles.
- **Stateless JWT Security:** Cryptographic token signing with HMAC-SHA512.
- **Sandbox Terminal Containment:** Strict boundaries prevent agents from accessing files or executing destructive operations outside the active workspace.

---

## 🏛️ System Architecture Topology

Kyvora is built on a resilient **3-Tier Distributed Topology**:

```mermaid
graph TB
    subgraph Client Tier ["1. Client Application Tier"]
        KS["💻 Kyvora Studio IDE<br/>(Electron + TypeScript Runtime)"]
        WP["🌐 Kyvora Web Portal<br/>(Next.js 15 + React 19 + Turbopack)<br/>https://kyvora-frontend-sand.vercel.app/"]
    end

    subgraph Gateway ["Edge & Security Boundary"]
        WSS["WebSocket Gateway (/ws-collaboration)"]
        REST["REST API Gateway (/api/v1)"]
    end

    subgraph Service Tier ["2. Backend Services Tier (Java 21 / Spring Boot 3.2.5)"]
        AUTH["🔐 Auth & RBAC Manager<br/>(JJWT 0.12.5)"]
        COLLAB["👥 Real-Time Collaboration Hub<br/>(Delta & Session Controller)"]
        AI_GW["🧠 Multi-Model AI Gateway<br/>(Gemini, Claude, Groq, Ollama)"]
        RAG_ENG["📚 RAG & Context Engine<br/>(AST & Vector Search)"]
        EVENT_BUS["📡 Event Streaming Controller"]
    end

    subgraph Data Tier ["3. Infrastructure & Persistence Tier"]
        VALKEY[("⚡ Valkey / Redis 7.2<br/>Presence State & User Cache")]
        KAFKA["📨 Apache Kafka (SASL_SSL)<br/>Distributed Event Stream & Alerts"]
        MYSQL[("🗄️ MySQL 8.0<br/>Relational Persistence + Flyway")]
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

    EVENT_BUS -->|Publish Events| KAFKA
    KAFKA -->|Consume Notifications| EVENT_BUS
    EVENT_BUS --> SMTP
```

> 📖 **Read the Full Deep Dive:** [System Architecture Specification](docs/ARCHITECTURE.md)

---

## 📁 Repository Organization

The Kyvora repository is organized into distinct, specialized subprojects:

| Directory / File | Description | Technologies |
| :--- | :--- | :--- |
| **`kyvora/`** | The desktop IDE runtime and hardware-accelerated editor. | Electron, TypeScript, Monaco Editor |
| **`kyvora-backend/`** | Real-time collaboration engine, AI gateway, and security cluster. | Java 21, Spring Boot 3.2.5, JJWT |
| **`Kyvora-Frontend/`** | Web portal, documentation, and live editor preview. | Next.js 15, React 19, Tailwind v4 |
| **`docs/`** | Comprehensive architectural, API, and setup documentation suite. | Markdown, Mermaid |
| **`docker-compose.yml`** | Container orchestration for MySQL, Valkey, Kafka, and backend. | Docker, Docker Compose |
| **`start_kyvora.bat`** | One-click Windows launcher for all platform services + IDE. | Batch Script |
| **`run_kyvora.bat`** | Instant launcher for standalone Kyvora Studio IDE. | Batch Script |
| **`LICENSE`** | Open-source MIT License. | MIT |
| **`SECURITY.md`** | Security and responsible disclosure guidelines. | Markdown |

---

## ⚡ Quick Start

### Method 1: One-Click Automated Launch (Windows)

Launch the entire ecosystem (Backend, Web Portal, and Studio IDE) with a single command:

```powershell
.\start_kyvora.bat
```

Or launch only the Studio desktop editor:
```powershell
.\run_kyvora.bat
```

---

### Method 2: Modular Developer Setup

#### 1. Collaboration Backend (`kyvora-backend`)
```powershell
cd kyvora-backend
# Spin up local database and cache (or connect to Aiven Cloud)
docker-compose -f ../docker-compose.yml up -d mysql valkey kafka

# Run Spring Boot service
.\mvnw.cmd spring-boot:run
```
*Listening on:* `http://localhost:8080` (WebSocket at `ws://localhost:8080/ws-collaboration`)

#### 2. Web Portal (`Kyvora-Frontend`)
```powershell
cd Kyvora-Frontend
npm install
npm run dev
```
*Listening on:* `http://localhost:3000` (Hosted Live: [kyvora-frontend-sand.vercel.app](https://kyvora-frontend-sand.vercel.app/))

#### 3. Desktop Studio IDE (`kyvora`)
```powershell
cd kyvora
yarn install

# Terminal 1: Watch & compile
npm run watch

# Terminal 2: Launch Electron client
.\scripts\code.bat
```

---

### Method 3: Containerized Full-Stack (Docker Compose)

Run the backend with MySQL, Valkey, and Apache Kafka in Docker:

```powershell
docker-compose up --build -d
```

> 📖 **Full Setup Instructions:** [Getting Started Guide](docs/GETTING_STARTED.md)

---

## 👥 Real-Time Pair Programming in Action

Kyvora enables developers to pair program with zero setup friction:

```
[Host: Alice] ──────── Create Session ───────► [Spring Boot Hub]
      │                                                │
      ▼                                                ▼
Copies Session ID & Token                     Saves Session in Valkey
      │                                                │
      ▼                                                ▼
Shares with Bob ──────── Joins Session ───────► [Both Connected]
                                                       │
  ┌────────────────────────────────────────────────────┴────────────────────────────────────────────────────┐
  ▼                                                    ▼                                                    ▼
[Live Cursor Sync]                             [Delta Buffer Edit]                                  [Shared Team Chat]
Alice sees Bob's purple caret                  Zero-conflict typing                                 Integrated markdown chat
```

### Testing Two Independent Instances Locally
Simulate two concurrent users on one machine with isolated profiles:

```powershell
# Instance 1 (User A)
.\scripts\code.bat --user-data-dir="dev-user-data-1" --extensions-dir="dev-ext-1"

# Instance 2 (User B)
.\scripts\code.bat --user-data-dir="dev-user-data-2" --extensions-dir="dev-ext-2"
```

1. In Instance 1, open **Collaboration Hub** -> Sign up as `alice` -> Click **Create Session**.
2. Copy the **Session ID** and **Secret Token**.
3. In Instance 2, sign up as `bob` -> Paste credentials into **Join Session**.
4. Enjoy real-time multi-cursor pairing, shared typing, and live team chat!

> 📖 **Step-by-Step Walkthrough:** [Collaboration Testing Guide](docs/COLLABORATION_GUIDE.md)

---

## 📚 Comprehensive Documentation Suite

Kyvora includes in-depth guides covering every facet of the platform:

| Guide | Purpose | Direct Link |
| :--- | :--- | :--- |
| 🏛️ **System Architecture** | 3-tier topology, client layers, event streaming, data models | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| 🚀 **Getting Started** | Prerequisites, compilation, release packaging, environment setup | [docs/GETTING_STARTED.md](docs/GETTING_STARTED.md) |
| 👥 **Real-Time Collaboration** | Multi-instance pairing, WebSocket packets, room secrets, cursors | [docs/COLLABORATION_GUIDE.md](docs/COLLABORATION_GUIDE.md) |
| 🤖 **AI & Autonomous Agents** | 12+ Agent swarm roles, context graphs, loops, MCP gateway | [docs/AI_AND_AGENTS.md](docs/AI_AND_AGENTS.md) |
| 🔌 **API & WebSocket Spec** | Full REST endpoint specifications, payload schemas, auth headers | [docs/API_REFERENCE.md](docs/API_REFERENCE.md) |
| 🛡️ **Security & Governance** | RBAC policies, JWT verification, terminal sandboxing, disclosure | [docs/SECURITY.md](docs/SECURITY.md) |
| ☁️ **Cloud Deployment** | Render backend setup, Vercel hosting, Aiven cloud infrastructure | [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) |

---

## 📦 Downloads & Releases

Pre-compiled production releases of **Kyvora Studio** for Windows x64:

- 🪟 **Installer (.exe):** [`Kyvora-Studio-Setup-x64.exe`](Kyvora-Studio-Setup-x64.exe) (188 MB)
- 🪟 **Standalone Setup:** [`KyvoraSetup.exe`](KyvoraSetup.exe) (261 MB)
- 🐧 **Linux x64:** Compile via `npm run gulp vscode-linux-x64`
- 🍎 **macOS (Apple Silicon & Intel):** Compile via `npm run gulp vscode-darwin-arm64`

---

## 🔑 Environment Variables Reference (`.env`)

```env
# Database Credentials
DATABASE_URL=jdbc:mysql://localhost:3306/kyvora_collaboration?useSSL=false&serverTimezone=UTC
DATABASE_USER=kyvora_admin
DATABASE_PASS=kyvora_secure_pass_2026

# Valkey / Redis Caching
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Apache Kafka Event Streaming
KAFKA_BOOTSTRAP_SERVERS=localhost:9092
KAFKA_SECURITY_PROTOCOL=PLAINTEXT

# AI Model Keys (Gemini, OpenRouter, Groq, HuggingFace)
GEMINI_API_KEY=your_gemini_api_key
OPENROUTER_API_KEY=your_openrouter_api_key
GROQ_API_KEY=your_groq_api_key

# Transactional Mail Alerts
SPRING_MAIL_HOST=smtp.gmail.com
SPRING_MAIL_PORT=587
SPRING_MAIL_USERNAME=alerts@kyvora.io
SPRING_MAIL_PASSWORD=your_gmail_app_password
RECIPIENT_EMAIL=admin@kyvora.io
```

---

## 🛡️ Security & Compliance

Kyvora enforces enterprise security at every boundary:
- **RBAC:** `ROLE_USER`, `ROLE_EDITOR`, and `ROLE_ADMIN` enforced via Spring Security `@PreAuthorize`.
- **JWT Cryptography:** Signed with **HMAC-SHA512** with strict expiration and token revoking.
- **Sandboxed Agent Execution:** Destructive shell commands (`rm -rf`, disk wipes) are intercepted and prevented by sandbox guards.
- **Vulnerability Disclosure:** Read our complete [Security Policy](SECURITY.md) or contact `security@kyvora.io`.

---

## 📄 License

Kyvora Software is released under the open-source **[MIT License](LICENSE)**.

```
Copyright (c) 2026 Kyvora Software Contributors.
Licensed under the MIT License.
```

<div align="center">

**[Explore Hosted Web Portal](https://kyvora-frontend-sand.vercel.app/)** • **[Star Repository](#)** • **[Read Architecture](docs/ARCHITECTURE.md)**

Made with passion for the future of software engineering.

</div>
