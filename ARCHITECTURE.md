# Architecture Document

This document describes the high-level architecture, component design, data flow, and key engineering decisions behind the AI Code Review Assistant.

---

## 1. System Architecture

The application follows a **decoupled client-server architecture** with three distinct layers:

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser)                            │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                    Next.js 16 (App Router)                     │  │
│  │                                                                │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │  │
│  │  │  Auth    │  │ Projects │  │Workspace │  │  AI Chat     │   │  │
│  │  │  Pages   │  │Dashboard │  │  Page    │  │  Component   │   │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────────┘   │  │
│  │                                                                │  │
│  │  ┌──────────────────────────────────────────────────────────┐  │  │
│  │  │              Shared: AuthContext, API Client              │  │  │
│  │  └──────────────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                              │                                       │
│                    /api/* proxy (next.config.js)                      │
└──────────────────────────────┼───────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      SERVER (FastAPI)                                │
│                                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐    │
│  │ projects │  │  files   │  │ai_provid │  │   Auth Middleware │    │
│  │  router  │  │  router  │  │  router  │  │   (JWT verify)   │    │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────────────────┘    │
│       │              │              │                                │
│  ┌────▼──────────────▼──────────────▼──────────────────────────┐    │
│  │                    Service Layer                             │    │
│  │  ┌────────────┐  ┌────────────┐  ┌──────────────────────┐   │    │
│  │  │ Review     │  │    ZIP     │  │   Tree Builder       │   │    │
│  │  │ Engine     │  │ Extractor  │  │                      │   │    │
│  │  └──────┬─────┘  └────────────┘  └──────────────────────┘   │    │
│  │         │                                                    │    │
│  │  ┌──────▼──────────────────────────────────────────────┐    │    │
│  │  │              AI Subsystem                            │    │    │
│  │  │  ┌─────────────┐  ┌──────────┐  ┌───────────────┐   │    │    │
│  │  │  │   Prompt    │  │ Provider │  │   Context      │   │    │    │
│  │  │  │  Templates  │  │  Client  │  │   Builder      │   │    │    │
│  │  │  └─────────────┘  └──────────┘  └───────────────┘   │    │    │
│  │  └──────────────────────────────────────────────────────┘    │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                              │                                       │
└──────────────────────────────┼───────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    DATA LAYER                                       │
│                                                                     │
│  ┌──────────────────────┐    ┌──────────────────────────────────┐   │
│  │  PostgreSQL (Supabase)│    │  AI Provider (External)          │   │
│  │                       │    │  OpenAI / LM Studio / Ollama     │   │
│  │  - Users (auth.users) │    │                                  │   │
│  │  - Projects           │    │  Accessed via httpx (async)      │   │
│  │  - Files              │    │  OpenAI-compatible chat/         │   │
│  │  - Reviews            │    │  completions endpoint            │   │
│  │  - Issues             │    └──────────────────────────────────┘   │
│  │  - AI Provider Configs│                                          │
│  │  - Chat Sessions      │                                          │
│  └──────────────────────┘                                           │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Frontend Architecture

### Framework & Routing
- **Next.js 16** with the App Router and React 19
- File-based routing under `src/app/`
- Route groups: `(auth)` for login/register, `(root)` for the landing page, `projects/` for the dashboard and workspace

### State Management
The application uses **React's built-in state** (`useState`, `useEffect`, `useContext`) exclusively. No external state management libraries are used — this was a deliberate decision to keep the dependency footprint minimal and the mental model simple.

- **AuthContext** — Global context providing `user`, `session`, `signIn`, `signUp`, `signOut` across the component tree
- **Page-level state** — The workspace page (`projects/[projectId]/page.tsx`) manages all workspace state (tree, files, issues, reviews, active tabs) in a single component, passing props down to child components

### Key Components

| Component | Responsibility |
|---|---|
| `Navbar` | Global navigation, user info, sign-out |
| `ProtectedRoute` | Auth guard wrapper — redirects unauthenticated users |
| `FileTree` | Recursive tree renderer with search, expand/collapse, severity badges |
| `CodeViewer` | Syntax-highlighted code display with line-level severity highlighting and inline AI actions |
| `OverviewTab` | Project dashboard with stats, severity breakdown, review coverage, review history table |
| `ReviewScopeModal` | Multi-step modal for configuring review scope, file selection, templates, and depth |
| `CodeUploadModal` | ZIP upload with drag-and-drop, progress tracking, and GitHub URL import |
| `ProviderSettingsModal` | Full CRUD for AI provider configurations with live connection testing |
| `AIChat` | Context-aware chat interface with mode switching (issue / file / project context) |

### API Communication
All API calls go through a centralized `api` utility (`src/lib/api.ts`) that:
1. Automatically injects the Supabase JWT token via `Authorization: Bearer` header
2. Provides typed generic methods: `get<T>`, `post<T>`, `put<T>`, `patch<T>`, `delete<T>`
3. Routes through Next.js rewrites (`/api/*` → `http://127.0.0.1:8000/api/*`) to avoid CORS complexity

### Styling
- **Tailwind CSS 3.4** with a custom dark theme
- Consistent design tokens: `zinc-950` backgrounds, `sky-500` primary accents, `white/5` borders
- Glassmorphism effects, subtle gradients, and micro-animations for a premium feel

---

## 3. Backend Architecture

### Framework
**FastAPI** with async support throughout. The application uses:
- **SQLAlchemy 2.0** async sessions with `asyncpg` driver
- **SQLModel** for ORM models (combining Pydantic + SQLAlchemy)
- **Pydantic Settings** for configuration management
- **python-jose** for JWT verification

### Layer Separation

```
Routers (HTTP handlers)
    │
    ├── projects.py    — Projects, reviews, issues, chat, stats
    ├── files.py       — File upload (ZIP), content retrieval
    └── ai_providers.py — Provider CRUD, connection testing
    │
Services (Business logic)
    │
    ├── zip_extractor.py   — ZIP parsing, binary detection, file storage
    ├── tree_builder.py    — Hierarchical tree construction from flat file paths
    └── ai/
        ├── review_engine.py   — Orchestrates the full review lifecycle
        ├── provider_client.py — Generic OpenAI-compatible HTTP client
        ├── prompts.py         — Template-specific system prompts
        └── context_builder.py — Assembles file content into AI context
```

### Authentication Flow
1. The frontend authenticates with Supabase Auth and receives a JWT
2. Every API request includes the JWT in the `Authorization` header
3. The `get_current_user` dependency in FastAPI decodes and verifies the JWT using the Supabase JWT secret
4. The extracted `user_id` (UUID) is injected into route handlers for ownership checks

### Review Engine (Async Background Processing)
The review engine is designed to be **non-blocking**:

```
1. User triggers review → POST /projects/{id}/reviews
2. Backend creates a Review record with status="running"
3. BackgroundTask is spawned (FastAPI's built-in)
4. For each file in scope:
   a. Context Builder assembles the file content + metadata
   b. Prompt Builder selects the template (security/performance/quality)
   c. Provider Client sends the request to the configured AI endpoint
   d. Response is parsed (JSON extraction from AI output)
   e. Issues are saved to the database with severity, line numbers, recommendations
5. Review status is updated to "completed" or "failed"
6. Frontend polls every 3 seconds and updates the UI when done
```

### AI Provider Client
The `provider_client.py` is a **generic OpenAI-compatible client** that works with any endpoint following the `/chat/completions` format:

```python
# The same client works for:
# - OpenAI (https://api.openai.com/v1)
# - LM Studio (http://localhost:1234/v1)
# - Ollama (http://localhost:11434/v1)
# - Any compatible endpoint
```

Key design decisions:
- Uses `httpx.AsyncClient` for non-blocking HTTP
- Configurable timeout (120s for large codebases)
- Graceful error handling with provider-specific error messages
- JSON extraction from AI responses with fallback parsing

---

## 4. Database Design

### Entity-Relationship Diagram

```
auth.users (Supabase-managed)
    │
    ├──── 1:N ──── ai_provider_configs
    │                    │
    ├──── 1:N ──── projects
    │                    │
    │               ├── 1:N ──── files
    │               │              │
    │               ├── 1:N ──── reviews ──── N:M ──── review_files
    │               │              │
    │               │         ├── 1:N ──── issues (FK → file)
    │               │
    │               └── 1:N ──── chat_sessions
    │                              │
    │                         └── 1:N ──── chat_messages
    │
    └── projects.ai_provider_config_id → ai_provider_configs.id
```

### Table Descriptions

| Table | Purpose | Key Fields |
|---|---|---|
| `ai_provider_configs` | User-defined AI endpoints | `base_url`, `api_key`, `model_name`, `temperature`, `max_tokens` |
| `projects` | Top-level project container | `name`, `description`, FK to `ai_provider_configs` |
| `files` | Uploaded source code files | `path`, `filename`, `language`, `content`, `size_bytes` |
| `reviews` | Review execution record | `scope`, `template_type`, `status`, `summary` |
| `issues` | Individual review findings | `title`, `severity`, `line_start`, `line_end`, `recommendation`, `evidence` |
| `review_files` | Many-to-many: reviews ↔ files | Junction table |
| `chat_sessions` | AI chat conversation container | FK to `projects` |
| `chat_messages` | Individual chat messages | `role`, `content`, optional FK to `issues` |

### Design Decisions
- **UUIDs everywhere** — All primary keys are UUID v4 for security (no enumerable IDs) and distributed-system readiness
- **Cascading deletes** — Deleting a project cascades to files, reviews, issues, and chat sessions
- **Soft references** — `ai_provider_config_id` uses `ON DELETE SET NULL` so deleting a provider doesn't break projects
- **Content in DB** — File contents are stored directly in the `files` table rather than on disk, simplifying deployment and enabling full-text search capabilities

---

## 5. AI Integration Flow

### Review Flow (Detailed)

```
                    ┌──────────────────┐
                    │   User selects   │
                    │  scope + template │
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │  POST /reviews   │
                    │  (creates record)│
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │ BackgroundTask   │
                    │ spawned          │
                    └────────┬─────────┘
                             │
              ┌──────────────▼──────────────┐
              │  For each file in scope:     │
              │                              │
              │  1. Build context string     │
              │     (path + content)         │
              │                              │
              │  2. Select prompt template   │
              │     (security/perf/quality)  │
              │                              │
              │  3. Call AI provider          │
              │     POST /chat/completions   │
              │                              │
              │  4. Extract JSON from        │
              │     AI response              │
              │                              │
              │  5. Parse issues array       │
              │     with severity/lines      │
              │                              │
              │  6. Delete stale issues      │
              │     for same file+category   │
              │                              │
              │  7. Save new issues to DB    │
              └──────────────┬──────────────┘
                             │
                    ┌────────▼─────────┐
                    │  Update review   │
                    │  status →        │
                    │  "completed"     │
                    └──────────────────┘
```

### Chat Flow
1. User types a question in the AI Chat panel
2. Context is assembled based on the selected mode:
   - **Issue mode**: The specific issue + its file content
   - **File mode**: The currently open file's content
   - **Project mode**: A summary of the project's file structure
3. The assembled context + user message + conversation history is sent to the AI provider
4. The AI response is streamed back and displayed in the chat UI

### Prompt Engineering
Each review template uses a carefully crafted system prompt that:
- Defines the review persona (security auditor, performance engineer, code quality reviewer)
- Specifies the exact JSON output format expected
- Lists the specific categories of issues to look for
- Requests line-number references for precise annotations

---

## 6. Key Engineering Decisions

| Decision | Rationale |
|---|---|
| **FastAPI over NestJS** | Python's ecosystem for AI/ML integration is stronger; async-first design matches our non-blocking review engine |
| **Supabase over raw PostgreSQL** | Managed auth, instant API, row-level security, and hosted Postgres — faster time to production |
| **SQLModel over raw SQLAlchemy** | Combines Pydantic validation with SQLAlchemy ORM — single model definition for both API schemas and DB models |
| **Next.js API proxy** | Eliminates CORS issues entirely; the browser only talks to one origin |
| **Background tasks over queues** | For a 3-day assessment, FastAPI's `BackgroundTasks` provides sufficient async processing without the operational overhead of Redis/Celery |
| **File content in DB** | Simplifies the architecture (no file system management), enables future full-text search, and works naturally with Supabase's managed Postgres |
| **No external state management** | React's built-in `useState` + `useContext` handles all state needs without adding Redux/Zustand complexity |
| **Generic AI client** | A single `provider_client.py` works with any OpenAI-compatible endpoint — no provider-specific code paths |

---

## 7. Security Considerations

- **JWT verification** on every API request with Supabase JWT secret
- **User isolation** — All queries filter by `user_id` to prevent cross-user data access
- **No secrets in code** — All sensitive values loaded from environment variables
- **API key encryption** — Provider API keys are stored in the database (Supabase provides at-rest encryption)
- **Input sanitization** — File uploads are filtered for binary content and size limits
- **CORS** — Strict origin allowlist configured via environment variable