# ARCHITECTURE.md

## AI-Powered Code Review Assistant

---

## 1. Overview

A full-stack application that lets developers upload a codebase (as a ZIP), automatically
builds a navigable file tree, runs AI-generated code reviews against configurable
OpenAI-compatible providers, and surfaces issues visually on the tree with severity-based
coloring, a per-issue detail sidebar, and a code-aware chat interface using slash-command
references.

**Stack:**
- Frontend: Next.js (App Router) + TypeScript + Tailwind CSS
- Backend: FastAPI (Python)
- Database & Auth: Supabase (Postgres + Supabase Auth)
- File storage: Local disk (see §7 for tradeoffs and deployment note)
- AI Integration: Unified OpenAI-compatible client (OpenAI, LM Studio, Ollama, any
  OpenAI-compatible endpoint)

---

## 2. Frontend Architecture

```
frontend/
  app/
    (auth)/login/
    (auth)/register/
    projects/
      page.tsx                 # project list
      [projectId]/
        page.tsx                # main workspace: tree + code/issue tabs + chat
        settings/               # provider config for this project (if editable later)
  components/
    tree/TreeNode.tsx           # recursive tree renderer, severity-colored dots
    explorer/CodeIssueTabs.tsx  # tabbed center panel: Code | Issue, line-highlighted
    sidebar/IssueSidebar.tsx    # lists issues for selected node, switch between them
    chat/ChatBox.tsx            # project-wide chat, slash-command autocomplete
    chat/CommandAutocomplete.tsx
    providers/ProviderForm.tsx  # Base URL / API Key / Model Name entry
    reviews/ReviewToolbar.tsx   # trigger review, search, severity filter
  lib/
    supabaseClient.ts
    api.ts                      # typed fetch wrapper, attaches Supabase bearer token
```

**State/data flow:**
- Supabase session token attached as `Authorization: Bearer <token>` on every backend call.
- Tree, issues, and severity coloring are fetched from a single `GET /projects/{id}/tree`
  endpoint (see §5) — the frontend does not compute severity aggregation itself.
- Clicking a **file node**: opens the tabbed center panel. If the file has ≥1 issue, the
  **Issue tab** is shown by default with the highest-severity issue loaded; the sidebar
  lists all issues for that file, letting the user switch which issue is active in the
  center panel. If no issues, the **Code tab** is shown by default.
- The **code line range** of the active issue (`line_start`–`line_end`) is highlighted in
  the severity's color when the Code tab is viewed alongside an active issue.

---

## 3. Backend Architecture

```
backend/
  app/
    main.py
    core/
      config.py            # env vars: SUPABASE_URL, SUPABASE_JWT_SECRET, DATABASE_URL, etc.
      deps.py               # get_current_user() — verifies Supabase JWT
    db/
      session.py
    models/                 # SQLModel ORM models (see schema.sql for DDL)
    schemas/                # Pydantic request/response DTOs
    routers/
      projects.py
      files.py
      reviews.py            # trigger + fetch + search reviews
      chat.py
      ai_providers.py
    services/
      zip_extractor.py      # zip-slip guarded extraction, noise-folder skip
      tree_builder.py        # flat File rows -> nested tree JSON
      severity_aggregator.py # per-file highest severity from latest review only
      slug_generator.py      # command_slug generation w/ fallback chain
      ai/
        provider_client.py   # unified OpenAI-compatible HTTP client
        prompts.py           # one prompt template per review type
        review_engine.py     # single/multi/project-scope review orchestration,
                              # map-reduce synthesis for project-scope
        chat_context.py       # keyword-overlap retrieval for project-wide chat
  alembic/                    # migrations (or run schema.sql directly against Supabase)
```

### 3.1 Auth
- Supabase Auth issues and manages sessions (registration/login/logout handled by
  `@supabase/supabase-js` on the frontend — backend never issues tokens).
- Backend only **verifies** incoming Supabase JWTs (`core/deps.py`) using
  `SUPABASE_JWT_SECRET`, extracting `sub` (the Supabase `auth.users.id`) as the current
  user for all authorization checks.
- No custom `User` table. All ownership foreign keys point directly at
  `auth.users.id` (UUID).

### 3.2 AI Provider Abstraction
One interface, many configured instances — no per-vendor branching:

```python
class AiProvider:
    async def chat_completion(self, messages: list[dict], **options) -> dict:
        ...

class OpenAiCompatibleProvider(AiProvider):
    def __init__(self, base_url: str, api_key: str, model: str):
        ...
    async def chat_completion(self, messages, **options):
        # POST {base_url}/chat/completions via httpx.AsyncClient
        ...
```
`AiProviderConfig` rows (base_url, api_key, model_name) are the only thing that
differs between OpenAI / LM Studio / Ollama / OpenRouter — never hardcoded.

### 3.3 Review Engine Flow
1. Assemble context: selected file(s) content, or all files for project-scope.
2. Build system prompt per template (Security / Performance / Code Quality / Tech Debt /
   Architecture) — prompt instructs strict JSON output matching the `Issue` schema,
   **including `function_name`, `line_start`, `line_end` where identifiable.**
3. Call provider async; parse JSON; one retry on malformed output.
4. **Project-scope reviews (map-reduce):** review files individually/in batches, then run
   one synthesis call over per-file results to produce the aggregated `Review.summary`.
5. Persist: one `Review` row + N `Issue` rows (joined via `review_id`), each `Issue`
   gets a generated `command_slug` (see §3.5).

