# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this directory (part of the `lang` monorepo).

## Project Overview

Parallel Reader — a web app for reading German texts with side-by-side English translations and click-to-explain word definitions. Python/FastAPI backend + React/TypeScript frontend, powered by OpenAI's Responses API.

## Commands

### Run both servers (recommended)
```bash
./start.sh
```

### Backend only
```bash
cd backend && source .venv/bin/activate && python main.py
# Runs on http://localhost:8000
```

### Frontend only
```bash
cd frontend && npm run dev
# Runs on http://localhost:5173 (proxies /api/* to backend)
```

### Lint
```bash
cd frontend && npm run lint
```

### Build
```bash
cd frontend && npm run build   # tsc + vite build
```

### Install dependencies
```bash
# Backend
cd backend && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt

# Frontend
cd frontend && npm install
```

## Architecture

**Two-process architecture**: Vite dev server proxies `/api/*` to the FastAPI backend. No database — all data persists as JSON files in `backend/cache/`.

### Backend (`backend/main.py` — single file)
- FastAPI app with 6 REST endpoints under `/api`
- Uses OpenAI **Responses API** (not Chat Completions) with models: `gpt-5-mini` (paragraph splitting), `gpt-5.2` (translation, word explanation), `gpt-5-nano` (title generation)
- Each endpoint uses `reasoning={"effort": "minimal"|"low"|"none"}` for cost control
- Cache files are keyed by UUID text IDs; explanations are cached within each text's JSON by `(paragraph_idx, token_idx)`

### Frontend (`frontend/src/App.tsx` — single component)
- All UI logic lives in one React component using hooks (`useState`, `useEffect`, `useCallback`)
- Tailwind CSS v4 via Vite plugin (configured in `vite.config.ts`, imported in `index.css`)
- Dark mode persisted in localStorage, toggled via class strategy

### Data flow
1. User submits German text → `POST /api/process` → backend splits into paragraphs, generates title, caches, returns text ID
2. User enables translation → `POST /api/texts/{id}/translate` → backend translates via OpenAI, caches English paragraphs
3. User clicks a word → `POST /api/explain` → backend returns contextual explanation, caches it

## Deployment

**Production domain**: `parread.com` — deployed to a single VPS (`129.212.140.176`).

### Deploy
```bash
./deploy/deploy.sh            # clones from GitHub, builds on server, deploys
./deploy/deploy.sh --local    # uses local source instead of cloning
```

### Connect to server
```bash
./connect.sh                  # SSH shortcut to root@server
```

### Production architecture
- **Nginx** serves the Vite-built static frontend from `/var/www/parread/frontend/dist` and reverse-proxies `/api/` to uvicorn on port 8000
- **Systemd** service (`parread.service`) runs uvicorn as `www-data`, reads secrets from `/etc/parread/env`
- **HTTPS** via Certbot/Let's Encrypt (auto-configured by deploy script)
- **Logs** at `/var/log/parread/` with logrotate configured

### Deploy files
- `deploy/deploy.sh` — main deployment script (build + install + restart)
- `deploy/initial_setup.md` — one-time server provisioning steps
- `deploy/nginx.conf` — nginx site config
- `deploy/parread.service` — systemd unit file
- `deploy/logrotate.conf` — log rotation config

## Key Details

- **Environment**: Backend requires `OPENAI_API_KEY` in `backend/.env` (see `.env.example`)
- **Text limit**: 5000 characters max (enforced in both backend and frontend)
- **No tests**: The project has no test suite
- **CORS**: Backend allows all origins (`allow_origins=["*"]`)
- **Requirements**: Python 3.11+, Node.js 18+
