from src.services.ai_eval import AIEvalCase, evaluate_case, evaluate_suite


def test_evaluate_case_validates_level_required_keys_and_forbidden_tokens():
    case = AIEvalCase(
        scenario_slug="owner-triage",
        response={"level": "RED", "reasons": ["respiratory distress"], "next_steps": ["go to clinic"]},
        expected_level="RED",
        must_have_keys=("level", "reasons", "next_steps"),
        forbidden_substrings=("mg", "dosage"),
    )
    result = evaluate_case(case)
    assert result["score"] == 1.0
    assert result["passed"] == result["total"]


def test_evaluate_case_reports_failures():
    case = AIEvalCase(
        scenario_slug="owner-triage",
        response={"level": "GREEN", "text": "give 20 mg now"},
        expected_level="RED",
        must_have_keys=("reasons",),
        forbidden_substrings=("mg",),
    )
    result = evaluate_case(case)
    assert result["score"] < 1.0
    assert any(not check["ok"] for check in result["checks"])


def test_evaluate_suite_aggregates_scores():
    suite = evaluate_suite(
        [
            AIEvalCase("a", {"level": "RED"}, expected_level="RED"),
            AIEvalCase("b", {"level": "YELLOW"}, expected_level="RED"),
        ]
    )
    assert suite["suite_total"] == 2
    assert suite["suite_passed"] == 1
    assert 0 < suite["suite_score"] < 1
