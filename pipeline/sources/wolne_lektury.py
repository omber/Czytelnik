"""
Fetch Polish books from the Wolne Lektury public domain digital library.
API docs: https://wolnelektury.pl/api/
"""
from __future__ import annotations

import re
import unicodedata
from typing import TypedDict

import requests

from config import WL_API_BASE


class ChapterRaw(TypedDict):
    number: int
    title: str
    text: str


class BookRaw(TypedDict):
    title: str
    author: str
    slug: str
    chapters: list[ChapterRaw]


def fetch_book_metadata(slug: str) -> dict:
    """Return the API metadata dict for *slug*."""
    url = f"{WL_API_BASE}/books/{slug}/"
    resp = requests.get(url, timeout=30)
    resp.raise_for_status()
    return resp.json()


def fetch_book_text(slug: str) -> str:
    """Download the plain-text version of the book and return it."""
    meta = fetch_book_metadata(slug)
    txt_url = meta.get("txt")
    if not txt_url:
        raise ValueError(f"No .txt URL found in metadata for slug '{slug}'")
    resp = requests.get(txt_url, timeout=60)
    resp.raise_for_status()
    text = resp.text
    # Normalize unicode (NFC)
    return unicodedata.normalize("NFC", text)


# ── Chapter splitting ──────────────────────────────────────────────────────

# Wolne Lektury text format:
#   Lines like  "ROZDZIAŁ I", "ROZDZIAŁ II", "Rozdział pierwszy", etc.
# We also handle section markers like "I.", "II." that appear after the header block.

_CHAPTER_RE = re.compile(
    r"^\s*(ROZDZIAŁ|Rozdział|CHAPTER|Chapter|CZĘŚĆ|Część)"
    r"[\s\xa0]+([IVXLCDM]+|[0-9]+|[a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ]+)"
    r"[\s\xa0]*$",
    re.MULTILINE,
)

# Wolne Lektury .txt files begin with a metadata block terminated by "-----"
_HEADER_SEPARATOR = re.compile(r"^-{5,}\s*$", re.MULTILINE)


def _strip_header(text: str) -> str:
    """Remove Wolne Lektury metadata header (everything up to and including '-----')."""
    m = _HEADER_SEPARATOR.search(text)
    if m:
        return text[m.end():].lstrip()
    return text


def split_into_chapters(raw_text: str) -> list[ChapterRaw]:
    """
    Split full book text into chapters.

    Returns a list of dicts with keys: number, title, text.
    If no chapter headings are found, returns the whole book as chapter 1.
    """
    text = _strip_header(raw_text)

    matches = list(_CHAPTER_RE.finditer(text))
    if not matches:
        # No chapter markers found — treat entire text as one chapter
        return [{"number": 1, "title": "Rozdział 1", "text": text.strip()}]

    chapters: list[ChapterRaw] = []
    for i, m in enumerate(matches):
        title = m.group(0).strip()
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        body = text[start:end].strip()
        chapters.append({"number": i + 1, "title": title, "text": body})

    return chapters


def load_book(slug: str) -> BookRaw:
    """
    High-level helper: fetch metadata + text, split into chapters.
    Returns a BookRaw dict.
    """
    print(f"[wolnelektury] Fetching metadata for '{slug}' …")
    meta = fetch_book_metadata(slug)
    title = meta.get("title", slug)
    author_data = meta.get("authors", [{}])
    author = author_data[0].get("name", "Unknown") if author_data else "Unknown"

    print(f"[wolnelektury] Downloading text …")
    raw_text = fetch_book_text(slug)

    print(f"[wolnelektury] Splitting into chapters …")
    chapters = split_into_chapters(raw_text)
    print(f"[wolnelektury] Found {len(chapters)} chapter(s).")

    return {"title": title, "author": author, "slug": slug, "chapters": chapters}
