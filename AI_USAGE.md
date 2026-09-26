# AI_USAGE.md

## AI Tools Used
- Claude (Anthropic) — used for planning, architecture design, and gap analysis against
  the assessment brief prior to writing any code.
- [Add others here as you use them: e.g. Cursor/Windsurf for implementation, ChatGPT for
  debugging specific errors, GitHub Copilot for autocomplete, etc.]

---

## Planning Phase (Day 0, before implementation)

### Prompts Used

Below is a summary of the engineering questions and directives I brought to the planning
session, in the order they were raised. Each was a deliberate checkpoint aimed at
validating a specific architectural or product decision, not a request to "design the
app" wholesale.

1. **Baseline planning request.** Supplied the full assessment brief and requested a
   structured implementation plan — stack recommendation, module breakdown, database
   design, and a day-by-day delivery schedule against the 3-day window.

2. **Backend framework decision.** Specified FastAPI as the backend framework (over the
   suggested NestJS) and requested the design for a core differentiating feature: on
   upload, the system should reconstruct the repository's folder structure as a navigable
   tree, rather than presenting a flat file list.

3. **Database platform evaluation.** Evaluated whether Supabase satisfies the brief's
   PostgreSQL requirement, to avoid provisioning and managing a separate Postgres
   instance during a time-constrained build.

4. **Auth strategy evaluation.** Extended the Supabase decision to authentication —
   assessed whether Supabase Auth could replace a hand-rolled JWT implementation to
   reduce auth-related engineering surface area.

5. **Storage architecture review.** Challenged the initial local-disk-only storage
   assumption by asking whether file storage should also move to Supabase Storage,
   which surfaced the underlying tradeoff between filesystem-direct processing (needed by
   the tree builder/extractor) and deployment durability on ephemeral hosts — a decision
   deferred pending a deployment target.

6. **Requirements traceability check.** Requested a section-by-section comparison of the
   evolving plan against the original brief, to catch requirements not yet addressed
   before committing engineering time (this surfaced review search, the provider
   configuration UI, and several schema ambiguities that would have been costly to
   discover mid-build).

7. **Custom feature specification — severity-aware code navigation.** Specified a UX
   requirement beyond the base brief: tree nodes should visually encode issue severity by
   color, and selecting a node should surface issue detail (summary, root cause,
   recommendation) alongside a way to discuss that issue further. Requested a follow-up
   traceability check on this addition specifically, since it touched the data model.

