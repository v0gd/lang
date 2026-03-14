# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

Monorepo for language learning tools. See each subdirectory's README.md (and CLAUDE.md where present) for project-specific commands, setup, and architecture.

## Projects

- **`api/`** — Polypup Go backend (bilingual story reader API)
- **`web/`** — Polypup React/TypeScript frontend
- **`parread/`** — Parallel Reader app (Python/FastAPI + React/Vite)
- **`videos/`** — Python scripts for generating narrated language learning videos

## Deployment

Each project deploys independently to Digital Ocean VPS(es) via deploy scripts in their respective `deploy/` directories. Nginx handles TLS (Certbot/Let's Encrypt) and reverse proxying.
