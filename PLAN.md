# PLAN.md

## Build Order & Reference — AI Code Review Assistant

This is the single source of truth to feed your AI IDE alongside `ARCHITECTURE.md` and
`schema.sql`. Follow the day order below — later steps depend on earlier ones.

---

## Day 1 — Foundation

1. **Repo skeleton**
   ```
   repo/
     frontend/
     backend/
     README.md
     ARCHITECTURE.md
     AI_USAGE.md
   ```
2. **Run `schema.sql` against Supabase** (SQL editor or psql). Confirm `auth.users` exists
   by default — do not create it.
3. **SQLModel/SQLAlchemy models** in `backend/app/models/` mirroring `schema.sql` exactly.
   Model the severity ranking (`CRITICAL > HIGH > MEDIUM > LOW`) in Python, not relying on
   Postgres enum `max()` (see note at bottom of `schema.sql`).
4. **Supabase Auth wiring:**
   - Frontend: `@supabase/supabase-js` client, register/login/logout pages.
   - Backend: `core/deps.py` → `get_current_user()` verifying the Supabase JWT
     (`SUPABASE_JWT_SECRET`), extracting `sub` as user id. Apply as a dependency on every
     protected router.
5. **Project creation flow (with provider config):**
   - `POST /ai-provider-configs` — create/save a provider config for the current user.
   - `GET /ai-provider-configs` — list saved configs (for the "show as an option" step).
   - `POST /projects` — accepts `name`, `description`, `ai_provider_config_id` (existing
     or newly created config).
   - Frontend: project-creation form asks for provider details *before* upload; if the
     user has saved configs, show them as a dropdown with an "Add new" option.
6. **Provider test-connection endpoint:** `POST /ai-provider-configs/{id}/test` — sends a
   trivial chat completion to confirm base_url/api_key/model_name are valid before saving.

**End of Day 1 checkpoint:** a logged-in user can register, log in, create a provider
config, and create a project linked to that config.

---

## Day 2 — Upload, Explorer, Core Review Engine

1. **ZIP upload + extraction** (`services/zip_extractor.py`):
   - Zip-slip guard: reject any entry whose resolved path escapes the target directory.
   - Skip noise dirs: `node_modules`, `.git`, `__pycache__`, `.venv`, `dist`, `build`, `.next`.
   - Size cap per file (~1MB); skip/flag binaries.
   - Bulk insert `files` rows (flat, `path` = full relative path).
2. **Tree builder** (`services/tree_builder.py`): flat `files` rows → nested tree JSON.
   Dirs before files, alphabetical within each level.
3. **`GET /projects/{id}/tree`**: tree JSON + per-file severity (initially all neutral,
   until reviews exist — see `severity_aggregator.py` stub now, fill logic in step 6).
4. **Code Explorer UI:** recursive `<TreeNode />`, click → tabbed center panel
   (`Code` tab active by default while there are no issues yet), syntax highlighting via
   shiki/react-syntax-highlighter keyed off `language`.
5. **AI provider client** (`services/ai/provider_client.py`): `OpenAiCompatibleProvider`
   using `httpx.AsyncClient`, config pulled from the project's linked
   `ai_provider_configs` row.
6. **Review engine — single file first** (`services/ai/review_engine.py`):
   - One template only to start (Security Review) to validate the full loop end-to-end.
   - Prompt must request strict JSON: `title, description, severity, function_name,
     line_start, line_end, recommendation` per issue.
   - `services/slug_generator.py`: implement priority chain
     `function_name → line_start → numeric suffix`.
   - Persist `Review` + `Issue` rows.
7. **Expand to all 3 required templates** (Security, Performance, Code Quality) — same
   engine, different prompt in `prompts.py`.
8. **`severity_aggregator.py`:** compute highest severity **per file, from the latest
   review that included that file** (not global latest review). Wire into
   `GET /projects/{id}/tree`.
9. **Review history:** `GET /reviews?project_id=` list + detail view (search filters come
   Day 3).

**End of Day 2 checkpoint:** upload a ZIP, see a colored tree, click a file with an issue,
see it highlighted in the Issue tab with correct severity color.

---

## Day 3 — Advanced Review, Chat, Bonus Features, Polish

1. **Multi-file / whole-project review (map-reduce):**
   - Batch per-file reviews for project scope, then one synthesis call over the batch
     results → `Review.summary`.
2. **Issue sidebar (multi-issue per node):**
   - `GET /files/{id}/issues` (latest review only) → list with severity dots.
   - Clicking an issue in the sidebar swaps the active issue in the center Issue tab.
3. **Slash-command chat:**
   - `GET /projects/{id}/issues/commands` → full project-wide list of `command_slug`s.
   - `<CommandAutocomplete />`: triggers on `/`, fuzzy-matches against the list above.
   - `chat_context.py`: resolve any referenced slugs into full issue + file content in
     the prompt context, plus simple keyword-overlap retrieval for the rest of the
     project-wide chat.
   - Chat is a single project-wide session (`chat_sessions`); `chat_messages.issue_id`
     records references for history, doesn't create separate sessions.
4. **Review search:** toolbar search input + severity/template/date filter chips,
   `GET /reviews?query=&severity=&template=&from=&to=`.
5. **Bonus features (2 chosen):**
   - **Technical Debt Scanner** — new `TECH_DEBT` template, reuses the review engine
     entirely, categorizes issues High/Medium/Low priority in the summary.
   - **Architecture Analysis** — new `ARCHITECTURE` template, project-scope only, reuses
     map-reduce synthesis to produce a structured architecture summary (no per-file
     issues expected, may return an empty issues array).
6. **Polish pass:**
   - Neutral file color: subtle border / default icon, not literal white fill.
   - Command legend / severity color legend visible somewhere in the UI.
   - Mobile responsiveness pass on tree + chat layout.
7. **Documentation finalize:**
   - `README.md`: setup instructions, env vars, database setup (link to `schema.sql`),
     features list, architecture overview summary.
   - `ARCHITECTURE.md`: already drafted — confirm it matches what was actually built.
   - `AI_USAGE.md`: finalize the running log (see below).
8. **Git cleanup:** confirm commit history is incremental and meaningful, not one squash.

**End of Day 3 checkpoint:** full loop works — upload, multi-template review, colored
tree, issue sidebar, slash-command chat referencing any file/issue in the project,
search, both bonus features, all three docs complete.

---

## AI_USAGE.md — keep this running, not reconstructed on Day 3

For every significant AI-assisted step, log:
- What was asked / prompted
- What was AI-generated vs. hand-written/modified
- Why a particular engineering decision was made (see the Scope Decisions Log in
  `ARCHITECTURE.md` §6 — that log is the backbone of this file)

---

## If behind schedule — cut in this order

1. Drag-and-drop / GitHub URL upload (~~already out of scope — ZIP only, no cut needed~~ Built anyway due to DX demands!)
2. Bonus features (drop to 1, or 0 if truly tight)
3. Whole-project map-reduce review (keep single/multi-file review working, this is graded higher)
4. Review search filters (keep the search endpoint minimal, drop extra filter chips)

**Never cut:** Supabase Auth + protected routes, the core review engine (single-file at
minimum, across all 3 required templates), or the three root documentation files — all
three are directly and separately graded.