### 3.4 Chat With Code
- Single project-wide `ChatSession` per project (no separate "issue-scoped" session type).
- User references specific issues/files via **slash commands** typed in the chatbox
  (e.g. `/auth-jwt-validateSession`), which are project-wide — any command can be
  referenced regardless of which node is currently selected.
- Typing `/` triggers autocomplete against `GET /projects/{id}/issues/commands`
  (fuzzy-matched against `command_slug`).
- The **issue sidebar** is a read-only filtered view (commands for the current node only)
  of this same underlying command list — it does not drive a different chat scope.
- Context assembly for a chat message: simple keyword/filename overlap retrieval across
  project files, plus full resolution of any referenced issue(s)/file(s) by slug into the
  prompt context.
- `ChatMessage.issue_id` (nullable) records which issue(s) a message referenced, for
  history/traceability — the session itself stays unscoped.

### 3.5 Slash-Command Slug Generation
Priority order, first that yields uniqueness wins:
1. `slugify(issue.title)-slugify(issue.function_name)` — e.g. `hardcoded-secret-getUserToken`
2. `slugify(issue.title)-L{line_start}` — when no function name is attributable
3. `slugify(issue.title)-{n}` — numeric suffix, for true file/project-level issues with
   neither a function nor a line anchor

Slugs are unique **per project** (not globally), generated at issue-creation time and
stored on the `Issue` row — never computed on the fly.

### 3.6 Tree + Severity Coloring
- Files are stored **flat** (`File.path` = full relative path); the nested tree is a
  **derived view**, not a separate DB table.
- `GET /projects/{id}/tree` joins `File` with `Issue`, computing **highest severity per
  file from the latest review that included that file** (not the latest review row
  globally — a window function partitioned by `file_path`, ordered by review
  `created_at desc`).
- Neutral (no issues) files render with no severity dot / default file icon — not a pure
  white fill, to keep contrast on light backgrounds.
- Tree JSON can optionally be cached on `Project.tree_json`, recomputed on re-upload or
  new review completion — not required for v1.

### 3.7 Review Search
`GET /reviews?project_id=&query=&severity=&template=&from=&to=`
- Full-text-ish match on `Review.summary` / `Issue.title` / `Issue.description`.
- Filters: severity, template type, date range.
- Toolbar search button + filter chips in the frontend, not a redesign of the tree view —
  the tree remains the primary current-state view; search is the cross-review/historical
  view (older issues superseded by re-review are no longer visible on the tree, but
  remain searchable).

---

## 4. Database Design

See `schema.sql` for full DDL. Summary of tables:

| Table | Purpose |
|---|---|
| `auth.users` | Managed entirely by Supabase — not modeled by us |
| `projects` | Owner ref → `auth.users.id`, name, description, created_at, optional `ai_provider_config_id` |
| `ai_provider_configs` | User's saved provider configs (base_url, api_key, model_name), reusable across projects |
| `files` | Flat file rows: path, filename, language, size, content |
| `reviews` | One row per review run: scope, template_type, summary, created_at |
| `issues` | One row per detected issue: severity, function_name, line_start/end, command_slug, recommendation |
| `review_files` | Join table: which files were included in a given review |
| `chat_sessions` | One per project (project-wide, unscoped) |
| `chat_messages` | role, content, optional `issue_id` reference |

**Key design decisions:**
- Flat file storage + derived tree avoids over-modeling a self-referencing folder table.
- Issues are first-class rows (not JSON blobs) so they can be individually addressed,
  slugged, and referenced by chat commands.
- Provider configs are user-scoped and reusable, decoupled from any single project.

---

## 5. AI Integration Flow (End-to-End)

```
Upload ZIP → extract (zip-slip guarded) → skip noise dirs → flat File rows
    → user triggers review (single/multi/project scope + template)
    → review_engine assembles context → provider_client calls configured AI endpoint
    → parse structured JSON → persist Review + Issue rows (with generated slugs)
    → GET /tree recomputes severity-per-file (latest review only)
    → user clicks node → sidebar lists issues → center panel tabs Code/Issue
    → user opens chat → types `/` → autocomplete over project-wide command list
    → chat_context resolves referenced issues/files → provider_client call → response
```

---

## 6. Scope Decisions Log

*(kept here for interview reference — decisions made deliberately, not by omission)*

- **FastAPI over NestJS** — native async fits AI provider calls well.
- **Supabase Auth over hand-rolled JWT** — reduces auth surface area, more time for the
  review pipeline.
- **Supabase Postgres, no separate `User` table** — `auth.users.id` used directly as FK.
- **Flat file storage + derived tree**, not a folder table — simpler, single source of truth.
- **ZIP upload chosen** as the required upload method (drag-and-drop/GitHub URL not built
  — explicit scope choice, not an oversight).
- **Local disk for extracted files**, not Supabase Storage — direct filesystem access
  needed by the extractor/tree builder; would move to Supabase Storage under an ephemeral
  deployment target (deployment target TBD, noted as a documented tradeoff).
- **Reviews are repeatable**, not one-time — required by the brief's "Review History"
  section; severity coloring uses latest-review-per-file, not first-ever review.
- **Chat is project-wide, not issue-scoped** — issue references happen via slash command
  inside the single chat, rather than separate chat sessions per issue.
- **Bonus features chosen:** Technical Debt Scanner, Architecture Analysis — both reuse
  the existing review pipeline/templates rather than requiring new infrastructure.