"""Lightweight checks that the migration graph is wired (no DB required)."""

from __future__ import annotations

from pathlib import Path

import pytest

pytest.importorskip("alembic")

from alembic.config import Config
from alembic.script import ScriptDirectory


def _script_dir() -> ScriptDirectory:
    backend = Path(__file__).resolve().parents[1]
    cfg = Config(str(backend / "alembic.ini"))
    return ScriptDirectory.from_config(cfg)


def test_alembic_head_is_latest():
    script = _script_dir()
    assert script.get_current_head() == "039_lp_hotspot_notif"