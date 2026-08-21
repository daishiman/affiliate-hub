# /// script
# name: test-seal-foundation-sources
# version: 0.1.0
# purpose: 書面根拠を実ファイルへ照合してから封をする writer (seal-foundation-sources) の門を固定する pytest。
# inputs:
#   - argv: pytest 経由 (直接 argv は取らない)
# outputs:
#   - stdout: pytest 結果
#   - exit: 0=all pass / 1=failure
# contexts: [E, C]
# network: false
# write-scope: tmp_path のみ
# dependencies: []
# requires-python: ">=3.9"
# ///
"""**封が「名乗り」を通していないことを固定する。**

`set-foundation` は foundation を丸ごと引数で受け取るので、`path` と `quote` は
呼び出し側の名乗りである。封はそれを実ファイルへ照合する側なので、**照合を
すり抜ける道が 1 本でも残っていれば封は封でなくなる。**

この検査は落とす側と通す側を対で置く。落とす側だけだと「何を渡しても落ちる
writer」を作っただけかもしれず、通す側だけだと「何を渡しても通る writer」を
作っただけかもしれない。どちらの間違いも、片側だけでは同じ緑に見える。

**⑤ 反転先**: `seal_foundation_sources` の doc comment が挙げている穴
(引用がその欄の根拠として妥当かは機械で決まらない) が塞がった日、
`test_a_quote_from_an_unrelated_place_still_seals` を消さず、
「対応が取れていない出典は封をされない」へ反転させる。**いま通ってしまうこと
自体を固定してあるので、塞がった日にその検査が赤くなって知らせる。**
"""
from __future__ import annotations

import copy
import json
import sys
from pathlib import Path

import pytest

SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPTS))
sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "scripts"))

import state_transition_common as stc  # noqa: E402
import state_transition_foundation as stf  # noqa: E402
import state_transition_matrix as stm  # noqa: E402
import foundation_provenance as fp  # noqa: E402

QUOTE = "封の対象になる一文である。"
OTHER = "同じ文書の、別の欄とは無関係な一文。"


