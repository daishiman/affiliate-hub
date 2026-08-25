# /// script
# name: test-counted-required-info-gate
# version: 0.1.0
# purpose: validate-coverage-matrix.py に足した 2 つの検査 (--require-counted-required-info による確定セルの C16 block item 充足照合 / matrix cell の qa_refs) を、正例・負例・陽性対照・後方互換で検証する pytest。
# inputs:
#   - argv: pytest 経由 (直接 argv は取らない)
# outputs:
#   - stdout: pytest 結果
#   - exit: 0=all pass / 1=failure
# contexts: [E, C]
# network: false
# write-scope: none
# dependencies: []
# requires-python: ">=3.9"
# ///
"""確定セルの C16 充足照合と qa_refs の検査を固定する。

**この 2 つは既存の検査を置き換えない。**`--require-counted-required-info` は
opt-in であり、既定の `--require-complete` の意味は変えていない (後方互換をここで
陽に固定する)。`qa_refs` は `qa_ref` を残したまま足す欄であり、単数欄を読む側は
そのまま動く。
"""
from __future__ import annotations

import importlib.util
import json
from pathlib import Path

HARNESS = Path(__file__).resolve().parent.parent
SCRIPTS = HARNESS / "scripts"
REPO_STATE = HARNESS.parent.parent.parent / "system-spec" / "spec-state.json"

PLATFORMS = ["web", "mobile", "tablet", "desktop-windows", "desktop-linux", "desktop-macos"]
CATEGORIES = [
    "database", "auth", "ui-ux", "security",
    "infrastructure", "backend", "frontend", "maintenance-ops",
]

# カタログ (required-info-catalog.json) の missing_effect=block を domain 別に写したもの。
# **この写しを検査の根拠にしない。**検査はカタログを直接読む。ここに置くのは、
# 写しとカタログが食い違ったときにテストが落ちて気づけるようにするためで、
# その突き合わせは test_the_local_copy_matches_the_catalog が行う。
BLOCK_BY_DOMAIN = {
    "auth": ["auth-model"],
    "backend": ["domain-model"],
    "security": ["security-posture"],
    "ui-ux": ["product-goal", "screen-information-priority", "target-platforms"],
}


def _load(name: str, filename: str):
    spec = importlib.util.spec_from_file_location(name, SCRIPTS / filename)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


c12 = _load("validate_coverage_matrix_c16", "validate-coverage-matrix.py")


def _write(tmp_path: Path, data: dict) -> str:
    p = tmp_path / "m.json"
    p.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    return str(p)


def _qa(qa_id: str) -> dict:
    return {
        "id": qa_id,
        "question": "q",
        "answer": "a",
        "design_applications": [{
            "knowledge_ref": "design-knowledge:test",
            "principle": "single source of truth",
            "applicability": "applied",
            "rationale": "one decision backs the confirmed cells in this fixture",
            "tradeoffs": ["fixture is intentionally compact"],
        }],
    }


def _matrix(*, counted: bool) -> dict:
    """8 カテゴリ×6 platform 全確定。counted=True で C16 の記録欄を持たせる。"""
    matrix = {}
    for cat in CATEGORIES:
        row = {}
        for pf in PLATFORMS:
            cell = {"state": "確定", "qa_ref": "qa-001", "serves_goals": ["G1"]}
            if counted:
                block = BLOCK_BY_DOMAIN.get(cat)
                if block:
                    cell["required_info"] = [
                        {"item_id": i, "missing_effect": "block", "status": "grounded",
                         "grounded_by": "qa-001"}
                        for i in block
                    ]
                else:
                    # 2026-08-25: `unmet_blocking_items` を足した。**検査を通すために
                    # 資材を書き換えたのではない** — writer (`record-required-info-check`)
                    # は 2 欄を分けて書くようになっており、この資材は writer の出力の
                    # 姿を真似たものである。片方だけ古い姿のまま残ると、資材のほうが
                    # 「writer が書かない形」を正しいと言い続ける。
                    cell["required_info_checks"] = [{
                        "checked_on": "2026-08-21",
                        "checked_with": "record-required-info-check",
                        "blocking_item_count": 0,
                        "unmet_blocking_items": 0,
                    }]
            row[pf] = cell
        matrix[cat] = row
    return {
        "schema_version": "1.1",
        "design_application_contract_version": "1.0",
        "categories": [{"id": c, "label": c} for c in CATEGORIES],
        "platforms": PLATFORMS,
        "matrix": matrix,
        "qa_log": [_qa("qa-001")],
        "approval_log": [{"id": "appr-001"}],
        "requirements_foundation": {},
        "decisions": [],
    }


