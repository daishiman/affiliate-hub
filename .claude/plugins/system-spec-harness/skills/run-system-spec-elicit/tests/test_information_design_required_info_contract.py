"""画面情報設計を frontend architecture より先に確定する契約を固定する。"""

import json
import subprocess
from pathlib import Path


SKILL_DIR = Path(__file__).resolve().parents[1]
CATALOG = SKILL_DIR / "references" / "required-info-catalog.json"
QUESTION_BANK = SKILL_DIR / "references" / "elicit-question-bank.md"
SKILL = SKILL_DIR / "SKILL.md"
R2 = SKILL_DIR / "prompts" / "R2-interview.md"
R3 = SKILL_DIR / "prompts" / "R3-reask.md"
VALIDATOR = SKILL_DIR.parents[1] / "scripts" / "validate-knowledge-graph.py"


def _catalog_items() -> dict[str, dict]:
    payload = json.loads(CATALOG.read_text(encoding="utf-8"))
    return {item["item_id"]: item for item in payload["items"]}


def test_screen_information_priority_blocks_and_precedes_frontend_arch() -> None:
    items = _catalog_items()
    screen = items["screen-information-priority"]
    frontend = items["frontend-arch"]

    assert screen["missing_effect"] == "block"
    assert set(screen["depends_on"]) == {"product-goal", "target-platforms"}
    assert "screen-information-priority" in frontend["depends_on"]
    assert "UI なしは理由付き N/A" in screen["completion_rule"]

    result = subprocess.run(
        [
            "python3",
            str(VALIDATOR),
            "--profile",
            "required-info",
            "--input",
            str(CATALOG),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    report = json.loads(result.stdout)
    assert "screen-information-priority" in report["coverage_certificate"]["blocking_items"]
    assert report["collection_order"].index("screen-information-priority") < report[
        "collection_order"
    ].index("frontend-arch")


def test_question_and_confirmed_gate_cover_context_and_no_ui_branch() -> None:
    screen = _catalog_items()["screen-information-priority"]
    question_bank = QUESTION_BANK.read_text(encoding="utf-8")
    skill = SKILL.read_text(encoding="utf-8")

    required_terms = (
        "利用者ロール",
        "主タスク",
        "熟練度",
        "端末",
        "利用頻度",
        "データ量",
        "比較・一括操作",
        "誤操作コスト",
        "visual device 方針",
    )
    for term in required_terms:
        assert term in screen["question"] or term in screen["completion_rule"]
        assert term in question_bank

    assert "UI がない場合" in question_bank
    assert "理由付き N/A" in question_bank
    assert "後続の確定を block しない" in question_bank
    assert "frontend architecture より先" in question_bank
    assert "UI ありで未接地なら UI-UX と `frontend-arch` の `confirmed` を許さず" in skill
    assert "UI なしの理由付き N/A は後続を block しない" in skill
    for term in ("最優先", "省略", "密度", "ラベル", "区切り線", "アイコン", "画像"):
        assert term in question_bank


def test_r2_and_r3_execute_required_info_order_and_ui_branch() -> None:
    prompts = {
        "R2": R2.read_text(encoding="utf-8"),
        "R3": R3.read_text(encoding="utf-8"),
    }
    required_terms = (
        "required-info-catalog.json",
        "validate-knowledge-graph.py --profile required-info",
        "collection_order",
        "screen-information-priority",
        "frontend-arch",
        "UI あり",
        "UI なし",
        "理由付き N/A",
        "利用者ロール",
        "主タスク",
        "熟練度",
        "端末",
        "利用頻度",
        "データ量",
        "比較/一括操作",
        "誤操作コスト",
        "visual device 方針",
    )

    for name, prompt in prompts.items():
        for term in required_terms:
            assert term in prompt, f"{name} prompt に実行契約 {term!r} がない"
        assert prompt.index("screen-information-priority") < prompt.index("frontend-arch")

    assert "保存済み `next_question` より優先" in prompts["R3"]
