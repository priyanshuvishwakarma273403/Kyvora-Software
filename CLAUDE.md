# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## 1. Core Operating Principles

### 1.1 Autonomous Action & Self-Correction
- **Be Autonomous**: Proactively search the workspace, trace dependencies, check types, and fix compile/run errors. Do not stop at the first error; read the logs, find the root cause, and resolve it.
- **Understand the Big Picture**: Before editing files, map out the affected files, imports, and services. Build a mental model of how components interact.
- **Validate Everything**:
  - Always check for TypeScript/Java compilation errors after making changes.
  - Never run tests if there are compilation errors.
  - Fix any linting or formatting issues immediately.

### 1.2 Writing Code (No Placeholders)
- **Zero Placeholders**: Never write comments like `// TODO: implement`, `// ...`, or return stub values. Always implement the complete, fully functional, production-ready logic.
- **Compact & Clean**: Do not make unnecessary formatting changes. Do not duplicate imports. When removing code/imports, ensure the surrounding code remains clean and compact.

---

## 2. Project Architecture & Subproject Guidelines

The workspace is organized into three main directories:
1. `kyvora/` — The custom VS Code-based editor runtime.
2. `Kyvora-Frontend/` — The Next.js web application.
3. `kyvora-backend/` — The Spring Boot collaboration backend.

---

### 2.1 The Editor Runtime (`kyvora/`)
A custom Electron + TypeScript IDE built on VS Code.

#### Architecture Layers (`kyvora/src/vs/`)
- `base/` — Platform utilities, UI basics, and cross-platform abstractions.
- `platform/` — Service definitions and dependency injection infrastructure.
- `editor/` — Text editor, language services, and syntax highlighting.
- `workbench/` — Main workbench interface (browser, services, contrib features, extension host API).
- `sessions/` — Dedicated workbench layer for agentic sessions (runs alongside `workbench`).

#### Coding Standards for `kyvora/`
- **Indentation**: Use **TABS**, not spaces.
- **Dependency Injection**: Always declare service dependencies in constructors. Never access them through `IInstantiationService` elsewhere.
- **Disposables**: You MUST register disposables immediately. Use `DisposableStore`, `MutableDisposable`, or `DisposableMap`. Do not leak event listeners or timers.
- **UI Labels**: Use Title-Style Capitalization for command labels, buttons, and menus (e.g., "Open Folder").
- **Arrow Functions**: Use arrow functions (`=>`) over anonymous function expressions. Only parenthesize parameters when necessary (e.g., `x => x + x` is correct; `(x) => x` is incorrect).
- **Control Flow**: Prefer direct method calls/service interactions over event broadcasting to drive control flow.
- **Compilation**:
  - Do not use `npm run compile`.
  - Use `npm run typecheck-client` to validate type safety.
  - For built-in extensions (`extensions/`), run `npm run gulp compile-extensions`.

---

### 2.2 The Frontend App (`Kyvora-Frontend/`)
A modern Next.js 15 web client using React 19, TypeScript, and Tailwind CSS v4.

#### Technology Stack
- **Framework**: Next.js 15 (App Router under `src/app`).
- **Styling**: Tailwind CSS v4.
- **Animations**: Framer Motion & Lenis (smooth scrolling).
- **Components**: shadcn/ui & @base-ui/react.

#### Frontend Coding Standards & Design Aesthetics
- **Premium Design**: Design interfaces that look professional and high-end. Avoid default colors (plain red/blue/green); use curated, harmonious HSL scales, sleek dark modes, and soft gradients.
- **Smooth Animations**: Integrate Framer Motion micro-animations for hover states, page loads, and active tab transitions.
- **SEO & Semantics**: Use exact title tags, meta descriptions, a single `<h1>` per page, and standard HTML5 semantic tags (`<header>`, `<main>`, `<section>`, `<aside>`, `<footer>`).
- **Development & Verification**: Run `npm run dev` to test locally. Use `npm run build` to verify production bundling and catch static type errors.

---

### 2.3 The Backend Service (`kyvora-backend/`)
A robust Java 21 / Spring Boot 3.2.5 application managing real-time collaboration.

#### Technology Stack
- **Database**: MySQL, managed via Flyway migrations.
- **Caching & Pub/Sub**: Redis.
- **Messaging**: Kafka stream processing.
- **Real-Time**: WebSockets for workspace sync.
- **Auth**: Spring Security + JSON Web Tokens (JJWT 0.12.5).
- **Lombok**: Use `@Data`, `@Getter`, `@Setter`, `@Builder`, and `@Slf4j` to minimize boilerplate.

#### Backend Coding Standards
- **REST APIs**: Use standard HTTP methods (`GET`, `POST`, `PUT`, `DELETE`). Always validate request payloads with `@Valid` / `@NotNull`.
- **Flyway Migrations**: Write database schema updates as Flyway migration scripts (e.g. `V1__init.sql`) in `src/main/resources/db/migration/`. Never alter existing migration files.
- **Security**: Never expose credentials, logs, or secrets. Keep security configurations up to date.

---

## 3. Workflow for Writing Code
1. **Inspect**: Read relevant files, config files, and tests first.
2. **Plan**: Write down an atomic step-by-step implementation plan.
3. **Execute**: Edit files carefully keeping the local style (tabs in editor, spaces in frontend/backend).
4. **Compile & Fix**: Run typecheckers or build commands. Automatically resolve any issues.
5. **No Placeholders**: Ensure every single line of code is complete and functional.