def test_the_local_copy_matches_the_catalog() -> None:
    """写しが古びたら落ちる。カタログが増えたのに検査が増えない形を防ぐ。"""
    actual = c12._blocking_item_ids_by_domain()
    assert {k: sorted(v) for k, v in actual.items()} == {
        k: sorted(v) for k, v in BLOCK_BY_DOMAIN.items()
    }


def test_the_gate_is_opt_in_and_does_not_change_require_complete(tmp_path) -> None:
    """**後方互換をここで固定する。**記録欄を持たない matrix は、これまでどおり
    `--require-complete` を通る。新しい検査を既定に入れると、確定セルを作る合成
    matrix が一斉に落ちる (実測 19 本) — 既存の『valid complete とは何か』を
    この変更の裁量で書き換えないという線引きを、テストとして残す。"""
    m = _write(tmp_path, _matrix(counted=False))
    assert c12.main(["--matrix", m, "--require-complete"]) == 0


def test_the_gate_fires_on_a_state_that_never_counted(tmp_path, capsys) -> None:
    """**0 件を主張する側の陽性対照。**記録の無いセルで実際に落ちることを見る。
    これが無いと、検査が壊れて何も見つけなくても同じ緑になる。"""
    m = _write(tmp_path, _matrix(counted=False))
    assert c12.main(["--matrix", m, "--require-complete", "--require-counted-required-info"]) == 1
    err = capsys.readouterr().err
    assert "数えた記録 (required_info_checks) が無い" in err
    assert "の充足状態が記録されていない" in err


def test_a_counted_state_passes(tmp_path) -> None:
    m = _write(tmp_path, _matrix(counted=True))
    assert c12.main(["--matrix", m, "--require-complete", "--require-counted-required-info"]) == 0


def test_the_newest_record_must_separate_total_from_unmet(tmp_path, capsys) -> None:
    """**上の資材変更が、検査を緩めたのではないことの陽性対照。**

    2026-08-24 の監査が `blocking_item_count` を未充足数と読み違え、充足済みの
    4 セルを差し戻し対象に挙げた (本人撤回)。総数と未充足数が 1 つの欄に
    同居していると、読む側が毎回どちらかに賭けることになる。

    直し方は再計測 (`record-required-info-check` の再実行) であって古い記録の
    書き換えではないので、**最新の 1 件にだけ**要求する。ここが緑のまま
    `unmet_blocking_items` を消せてしまうなら、資材へ足した 1 行は
    「赤を消すために書いた行」でしかない。
    """
    data = _matrix(counted=True)
    del data["matrix"]["database"]["web"]["required_info_checks"][0]["unmet_blocking_items"]
    m = _write(tmp_path, data)
    assert c12.main(["--matrix", m, "--require-complete", "--require-counted-required-info"]) == 1
    err = capsys.readouterr().err
    assert "unmet_blocking_items が無い" in err
    assert "matrix[database][web]" in err


def test_an_older_record_without_the_field_is_left_alone(tmp_path) -> None:
    """**過去の記録は書き換えさせない。**古い姿の記録が最新でなければ通る。
    ここを赤くすると、直し方が「数え直す」ではなく「履歴を直す」になる。"""
    data = _matrix(counted=True)
    checks = data["matrix"]["database"]["web"]["required_info_checks"]
    checks.insert(0, {
        "checked_on": "2026-08-20",
        "checked_with": "record-required-info-check",
        "blocking_item_count": 0,
    })
    m = _write(tmp_path, data)
    assert c12.main(["--matrix", m, "--require-complete", "--require-counted-required-info"]) == 0


def test_a_recorded_nonzero_count_contradicting_the_catalog_fails(tmp_path, capsys) -> None:
    """block item 0 件の category が『0 でない件数を数えた』と記録している状態。
    記録とカタログの食い違いは、記録を自分で書けることの裏返しなので落とす。"""
    data = _matrix(counted=True)
    data["matrix"]["database"]["web"]["required_info_checks"][0]["blocking_item_count"] = 2
    m = _write(tmp_path, data)
    assert c12.main(["--matrix", m, "--require-complete", "--require-counted-required-info"]) == 1
    assert "記録とカタログが食い違っている" in capsys.readouterr().err


