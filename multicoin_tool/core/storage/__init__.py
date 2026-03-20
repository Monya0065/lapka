"""Persistence for discovered non-zero balances."""

from __future__ import annotations

import csv
import json
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path


@dataclass
class BalanceRecord:
    network: str
    derivation_path: str
    address: str
    balance: str
    timestamp: str
    seed_hex: str | None = None


FIELDS = ["network", "derivation_path", "address", "balance", "timestamp", "seed_hex"]


def make_record(
    network: str,
    derivation_path: str,
    address: str,
    balance: str,
    seed_hex: str | None,
) -> BalanceRecord:
    return BalanceRecord(
        network=network,
        derivation_path=derivation_path,
        address=address,
        balance=balance,
        timestamp=datetime.now(tz=timezone.utc).isoformat(),
        seed_hex=seed_hex,
    )


def save_records(records: list[BalanceRecord], output_file: str, output_format: str = "json") -> None:
    if not records:
        return

    output_path = Path(output_file)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    if output_format == "json":
        existing: list[dict] = []
        if output_path.exists():
            raw = output_path.read_text(encoding="utf-8").strip()
            if raw:
                existing = json.loads(raw)
                if not isinstance(existing, list):
                    raise ValueError(f"JSON output file must contain an array: {output_file}")
        existing.extend(asdict(record) for record in records)
        output_path.write_text(json.dumps(existing, indent=2, ensure_ascii=False), encoding="utf-8")
        return

    if output_format == "csv":
        write_header = not output_path.exists() or output_path.stat().st_size == 0
        with output_path.open("a", encoding="utf-8", newline="") as fp:
            writer = csv.DictWriter(fp, fieldnames=FIELDS)
            if write_header:
                writer.writeheader()
            for record in records:
                writer.writerow(asdict(record))
        return

    raise ValueError("output_format must be 'json' or 'csv'")
