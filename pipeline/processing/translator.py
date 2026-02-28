"""
Sentence translation using the Anthropic Batch API (claude-haiku).

Strategy
--------
1. Collect all sentences that need translation across all paragraphs.
2. Check the translation cache — skip already-translated sentences.
3. Send remaining sentences in a single batch request.
4. Poll until the batch completes, then write results to cache.
5. Return paragraphs with translations filled in.

Cache format: JSON dict  {sentence_text: russian_translation}
Located at: cache/{book_id}/translations.json
"""
from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any

import anthropic

from config import ANTHROPIC_API_KEY, CACHE_DIR, CLAUDE_MODEL
from processing.morphology import Paragraph


# ── Prompt ─────────────────────────────────────────────────────────────────

SYSTEM_PROMPT = (
    "Ты — профессиональный литературный переводчик с польского на русский. "
    "Переводи точно, естественно, литературным языком. "
    "Отвечай ТОЛЬКО переводом — без пояснений, без кавычек, без лишних слов."
)

USER_TEMPLATE = "Переведи на русский:\n{sentence}"


# ── Cache helpers ───────────────────────────────────────────────────────────

def _cache_path(book_id: str) -> Path:
    p = CACHE_DIR / book_id / "translations.json"
    p.parent.mkdir(parents=True, exist_ok=True)
    return p


def _load_cache(book_id: str) -> dict[str, str]:
    p = _cache_path(book_id)
    if p.exists():
        return json.loads(p.read_text(encoding="utf-8"))
    return {}


def _save_cache(book_id: str, cache: dict[str, str]) -> None:
    p = _cache_path(book_id)
    p.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")


# ── Sentence collection ─────────────────────────────────────────────────────

def _sentence_surface(para: Paragraph, sent_idx: int) -> str:
    """Reconstruct sentence text from tokens."""
    tokens = para["sentences"][sent_idx]["tokens"]
    return "".join(t["surface"] for t in tokens)


def _collect_sentences(
    chapters: list[list[Paragraph]],
) -> list[tuple[int, int, int, str]]:
    """
    Returns list of (chapter_idx, para_idx, sent_idx, surface_text) for
    every sentence across all chapters.
    """
    result = []
    for ch_idx, paragraphs in enumerate(chapters):
        for para in paragraphs:
            for sent in para["sentences"]:
                text = "".join(t["surface"] for t in sent["tokens"]).strip()
                if text:
                    result.append((ch_idx, para["index"], sent["index"], text))
    return result


# ── Batch API ───────────────────────────────────────────────────────────────

def _build_batch_requests(
    sentences: list[tuple[int, int, int, str]],
    cache: dict[str, str],
) -> tuple[list[dict[str, Any]], list[tuple[int, int, int, str]]]:
    """
    Build Anthropic batch message requests for sentences not yet in cache.
    Returns (requests, uncached_sentences) where uncached_sentences mirrors requests.
    """
    requests_list: list[dict[str, Any]] = []
    uncached: list[tuple[int, int, int, str]] = []

    seen_texts: set[str] = set()
    for item in sentences:
        text = item[3]
        if text in cache or text in seen_texts:
            continue
        seen_texts.add(text)
        requests_list.append({
            "custom_id": f"s-{len(requests_list)}",
            "params": {
                "model": CLAUDE_MODEL,
                "max_tokens": 512,
                "system": SYSTEM_PROMPT,
                "messages": [
                    {"role": "user", "content": USER_TEMPLATE.format(sentence=text)}
                ],
            },
        })
        uncached.append(item)

    return requests_list, uncached


def _poll_batch(client: anthropic.Anthropic, batch_id: str) -> list[Any]:
    """Poll until batch completes; return list of MessageBatchResult objects."""
    print(f"[translator] Batch {batch_id} submitted. Polling …")
    while True:
        batch = client.messages.batches.retrieve(batch_id)
        status = batch.processing_status
        counts = batch.request_counts
        print(
            f"[translator]   status={status} "
            f"succeeded={counts.succeeded} errored={counts.errored} "
            f"processing={counts.processing}"
        )
        if status == "ended":
            break
        time.sleep(10)

    results = []
    for result in client.messages.batches.results(batch_id):
        results.append(result)
    return results


# ── Public API ──────────────────────────────────────────────────────────────

def translate_chapters(
    chapters: list[list[Paragraph]],
    book_id: str,
) -> list[list[Paragraph]]:
    """
    Fill in the `translation` field for every sentence in *chapters*.
    Uses cache to avoid re-translating; falls back gracefully on API errors.

    Mutates chapters in-place and returns them.
    """
    cache = _load_cache(book_id)
    all_sentences = _collect_sentences(chapters)

    # Identify uncached sentences
    uncached_texts = [
        (ch, p, s, text)
        for ch, p, s, text in all_sentences
        if text not in cache
    ]

    if uncached_texts:
        print(
            f"[translator] {len(uncached_texts)} sentence(s) need translation "
            f"({len(all_sentences) - len(uncached_texts)} cached)."
        )

        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        batch_requests, uncached_items = _build_batch_requests(all_sentences, cache)

        if batch_requests:
            batch = client.messages.batches.create(requests=batch_requests)
            results = _poll_batch(client, batch.id)

            # Map custom_id index → translation
            idx_to_translation: dict[int, str] = {}
            for result in results:
                idx = int(result.custom_id.split("-")[1])
                if result.result.type == "succeeded":
                    idx_to_translation[idx] = result.result.message.content[0].text.strip()
                else:
                    idx_to_translation[idx] = ""

            # Populate cache with unique texts (using the uncached list order)
            seen: set[str] = set()
            for i, (_, _, _, text) in enumerate(uncached_items):
                if text not in seen:
                    seen.add(text)
                    cache[text] = idx_to_translation.get(i, "")

            _save_cache(book_id, cache)
    else:
        print(f"[translator] All {len(all_sentences)} sentences already cached.")

    # Write translations back into chapter structures
    for ch_idx, paragraphs in enumerate(chapters):
        for para in paragraphs:
            for sent in para["sentences"]:
                text = "".join(t["surface"] for t in sent["tokens"]).strip()
                sent["translation"] = cache.get(text, "")

    return chapters
