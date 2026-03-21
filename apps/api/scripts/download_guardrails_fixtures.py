#!/usr/bin/env python3
"""Download deepset/prompt-injections dataset for guardrails evaluation.

Uses the HuggingFace datasets-server REST API with stdlib only (urllib).
Writes JSONL to apps/api/tests/fixtures/guardrails/deepset_injections.jsonl.

Usage:
    python apps/api/scripts/download_guardrails_fixtures.py
"""

from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

DATASET = "deepset/prompt-injections"
CONFIG = "default"
SPLIT = "train"
PAGE_SIZE = 100
BASE_URL = "https://datasets-server.huggingface.co/rows"

# Output path relative to repo root
REPO_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_DIR = REPO_ROOT / "tests" / "fixtures" / "guardrails"
OUTPUT_FILE = OUTPUT_DIR / "deepset_injections.jsonl"


def fetch_page(offset: int, length: int = PAGE_SIZE) -> dict:
    """Fetch a page of rows from the HF datasets-server API."""
    params = (
        f"dataset={DATASET}&config={CONFIG}&split={SPLIT}"
        f"&offset={offset}&length={length}"
    )
    url = f"{BASE_URL}?{params}"
    req = urllib.request.Request(url, headers={"User-Agent": "BeeBuddy-Guardrails/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        print(f"HTTP {e.code} at offset {offset}: {e.reason}", file=sys.stderr)
        raise
    except urllib.error.URLError as e:
        print(f"URL error at offset {offset}: {e.reason}", file=sys.stderr)
        raise


def download_all() -> list[dict]:
    """Paginate through the full dataset and return normalized records."""
    records: list[dict] = []
    offset = 0

    # First request to get total count
    data = fetch_page(offset)
    num_rows_total = data.get("num_rows_total", 0)
    print(f"Dataset has {num_rows_total} total rows")

    while True:
        rows = data.get("rows", [])
        if not rows:
            break

        for row_wrapper in rows:
            row = row_wrapper.get("row", {})
            text = row.get("text", "").strip()
            label_val = row.get("label", 0)

            if not text:
                continue

            # label: 1 = injection, 0 = legitimate
            label = "injection" if label_val == 1 else "legitimate"
            records.append({
                "text": text,
                "label": label,
                "source": "deepset",
            })

        offset += len(rows)
        print(f"  Fetched {offset}/{num_rows_total} rows...", end="\r")

        if offset >= num_rows_total:
            break

        data = fetch_page(offset)

    print(f"\nDone: {len(records)} records total")
    return records


def write_jsonl(records: list[dict], path: Path) -> None:
    """Write records as JSONL."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        for record in records:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")
    print(f"Wrote {len(records)} records to {path}")


def main() -> None:
    print(f"Downloading {DATASET} dataset...")
    records = download_all()

    injection_count = sum(1 for r in records if r["label"] == "injection")
    legit_count = sum(1 for r in records if r["label"] == "legitimate")
    print(f"  Injections: {injection_count}")
    print(f"  Legitimate: {legit_count}")

    write_jsonl(records, OUTPUT_FILE)


if __name__ == "__main__":
    main()
