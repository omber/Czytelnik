"""
Parse DRM-free EPUB files into the same BookRaw structure used by wolne_lektury.py.
Uses ebooklib for EPUB reading and BeautifulSoup4 for HTML cleaning.
"""
from __future__ import annotations

import re
import unicodedata
from pathlib import Path
from typing import TypedDict

import warnings

import ebooklib
from ebooklib import epub
from bs4 import BeautifulSoup, XMLParsedAsHTMLWarning

warnings.filterwarnings("ignore", category=XMLParsedAsHTMLWarning)

# Re-use the same type as wolne_lektury for consistency
from sources.wolne_lektury import BookRaw, ChapterRaw


# ── HTML → plain text ──────────────────────────────────────────────────────

_SOFT_HYPHEN = "\u00ad"
_NBSP = "\u00a0"

def _html_to_text(html_content: bytes | str) -> str:
    """Convert EPUB chapter HTML to clean plain text."""
    soup = BeautifulSoup(html_content, "lxml")

    # Remove unwanted elements
    for tag in soup(["script", "style", "img", "figure", "nav", "aside"]):
        tag.decompose()

    # Preserve paragraph breaks
    for br in soup.find_all("br"):
        br.replace_with("\n")
    for p in soup.find_all(["p", "div", "h1", "h2", "h3", "h4", "h5", "h6"]):
        p.append("\n\n")

    text = soup.get_text()

    # Clean up
    text = text.replace(_SOFT_HYPHEN, "")        # remove soft hyphens
    text = text.replace(_NBSP, " ")              # normalize non-breaking spaces
    text = unicodedata.normalize("NFC", text)
    # Collapse excessive blank lines (keep max 2 consecutive newlines)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


# ── Chapter detection ──────────────────────────────────────────────────────

_CHAPTER_HEADING_RE = re.compile(
    r"^(ROZDZIAŁ|Rozdział|CHAPTER|Chapter|CZĘŚĆ|Część|Kapitel"
    r"|[IVXLCDM]{1,6}\.?\s*$)",
    re.MULTILINE,
)


def _split_by_heading(text: str, spine_title: str) -> list[str]:
    """
    Try to detect sub-chapters within a single XHTML document.
    Returns a list of text blocks (one per detected heading group).
    Falls back to the whole text as one block.
    """
    matches = list(_CHAPTER_HEADING_RE.finditer(text))
    if not matches:
        return [text]
    blocks = []
    for i, m in enumerate(matches):
        start = m.start()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        blocks.append(text[start:end].strip())
    return blocks


# ── Main entry point ───────────────────────────────────────────────────────

def parse_epub(filepath: str | Path) -> BookRaw:
    """
    Parse a DRM-free EPUB file.

    Strategy:
    1. Try NCX/NAV TOC for chapter titles.
    2. Fall back to XHTML file boundaries as chapters.
    3. Last resort: regex on ROZDZIAŁ headings within concatenated text.

    Returns a BookRaw dict compatible with wolne_lektury.load_book().
    """
    filepath = Path(filepath)
    book = epub.read_epub(str(filepath))

    # ── Metadata ────────────────────────────────────────────────────────────
    title_meta = book.get_metadata("DC", "title")
    title = title_meta[0][0] if title_meta else filepath.stem

    creator_meta = book.get_metadata("DC", "creator")
    author = creator_meta[0][0] if creator_meta else "Unknown"

    # ── Build spine items (only XHTML documents) ───────────────────────────
    spine_ids = [item_id for item_id, _ in book.spine]
    spine_items = []
    for item_id in spine_ids:
        item = book.get_item_with_id(item_id)
        if item and item.get_type() == ebooklib.ITEM_DOCUMENT:
            spine_items.append(item)

    if not spine_items:
        raise ValueError(f"No readable XHTML documents found in {filepath}")

    # ── Try TOC for titles ─────────────────────────────────────────────────
    # NCX / NAV toc gives us (title, href) pairs we can match to spine items
    toc_titles: dict[str, str] = {}  # href basename → title
    def _walk_toc(toc_items):
        for item in toc_items:
            if isinstance(item, epub.Link):
                href = item.href.split("#")[0].split("/")[-1]
                toc_titles[href] = item.title
            elif isinstance(item, tuple):
                section, children = item
                if hasattr(section, "href"):
                    href = section.href.split("#")[0].split("/")[-1]
                    toc_titles[href] = section.title
                _walk_toc(children)

    _walk_toc(book.toc)

    # ── Extract chapters ───────────────────────────────────────────────────
    chapters: list[ChapterRaw] = []
    chapter_num = 0

    for item in spine_items:
        text = _html_to_text(item.get_content())
        if not text.strip():
            continue

        item_filename = item.file_name.split("/")[-1]
        toc_title = toc_titles.get(item_filename, "")

        # Skip cover/copyright/preface spine items that are tiny
        if len(text) < 200 and not toc_title:
            continue

        chapter_num += 1
        title_for_chapter = toc_title or f"Rozdział {chapter_num}"
        chapters.append({
            "number": chapter_num,
            "title": title_for_chapter,
            "text": text,
        })

    if not chapters:
        raise ValueError(f"Could not extract any chapters from {filepath}")

    # ── Fallback: if only 1 chapter found but text is huge, try regex split ─
    if len(chapters) == 1 and len(chapters[0]["text"]) > 10_000:
        blocks = _split_by_heading(chapters[0]["text"], chapters[0]["title"])
        if len(blocks) > 1:
            chapters = [
                {"number": i + 1, "title": f"Rozdział {i + 1}", "text": b}
                for i, b in enumerate(blocks)
            ]

    print(f"[epub_parser] '{title}' by {author} — {len(chapters)} chapter(s)")
    return {
        "title": title,
        "author": author,
        "slug": filepath.stem.lower().replace(" ", "-"),
        "chapters": chapters,
    }