def test_an_item_id_outside_the_catalog_fails(tmp_path, capsys) -> None:
    """充足件数を自前で増やせる形を塞ぐ。"""
    data = _matrix(counted=True)
    data["matrix"]["auth"]["web"]["required_info"].append(
        {"item_id": "auth-model-extra", "missing_effect": "block", "status": "grounded"}
    )
    m = _write(tmp_path, data)
    assert c12.main(["--matrix", m, "--require-complete", "--require-counted-required-info"]) == 1
    assert "カタログに無い required_info item_id" in capsys.readouterr().err


def test_a_missing_block_item_fails(tmp_path, capsys) -> None:
    data = _matrix(counted=True)
    data["matrix"]["ui-ux"]["web"]["required_info"].pop()
    m = _write(tmp_path, data)
    assert c12.main(["--matrix", m, "--require-complete", "--require-counted-required-info"]) == 1
    assert "充足状態が欠けている" in capsys.readouterr().err


def test_an_unreadable_catalog_is_fail_closed(tmp_path) -> None:
    """**カタログが読めないときに素通りしない。**空を返すと block item 0 件と
    同じ意味になり、検査が黙って全部通る。"""
    findings = c12._validate_confirmed_required_info(
        _matrix(counted=True), CATEGORIES, catalog_path=tmp_path / "does-not-exist.json"
    )
    assert len(findings) == 1
    assert "カタログを参照できない" in findings[0]


def test_the_flag_requires_require_complete(tmp_path, capsys) -> None:
    m = _write(tmp_path, _matrix(counted=True))
    assert c12.main(["--matrix", m, "--require-counted-required-info"]) == 1
    assert "--require-complete と併用する" in capsys.readouterr().err


def test_the_repository_state_passes_the_gate() -> None:
    """このリポジトリの実 state が実際に通ることを見る。合成 fixture だけだと、
    検査が通る形と実物の形がずれていても気づけない。"""
    data = json.loads(REPO_STATE.read_text(encoding="utf-8"))
    assert c12._validate_confirmed_required_info(data, [c["id"] for c in data["categories"]]) == []


# --- qa_refs ---------------------------------------------------------------

def _with_qa_refs(refs: list[str], extra_qa: list[dict] | None = None) -> dict:
    data = _matrix(counted=True)
    data["matrix"]["database"]["web"]["qa_refs"] = refs
    data["qa_log"].extend(extra_qa or [])
    return data


def test_qa_refs_accepts_the_singular_ref_plus_extras(tmp_path) -> None:
    """**単数欄を消さずに足す形が通る。**`qa_ref` を読む側は harness の内外に
    多数在るので、置き換えではなく追加にしてある。"""
    m = _write(tmp_path, _with_qa_refs(["qa-001", "qa-002"], [_qa("qa-002")]))
    assert c12.main(["--matrix", m, "--require-complete"]) == 0


def test_qa_refs_must_lead_with_the_singular_ref(tmp_path, capsys) -> None:
    """先頭が `qa_ref` と一致しないと、単数欄を読む側と複数欄を読む側が
    別の entry を見ることになる。"""
    m = _write(tmp_path, _with_qa_refs(["qa-002", "qa-001"], [_qa("qa-002")]))
    assert c12.main(["--matrix", m, "--require-complete"]) == 1
    assert "qa_refs[0]" in capsys.readouterr().err


def test_qa_refs_rejects_a_dangling_ref(tmp_path, capsys) -> None:
    m = _write(tmp_path, _with_qa_refs(["qa-001", "qa-missing"]))
    assert c12.main(["--matrix", m, "--require-complete"]) == 1
    assert "qa-missing" in capsys.readouterr().err


def test_an_added_ref_gets_the_same_design_application_check(tmp_path, capsys) -> None:
    """**足した ref も同じ検査に掛ける。**掛けないと、裏付けを増やすほど
    検査が緩む形になる (design_applications の無い entry を qa_refs へ足せば
    素通りする、という抜け道ができる)。"""
    bare = {"id": "qa-003", "question": "q", "answer": "a"}
    m = _write(tmp_path, _with_qa_refs(["qa-001", "qa-003"], [bare]))
    assert c12.main(["--matrix", m, "--require-complete"]) == 1
    assert "qa-003" in capsys.readouterr().err
