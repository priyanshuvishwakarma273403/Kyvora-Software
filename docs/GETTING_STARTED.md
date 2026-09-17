# 🚀 Kyvora Getting Started Guide

This guide walks you through setting up, running, building, and contributing to the **Kyvora** ecosystem from source.

---

## 📋 System Prerequisites

Before getting started, ensure you have the following software installed:

| Tool | Recommended Version | Purpose |
| :--- | :--- | :--- |
| **Node.js** | `v20.x` or `v22.x LTS` | Runtime for Kyvora Studio & Next.js Web Portal |
| **Yarn** / **npm** | `Yarn v1.22+` or `npm v10+` | Package manager for desktop editor & web modules |
| **Java Development Kit (JDK)** | `JDK 21 (Eclipse Temurin / OpenJDK)` | Runtime & compiler for Kyvora Collaboration Backend |
| **Apache Maven** | `v3.9.x` (or use bundled `mvnw`) | Build system for Spring Boot backend |
| **Docker & Docker Compose** | Latest Desktop version | Container orchestration for MySQL, Valkey & Kafka |
| **Inno Setup** *(Windows only)* | `v6.x` | Required for compiling the `.exe` setup installer |
| **Python** | `v3.10+` | Required by node-gyp for native Electron modules |

---

## ⚡ Quick Start: One-Click Launch

For instant local development on Windows, Kyvora provides convenient automated launcher batch scripts located at the workspace root:

### 1. Launch All Platform Services & IDE
```powershell
.\start_kyvora.bat
```
*What this script does:*
1. Reads environment configurations from `.env`.
2. Spins up the **Spring Boot Collaboration Backend** on port `8080` in a dedicated terminal.
3. Spins up the **Next.js Web Portal** on port `3000` in a dedicated terminal.
4. Launches **Kyvora Studio Desktop IDE** in development mode.
5. Automatically opens your browser to `http://localhost:3000`.

### 2. Launch Kyvora Studio IDE Only
```powershell
.\run_kyvora.bat
```
Launches the standalone Kyvora Studio desktop client directly without starting the background web servers.

---

## 🛠️ Manual Subproject Setup

If you prefer to run and debug individual components independently, follow the modular steps below:

### 1. Kyvora Collaboration Backend (`kyvora-backend`)

The backend is built with Spring Boot 3.2.5 and Java 21.

```powershell
# Navigate to backend directory
cd kyvora-backend

# Ensure local infrastructure is running (or connect to Aiven Cloud)
# To run local MySQL, Valkey, and Kafka:
docker-compose -f ../docker-compose.yml up -d mysql valkey kafka

# Run the Spring Boot application
.\mvnw.cmd spring-boot:run
# Or on Linux/macOS:
# ./mvnw spring-boot:run
```

*Verification:*
- Health Check: `http://localhost:8080/actuator/health` (or login endpoint `http://localhost:8080/api/v1/auth/login`)
- WebSocket Endpoint: `ws://localhost:8080/ws-collaboration`

---

### 2. Kyvora Web Application (`Kyvora-Frontend`)

The web portal is built with Next.js 15, React 19, and Tailwind CSS v4.

```powershell
# Navigate to frontend directory
cd Kyvora-Frontend

# Install dependencies
npm install

# Run the development server with Turbopack
npm run dev
```

*Verification:*
- Open your browser at `http://localhost:3000`
- Explore the interactive IDE simulator, documentation, and agent pages.

---

### 3. Kyvora Studio Desktop IDE (`kyvora`)

Kyvora Studio is compiled and executed using an Electron + TypeScript pipeline:

```powershell
# Navigate to desktop editor directory
cd kyvora

# Install dependencies (using yarn or npm)
yarn install

# Terminal 1: Start background file watcher & TypeScript transpiler
npm run watch

# Terminal 2: Launch the Electron desktop client
.\scripts\code.bat
```

> [!TIP]
> To run type safety checks across the client runtime without building full bundles, run:
> ```powershell
> npm run typecheck-client
> ```

---

## 📦 Compiling Production Release Binaries

Kyvora Studio uses an optimized Gulp & esbuild pipeline to package production executables across multiple platforms:

### 🪟 Windows (x64)

1. **Compile the standalone portable package:**
   ```powershell
   cd kyvora
   npm run gulp vscode-win32-x64
   ```
   *Output Folder:* `d:\Cursor-clone\VSCode-win32-x64`

2. **Copy Inno Setup updaters:**
   ```powershell
   npm run gulp vscode-win32-x64-inno-updater
   ```

3. **Build the complete `.exe` Setup Installer:**
   ```powershell
   npm run gulp vscode-win32-x64-user-setup
   ```
   *Output Installer:* `d:\Cursor-clone\kyvora\.build\win32-x64\user-setup\KyvoraSetup.exe` (or pre-compiled installer at root `Kyvora-Studio-Setup-x64.exe`).

### 🐧 Linux (x64)
```bash
npm run gulp vscode-linux-x64
```
*Output Folder:* `VSCode-linux-x64`

### 🍎 macOS (Intel & Apple Silicon)
- **Apple Silicon (M1/M2/M3/ARM64):**
  ```bash
  npm run gulp vscode-darwin-arm64
  ```
- **Intel x64:**
  ```bash
  npm run gulp vscode-darwin-x64
  ```

---

## 🐳 Running Full Stack with Docker Compose

To run the complete Kyvora stack (MySQL 8.0, Valkey 7.2, Kafka 3.7 KRaft mode, and the Spring Boot backend) in isolated Docker containers:

```powershell
# Start all services in the background
docker-compose up --build -d

# View real-time logs
docker-compose logs -f kyvora-backend

# Stop all containers
docker-compose down
```

---

## 🔑 Environment Configuration (`.env`)

Create or update `.env` in the root directory:

```env
# Database Credentials
DATABASE_URL=jdbc:mysql://localhost:3306/kyvora_collaboration?useSSL=false&serverTimezone=UTC
DATABASE_USER=kyvora_admin
DATABASE_PASS=kyvora_secure_pass_2026

# Valkey / Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Apache Kafka
KAFKA_BOOTSTRAP_SERVERS=localhost:9092
KAFKA_SECURITY_PROTOCOL=PLAINTEXT

# AI Model API Keys (For AI Gateway & Agent Swarms)
GEMINI_API_KEY=your_gemini_api_key_here
OPENROUTER_API_KEY=your_openrouter_api_key_here
GROQ_API_KEY=your_groq_api_key_here
HUGGINGFACE_API_KEY=your_huggingface_api_key_here
SAMBANOVA_API_KEY=your_sambanova_api_key_here

# Mail Alerts (Optional Gmail SMTP)
SPRING_MAIL_HOST=smtp.gmail.com
SPRING_MAIL_PORT=587
SPRING_MAIL_USERNAME=your_email@gmail.com
SPRING_MAIL_PASSWORD=your_16_char_app_password
RECIPIENT_EMAIL=your_email@gmail.com
```

Now you're ready to build, collaborate, and develop with Kyvora!
