# lang

A monorepo for language learning tools — web apps, APIs, and video generation scripts.

## Projects

### [web/](web/) + [api/](api/) — Polypup

The main web application for language learners. Users can generate and read bilingual stories, listen to text-to-speech narration, and get contextual word explanations. React/TypeScript frontend with a Go backend, MySQL database, Firebase Auth, and AI-powered content generation (OpenAI, Anthropic, AWS Polly).

Deployed at [polypup.org](https://polypup.org).

Some naming convention: the native language of the user is referred in code as 'l' (Left), while the language being learned is 'r' (Right). Why Left and Right? E.g. if I speak English and learn German, I would write the translation pair as English -> German (English on the left, German on the right).

### [parread/](parread/) — Parallel Reader

An experimental web app for parallel reading — paste German text to get side-by-side English translations with click-to-explain word definitions. Python/FastAPI backend + React/TypeScript frontend.

Deployed at [parread.com](https://parread.com).

### [videos/](videos/) — Video Generation

Tools for generating parallel listening videos for language learners. Produces narrated, subtitled videos that are then uploaded to YouTube.

## Deployment

Each project has its own `deploy/` directory (or `deploy.sh`) with deployment scripts, nginx configs, and systemd service files. See the respective subdirectories for details.

## Style guide

- Full variable names, e.g. not zurichLoc, but zurichLocation. Standard idx or id is fine.
- Don't be silent, prefer notifyError to printf for unexpected errors. No one reads printf.
- Use structured outputs instead of asking LLMs to produce output in a certain format. This includes optional responses - e.g. use an array or a boolean field in the structured LLM output instead of asking it to print some constant string like "None" or "Empty".
- The project owner is an experienced engineer - when working on tasks always consult with him on important decisions.
- The project owner might've missed something or forgot to update some temporary code - don't hesitate to remind him or judge his decision or current state of the project.
- Prefer semantically correct and descriptive names, e.g. `scheduleWakeupEventIfNeededPostDialogue` instead of a vague `decideWakeupEvent`.
- Treat code as production-ready. It's not a prototype. Make sure to clean up memory, use best security practices, error checking and recovery, loud logging, etc.

## Project index

Last update commit: 0adfd7d6f3f4a88d83ecd056fc0a03948e3147a8

```
.gitignore - root ignore rules (DS_Store, Python bytecode, node_modules, venvs, logs)
README.md - this file: monorepo overview, style guide, and project index
TODO.md - product/UX improvement notes for Polypup (activation, retention, paywall ideas)
api/
  .gitignore - ignores secrets, credentials, cache, env files, and build artifacts
  .vscode/
    settings.json - VS Code editor config setting a 100-column ruler
  README.md - setup/deploy guide for the Go API (Firebase, MySQL, DigitalOcean, nginx)
  connect.sh - shell helper to SSH into the production server as root
  deploy/
    db-setup.sql - creates the `lang` MySQL database and all tables (story, tts, dictionary, etc.)
    deploy.sh - deploy script: clones repo, builds Go binary, installs systemd/nginx/certbot on server
    l-api.service - systemd unit running the l-api Go binary as www-data with auto-restart
    localhost.crt - self-signed TLS certificate for local HTTPS development
    localhost.key - private key paired with the localhost dev TLS certificate
    logrotate.conf - logrotate config rotating l-api logs daily, restarting the service
    nginx-expected.md - reference of the expected `nginx -T` output after deployment
    nginx.conf - nginx site config serving the web app and proxying /api plus Firebase auth
  env-template - production env var template (API keys, DB password, cache/story dirs)
  env-template.sh - local-dev env var template exporting the same secrets/config for sourcing
  src/
    app/app.go - HTTP server: routes, auth/CORS middleware, and all endpoint handlers
    cache/cache.go - filesystem cache helper for reading/writing files under the cache directory
    db/db.go - initializes and holds the global MySQL connection pool
    dictionary/dictionary.go - global word dictionary plus per-user saved-word list with LLM ingest/dedupe
    explanation/explanation.go - generates and caches LLM sentence/word translation explanations for learners
    favorite/favorite.go - manages the user_favorite_story table (per-user story favorite marks)
    firebase/firebase.go - initializes the Firebase app and Auth client for token verification
    gender/gender.go - annotates/strips {m/f/n} grammatical-gender markers on German/Russian nouns via LLM
    generator/generator.go - generates stories via LLM and persists/loads/deletes them in the story table
    go.mod - Go module definition and dependencies (Anthropic, OpenAI, AWS, Firebase, MySQL)
    go.sum - dependency checksum lockfile for the Go module
    llm/llm.go - LLM client wrapper for OpenAI and Anthropic with structured-output helpers
    main.go - entry point wiring up subsystem Setup calls and starting the server
    osutil/osutil.go - provides MustGetEnv, panicking on missing environment variables
    progresslines/progresslines.go - serves playful localized status lines for the story-generation progress overlay
    scan/scan.go - image-OCR ingest flow extracting target-language text via vision LLM
    story/story.go - story data model, parsing, and serialization (tokens, sentences, localizations)
    stringutil/stringutil.go - string helpers: alphanumeric checks and secure random base32 generation
    telemetry/telemetry.go - lightweight per-request tracing with correlated start/log/stop logging
    tts/tts.go - text-to-speech via AWS Polly with per-locale voices and file caching
    upload/upload.go - user-pasted-text ingest pipeline (safety gate, normalize, gender, structure)
    user/user.go - maps Firebase UIDs to internal numeric user ids with in-memory caching
  stories/
    beneath-peeling-paint/
      C1/story.txt - curated multilingual (en/de/ru) sentence-aligned story source with markup directives
      images/4.webp - WebP illustration (id 4, story cover) for the curated story
      images/8.webp - WebP illustration (id 8) for the curated story
      images/18.webp - WebP illustration (id 18) for the curated story
parread/
  .gitignore - ignore rules for deps, build output, .env files, JSON cache, and IDE/OS cruft
  CLAUDE.md - Claude Code guidance for parread: overview, commands, architecture, deployment
  README.md - user-facing parread readme: features, setup, run instructions, API endpoint table
  backend/
    .env.example - template for backend env vars OPENAI_API_KEY and API_SECRET_KEY
    cache/.gitkeep - empty placeholder keeping the JSON cache directory in git
    main.py - FastAPI backend: OpenAI-powered German/English paragraph translation, word explanation, JSON-cached texts
    requirements.txt - Python deps: fastapi, uvicorn, openai, python-dotenv, pydantic
  connect.sh - SSH shortcut to root on the production server
  deploy/
    deploy.sh - deploy script: sync source to VPS, build backend/frontend, configure nginx/systemd/certbot
    initial_setup.md - one-time server provisioning guide: firewall, swap, packages, Node, dirs, env, certbot
    logrotate.conf - daily logrotate config for /var/log/parread logs, restarting parread after rotation
    nginx.conf - nginx site config serving Vite dist and reverse-proxying /api/ to port 8000
    parread.service - systemd unit running uvicorn as www-data with auto-restart and log files
  frontend/
    .gitignore - Vite frontend ignore rules for logs, node_modules, dist, and editor files
    eslint.config.js - ESLint flat config for TypeScript/React with hooks and react-refresh plugins
    index.html - Vite HTML entry loading main.tsx, Lora font, titled "Parallel Reader"
    package-lock.json - npm lockfile pinning exact frontend dependency versions
    package.json - frontend manifest: React 19, Vite, Tailwind v4, TypeScript, ESLint
    public/vite.svg - default Vite logo SVG served as the favicon
    src/
      App.tsx - single-component React UI: text input, paragraph display, translation toggle, click-to-explain popup
      LoadingOverlay.tsx - animated loading overlay with rotating whimsical messages and inline translating dots
      assets/react.svg - default React logo SVG asset (unused boilerplate)
      index.css - Tailwind import, dark-mode variant, Lora body font, loading-wave keyframes
      main.tsx - React entry point mounting App in StrictMode into #root
    tsconfig.app.json - TypeScript config for app source: ES2022, bundler resolution, strict linting
    tsconfig.json - root TypeScript project referencing app and node configs
    tsconfig.node.json - TypeScript config for Node-side files (vite.config.ts)
    vite.config.ts - Vite config with React and Tailwind plugins, proxying /api to localhost:8000
  start.sh - local dev launcher starting backend and frontend together with cleanup on exit
videos/
  .gitignore - ignore rules for API keys, mp3s, fonts, and caches
  .vscode/
    launch.json - VS Code debug config launching video2.py with sample args
    settings.json - VS Code editor rulers and pylint disable settings
  README.md - setup/install instructions plus a moviepy CompositeVideoClip patch note
  audio.py - generates TTS intro and transition mp3s per language via ElevenLabs
  client.py - OpenAI GPT client wrapper plus shared file/path helper functions
  create_thumbnail.py - composites YouTube thumbnail from base, level, and intro overlay images
  editor.py - PySide6 GUI for editing multilingual story localizations and titles
  enumerator.py - GPT prompt/role assigning word-group numbers to each text line
  group_clean.py - cleans grouped mapping file: strips union numbers, renumbers groups
  group_mapping.py - interleaves per-language story.txt files into combined mapping_grouped.txt
  groupun_mapping.py - un-groups mapping_grouped.txt back into per-language mapping.txt files
  languages.py - language config: locales, ElevenLabs voices, intro/transition text strings
  mapper.py - aligns cross-language word numbers via GPT and SequenceMatcher union logic
  mapper_lib.py - shared mapping library: GPT role prompt and map_and_cache helpers
  mapperre.py - re-runs word mapping for each locale pair via map_and_cache
  narration_extractor.py - builds TTS narration text with name substitutions and break tags
  original_story_restorer.py - uses GPT to regroup sentences into paragraphs restoring original.txt
  pack_enumeration.py - renumbers word-group parentheses sequentially per sentence in story_ml.txt
  painter.py - parses word/number tokens and merges consecutive same-number words for coloring
  pyproject.toml - Black formatter configuration (line-length 80, py311)
  requirements.txt - Python dependency list (pillow, moviepy, openai, elevenlabs, linters)
  sentence_numbers.py - prepends sentence index numbers to each mapping.txt line per language
  sentence_separator.py - GPT splits raw text into one sentence per line
  story.py - dataclasses (Token/Segment/Sentence/Scene) and parser with grouped-id tokens
  story_flat.py - flat multilingual story dataclasses and line-based parser
  sublime/
    sublime_add_union_number.py - Sublime command adding/removing parenthesized numbers on tokens via hotkeys
    sublime_key_bindings.json - Sublime keybindings mapping ctrl+digits to token-numbering commands
    sublime_line_length.py - Sublime command estimating/displaying grouped line lengths as phantoms
    sublime_plugin.py - Sublime plugin highlighting numbered tokens with per-number region colors
  translation_improver.py - GPT refines translated story_raw into corrected per-language versions
  translator.py - GPT translates English story into each language plus validation
  tts.py - ElevenLabs text-to-speech wrapper writing audio to file
  tuple_hash.py - computes SHA-256 hex hash of a tuple's repr for caching
  video2.py - main script assembling parallel-listening language video with moviepy
  video_description.py - builds localized YouTube titles and descriptions per level/language
web/
  .gitignore - Create React App gitignore (node_modules, build, coverage, env, logs)
  .vscode/
    settings.json - VS Code setting adding an editor ruler at column 80
  README.md - setup instructions (nvm, npm) and Create React App usage docs
  deploy.sh - bash script cloning repo and deploying web build to a server via ssh/nginx
  package-lock.json - npm lockfile pinning exact dependency versions for the web app
  package.json - package manifest: React, react-query, firebase, react-router deps and CRA scripts
  public/
    favicon.ico - favicon asset for the site
    index.html - HTML template with Polypup title, Literata font, manifest, and root div
    manifest.json - PWA manifest naming app "Polypup", standalone display, cream background
    robots.txt - robots file allowing all crawlers full access
  src/
    App.css - empty stylesheet file
    App.tsx - root component: routing, settings persistence/theme, and top-level page layout
    Explanation.tsx - word-explanation popup with positioning, audio playback, and save/remove word actions
    GenerateView.tsx - story generation form: level/mood/topic selection with progress overlay
    HomePage.tsx - logged-out landing page: hero, how-it-works, curated stories, signup CTAs
    LanguageDropdown.tsx - select dropdown for choosing a language (en/de/ru) with flag labels
    LanguageFlag.tsx - helpers mapping locale codes to flag emoji and language names
    LoginPage.tsx - sign-in/sign-up form with email/Google auth and localized Firebase error mapping
    Modal.tsx - reusable dialog modal with backdrop click-to-close and optional close button
    MyDictionaryView.tsx - saved-words dictionary view with gender coloring and two-step delete control
    ProgressOverlay.tsx - non-dismissable in-flight modal with animation, rotating messages, and cancel
    SettingsMenu.tsx - settings modal for language pair, theme toggle, and gender-coloring options
    StoryMenu.tsx - logged-in story list with generate/scan/upload buttons, favorites, and delete
    StoryView.tsx - parallel-reading story renderer with word popups, gender coloring, and favorites
    TopMenu.tsx - top navigation bar with reader-options menu and user/settings controls
    UploadView.tsx - text upload form (10k char limit) submitting to upload mutation with progress overlay
    config.tsx - exports API_URL and RELOAD_STORY from environment variables
    firebase.tsx - Firebase app/auth init plus hooks and helpers for login state and tokens
    gender.tsx - noun-gender markers: regex, Tailwind color classes, supported locales, examples
    index.css - Tailwind directives, secondary-button component, and light/dark CSS color variables
    index.tsx - app entry point rendering App with react-query QueryClientProvider and devtools
    levelColors.tsx - maps CEFR level strings to Tailwind badge text/background color classes
    localization.tsx - LocalizationStrings interface defining all UI text keys for translations
    logo.svg - default Create React App React logo SVG (unused branding asset)
    queries.tsx - react-query hooks and fetch helpers for stories, words, generate/scan/upload APIs
    react-app-env.d.ts - TypeScript reference to react-scripts type definitions
    reportWebVitals.ts - optional web-vitals performance measurement helper from CRA
    settings.tsx - Settings/Theme/ShowTranslationMode type and enum definitions
    setupTests.ts - Jest test setup importing jest-dom custom matchers
    story.tsx - story data type interfaces and story-list title truncation helper
  tailwind.config.js - Tailwind config: content globs, dark mode, Literata font, custom CSS-var colors
  tsconfig.json - TypeScript compiler configuration for the CRA React project
```