@pytest.fixture()
def doc(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """出典文書を tmp_path に置き、相対 path で開けるよう cwd を移す。

    writer は `Path(path)` を相対で開くので、cwd を固定しないと
    「実在しないから落ちた」を「引用が無いから落ちた」と読み違える。
    """
    target = tmp_path / "brief.md"
    target.write_text(f"# 見出し\n\n{QUOTE}\n\n{OTHER}\n", encoding="utf-8")
    monkeypatch.chdir(tmp_path)
    return target


def make_state(records: list[dict]) -> dict:
    return {
        "qa_log": [{"id": "qa-foundation-u1", "question": "問", "answer": "答"}],
        "requirements_foundation": {
            "essential_purpose": "目的",
            "provenance": {"field_sources": copy.deepcopy(records)},
        },
    }


def written(**overrides) -> dict:
    record = {
        "field": "essential_purpose",
        "kind": "written-requirements",
        "path": "brief.md",
        "quote": QUOTE,
    }
    record.update(overrides)
    return record


# ── 通す側 ────────────────────────────────────────────────────────────
def test_a_real_quote_gets_sealed(doc: Path) -> None:
    """対になる緑。これが無いと「何を渡しても落ちる writer」かもしれない。"""
    state = make_state([written()])
    summary = stf.seal_foundation_sources(state)
    assert summary == {"sealed": 1, "dialogue": 0, "total": 1}

    record = state["requirements_foundation"]["provenance"]["field_sources"][0]
    assert record["sealed_with"] == "seal-foundation-sources"
    assert record["sha256"] == __import__("hashlib").sha256(doc.read_bytes()).hexdigest()
    # 日付は writer が付ける。呼び出し側は渡していない。
    assert record["sealed_on"].count("-") == 2


def test_sealing_twice_changes_nothing(doc: Path) -> None:
    """冪等。同じ文書を 2 回封しても、指紋も日付も書き換わらない。"""
    state = make_state([written()])
    stf.seal_foundation_sources(state)
    first = copy.deepcopy(state["requirements_foundation"]["provenance"])
    assert stf.seal_foundation_sources(state) == {"sealed": 1, "dialogue": 0, "total": 1}
    assert state["requirements_foundation"]["provenance"] == first


def test_dialogue_records_are_checked_but_not_sealed(doc: Path) -> None:
    """対話は指紋を取る相手が無い。実在する qa を指していることだけ見る。"""
    state = make_state([{"field": "essential_purpose", "kind": "user-dialogue",
                         "qa_id": "qa-foundation-u1"}])
    assert stf.seal_foundation_sources(state) == {"sealed": 0, "dialogue": 1, "total": 1}
    record = state["requirements_foundation"]["provenance"]["field_sources"][0]
    assert "sha256" not in record


# ── 落とす側: 名乗りは封にならない ───────────────────────────────────
def test_a_quote_that_is_not_in_the_document_is_refused(doc: Path) -> None:
    """**この検査が本体。**`set-qa-written-up` が塞げなかった穴がここで塞がる。"""
    state = make_state([written(quote="どこにも書かれていない一文")])
    with pytest.raises(stc.TransitionError) as excinfo:
        stf.seal_foundation_sources(state)
    assert "本文に見つからない" in str(excinfo.value)


def test_a_missing_document_is_refused(doc: Path) -> None:
    state = make_state([written(path="ない.md")])
    with pytest.raises(stc.TransitionError) as excinfo:
        stf.seal_foundation_sources(state)
    assert "実在しない" in str(excinfo.value)


def test_a_dangling_qa_id_is_refused(doc: Path) -> None:
    state = make_state([{"field": "essential_purpose", "kind": "user-dialogue",
                         "qa_id": "qa-foundation-u9"}])
    with pytest.raises(stc.TransitionError) as excinfo:
        stf.seal_foundation_sources(state)
    assert "qa_log に不在" in str(excinfo.value)


def test_a_moved_document_is_refused_instead_of_resealed(doc: Path) -> None:
    """**取り直さない。**黙って取り直すと、指紋は何も示さなくなる。"""
    state = make_state([written()])
    stf.seal_foundation_sources(state)
    doc.write_text(doc.read_text(encoding="utf-8") + "\n追記。\n", encoding="utf-8")

    before = copy.deepcopy(state["requirements_foundation"]["provenance"])
    with pytest.raises(stc.TransitionError) as excinfo:
        stf.seal_foundation_sources(state)
    assert "文書が動いています" in str(excinfo.value)
    # 拒否したあと、封が黙って書き換わっていないこと。
    assert state["requirements_foundation"]["provenance"] == before


def test_the_caller_cannot_declare_a_seal(doc: Path) -> None:
    """指紋を自己申告させない。**黙って捨てず、名乗ろうとした事実ごと拒否する。**"""
    state = {"approval_log": [], "requirements_foundation": {}, "qa_log": []}
    for field in ("sha256", "sealed_on", "sealed_with"):
        with pytest.raises(stc.TransitionError) as excinfo:
            stf.set_foundation(state, {"provenance": {"field_sources": [
                written(**{field: "x" * 64})
            ]}})
        assert field in str(excinfo.value)


# ── 読み側の門 ────────────────────────────────────────────────────────
def test_the_read_gate_rejects_an_unsealed_written_source(doc: Path) -> None:
    """封の無い書面根拠は読み側で落ちる。**書き手側に対は置けない**

    (封は state が在ってからでないと打てないので、確定条件にすると堂々巡り)。
    """
    foundation = make_state([written()])["requirements_foundation"]
    assert fp.foundation_unsealed_sources(foundation) == ["essential_purpose"]
    findings = fp.validate_foundation_sealed_sources(foundation)
    assert len(findings) == 1
    assert "原文へ照合されていない書面根拠が 1 件" in findings[0]


def test_the_read_gate_passes_a_sealed_source(doc: Path) -> None:
    """対になる緑。封を打てば同じ foundation が通る。"""
    state = make_state([written()])
    stf.seal_foundation_sources(state)
    foundation = state["requirements_foundation"]
    assert fp.foundation_unsealed_sources(foundation) == []
    assert fp.validate_foundation_sealed_sources(foundation) == []


def test_a_forged_seal_marker_does_not_satisfy_the_read_gate(doc: Path) -> None:
    """指紋だけ書いても通らない。**打刻者まで見る。**

    `set_foundation` は封の欄を弾くが、writer を迂回して state を直接書く道は
    在る (この repo には現に迂回した記録が 2 件ある)。読み側は迂回した state を
    受け取る側なので、ここでも見る。
    """
    foundation = make_state([written(sha256="0" * 64)])["requirements_foundation"]
    assert fp.foundation_unsealed_sources(foundation) == ["essential_purpose"]
    foundation["provenance"]["field_sources"][0]["sealed_with"] = "手で書いた"
    assert fp.foundation_unsealed_sources(foundation) == ["essential_purpose"]


# ── 塞げていないところ (②: 塞がった日に赤くなる) ────────────────────
def test_a_quote_from_an_unrelated_place_still_seals(doc: Path) -> None:
    """**いま通ってしまうことを固定する。**

    引用が本文に在ることは確かめられるが、その引用が**その欄の根拠として妥当か**
    は機械では決まらない。文書のどこかに在る一文を、無関係な欄へ貼れる。
    塞がった日にこの検査が赤くなる。そのとき消さず、module docstring の⑤へ進む。
    """
    state = make_state([written(field="background", quote=OTHER)])
    assert stf.seal_foundation_sources(state) == {"sealed": 1, "dialogue": 0, "total": 1}
    record = state["requirements_foundation"]["provenance"]["field_sources"][0]
    assert record["sealed_with"] == "seal-foundation-sources", (
        "無関係な引用が封をされなくなりました。⑤に従って反転させてください"
    )


# ── CLI から呼べること (門は呼ばれていなければ存在しない) ────────────
def test_the_cli_exposes_the_writer(tmp_path: Path, doc: Path) -> None:
    import subprocess

    state_path = tmp_path / "state.json"
    # CLI は legacy state を読み取り専用として弾くので、現行版を名乗らせる。
    # **版は定数から引く。**手で "1.2" と書くと、版が上がった日にこの検査だけが
    # 古い版で通り続け、CLI が本当に呼べるかを見なくなる。
    payload = make_state([written()])
    payload["schema_version"] = stm.CURRENT_STATE_SCHEMA_VERSION
    payload["design_application_contract_version"] = stm.DESIGN_APPLICATION_CONTRACT_VERSION
    state_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    result = subprocess.run(
        [sys.executable, str(SCRIPTS / "apply-spec-transition.py"),
         "seal-foundation-sources", "--state", str(state_path), "--out", str(state_path)],
        capture_output=True, text=True, cwd=str(doc.parent),
    )
    assert result.returncode == 0, result.stderr
    assert "封: 書面 1 件" in result.stdout
    written_back = json.loads(state_path.read_text(encoding="utf-8"))
    record = written_back["requirements_foundation"]["provenance"]["field_sources"][0]
    assert record["sealed_with"] == "seal-foundation-sources"
