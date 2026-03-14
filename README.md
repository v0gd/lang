# lang

A monorepo for language learning tools — web apps, APIs, and video generation scripts.

## Projects

### [web/](web/) + [api/](api/) — Polypup

The main web application for language learners. Users can generate and read bilingual stories, listen to text-to-speech narration, and get contextual word explanations. React/TypeScript frontend with a Go backend, MySQL database, Firebase Auth, and AI-powered content generation (OpenAI, Anthropic, AWS Polly).

Deployed at [polypup.org](https://polypup.org).

### [parread/](parread/) — Parallel Reader

An experimental web app for parallel reading — paste German text to get side-by-side English translations with click-to-explain word definitions. Python/FastAPI backend + React/TypeScript frontend.

Deployed at [parread.com](https://parread.com).

### [videos/](videos/) — Video Generation

Python scripts for generating parallel listening videos for language learners. Produces narrated, subtitled videos that are uploaded to YouTube.

## Deployment

Each project has its own `deploy/` directory (or `deploy.sh`) with deployment scripts, nginx configs, and systemd service files. See the respective subdirectories for details.
