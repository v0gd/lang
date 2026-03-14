# Parallel Reader

A web application for parallel reading of German texts with English translations. Displays original German text and English translation side-by-side, with click-to-explain functionality for individual words.

## Features

- Input German text and get paragraph-aligned English translation
- Side-by-side display of German and English paragraphs
- Click any German word to see contextual translation explanation
- Auto-generated titles for saved texts
- Browse and manage previously translated texts
- All translations cached locally in JSON files

## Requirements

- Python 3.11+
- Node.js 18+
- OpenAI API key

## Project Structure

```
parread/
├── backend/
│   ├── main.py           # FastAPI server
│   ├── requirements.txt  # Python dependencies
│   ├── .env.example      # Environment template
│   └── cache/            # JSON cache storage
└── frontend/
    ├── src/
    │   └── App.tsx       # Main React component
    ├── package.json
    └── vite.config.ts
```

## Setup

### Backend

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create and activate a virtual environment:
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   ```

   Or using `uv`:
   ```bash
   uv venv
   source .venv/bin/activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

   Or using `uv`:
   ```bash
   uv pip install -r requirements.txt
   ```

4. Create the environment file:
   ```bash
   cp .env.example .env
   ```

5. Edit `.env` and add your OpenAI API key:
   ```
   OPENAI_API_KEY=sk-your-api-key-here
   ```

### Frontend

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Running the Application

### Start the Backend

From the `backend` directory with the virtual environment activated:

```bash
python main.py
```

The API server will start at `http://localhost:8000`.

### Restart the Backend

To restart the backend after code changes:

```bash
# Kill the running process
pkill -f "python main.py"

# Start it again
cd backend
source .venv/bin/activate
python main.py
```

Or press `Ctrl+C` in the terminal running the backend, then run `python main.py` again.

### Start the Frontend

From the `frontend` directory:

```bash
npm run dev
```

The development server will start at `http://localhost:5173`.

### Access the Application

Open `http://localhost:5173` in your browser.

## Usage

1. Enter German text in the input field
2. Click "Proceed" to translate
3. View the side-by-side German/English paragraphs
4. Click any German word to see its contextual explanation
5. Use "Saved Texts" menu to access previous translations
6. Click "New Translation" to translate another text

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/translate` | Translate German text |
| POST | `/api/explain` | Get word explanation |
| GET | `/api/texts` | List all saved texts |
| GET | `/api/texts/{id}` | Get a specific text |
| DELETE | `/api/texts/{id}` | Delete a saved text |

## Translations Cache

Translations are stored as JSON files in `backend/cache/`. Both translations and explanations are cached.