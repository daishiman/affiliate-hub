"""C05 監査 fork の完全 response 台帳束縛を静的に固定する。"""
from pathlib import Path


SKILL_ROOT = Path(__file__).resolve().parents[1]


def test_three_auditors_are_dispatched_serially_in_foreground() -> None:
    skill = (SKILL_ROOT / "SKILL.md").read_text(encoding="utf-8")
    score = (SKILL_ROOT / "prompts" / "R1-score.md").read_text(encoding="utf-8")
    prompt = (SKILL_ROOT / "prompts" / "R2-delegate.md").read_text(encoding="utf-8")

    for text in (skill, score, prompt):
        assert "1 message = 1 foreground fork" in text
        assert "PostToolUse" in text

    for text in (skill, prompt):
        assert "AUDIT_VERDICT" in text
        assert "background/非同期" in text

    assert "3 監査は独立 context で並走し得る" not in prompt
    assert "並走させ得る" not in score


def test_five_axis_wording_includes_foundation_source_evidence() -> None:
    score = (SKILL_ROOT / "prompts" / "R1-score.md").read_text(encoding="utf-8")
    delegate = (SKILL_ROOT / "prompts" / "R2-delegate.md").read_text(encoding="utf-8")
    criteria = (SKILL_ROOT / "references" / "aspect-criteria.md").read_text(encoding="utf-8")

    for text in (score, delegate, criteria):
        assert "5 軸" in text
        assert "foundation 利用者根拠" in text
        assert "4 軸" not in text
