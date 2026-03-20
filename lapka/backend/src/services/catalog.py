from __future__ import annotations

import json
import re
from collections import defaultdict
from functools import lru_cache
from pathlib import Path
from typing import Any

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"


def _load_json(name: str, key: str) -> list[dict[str, Any]]:
    path = DATA_DIR / name
    if not path.exists():
        return []
    data = json.loads(path.read_text(encoding="utf-8"))
    rows = data.get(key, [])
    return rows if isinstance(rows, list) else []


def _tokenize(value: str) -> list[str]:
    return re.findall(r"[a-zA-Zа-яА-Я0-9]+", value.lower())


def _prefixes(tokens: list[str], *, max_prefix: int = 4) -> set[str]:
    out: set[str] = set()
    for token in tokens:
        if len(token) < 2:
            continue
        out.add(token[: min(max_prefix, len(token))])
    return out


@lru_cache(maxsize=1)
def get_symptoms() -> list[dict[str, Any]]:
    return _load_json("symptoms_catalog.json", "symptoms_catalog")


@lru_cache(maxsize=1)
def get_diseases() -> list[dict[str, Any]]:
    return _load_json("diseases_catalog.json", "diseases_catalog")


@lru_cache(maxsize=1)
def get_drugs() -> list[dict[str, Any]]:
    return _load_json("drug_catalog.json", "drug_catalog")


@lru_cache(maxsize=1)
def _symptoms_compiled() -> list[dict[str, Any]]:
    compiled: list[dict[str, Any]] = []
    for row in get_symptoms():
        compiled.append(
            {
                "row": row,
                "category": str(row.get("category", "")).lower(),
                "name": str(row.get("name", "")).lower(),
                "description": str(row.get("description", "")).lower(),
            }
        )
    return compiled


@lru_cache(maxsize=1)
def _diseases_compiled() -> tuple[list[dict[str, Any]], dict[str, list[int]]]:
    compiled: list[dict[str, Any]] = []
    index: dict[str, list[int]] = defaultdict(list)
    for idx, row in enumerate(get_diseases()):
        name = str(row.get("name", "")).lower()
        summary = str(row.get("summary", "")).lower()
        category = str(row.get("category", "")).lower()
        species = {str(s).lower() for s in row.get("species", [])}
        blob = f"{name} {summary} {category}"
        compiled.append(
            {
                "row": row,
                "category": category,
                "species": species,
                "name": name,
                "summary": summary,
                "blob": blob,
            }
        )
        for prefix in _prefixes(_tokenize(blob)):
            index[prefix].append(idx)
    return compiled, dict(index)


@lru_cache(maxsize=1)
def _drugs_compiled() -> tuple[list[dict[str, Any]], dict[str, list[int]]]:
    compiled: list[dict[str, Any]] = []
    index: dict[str, list[int]] = defaultdict(list)
    for idx, row in enumerate(get_drugs()):
        name = str(row.get("name", "")).lower()
        group = str(row.get("group", "")).lower()
        blob = f"{name} {group}"
        species = {str(s).lower() for s in row.get("species", [])}
        compiled.append(
            {
                "row": row,
                "name": name,
                "group": group,
                "blob": blob,
                "species": species,
                "rx": bool(row.get("prescription_required", False)),
            }
        )
        for prefix in _prefixes(_tokenize(blob)):
            index[prefix].append(idx)
    return compiled, dict(index)


def search_symptoms(q: str | None = None, category: str | None = None, red_flag: bool | None = None, limit: int = 50) -> list[dict[str, Any]]:
    rows = _symptoms_compiled()
    ql = (q or "").strip().lower()
    cl = (category or "").strip().lower()
    out: list[dict[str, Any]] = []
    for row in rows:
        cat = row["category"]
        if cl and cl not in cat and cat not in cl:
            continue
        if red_flag is not None and bool(row["row"].get("red_flag", False)) != red_flag:
            continue
        if ql and ql not in row["name"] and ql not in row["description"]:
            continue
        out.append(row["row"])
        if len(out) >= limit:
            break
    return out


def search_diseases(q: str | None = None, category: str | None = None, species: str | None = None, limit: int = 50) -> list[dict[str, Any]]:
    rows, index = _diseases_compiled()
    ql = (q or "").strip().lower()
    cl = (category or "").strip().lower()
    sp = (species or "").strip().lower()
    out: list[dict[str, Any]] = []
    candidate_rows = rows
    if ql:
        q_prefix = ql[: min(4, len(ql))]
        if len(q_prefix) >= 2 and q_prefix in index:
            candidate_rows = [rows[idx] for idx in index[q_prefix]]
    for row in candidate_rows:
        cat = row["category"]
        if cl and cl not in cat and cat not in cl:
            continue
        if sp:
            if sp not in row["species"]:
                continue
        if ql and ql not in row["name"] and ql not in row["summary"]:
            continue
        out.append(row["row"])
        if len(out) >= limit:
            break
    return out


def search_drugs(q: str | None = None, species: str | None = None, prescription_required: bool | None = None, limit: int = 50) -> list[dict[str, Any]]:
    rows, index = _drugs_compiled()
    ql = (q or "").strip().lower()
    sp = (species or "").strip().lower()
    out: list[dict[str, Any]] = []
    candidate_rows = rows
    if ql:
        q_prefix = ql[: min(4, len(ql))]
        if len(q_prefix) >= 2 and q_prefix in index:
            candidate_rows = [rows[idx] for idx in index[q_prefix]]
    for row in candidate_rows:
        if prescription_required is not None and row["rx"] != prescription_required:
            continue
        if sp:
            if sp not in row["species"]:
                continue
        if ql and ql not in row["name"] and ql not in row["group"]:
            continue
        out.append(row["row"])
        if len(out) >= limit:
            break
    return out


def catalog_counts() -> dict[str, int]:
    return {
        "symptoms": len(get_symptoms()),
        "diseases": len(get_diseases()),
        "drugs": len(get_drugs()),
    }
