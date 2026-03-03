"""
Per-lemma dictionary: Polish lemma → {ru: Russian translation, pos: POS tag}.

The dictionary grows across books and is stored as a shared JSON file at
pipeline/dictionary.json.  Missing lemmas are batch-translated via Claude Haiku.
"""
from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any

import anthropic

import shutil

from config import ANTHROPIC_API_KEY, CLAUDE_MODEL, DICTIONARY_PATH, FRONTEND_DICT_PATH
from processing.morphology import Paragraph


# ── Types ──────────────────────────────────────────────────────────────────

DictEntry = dict  # {"ru": str, "pos": str}
Dictionary = dict[str, DictEntry]


# ── Prompt ─────────────────────────────────────────────────────────────────

DICT_SYSTEM = (
    "Ты — лингвист-переводчик. Для каждого польского слова дай краткий перевод "
    "на русский. Отвечай строго в формате JSON: {\"ru\": \"перевод\"}. "
    "Только JSON, без объяснений."
)

DICT_USER_TEMPLATE = (
    "Польское слово: {lemma} (часть речи: {pos})\n"
    "Дай краткий словарный перевод на русский."
)


# ── I/O ────────────────────────────────────────────────────────────────────

def load_dictionary() -> Dictionary:
    if DICTIONARY_PATH.exists():
        return json.loads(DICTIONARY_PATH.read_text(encoding="utf-8"))
    return {}


def save_dictionary(d: Dictionary) -> None:
    content = json.dumps(d, ensure_ascii=False, indent=2, sort_keys=True)
    DICTIONARY_PATH.write_text(content, encoding="utf-8")
    if FRONTEND_DICT_PATH.parent.exists():
        shutil.copy2(DICTIONARY_PATH, FRONTEND_DICT_PATH)


# ── Lemma collection ────────────────────────────────────────────────────────

def collect_lemmas(chapters: list[list[Paragraph]]) -> list[tuple[str, str]]:
    """Return deduplicated (lemma, pos) pairs from all chapters."""
    seen: set[tuple[str, str]] = set()
    result: list[tuple[str, str]] = []
    for paragraphs in chapters:
        for para in paragraphs:
            for sent in para["sentences"]:
                for tok in sent["tokens"]:
                    if tok["is_punct"] or tok["is_space"]:
                        continue
                    key = (tok["lemma"].lower(), tok["pos"])
                    if key not in seen:
                        seen.add(key)
                        result.append(key)
    return result


# ── Batch translation ───────────────────────────────────────────────────────

def _poll_batch(client: anthropic.Anthropic, batch_id: str) -> list[Any]:
    print(f"[dictionary] Batch {batch_id} submitted. Polling …")
    while True:
        batch = client.messages.batches.retrieve(batch_id)
        status = batch.processing_status
        counts = batch.request_counts
        print(
            f"[dictionary]   status={status} "
            f"succeeded={counts.succeeded} errored={counts.errored} "
            f"processing={counts.processing}"
        )
        if status == "ended":
            break
        time.sleep(10)

    return list(client.messages.batches.results(batch_id))


def update_dictionary(chapters: list[list[Paragraph]]) -> Dictionary:
    """
    Ensure the shared dictionary contains entries for every lemma in *chapters*.
    Translates missing lemmas via Claude Haiku Batch API.

    Returns the updated dictionary.
    """
    d = load_dictionary()
    lemmas = collect_lemmas(chapters)

    missing = [(lemma, pos) for lemma, pos in lemmas if lemma not in d]
    if not missing:
        print(f"[dictionary] All {len(lemmas)} lemmas already in dictionary.")
        return d

    print(f"[dictionary] Translating {len(missing)} new lemma(s) …")

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    batch_requests = [
        {
            "custom_id": f"l-{i}",
            "params": {
                "model": CLAUDE_MODEL,
                "max_tokens": 64,
                "system": DICT_SYSTEM,
                "messages": [
                    {
                        "role": "user",
                        "content": DICT_USER_TEMPLATE.format(lemma=lemma, pos=pos),
                    }
                ],
            },
        }
        for i, (lemma, pos) in enumerate(missing)
    ]

    batch = client.messages.batches.create(requests=batch_requests)
    results = _poll_batch(client, batch.id)

    for result in results:
        idx = int(result.custom_id.split("-")[1])
        lemma, pos = missing[idx]
        if result.result.type == "succeeded":
            raw = result.result.message.content[0].text.strip()
            # Strip markdown code fences if present (e.g. ```json\n...\n```)
            if raw.startswith("```"):
                lines = [l for l in raw.splitlines() if not l.startswith("```")]
                raw = "\n".join(lines).strip()
            try:
                entry = json.loads(raw)
                ru = entry.get("ru", "")
            except json.JSONDecodeError:
                # Fallback: treat the entire response as the translation
                ru = raw
        else:
            ru = ""
        d[lemma] = {"ru": ru, "pos": pos}

    save_dictionary(d)
    print(f"[dictionary] Dictionary now has {len(d)} entries.")
    return d
