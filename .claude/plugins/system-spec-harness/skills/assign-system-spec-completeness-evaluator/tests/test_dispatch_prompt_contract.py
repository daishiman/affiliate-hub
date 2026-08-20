"""C05 監査 fork の完全 response 台帳束縛を静的に固定する。"""
from pathlib import Path


SKILL_ROOT = Path(__file__).resolve().parents[1]


def _contract_texts() -> dict[str, str]:
    return {
        "SKILL.md": (SKILL_ROOT / "SKILL.md").read_text(encoding="utf-8"),
        "R1-score.md": (SKILL_ROOT / "prompts" / "R1-score.md").read_text(encoding="utf-8"),
        "R2-delegate.md": (SKILL_ROOT / "prompts" / "R2-delegate.md").read_text(encoding="utf-8"),
    }


def test_audit_fork_attribution_is_bound_by_agent_id() -> None:
    """帰属の根拠が `agent_id` の照合であることを 3 文書で固定する。

    以前この検査は「1 message = 1 foreground fork」という語の在否だけを見ていた。
    その語は手段の名前であって目的ではない。手段が撤回された後もその語は
    「撤回した」という文の中に残るので、語の在否を見る検査は撤回に気づかない。
    見るべきは、束縛の根拠 (`agent_id`) と、撤回で失われた保証 (順序の保証) と、
    撤回していない禁止 (起動受理を verdict にしない) が条文として在ることである。
    """
    for name, text in _contract_texts().items():
        assert "PostToolUse" in text, name
        assert "SubagentStop" in text, name
        assert "agent_id" in text, name
        # 撤回で失われた保証。ここが消えたら、順序に頼る推論が黙って戻る。
        assert "順序の保証" in text, name
        # 配線を直しても過去の pending 行は resolved にならない。
        assert "遡及" in text, name
        # 目的側の条項。手段の撤回に巻き込まれて一緒に消えていないこと。
        assert "撤回していない" in text, name


def test_retracted_means_is_never_stated_as_in_force() -> None:
    """撤回した手段の語が、撤回の文脈から離れて再び規則として現れないこと。

    語を消せばこの検査は素通りするので、上の test が `agent_id` / 順序の保証 /
    撤回していない、の下限を張って対にしてある。片方だけでは抜けられる。
    """
    means = "1 message = 1 foreground fork"
    for name, text in _contract_texts().items():
        for lineno, line in enumerate(text.splitlines(), start=1):
            if means in line:
                assert "撤回" in line, f"{name}:{lineno} が撤回の文脈なしに手段を規則として述べている"


def test_three_auditors_keep_the_complete_response_binding() -> None:
    texts = _contract_texts()
    for name in ("SKILL.md", "R2-delegate.md"):
        text = texts[name]
        assert "AUDIT_VERDICT" in text, name
        assert "background/非同期" in text, name

    assert "3 監査は独立 context で並走し得る" not in texts["R2-delegate.md"]
    assert "並走させ得る" not in texts["R1-score.md"]


def test_five_axis_wording_includes_foundation_source_evidence() -> None:
    score = (SKILL_ROOT / "prompts" / "R1-score.md").read_text(encoding="utf-8")
    delegate = (SKILL_ROOT / "prompts" / "R2-delegate.md").read_text(encoding="utf-8")
    criteria = (SKILL_ROOT / "references" / "aspect-criteria.md").read_text(encoding="utf-8")

    for text in (score, delegate, criteria):
        assert "5 軸" in text
        assert "foundation 利用者根拠" in text
        assert "4 軸" not in text
