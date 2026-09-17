# Kyvora Studio Engine

<p align="center">
  <strong>The Desktop Runtime & Editor Engine for the Kyvora Ecosystem</strong>
</p>

<p align="center">
  <a href="https://kyvora-frontend-sand.vercel.app/"><img src="https://img.shields.io/badge/Hosted%20Web%20Portal-Live%20Demo-8A2BE2?style=flat-square&logo=vercel" alt="Live Demo"></a>
  <a href="../README.md"><img src="https://img.shields.io/badge/Root%20Docs-Kyvora%20Overview-blueviolet?style=flat-square" alt="Documentation"></a>
  <a href="../LICENSE"><img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License"></a>
</p>

---

## 📌 Overview

**Kyvora Studio** is a high-performance desktop IDE runtime built on Electron and TypeScript. It serves as the primary developer interface for the Kyvora ecosystem, featuring:

- **Integrated Real-Time Collaboration Hub:** Multi-user live pairing, cursor broadcasting, delta buffer syncing, team chat, and voice indicators.
- **Autonomous Multi-Agent Swarm (`kyvoraAgents`):** Built-in agent orchestrators running compile-test-debug loops in real-time.
- **Semantic Codebase Context Graph:** Deep multi-file AST indexing and symbol dependency resolution.
- **Hardware-Accelerated Workbench:** Highly responsive layout with dedicated agent session layers (`vs/sessions`).

---

## 🚀 Quick Launch

To launch Kyvora Studio in development mode:

```powershell
# 1. Start the background compiler watcher
npm run watch

# 2. Launch the desktop client
.\scripts\code.bat
```

To run typecheck validation across the client:
```powershell
npm run typecheck-client
```

---

## 📖 Complete Documentation

For the full platform architecture, cloud backend, web portal, API specifications, and security policies, please refer to the primary repository documentation:

- 🏛️ [System Architecture](../docs/ARCHITECTURE.md)
- 🚀 [Getting Started & Build Guide](../docs/GETTING_STARTED.md)
- 👥 [Real-Time Collaboration Guide](../docs/COLLABORATION_GUIDE.md)
- 🤖 [AI & Autonomous Agents](../docs/AI_AND_AGENTS.md)
- 🔌 [API & WebSocket Reference](../docs/API_REFERENCE.md)
- 🛡️ [Security Policy](../docs/SECURITY.md)
- ☁️ [Production Deployment](../docs/DEPLOYMENT.md)

---

## 📄 License

Kyvora Studio is open source software released under the [MIT License](../LICENSE).
