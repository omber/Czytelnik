"""
Global constants for the Czytelnik pipeline.
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from the pipeline directory
load_dotenv(Path(__file__).parent / ".env", override=True)

# ── Paths ──────────────────────────────────────────────────────────────────
PIPELINE_DIR = Path(__file__).parent
CACHE_DIR = PIPELINE_DIR / "cache"
DICTIONARY_PATH = PIPELINE_DIR / "dictionary.json"

# ── Anthropic ──────────────────────────────────────────────────────────────
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
CLAUDE_MODEL = "claude-haiku-4-5-20251001"  # cheapest model for batch translation

# ── spaCy ──────────────────────────────────────────────────────────────────
SPACY_MODEL = "pl_core_news_lg"

# ── TTS ────────────────────────────────────────────────────────────────────
TTS_VOICE = "pl-PL-ZofiaNeural"

# ── Wolne Lektury API ──────────────────────────────────────────────────────
WL_API_BASE = "https://wolnelektury.pl/api"

# ── Segmentation ───────────────────────────────────────────────────────────
MIN_SENTENCE_TOKENS = 3   # shorter sentences are merged with preceding one
