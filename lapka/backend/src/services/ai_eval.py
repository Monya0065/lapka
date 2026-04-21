from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass
class AIEvalCase:
    scenario_slug: str
    response: dict[str, Any]
    expected_level: str | None = None
    must_have_keys: tuple[str, ...] = ()
    forbidden_substrings: tuple[str, ...] = ()


def evaluate_case(case: AIEvalCase) -> dict[str, Any]:
    response = case.response or {}
    checks: list[dict[str, Any]] = []

    if case.expected_level is not None:
        actual_level = str(response.get("level", "")).upper()
        checks.append(
            {
                "name": "expected_level",
                "ok": actual_level == case.expected_level.upper(),
                "expected": case.expected_level.upper(),
                "actual": actual_level,
            }
        )

    for key in case.must_have_keys:
        checks.append(
            {
                "name": f"must_have:{key}",
                "ok": key in response,
                "expected": "present",
                "actual": "present" if key in response else "missing",
            }
        )

    response_blob = str(response).lower()
    for token in case.forbidden_substrings:
        checks.append(
            {
                "name": f"forbidden:{token}",
                "ok": token.lower() not in response_blob,
                "expected": "absent",
                "actual": "present" if token.lower() in response_blob else "absent",
            }
        )

    passed = sum(1 for check in checks if check["ok"])
    total = len(checks)
    score = 1.0 if total == 0 else round(passed / total, 4)
    return {
        "scenario_slug": case.scenario_slug,
        "score": score,
        "passed": passed,
        "total": total,
        "checks": checks,
    }


def evaluate_suite(cases: list[AIEvalCase]) -> dict[str, Any]:
    results = [evaluate_case(case) for case in cases]
    passed = sum(1 for row in results if row["score"] >= 1.0)
    total = len(results)
    return {
        "suite_score": 1.0 if total == 0 else round(sum(row["score"] for row in results) / total, 4),
        "suite_passed": passed,
        "suite_total": total,
        "results": results,
    }
