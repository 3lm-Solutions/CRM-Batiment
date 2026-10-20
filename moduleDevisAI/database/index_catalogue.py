from __future__ import annotations
import argparse
import os
import sys
from pathlib import Path

import psycopg
from dotenv import load_dotenv

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from catalog import CatalogueIndexer
from catalog.embeddings import EmbeddingGemmaProvider

def connection():
    return psycopg.connect(os.environ["DATABASE_URL"])

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--company-id", type=int, required=True)
    parser.add_argument("--batch-size", type=int, default=50)
    args = parser.parse_args()
    if args.batch_size < 1 or args.batch_size > 500:
        parser.error("--batch-size must be between 1 and 500")
    missing = [name for name in ("DATABASE_URL",) if not os.environ.get(name)]
    if missing:
        parser.error(f"Missing required environment variable(s): {', '.join(missing)}")

    indexer = CatalogueIndexer(connection, EmbeddingGemmaProvider())
    total = 0
    while True:
        indexed = indexer.index_pending(args.company_id, args.batch_size)
        total += indexed
        if indexed < args.batch_size:
            break
    print(f"Indexed {total} catalogue rows for company {args.company_id}.")

if __name__ == "__main__":
    main()
