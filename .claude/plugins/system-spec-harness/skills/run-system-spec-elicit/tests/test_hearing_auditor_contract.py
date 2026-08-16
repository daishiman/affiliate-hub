"""C06 hearing auditor の 5 軸・実 loop 上限契約を静的に固定する。"""
from pathlib import Path


PLUGIN = Path(__file__).resolve().parents[3]
ADAPTER = PLUGIN / "agents" / "system-spec-hearing-auditor.md"
SSOT = PLUGIN / "skills" / "run-system-spec-elicit" / "prompts" / "R6-audit-hearing.md"


def test_adapter_keeps_all_five_audit_axes_in_stopping_contract() -> None:
    text = ADAPTER.read_text(encoding="utf-8")

    assert "PASS`=5 軸すべて問題なし" in text
    assert "5 軸すべてを評価" in text
    assert "foundation 根拠欠落" in text
    assert "U1-U9 を canonical source-index" in text
    assert "4 軸" not in text


def test_adapter_and_ssot_use_persisted_max_loops_not_fixed_five() -> None:
    adapter = ADAPTER.read_text(encoding="utf-8")
    ssot = SSOT.read_text(encoding="utf-8")

    for text in (adapter, ssot):
        assert "`max_loops` の実値" in text
        assert "5 周" not in text


def test_adapter_allows_only_read_and_read_only_bash() -> None:
    text = ADAPTER.read_text(encoding="utf-8")

    assert "tools: Read, Bash" in text
    assert "許可された read-only `Bash`" in text
    assert "書込・redirect・network" in text
    assert "Read 以外の操作" not in text
