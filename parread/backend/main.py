import os
import json
import uuid
import time
import logging
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Depends, Query, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(filename)s:%(lineno)d] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    logger.error(f"{request.method} {request.url.path} → {exc.status_code}: {exc.detail}")
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


CACHE_DIR = Path(__file__).parent / "cache"
CACHE_DIR.mkdir(exist_ok=True)

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

API_SECRET_KEY = os.getenv("API_SECRET_KEY", "")

MAX_TEXT_LENGTH = 5000


async def verify_api_key(key: str = Query(default="")):
    if API_SECRET_KEY and key != API_SECRET_KEY:
        raise HTTPException(status_code=403, detail="Access Denied")



class TranslateRequest(BaseModel):
    text: str


class ExplainRequest(BaseModel):
    text_id: str
    paragraph_idx: int
    token_idx: int
    word: str
    sentence: str


class TextResponse(BaseModel):
    id: str
    en: list[str]
    de: list[str]
    title: str
    cached_explanations: list[dict]


def get_cache_file(text_id: str) -> Path:
    return CACHE_DIR / f"{text_id}.json"


def load_cached_text(text_id: str) -> Optional[dict]:
    cache_file = get_cache_file(text_id)
    if cache_file.exists():
        with open(cache_file, "r", encoding="utf-8") as f:
            return json.load(f)
    return None


def save_cached_text(text_id: str, data: dict):
    cache_file = get_cache_file(text_id)
    with open(cache_file, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def parse_llm_json(raw: str, context: str) -> dict:
    """Parse JSON from LLM output, logging the raw text on failure."""
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        logger.error(f"[{context}] Failed to parse LLM response: {raw}")
        raise


def detect_language(text: str) -> str:
    """Detect whether the input text is English or German using structured LLM output."""
    preview = text[:500]
    response = client.responses.create(
        model="gpt-5-nano",
        instructions="Detect the language of the following text. Return only the language code.",
        input=preview,
        reasoning={"effort": "minimal"},
        text={
            "format": {
                "type": "json_schema",
                "name": "language_detection",
                "strict": True,
                "schema": {
                    "type": "object",
                    "properties": {
                        "language": {"type": "string", "enum": ["en", "de"]}
                    },
                    "required": ["language"],
                    "additionalProperties": False
                }
            }
        }
    )

    result = parse_llm_json(response.output_text, "detect_language")
    logger.info(f"[detect_language] Detected: {result['language']}")
    return result["language"]


def split_into_paragraphs(text: str) -> list[str]:
    """Use OpenAI to intelligently split text into paragraphs."""
    response = client.responses.create(
        model="gpt-5-mini",
        instructions="""You are a text processing assistant. Your task is to take text and split it into logical paragraphs.
If the text is already properly paragraphed, keep the existing structure.
Try to keep paragraphs short (a few lines of text per paragraph).
If the text is already properly paragraphed but some paragraphs are too long, break long paragraphs into multiple.
If not, identify natural paragraph breaks based on topic changes, dialogue, or logical divisions.
Clean up any formatting, links, etc., only output clean text.""",
        input=text,
        reasoning={"effort": "minimal"},
        text={
            "format": {
                "type": "json_schema",
                "name": "paragraphs",
                "strict": True,
                "schema": {
                    "type": "object",
                    "properties": {
                        "paragraphs": {
                            "type": "array",
                            "items": {"type": "string"}
                        }
                    },
                    "required": ["paragraphs"],
                    "additionalProperties": False
                }
            }
        }
    )

    result = parse_llm_json(response.output_text, "split_into_paragraphs")
    logger.info(f"[split_into_paragraphs] Result: {len(result['paragraphs'])} paragraphs")
    return result["paragraphs"]


def translate_paragraphs(paragraphs: list[str], source_lang: str = "de") -> list[str]:
    """Translate paragraphs between German and English while maintaining structure."""
    if source_lang == "de":
        direction = "German to English"
    else:
        direction = "English to German"

    response = client.responses.create(
        model="gpt-5.2",
        instructions=f"""You are a professional {direction} translator.
Translate each paragraph while preserving the original meaning, tone, and style.
Maintain the same number of paragraphs as the input.""",
        input=json.dumps(paragraphs, ensure_ascii=False),
        reasoning={"effort": "low"},
        text={
            "format": {
                "type": "json_schema",
                "name": "translation",
                "strict": True,
                "schema": {
                    "type": "object",
                    "properties": {
                        "paragraphs": {
                            "type": "array",
                            "items": {"type": "string"}
                        }
                    },
                    "required": ["paragraphs"],
                    "additionalProperties": False
                }
            }
        }
    )

    result = parse_llm_json(response.output_text, "translate_paragraphs")
    logger.info(f"[translate_paragraphs] Result: {len(result['paragraphs'])} paragraphs")
    return result["paragraphs"]


def generate_title(paragraphs: list[str]) -> str:
    """Generate a short title for the text using a lighter model."""
    preview = " ".join(paragraphs)[:500]

    response = client.responses.create(
        model="gpt-5-nano",
        instructions="Generate a short, descriptive title (max 50 characters) for the following text.",
        input=preview,
        reasoning={"effort": "minimal"},
        text={
            "format": {
                "type": "json_schema",
                "name": "title",
                "strict": True,
                "schema": {
                    "type": "object",
                    "properties": {
                        "title": {"type": "string"}
                    },
                    "required": ["title"],
                    "additionalProperties": False
                }
            }
        }
    )

    result = parse_llm_json(response.output_text, "generate_title")
    return result["title"][:50]


def explain_word(word: str, sentence: str) -> str:
    """Explain a German word in the context of its sentence."""
    response = client.responses.create(
        model="gpt-5.2",
        instructions="""You are a German language expert and teacher. Explain in English the meaning of the given German word in the context of the provided sentence.
Include:
- The basic translation of the word
- For nouns also append an article so the word gender is clear (e.g. "Das Jahrhundert" instead of "Jahrhundert")
- Any special meaning or nuance in this particular context, IF any
- [Optional] IF it's part of a compound word or idiom, explain that. If not, skip this part.

Rules:
- Keep your explanation concise but informative (2-3 sentences max). Only output plain text, not formatting.
- Put both the original word and its translation in double quotes.
- Avoid general knowledge remarks in the explanation (unless it's required for better understanding of translation), your main role is a foreign language teacher.

Examples:
”Das Jahrhundert” means ”century”. Here "im 17. Jahrhundert" means "in the 17th century."
“Spielte” is “played” (past tense of “spielen”). In “spielte eine Rolle,” it’s an idiomatic use meaning “played a role” / “was a factor,”
”Darüber” literally means "about/over that," but here it functions as part of the connective phrase "darüber hinaus" meaning "in addition" / "furthermore."
""",
        input=f"Word: {word}\nSentence: {sentence}",
        reasoning={"effort": "none"}
    )

    return response.output_text.strip()


@app.post("/api/process")
async def process_text(request: TranslateRequest, _=Depends(verify_api_key)):
    """Process text: detect language, split into paragraphs, translate if English, generate title."""
    if len(request.text) > MAX_TEXT_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=f"Text exceeds maximum length of {MAX_TEXT_LENGTH} characters"
        )

    try:
        source_lang = detect_language(request.text)
        paragraphs = split_into_paragraphs(request.text)

        if source_lang == "en":
            # English input: translate to German immediately, store both
            en_paragraphs = paragraphs
            de_paragraphs = translate_paragraphs(en_paragraphs, source_lang="en")
            title = generate_title(de_paragraphs)
        else:
            # German input: store German only, translation is lazy
            de_paragraphs = paragraphs
            en_paragraphs = None
            title = generate_title(de_paragraphs)

        text_id = str(uuid.uuid4())[:8]

        data = {
            "de": de_paragraphs,
            "title": title,
            "source_lang": source_lang,
            "timestamp": int(time.time()),
            "cached_explanations": []
        }

        if en_paragraphs:
            data["en"] = en_paragraphs

        save_cached_text(text_id, data)

        return {"id": text_id, **data}

    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Failed to process text")
    except HTTPException:
        raise
    except Exception:
        logger.exception("[process_text] Unexpected error")
        raise HTTPException(status_code=500, detail="Failed to process text")


