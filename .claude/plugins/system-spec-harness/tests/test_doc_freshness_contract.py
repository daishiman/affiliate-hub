"""C08 の契約書が「判定できないこと」を FAIL と呼ばないこと。

契約書は 2 つある — agent 起動プロンプトと SSOT。**食い違ったら SSOT が勝つ**と
agent 側に書いてある。つまり agent だけ直しても効かない。実測 2026-08-25 に、
doc_freshness がずっと赤だった原因はここにあった:

  - 転記 (証跡との逐語一致) を確かめる層が**そもそも無かった**。C13 は
    `evidence_sha256` を書式 (SHA256_HEX) までしか見ず、実体と突き合わせない。
    **書式だけ正しい嘘は書式検査を通る。**
  - 結果、「記録が違う」「証跡が古い」「上流が変わった」が 1 つの FAIL に潰れ、
    是正の宛先が仕様書へ向いた。だが仕様書は正しかった (実測 15/15 逐語一致)。
    **直すところの無い赤は消えず、やがて誰も見なくなる。**

この試験群が留めるのは 3 つ。**三層であること**、**判定できないものを
INDETERMINATE と呼ぶこと**、そして **緩めたのではないこと** — すなわち
`MAX_UNVERIFIED_FRESHNESS = 1` が動いていないこと。
最後の 1 つが無いと、この修正は「閾値を下げて緑にした」と区別がつかない。
"""
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
AGENT = ROOT / "agents" / "system-spec-doc-freshness-auditor.md"
SSOT = ROOT / "skills" / "run-system-spec-doc-fetch" / "prompts" / "R4-audit-doc-freshness.md"
GATE = ROOT / "scripts" / "validate-evidence-transcription.py"

CONTRACTS = pytest.mark.parametrize("doc", [AGENT, SSOT], ids=["agent", "ssot"])


def _text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


# ── 二つの契約書が食い違わないこと ──────────────────────────────────────
@CONTRACTS
def test_the_contract_declares_three_layers(doc):
    """**片方だけ直すと SSOT 優先規則で元に戻る。**"""
    body = _text(doc)
    assert "三層" in body, doc.name
    assert "二層監査" not in body, doc.name


@CONTRACTS
def test_the_transcription_gate_is_named_in_the_contract(doc):
    """契約書が名指ししない検査は、誰も走らせない。"""
    assert "validate-evidence-transcription.py" in _text(doc), doc.name


def test_the_named_gate_actually_exists():
    """**存在しない道具を要求する契約は、守れないことを要求している。**"""
    assert GATE.is_file(), GATE


@CONTRACTS
def test_the_contract_splits_the_three_kinds_of_mismatch(doc):
    body = _text(doc)
    for phrase in ("転記", "上流が変わった", "再取得"):
        assert phrase in body, (doc.name, phrase)


# ── 判定できないものを FAIL と呼ばないこと ──────────────────────────────
@CONTRACTS
def test_the_contract_forbids_calling_the_undecidable_a_failure(doc):
    """判定できないことを FAIL と呼ぶと、直せない赤が居座る。"""
    body = _text(doc)
    assert "判定できないことを FAIL と呼ぶと" in body or "確定不能を FAIL とも呼ばない" in body, doc.name
    assert "INDETERMINATE" in body, doc.name


@CONTRACTS
def test_a_faithful_record_is_not_blamed_for_a_stale_upstream(doc):
    """転記が証跡と一致するのに現行版と食い違うとき、宛先は再取得であって記録の書き換えではない。

    **正しい記録を書き換えさせる圧力は、証跡を壊す。**
    """
    body = _text(doc)
    assert "記録の誤りではない" in body, doc.name
    assert "記録の訂正としては書かない" in body, doc.name


def test_a_missing_tool_is_not_a_verdict():
    """道具が無くて層2 を一件も実施できなかったのは、PASS でも FAIL でもない。

    実測: このセッションでは WebFetch が使えない。**確かめなかったことは、
    良い報せでも悪い報せでもない。**
    """
    body = _text(SSOT)
    assert "監査不成立" in body
    assert "層2 を実施していない" in body
    assert "`INDETERMINATE` は緑ではなく" in body


@CONTRACTS
def test_the_contract_requires_saying_what_it_did_not_judge(doc):
    """述べない検査は「見た」と区別がつかない。"""
    assert "判定しなかった軸" in _text(doc) or "判定**できなかった**軸" in _text(doc), doc.name


# ── 緩めたのではないこと ────────────────────────────────────────────────
def test_the_unverified_freshness_cap_did_not_move():
    """**閾値は動かしていない。**緩めた修正と、分けた修正を取り違えさせない。

    利用者が 2026-08-20 に裁定した上限である。ここが 2 以上へ動いたら、
    この一連の修正は「未確認を積み増して緑を保つ」経路になる。
    """
    body = _text(SSOT)
    assert "`MAX_UNVERIFIED_FRESHNESS = 1`" in body
    assert "下げる方向にしか動かさない" in body
    assert "1 → 2 以上は不可" in body


def test_transcription_fidelity_does_not_buy_freshness():
    """層0 の緑を理由に未確認へ寄せた target も、上限の勘定に入ること。

    ここが抜けると「転記は正しい」と言うだけで無限に未確認を作れる。
    **転記が正しいことは、鮮度を確かめた証明にはならない。**
    """
    assert "この勘定に入る" in _text(SSOT)


def test_the_agent_checklist_requires_running_the_gate():
    """契約書に書いても、停止条件に無ければ走らせずに返せてしまう。"""
    body = _text(AGENT)
    assert "- [ ] C08a (`validate-evidence-transcription.py" in body