8. **Design decisions locked through iterative refinement.** Across several exchanges, I
   evaluated trade-offs raised by the planning session and made the following calls:
   - Modeled issues as first-class relational rows rather than an embedded JSON array,
     since individual issues needed to be independently addressable and referenceable.
   - Defined severity aggregation as the highest severity found in the **most recent**
     review covering a given file — not the worst severity ever recorded — so the tree
     reflects current code state rather than historical state.
   - Resolved the code/issue viewing conflict by specifying a tabbed interface (Code /
     Issue) with the affected line range highlighted in the issue's severity color,
     rather than a permanent split view.
   - Redesigned the chat feature from a per-issue session model to a single project-wide
     chat using slash-command references (e.g. `/auth-jwt-validateSession`) — allowing
     any file or issue to be referenced from one conversation rather than fragmenting
     context across sessions.
   - Specified the command-slug generation strategy and its fallback order
     (function name → line number → numeric suffix) to guarantee uniqueness without
     losing readability.
   - Clarified that reviews are a repeatable, on-demand action (per the brief's "Review
     History" requirement) rather than a one-time step at upload — this directly shaped
     the severity-aggregation logic above.
   - Assessed whether review search duplicates the tree view and concluded it serves a
     distinct purpose (current-state navigation vs. historical/cross-review lookup),
     then scoped it to a toolbar search with severity/template/date filters.
   - Defined the provider-configuration UX: collected at project-creation time, persisted
     per user, and offered as a reusable saved option on subsequent projects.

9. **Documentation generation for handoff.** Requested `ARCHITECTURE.md`, `schema.sql`,
   and `PLAN.md` be produced reflecting the decisions above, to serve as grounded context
   for AI-assisted implementation (AI IDE) rather than working from memory or a
   loosely-specified verbal plan.

### AI-Generated Content
- `ARCHITECTURE.md` — full architecture document (frontend/backend structure, AI
  provider abstraction design, review engine flow, tree + severity coloring logic,
  slash-command scheme, chat model, scope decisions log).
- `schema.sql` — Postgres DDL for Supabase (all tables, enums, indexes, and the
  `file_current_severity` view), including a flagged caveat about Postgres enum sort
  order vs. application-level severity ranking.
- `PLAN.md` — day-by-day build order and a "cut in this order if behind schedule" list.

### Manually Written / Decided (by me, prompted by AI's clarifying questions)
- Every concrete product/UX decision listed under point 8 above was my call — Claude
  surfaced the ambiguity or gap, but did not choose the answer. Examples: choosing
  tabbed Code/Issue view over a split-screen or auto-switch design; choosing
  project-wide slash-command chat over per-issue chat sessions; choosing "latest review
  only" over "worst severity ever seen" for tree coloring; choosing local disk over
  Supabase Storage for now.
- Actual implementation (FastAPI routes, SQLModel models, Next.js components, the tree
  builder algorithm, the review engine, the AI prompt templates) — **to be filled in as
  I build**, using an AI IDE with `ARCHITECTURE.md`/`schema.sql`/`PLAN.md` as context.
  Each subsequent entry in this file should note which files were AI-scaffolded vs.
  hand-modified, and why.

---

## Engineering Decisions (Summary — see ARCHITECTURE.md §6 for full log)

| Decision | Reasoning |
|---|---|
| FastAPI over NestJS | Native async fits repeated AI provider HTTP calls well |
| Supabase Auth over hand-rolled JWT | Reduces auth surface area; more time for the review engine, which is more heavily weighted in the rubric |
| No custom `User` table | `auth.users.id` used directly as FK — avoids duplicating what Supabase already manages |
| Flat file storage + derived tree | Simpler than modeling folders as their own table; single source of truth |
| ZIP upload only (not drag-and-drop or GitHub URL) | Brief requires "at least one"; scoped deliberately to focus effort elsewhere |
| Local disk for extracted files (for now) | Direct filesystem access needed by the extractor/tree builder; revisit if deploying to an ephemeral host |
| Issues as first-class rows, not JSON | Needed for individual addressing, slug generation, and chat referencing |
| Reviews are repeatable | Required by the brief's "Review History" section; not a one-time action |
| Severity = latest review per file | Keeps the tree reflecting current state; older superseded issues remain reachable via search |
| Project-wide chat with slash commands | Simpler data model than per-issue sessions; matches how users actually mix general and issue-specific questions |

---

## Notes for Future Entries
As implementation proceeds, append a dated entry per work session with:
1. What was prompted to the AI IDE/assistant
2. What code was generated vs. hand-written or corrected
3. Any deviation from `ARCHITECTURE.md`/`PLAN.md` and why
4. Bugs or hallucinated code caught and fixed manually

---

## Implementation Phase — Day 1 (Foundation)

### AI Assistance (Scaffolding & Boilerplate)
- Used the AI IDE as a pair programmer to rapidly generate boilerplate for the Next.js frontend (Tailwind configs, standard UI layouts) and the FastAPI backend (SQLModel schema classes mirroring my `schema.sql`).
- Relied on AI to stub out standard CRUD endpoints (Projects, AI Provider Configs) which saved significant typing time, allowing me to focus on business logic.

### Manually Written & Refined by Me
- **ZIP Extraction Security:** I manually authored and verified the zip-slip guard logic in `zip_extractor.py`. I explicitly ensured paths couldn't traverse outside the upload directory (`..` detection) and that the database wouldn't be flooded with `node_modules` or `.git` files.
- **Tree Builder Algorithm:** The flat-to-nested tree transformation logic in `tree_builder.py` was heavily guided and corrected by me. The AI initially struggled to bubble up the highest issue severity to parent folders properly; I had to manually step in to enforce the `CRITICAL > HIGH > MEDIUM > LOW` ranking logic in Python.
- **Provider Connection Tester:** I designed the `POST /ai-provider-configs/{id}/test` endpoint logic to ensure it fires a low-token `max_tokens=5` dummy completion to validate user API keys immediately before saving them. I had to tweak the AI's HTTP client code to properly catch and surface specific timeout/connection errors to the frontend.
- **Auth Integration & Cryptography:** While AI generated the standard UI, I manually wired the Supabase `getSession()` logic into the Next.js `AuthContext` and the FastAPI `get_current_user` dependency. When upgrading to Supabase's modern ECDSA (ES256) signing keys, I had to deeply debug `python-jose` throwing "The specified alg value is not allowed" errors. I directed the AI to bypass signature verification for local dev while dynamically accepting `jwt.ALGORITHMS.SUPPORTED` to unblock development without wrangling multi-line PEM keys in `.env`.
- **Infrastructure Troubleshooting (PgBouncer):** I identified a critical crashing bug where `asyncpg` threw `InvalidSQLStatementNameError` due to Supabase's PgBouncer running in Transaction Mode (which breaks prepared statements). I instructed the AI to modify the SQLAlchemy `create_async_engine` config to force `statement_cache_size=0` and `prepared_statement_cache_size=0`, resolving the connection pooler conflict.
- **Payload Validation:** I caught a 422 Unprocessable Content error where the frontend AI Provider form was failing to send the required `name` field to the backend. I had the AI fix the React state payload to map provider URLs to their display names.