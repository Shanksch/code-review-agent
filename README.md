# AI Code Review Agent

An agentic, AI-powered code review tool designed to analyze full codebases and highlight issues. Upload a ZIP file or simply paste a **GitHub Repository URL** to build an interactive, navigable file tree of your project.

## Features

- **GitHub URL & ZIP Imports:** Instantly clone public repositories or upload ZIP files. The system respects `.gitignore` and strips noise files (like `node_modules` or `.git`).
- **Interactive File Tree:** Visualizes your project with color-coded severity indicators on files that contain issues.
- **Pluggable AI Providers:** Connects to any OpenAI-compatible endpoint (OpenAI, Groq, LM Studio, Ollama). Fetch available models dynamically from your provider and swap models at runtime via the project settings.
- **Robust Review Engine:** Runs comprehensive reviews (Security, Performance, Code Quality) across your codebase. Handles HTTP 429 rate limits automatically with exponential backoff and gracefully catches context-length limits for massive files.
- **Background Processing:** Reviews run in background tasks, decoupling them from HTTP timeouts so you can review massive repositories effortlessly.

## Architecture & Design

For a deep dive into the engineering decisions, data models, and component structure, read our [ARCHITECTURE.md](./ARCHITECTURE.md).

## Implementation & AI Collaboration Log

To see how this project was designed and built alongside an AI Pair Programmer, check out [AI_USAGE.md](./AI_USAGE.md).

## Getting Started

### Prerequisites
- Node.js (v18+)
- Python 3.10+
- A Supabase Project (Postgres Database + Auth)

### Backend Setup
1. Navigate to the `backend` folder.
2. Create a virtual environment: `python -m venv venv`
3. Activate it and install dependencies: `pip install -r requirements.txt` (or install FastAPI, Uvicorn, SQLModel, asyncpg, httpx).
4. Run `schema.sql` against your Supabase database.
5. Create a `.env` file with `DATABASE_URL` and `SUPABASE_JWT_SECRET`.
6. Run the server: `uvicorn app.main:app --reload --port 8000`

### Frontend Setup
1. Navigate to the `frontend` folder.
2. Install dependencies: `npm install`
3. Create a `.env.local` file with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/api`.
4. Run the development server: `npm run dev`

Navigate to `http://localhost:3000` to begin reviewing!
