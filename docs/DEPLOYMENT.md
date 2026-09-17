# ☁️ Kyvora Production Deployment & Cloud Guide

This guide outlines how to deploy the **Kyvora** software ecosystem to production cloud providers, orchestrate self-hosted infrastructure, and configure managed cloud services.

---

## 🌐 Production Architecture Overview

The production deployment consists of:
1. **Kyvora Cloud Web Portal:** Hosted on **Vercel** ([https://kyvora-frontend-sand.vercel.app/](https://kyvora-frontend-sand.vercel.app/)).
2. **Kyvora Backend Service:** Deployed on **Render.com** (Docker runtime, port `8080`).
3. **Cloud Infrastructure (Aiven):**
   - **MySQL:** Managed database with SSL encryption.
   - **Valkey:** High-speed cache and real-time state store with TLS.
   - **Apache Kafka:** Event broker with SASL_SSL / SCRAM-SHA-256.
4. **Desktop Client Distribution:** Pre-compiled binaries (`.exe`) hosted via GitHub Releases and cloud CDNs.

---

## 🚀 1. Deploying the Web Portal (Vercel)

The Next.js 15 frontend is optimized for zero-configuration continuous deployment on Vercel:

1. Connect your repository to **Vercel**.
2. Select the **Root Directory** as `Kyvora-Frontend`.
3. Framework Preset: **Next.js**.
4. Build Command: `npm run build` (uses Turbopack).
5. Output Directory: `.next`.
6. Add Environment Variables:
   - `NEXT_PUBLIC_BACKEND_URL`: URL to your live Spring Boot backend (e.g. `https://kyvora-backend.onrender.com`).
   - `NEXT_PUBLIC_WS_URL`: WebSocket URL to the backend (e.g. `wss://kyvora-backend.onrender.com/ws-collaboration`).
7. Deploy! Your portal will be accessible at `https://kyvora-frontend-sand.vercel.app/`.

---

## 🐳 2. Deploying the Backend on Render.com

The Java 21 / Spring Boot backend includes a multi-stage `Dockerfile` (`kyvora-backend/Dockerfile`):

### Step 1: Create a Web Service
1. In the **Render Dashboard**, click **New +** -> **Web Service**.
2. Connect your Git repository.
3. Configuration:
   - **Name:** `kyvora-backend`
   - **Language:** `Docker`
   - **Root Directory:** `kyvora-backend`
   - **Branch:** `main`

### Step 2: Configure Environment Variables in Render

| Variable | Description | Example / Recommended Value |
| :--- | :--- | :--- |
| `DATABASE_URL` | MySQL JDBC URL with SSL | `jdbc:mysql://<host>:<port>/kyvora?useSSL=true&requireSSL=true&serverTimezone=UTC` |
| `DATABASE_USER` | MySQL Username | `avnadmin` |
| `DATABASE_PASS` | MySQL Password | `your_secure_password` |
| `REDIS_HOST` | Valkey Hostname | `<host>.aivencloud.com` |
| `REDIS_PORT` | Valkey Port | `28953` |
| `REDIS_PASSWORD` | Valkey Password | `your_valkey_password` |
| `REDIS_SSL_ENABLED`| Enable TLS encryption | `true` |
| `KAFKA_BOOTSTRAP_SERVERS`| Kafka Broker endpoint | `<host>.aivencloud.com:28965` |
| `KAFKA_SECURITY_PROTOCOL`| Kafka Transport Protocol | `SASL_SSL` |
| `KAFKA_SASL_MECHANISM` | SASL Auth Mechanism | `SCRAM-SHA-256` |
| `KAFKA_JAAS_CONFIG` | JAAS Auth configuration | `org.apache.kafka.common.security.scram.ScramLoginModule required username="..." password="...";` |
| `SPRING_MAIL_USERNAME` | SMTP Alert sender | `alerts@kyvora.io` |
| `SPRING_MAIL_PASSWORD` | SMTP 16-character App Password | `app_password_here` |
| `GEMINI_API_KEY` | Google Gemini API Key | `AIza...` |
| `OPENROUTER_API_KEY` | OpenRouter Failover Key | `sk-or-...` |
| `GROQ_API_KEY` | Groq Fast LPU Key | `gsk_...` |

> [!NOTE]
> **Aiven Kafka Free/Trial Partition Limit:**
> Aiven enforces a limit of **maximum 2 partitions per topic** on trial tiers. Standard Kafka configurations default to 3 or more partitions, triggering `PolicyViolationException`.
> Kyvora explicitly configures all topics with `.partitions(1)` in `KafkaTopicConfig.java` to prevent deployment halts.

---

## 🖥️ 3. Self-Hosted Deployment (Docker Compose)

For air-gapped internal enterprise networks or private VPS instances:

```bash
# Clone the repository
git clone https://github.com/priyanshuvishwakarma273403/Kyvora-Software.git
cd Kyvora-Software

# Copy and update production configuration
cp .env.example .env

# Spin up complete stack
docker-compose up --build -d
```

Containers launched:
- `kyvora-mysql` on port `3309 -> 3306`
- `kyvora-valkey` on port `6379`
- `kyvora-kafka` (KRaft broker) on port `9092 / 9094`
- `kyvora-backend-app` on port `8080`

---

## 📦 4. Desktop Client Distribution

To release desktop builds to your organization or open-source community:

1. Compile the Windows binary via Inno Setup (`npm run gulp vscode-win32-x64-user-setup`).
2. Upload `Kyvora-Studio-Setup-x64.exe` to your release storage bucket or GitHub Releases.
3. Users download and run the installer. The app installs into `%LOCALAPPDATA%\Programs\Kyvora Studio` and creates start menu shortcuts.
