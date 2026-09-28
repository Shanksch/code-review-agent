# AI-Powered Code Review Assistant

A production-grade, full-stack application that empowers developers to upload source code, manage projects, and receive structured AI-generated code reviews — complete with severity classification, line-level annotations, and an interactive AI chat interface.

Built with **Next.js 16**, **FastAPI**, **PostgreSQL (Supabase)**, and **Tailwind CSS**.

![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript)
![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-green?logo=fastapi)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-blue?logo=postgresql)
![Tailwind](https://img.shields.io/badge/TailwindCSS-3.4-06B6D4?logo=tailwindcss)

---

## Assessment Requirements Mapping

| Requirement | Implementation |
|---|---|
| **Tech Stack** | **Frontend**: Next.js (App Router), TypeScript, Tailwind CSS.<br>**Backend**: FastAPI (Python), SQLModel.<br>**Database**: PostgreSQL (via Supabase). |
| **Code Upload** | Supports ZIP file uploads and GitHub repository imports. Extracts files, filters binaries, and stores metadata in PostgreSQL while keeping raw contents on disk to prevent DB bloat. |
| **Code Reviews** | Asynchronous background processing pipeline. Supports configurable review scopes (single file, selection, or full project) and templates (Security, Performance, Quality). |
| **AI Provider Support** | Built a generic, dynamic `ProviderClient` that connects to any OpenAI-compatible `/chat/completions` endpoint. Tested with OpenAI, LM Studio, Ollama, and OpenRouter. |
| **Production-Oriented** | Includes JWT-based authentication, non-blocking async execution, error boundaries, strict CORS proxying, and comprehensive database cascades (`ON DELETE CASCADE`). |

---

## Features

### Core
- **Authentication** — Registration, login, logout with JWT-protected routes via Supabase Auth
- **Project Management** — Create, view, rename, and delete projects with inline editing
- **Code Upload** — ZIP file upload with automatic extraction, binary filtering, and nested directory support
- **Code Explorer** — Interactive file tree with folder hierarchy, search, severity indicators, and syntax-highlighted file preview
- **AI Review Engine** — Asynchronous background reviews on single files, selected files, or entire projects
- **Review Templates** — Security, Performance, and Code Quality review modes with depth control (Quick / Standard / Deep)
- **Review History** — Searchable, filterable table of all past reviews with severity dot indicators
- **AI Chat With Code** — Context-aware conversational AI that can reference specific issues, files, or the entire project

### AI Provider Support
The application supports **any OpenAI-compatible API endpoint**. Provider configuration is fully dynamic — nothing is hardcoded.

| Provider | Example Base URL |
|---|---|
| OpenAI | `https://api.openai.com/v1` |
| LM Studio | `http://localhost:1234/v1` |
| Ollama | `http://localhost:11434/v1` |
| OpenRouter | `https://openrouter.ai/api/v1` |
| Any Custom | User-defined |

Users can configure per-provider:
- Base URL
- API Key
- Model Name
- Temperature & Max Tokens
- Connection testing with real-time validation

### Bonus Features
- **Technical Debt Scanner** — Issues are automatically classified by severity (Critical / High / Medium / Low) with visual indicators across the file tree, enabling quick identification of high-priority technical debt
- **Architecture-Aware Reviews** — The context builder intelligently assembles file content with path awareness, giving the AI model structural understanding of the project
- **Documentation Generator** — One-click generation of project-level documentation based on the codebase structure and contents
- **Unit Test Generator** — Automated generation of unit tests for individual files, instantly viewable in a specialized modal

---

## Architecture Overview

```
┌──────────────────────────┐        ┌──────────────────────────┐
│      Next.js Frontend    │        │     FastAPI Backend       │
│  (React 19 + Tailwind)   │──API──▶│  (Async Python + SQLAlchemy) │
│  Port 3000               │  Proxy │  Port 8000               │
└──────────────────────────┘        └────────────┬─────────────┘
                                                 │
                                    ┌────────────▼─────────────┐
                                    │   PostgreSQL (Supabase)   │
                                    │   + Supabase Auth (JWT)   │
                                    └────────────┬─────────────┘
                                                 │
                                    ┌────────────▼─────────────┐
                                    │   AI Provider (Dynamic)   │
                                    │  OpenAI / LM Studio /     │
                                    │  Ollama / Any Compatible  │
                                    └───────────────────────────┘
```

The frontend proxies all `/api/*` requests to the backend via Next.js rewrites, keeping CORS simple and the deployment topology clean.

---

## Getting Started

### Prerequisites
- **Node.js** 18+ and npm
- **Python** 3.11+
- A **Supabase** account (Free tier is perfectly fine!)
- An **AI provider** (OpenAI API key, or a local LM Studio / Ollama instance)

### 1. Supabase Database Setup (DO THIS FIRST)
We use Supabase for authentication and database storage. 

1. Create a new project at [database.new](https://database.new) (Supabase).
2. Go to the **SQL Editor** in your Supabase dashboard.
3. Open the `backend/schema.sql` file from this repository.
4. Copy all the text from that file, paste it into the Supabase SQL Editor, and click **Run**.
*(This creates all the necessary tables for the app).*

### 2. Configure Environment Variables
We need to connect both the frontend and backend to your new Supabase project.

#### Backend Configuration
1. Navigate to the backend folder: `cd backend`
2. Duplicate the example environment file: `cp .env.example .env`
3. Open `.env` and fill in the 3 Supabase variables:
   - **`SUPABASE_URL`**: Found in Supabase Settings -> API -> Project URL
   - **`SUPABASE_JWT_SECRET`**: Found in Supabase Settings -> API -> JWT Settings (You have to click 'Generate' or 'Reveal' to see it)
   - **`DATABASE_URL`**: Found in Supabase Settings -> Database -> Connection string -> URI. *(Important: Remember to replace `[YOUR-PASSWORD]` with your actual password, and change `postgresql://` to `postgresql+asyncpg://`)*

#### Frontend Configuration
1. Navigate to the frontend folder: `cd frontend`
2. Duplicate the example environment file: `cp .env.example .env.local`
3. Open `.env.local` and fill in the 2 Supabase variables:
   - **`NEXT_PUBLIC_SUPABASE_URL`**: Found in Supabase Settings -> API -> Project URL (Same as backend)
   - **`NEXT_PUBLIC_SUPABASE_ANON_KEY`**: Found in Supabase Settings -> API -> Project API keys -> `anon` public key

### 3. Run the Backend
Open a new terminal and run:
```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate it
venv\Scripts\activate        # On Windows
# source venv/bin/activate   # On macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Start the server (runs on port 8000)
uvicorn app.main:app --reload --port 8000
```

### 4. Run the Frontend
Open a second terminal and run:
```bash
cd frontend

# Install dependencies
npm install

# Start the dev server (runs on port 3000)
npm run dev
```

### 5. Open the Application
Navigate to `http://localhost:3000` in your browser. Create an account, and you're ready to go!

---

## Environment Variables Reference

For quick reference, here is what your `.env` files should look like when fully configured:

### Backend (`backend/.env`)
| Variable | Description | Example |
|---|---|---|
| `SUPABASE_URL` | Your Supabase project URL | `https://xxx.supabase.co` |
| `SUPABASE_JWT_SECRET` | JWT secret for token verification | `your-jwt-secret` |
| `DATABASE_URL` | Async PostgreSQL connection string | `postgresql+asyncpg://postgres:[YOUR-PASSWORD]...` |
| `UPLOAD_DIR` | Directory for temporary file uploads | `./uploads` |
| `CORS_ORIGINS` | Allowed CORS origins | `http://localhost:3000` |

### Frontend (`frontend/.env.local`)
| Variable | Description | Example |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key | `eyJhbGci...` |

> **Security Note:** Never commit `.env` or `.env.local` files. Both directories include `.gitignore` rules to prevent this.

---

## Environment Variables

### Backend (`backend/.env`)
| Variable | Description | Example |
|---|---|---|
| `SUPABASE_URL` | Your Supabase project URL | `https://xxx.supabase.co` |
| `SUPABASE_JWT_SECRET` | JWT secret for token verification | `your-jwt-secret` |
| `DATABASE_URL` | Async PostgreSQL connection string | `postgresql+asyncpg://...` |
| `UPLOAD_DIR` | Directory for temporary file uploads | `./uploads` |
| `CORS_ORIGINS` | Allowed CORS origins | `http://localhost:3000` |

### Frontend (`frontend/.env.local`)
| Variable | Description | Example |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key | `sb_publishable_xxx` |

> **Security Note:** Never commit `.env` files. Both directories include `.gitignore` rules to prevent this.

---

## Project Structure

```
code-review-agent/
├── frontend/                     # Next.js 16 + TypeScript + Tailwind
│   ├── src/
│   │   ├── app/                  # App Router pages
│   │   │   ├── (auth)/           # Login & Register pages
│   │   │   ├── projects/         # Dashboard & workspace pages
│   │   │   └── layout.tsx        # Root layout with AuthProvider
│   │   ├── components/           # Reusable UI components
│   │   │   ├── chat/             # AIChat component
│   │   │   ├── projects/         # CodeViewer, FileTree, Modals
│   │   │   └── providers/        # ProviderSettingsModal
│   │   ├── context/              # AuthContext (Supabase session)
│   │   └── lib/                  # API client, Supabase client
│   ├── next.config.js            # API proxy rewrites
│   └── tailwind.config.ts
│
├── backend/                      # FastAPI + SQLAlchemy + asyncpg
│   ├── app/
│   │   ├── core/                 # Settings, auth middleware
│   │   ├── db/                   # Async database session
│   │   ├── models/               # SQLModel ORM models
│   │   ├── routers/              # API route handlers
│   │   │   ├── projects.py       # Projects, reviews, issues, chat
│   │   │   ├── files.py          # File upload, content retrieval
│   │   │   └── ai_providers.py   # Provider CRUD & test endpoint
│   │   ├── schemas/              # Pydantic request/response schemas
│   │   └── services/             # Business logic layer
│   │       ├── ai/               # Review engine, prompts, provider client
│   │       ├── zip_extractor.py  # ZIP processing & file storage
│   │       └── tree_builder.py   # File tree construction
│   ├── schema.sql                # Database DDL
│   └── requirements.txt
│
├── README.md
├── ARCHITECTURE.md
└── AI_USAGE.md
```

---

## Tech Stack Summary

| Layer | Technology | Rationale |
|---|---|---|
| Frontend | Next.js 16 (App Router) | Server components, file-based routing, built-in API proxy |
| Styling | Tailwind CSS 3.4 | Utility-first, rapid iteration, dark mode support |
| Icons | Lucide React | Consistent, tree-shakeable icon set |
| Syntax Highlighting | react-syntax-highlighter | Prism-based with VS Code Dark+ theme |
| Auth | Supabase Auth | Managed JWT, social providers, row-level security |
| Backend | FastAPI 0.115 | Async-first, automatic OpenAPI docs, dependency injection |
| ORM | SQLModel + SQLAlchemy 2.0 | Async sessions, Pydantic integration, type safety |
| Database | PostgreSQL (Supabase) | ACID compliance, UUID support, managed hosting |
| AI Client | httpx | Async HTTP client for OpenAI-compatible endpoints |

---

## License

MIT