@app.post("/api/texts/{text_id}/translate")
async def translate_text(text_id: str, _=Depends(verify_api_key)):
    """Translate an existing text's paragraphs to English."""
    cached_data = load_cached_text(text_id)
    if not cached_data:
        raise HTTPException(status_code=404, detail="Text not found")

    # Return cached translation if it exists
    if "en" in cached_data and cached_data["en"]:
        return {"en": cached_data["en"]}

    try:
        en_paragraphs = translate_paragraphs(cached_data["de"])
        cached_data["en"] = en_paragraphs
        save_cached_text(text_id, cached_data)

        return {"en": en_paragraphs}

    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Failed to translate text")
    except HTTPException:
        raise
    except Exception:
        logger.exception("[translate_text] Unexpected error")
        raise HTTPException(status_code=500, detail="Failed to translate text")


@app.post("/api/explain")
async def explain_word_endpoint(request: ExplainRequest, _=Depends(verify_api_key)):
    """Get explanation for a German word in context."""
    cached_data = load_cached_text(request.text_id)
    if not cached_data:
        raise HTTPException(status_code=404, detail="Text not found")

    for explanation in cached_data.get("cached_explanations", []):
        if (explanation.get("paragraph_idx") == request.paragraph_idx and
            explanation.get("token_idx") == request.token_idx):
            return {"translation": explanation["translation"]}

    translation = explain_word(request.word, request.sentence)

    cached_data["cached_explanations"].append({
        "paragraph_idx": request.paragraph_idx,
        "token_idx": request.token_idx,
        "translation": translation
    })
    save_cached_text(request.text_id, cached_data)

    return {"translation": translation}


@app.get("/api/texts")
async def list_texts(_=Depends(verify_api_key)):
    """List all cached texts."""
    texts = []
    for cache_file in CACHE_DIR.glob("*.json"):
        text_id = cache_file.stem
        data = load_cached_text(text_id)
        if data:
            texts.append({
                "id": text_id,
                "title": data.get("title", "Untitled"),
                "timestamp": data.get("timestamp", 0)
            })
    texts.sort(key=lambda x: x["timestamp"], reverse=True)
    return {"texts": texts}


@app.get("/api/texts/{text_id}")
async def get_text(text_id: str, _=Depends(verify_api_key)):
    """Get a specific cached text."""
    data = load_cached_text(text_id)
    if not data:
        raise HTTPException(status_code=404, detail="Text not found")
    return {"id": text_id, **data}


@app.delete("/api/texts/{text_id}")
async def delete_text(text_id: str, _=Depends(verify_api_key)):
    """Delete a cached text."""
    cache_file = get_cache_file(text_id)
    if not cache_file.exists():
        raise HTTPException(status_code=404, detail="Text not found")

    cache_file.unlink()
    return {"message": "Text deleted successfully"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
