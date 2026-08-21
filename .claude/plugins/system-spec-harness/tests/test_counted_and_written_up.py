# /// script
# name: test-counted-and-written-up
# version: 0.1.0
# purpose: 「数えて 0 件」と「一度も数えていない」を分ける required_info_checks、対話 source を書き換えずに書き起こしを足す written_up、および writer が書く欄が schema に名前として通っているかを一般形で見る検査を固定する pytest。
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
"""欠けている記録の由来を分け、書き換えではなく追記で事実を足す。

**この 3 つは同じ 1 つの誤りの別の面である。**

1. `required_info` が無い確定セルには由来が 2 つある — 数えたら block item が 0 件だった /
   一度も数えていない。writer は「0 件の category に required_info を書く」ことを拒む
   (正しい拒否である。緩めると『0 件なのに記録が在る』を作れる) ので、数えた事実は
   別の欄に持つほかない。`asks_for_drift` で `None` と `[]` を分けたのと同じ形が、
   欄の有無として再発している。
2. 対話で聞いた問答を後から文書へ書き起こしたとき、`source.kind` を `written-requirements`
   へ書き換えると「聞いていないことを書いてあったことにする」偽造になる。起きたことは
   2 件 (聞いた / 書き起こした) なので 2 件とも残す。
3. 1 と 2 の欄はどちらも schema に名前が無いまま書けてしまう。qa entry も matrix cell も
   `additionalProperties` が開いており、**検証は素通りする**。「schema を通した」を
   検証の通過で確かめられないので、名前の宣言で見る。
"""
from __future__ import annotations

import argparse
import ast
import datetime
import inspect
import json
import sys
from pathlib import Path

import jsonschema
import pytest

PLUGIN_ROOT = Path(__file__).resolve().parent.parent
ELICIT_SCRIPTS = PLUGIN_ROOT / "skills/run-system-spec-elicit/scripts"
SCHEMA_PATH = PLUGIN_ROOT / "schemas" / "spec-state.schema.json"
sys.path.insert(0, str(ELICIT_SCRIPTS))
import state_transition_matrix as stm  # noqa: E402
from state_transition_common import TransitionError  # noqa: E402
from state_transition_required_info import blocking_items_for_category  # noqa: E402

PLATFORMS = list(stm.CANONICAL_PLATFORMS)
SCHEMA = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
CELL_SCHEMA = {"$ref": "#/$defs/matrixCell", "$defs": SCHEMA["$defs"]}
ENTRY_SCHEMA = {"$ref": "#/$defs/qaEntry", "$defs": SCHEMA["$defs"]}


def _state(categories=("database", "auth")) -> dict:
    state = stm.bootstrap_state()
    state["categories"] = [{"id": cid, "label": cid} for cid in categories]
    state["matrix"] = {cid: {pf: {"state": "未収集"} for pf in PLATFORMS} for cid in categories}
    stm.recompute_aggregates(state)
    return state


def _confirmed(state: dict, category: str, qa_ref: str = "qa-x", **over) -> dict:
    """block ゲートを通して 1 セルを確定させ、そのセルを返す。"""
    state["qa_log"].append({"id": qa_ref, "question": "q", "answer": "a"})
    op = {
        "action": "confirm",
        "category": category,
        "platform": "web",
        "qa_ref": qa_ref,
        "required_info": [
            {"item_id": item["item_id"], "status": "grounded", "grounded_by": qa_ref}
            for item in blocking_items_for_category(state, category)
        ],
    }
    op.update(over)
    stm.apply_cell_op(state, op)
    return state["matrix"][category]["web"]


def _check(state: dict, category: str) -> None:
    stm.apply_cell_op(
        state,
        {"action": "record-required-info-check", "category": category, "platform": "web"},
    )


# ── 1. 数えた事実の記録 ────────────────────────────────────────────────
def test_a_zero_count_is_recorded_instead_of_leaving_nothing() -> None:
    """**この検査の本体。**block item が 0 件の category は `required_info` を持てない。
    記録が何も無いと「数えて 0 件」と「一度も数えていない」が同じ姿になる。"""
    state = _state()
    cell = _confirmed(state, "database")
    assert blocking_items_for_category(state, "database") == [], "前提: database に block item は無い"
    assert "required_info" not in cell
    assert "required_info_checks" not in cell, "数える前は欄が無い = 一度も数えていない"

    _check(state, "database")

    assert cell["required_info_checks"] == [
        {
            "checked_on": datetime.date.today().isoformat(),
            "checked_with": "record-required-info-check",
            "blocking_item_count": 0,
        }
    ]
    jsonschema.validate(cell, CELL_SCHEMA)


def test_the_two_states_are_machine_distinguishable() -> None:
    """欄が無い / 欄が在って 0。読む側が `if not cell.get("required_info")` で
    潰していた 2 つが、別の鍵の有無として分かれる。"""
    state = _state()
    never = _confirmed(state, "database", "qa-never")
    state["matrix"]["auth"]["web"] = {"state": "未収集"}
    counted = _confirmed(state, "auth", "qa-counted")
    _check(state, "auth")

    assert "required_info_checks" not in never
    assert never.get("blocking_item_count") is None
    assert counted["required_info_checks"][0]["blocking_item_count"] == len(
        blocking_items_for_category(state, "auth")
    )
    # 「数えた」ことは、件数が 0 かどうかとは独立に判る
    assert ("required_info_checks" in never) is False
    assert ("required_info_checks" in counted) is True


def test_the_count_is_not_an_argument() -> None:
    """件数を引数で受けると、渡す側が何件だったと名乗るかを選べる
    (legacy_ids を引数から外したのと同じ理由)。op に件数を混ぜても無視されず、
    **writer が自分で数えた値が入る**ことを固定する。"""
    state = _state()
    _confirmed(state, "auth")
    stm.apply_cell_op(
        state,
        {
            "action": "record-required-info-check",
            "category": "auth",
            "platform": "web",
            "blocking_item_count": 999,
            "checked_on": "1999-01-01",
        },
    )
    record = state["matrix"]["auth"]["web"]["required_info_checks"][0]
    assert record["blocking_item_count"] == len(blocking_items_for_category(state, "auth"))
    assert record["blocking_item_count"] != 999
    assert record["checked_on"] == datetime.date.today().isoformat()


def test_the_field_is_never_created_empty() -> None:
    """空配列は「数えて 0 件」と読める姿になり、分けようとしている 2 つをまた潰す。
    writer は空配列を作らず、schema も minItems 1 で受け付けない。"""
    state = _state()
    cell = _confirmed(state, "database")
    _check(state, "database")
    assert len(cell["required_info_checks"]) >= 1
    cell["required_info_checks"] = []
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate(cell, CELL_SCHEMA)


def test_recording_is_append_only_and_refuses_a_same_day_duplicate() -> None:
    state = _state()
    cell = _confirmed(state, "database")
    _check(state, "database")
    with pytest.raises(TransitionError, match="同じ日に同じ件数"):
        _check(state, "database")
    assert len(cell["required_info_checks"]) == 1
    # 件数が変われば同じ日でも追記される (カタログが変わった日を潰さない)
    cell["required_info_checks"][0]["blocking_item_count"] = 7
    _check(state, "database")
    assert [record["blocking_item_count"] for record in cell["required_info_checks"]] == [7, 0]


def test_only_confirmed_cells_can_carry_the_record() -> None:
    state = _state()
    with pytest.raises(TransitionError, match="確定セルのみ数えた事実"):
        _check(state, "database")


def test_reopen_does_not_silently_drop_the_count() -> None:
    """reopen で「数えた事実」が黙って消えると、再確定したセルが
    『一度も数えていない』姿へ戻る。"""
    state = _state()
    _confirmed(state, "database")
    _check(state, "database")
    stm.apply_cell_op(
        state,
        {"action": "reopen", "category": "database", "platform": "web", "reason": "やり直し"},
    )
    discarded = state["reopen_log"][-1]["discarded"]
    assert "required_info_checks" in discarded
    assert discarded["required_info_checks"][0]["blocking_item_count"] == 0


def test_the_existing_refusal_is_not_loosened() -> None:
    """**回帰の見張り。**新しい欄を足した代わりに `set-required-info` の拒否を
    緩めると、「block item が 0 件なのに required_info が載っている」を作れる。
    緩んだ日にここが赤くなる。"""
    state = _state()
    _confirmed(state, "database")
    _check(state, "database")
    with pytest.raises(TransitionError, match="記録すべき missing_effect=block item が無い"):
        stm.apply_cell_op(
            state,
            {
                "action": "set-required-info",
                "category": "database",
                "platform": "web",
                "required_info": [],
            },
        )


def test_known_hole_the_recorded_count_is_not_verifiable() -> None:
    """**塞げていないところ。**記録された件数が、そのとき本当に数えた結果かは
    機械層で確かめられない。確かめているのは「記録が在ること」だけである。
    writer の外でこの JSON を書けば、数えていない件数が載り、schema も通る。

    塞ぐには「その時点のカタログと state から件数が再現できること」を後から
    確かめる鍵が要り、それは記録と同じ JSON の中には置けない (同じ手で書ける)。
    難しいのではなく、**ここには置けない**。

    反転条件: state の完全性を外から保証する鍵ができた日に、この検査を
    「記録された件数と再計算した件数が一致すること」へ反転させる。消さないこと —
    消すと、writer の外で書かれた記録が後から混ざっても誰も気づかない状態へ帰る。
    """
    state = _state()
    cell = _confirmed(state, "database")
    # writer を通さずに手で置いた記録
    cell["required_info_checks"] = [
        {
            "checked_on": "2026-08-20",
            "checked_with": "record-required-info-check",
            "blocking_item_count": 42,
        }
    ]
    jsonschema.validate(cell, CELL_SCHEMA)  # 通ってしまう
    assert cell["required_info_checks"][0]["blocking_item_count"] != len(
        blocking_items_for_category(state, "database")
    )


# ── 2. 書き起こしは追記で足す (source は書き換えない) ──────────────────
def _dialogue_state(tmp_path: Path) -> dict:
    state = _state()
    state["qa_log"].append(
        {
            "id": "qa-auth-web",
            "question": "認証方式は?",
            "answer": "Better Auth。",
            "source": {"kind": "user-dialogue"},
        }
    )
    return state


def test_written_up_is_added_without_touching_source(tmp_path: Path) -> None:
    """**対話で聞いた事実と、それを書き起こした事実は別の 2 件である。**
    `source.kind` を書き換えると「聞いていないことを書いてあった」ことにできる。"""
    state = _dialogue_state(tmp_path)
    doc = tmp_path / "auth.md"
    doc.write_text("## 認証\nBetter Auth を採用する。\n", encoding="utf-8")

    stm.set_qa_written_up(state, "qa-auth-web", str(doc), section="## 認証")

    entry = state["qa_log"][-1]
    assert entry["source"] == {"kind": "user-dialogue"}, "source は永久に対話のまま"
    assert entry["written_up"][0]["path"] == str(doc)
    assert entry["written_up"][0]["section"] == "## 認証"
    assert entry["written_up"][0]["recorded_with"] == "set-qa-written-up"
    assert entry["written_up"][0]["recorded_on"] == datetime.date.today().isoformat()
    jsonschema.validate(entry, ENTRY_SCHEMA)


def test_the_fingerprint_is_read_from_the_file_not_taken_from_the_caller(tmp_path: Path) -> None:
    """sha256 を受け取ると、書き起こしていない内容の指紋を名乗れる。
    引数にその口が無いことを、実装の signature と CLI の両方で固定する。"""
    import hashlib

    state = _dialogue_state(tmp_path)
    doc = tmp_path / "auth.md"
    doc.write_bytes(b"# auth\n")
    stm.set_qa_written_up(state, "qa-auth-web", str(doc))
    assert state["qa_log"][-1]["written_up"][0]["sha256"] == hashlib.sha256(b"# auth\n").hexdigest()

    params = set(inspect.signature(stm.set_qa_written_up).parameters)
    assert "sha256" not in params and "recorded_on" not in params, params

    parser = _cli_parser()
    written_up = _subparser(parser, "set-qa-written-up")
    options = {option for action in written_up._actions for option in action.option_strings}
    assert "--sha256" not in options and "--recorded-on" not in options, options


def test_a_write_up_target_that_does_not_exist_is_refused(tmp_path: Path) -> None:
    state = _dialogue_state(tmp_path)
    with pytest.raises(TransitionError, match="実在しない"):
        stm.set_qa_written_up(state, "qa-auth-web", str(tmp_path / "missing.md"))
    assert "written_up" not in state["qa_log"][-1]


def test_the_same_fingerprint_twice_is_refused_but_a_changed_document_appends(
    tmp_path: Path,
) -> None:
    state = _dialogue_state(tmp_path)
    doc = tmp_path / "auth.md"
    doc.write_text("v1\n", encoding="utf-8")
    stm.set_qa_written_up(state, "qa-auth-web", str(doc))
    with pytest.raises(TransitionError, match="既に在る"):
        stm.set_qa_written_up(state, "qa-auth-web", str(doc))
    doc.write_text("v2\n", encoding="utf-8")
    stm.set_qa_written_up(state, "qa-auth-web", str(doc))
    written = state["qa_log"][-1]["written_up"]
    assert len(written) == 2
    assert written[0]["sha256"] != written[1]["sha256"]


def test_no_writer_op_can_rewrite_source() -> None:
    """**gap 2 と同じ構造の見分け。**`source` を書き換える op が後から生えたら
    ここが赤くなる。書き込み箇所は entry 生成の 1 箇所だけで、後付け annotation は
    どれも新しい欄を足すだけである。"""
    sites = []
    for path in sorted(ELICIT_SCRIPTS.glob("state_transition_*.py")):
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for function in ast.walk(tree):
            if not isinstance(function, (ast.FunctionDef, ast.AsyncFunctionDef)):
                continue
            for node in ast.walk(function):
                if not isinstance(node, ast.Assign):
                    continue
                for target in node.targets:
                    # `entry["source"] = ...` だけでなく `entry["source"]["kind"] = ...`
                    # も拾う。左辺の subscript 連鎖のどこかに "source" が在れば書き換えである。
                    cursor = target
                    while isinstance(cursor, ast.Subscript):
                        if (
                            isinstance(cursor.slice, ast.Constant)
                            and cursor.slice.value == "source"
                        ):
                            sites.append((path.name, function.name))
                            break
                        cursor = cursor.value
    assert sites == [("state_transition_matrix.py", "apply_turn")], sites


def test_known_hole_the_write_up_is_not_checked_for_content(tmp_path: Path) -> None:
    """**塞げていないところ。**指紋は「その時点でそのファイルがそう在った」ことしか
    示さない。その節に本当にこの問答の内容が書かれているかは機械層で確かめられない。
    無関係な文書でも記録は通る。

    反転条件: 節と問答の対応を独立に持てる仕組み (節 id と qa_id の対応表が
    文書側に生成される等) ができた日に、「記録された節が当該 qa を引いていること」
    の検査へ反転させる。
    """
    state = _dialogue_state(tmp_path)
    unrelated = tmp_path / "unrelated.md"
    unrelated.write_text("# 天気\n晴れ。\n", encoding="utf-8")
    stm.set_qa_written_up(state, "qa-auth-web", str(unrelated), section="# 天気")
    jsonschema.validate(state["qa_log"][-1], ENTRY_SCHEMA)  # 通ってしまう


# ── 3. 一般形: writer が書く欄が schema に名前として通っているか ────────
def _cli_parser() -> argparse.ArgumentParser:
    """CLI の parser を、main を実行せずに組み立て直す。"""
    import importlib.util

    spec = importlib.util.spec_from_file_location(
        "_apply_spec_transition_for_test", ELICIT_SCRIPTS / "apply-spec-transition.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    # main() は parser を組み立ててから parse_args する。組み立て直しを避けるため、
    # parse_args の瞬間に parser 自身を掴んで抜ける。
    captured = {}
    original = argparse.ArgumentParser.parse_args

    def _capture(self, argv=None, namespace=None):  # noqa: ANN001
        captured["parser"] = self
        raise SystemExit(0)

    argparse.ArgumentParser.parse_args = _capture
    try:
        module.main([])
    except SystemExit:
        pass
    finally:
        argparse.ArgumentParser.parse_args = original
    return captured["parser"]


def _subparser(parser: argparse.ArgumentParser, name: str) -> argparse.ArgumentParser:
    for action in parser._actions:
        if isinstance(action, argparse._SubParsersAction) and name in action.choices:
            return action.choices[name]
    raise AssertionError(f"subcommand が無い: {name}")


def _writer_field_names() -> set[str]:
    names: set[str] = set()
    for path in sorted(ELICIT_SCRIPTS.glob("state_transition_*.py")):
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if not isinstance(node, ast.Assign):
                continue
            for target in node.targets:
                if (
                    isinstance(target, ast.Subscript)
                    and isinstance(target.slice, ast.Constant)
                    and isinstance(target.slice.value, str)
                ):
                    names.add(target.slice.value)
    return names


def _declared_names() -> set[str]:
    declared: set[str] = set()

    def walk(node: object) -> None:
        if isinstance(node, dict):
            for key, value in node.items():
                if key == "properties" and isinstance(value, dict):
                    declared.update(value)
                walk(value)
        elif isinstance(node, list):
            for value in node:
                walk(value)

    walk(SCHEMA)
    return declared


# 2026-08-20 実測 (分母 = 上の AST 走査が見つけた欄名 37 件) は 10 だった。
# 2026-08-21 に **9** へ下げる。分母は 47 件へ増えている
# (`python3` / 単位は欄名 / 対象は writer が literal で書く欄名 / 基点は上の 2026-08-20)。
# 減ったのは `scope_notes.topics[]` に items schema を足して `answer_span` と
# `released_section_heading` が名前を持ったため。**分母が増えて未宣言が減った**ので、
# 数えている対象を消して満たしたのではない。
# 以後この上限は**下げる方向にしか動かさない**。
UNDECLARED_FIELD_MAX = 9
# 上限だけでは抜けられる — 数えている対象 (writer が書く欄) を消せば上限は満たせる。
# 逆向きの下限を対で置く。以後この下限は**上げる方向にしか動かさない**。
# 2026-08-21 実測 **54**（`python3` / 単位は欄名 / 対象は writer が literal で書く欄名 /
# 分母は AST 走査が見つけた全欄名 / 基点は 2026-08-20 の 37）。37 のままだと 17 欄を
# 消しても床に当たらず、上限 9 を「数える対象を消して」満たす道が開いたままになる。
WRITER_FIELD_MIN = 54


def test_new_writer_fields_go_through_the_schema_by_name() -> None:
    """**今回足した 2 欄が schema に名前として在る。**gap 7 と今回で
    `additionalProperties: false` に 2 回続けて当たったので、3 回目が来る前に検査にする。"""
    declared = _declared_names()
    for field in ("required_info_checks", "written_up"):
        assert field in declared, f"{field} が schema に宣言されていない"
        assert field in _writer_field_names(), f"{field} を writer が書いていない"


def test_undeclared_writer_fields_stay_under_the_cap() -> None:
    """writer が名前を付けて書く欄のうち、公開 schema のどこにも名前が無いもの。

    **検証の通過では確かめられない。**qa entry も matrix cell も
    `additionalProperties` が開いており、宣言されていない欄を足しても
    `jsonschema.validate` は通る。だから名前の照合で見る。
    """
    written = _writer_field_names()
    undeclared = sorted(written - _declared_names())
    assert len(written) >= WRITER_FIELD_MIN, (
        f"writer が書く欄が {len(written)} 件へ減っている (下限 {WRITER_FIELD_MIN})。"
        "上限を満たすために数えている対象を消していないか"
    )
    assert len(undeclared) <= UNDECLARED_FIELD_MAX, (
        f"schema に名前の無い writer 欄が {len(undeclared)} 件: {undeclared} "
        f"(上限 {UNDECLARED_FIELD_MAX})"
    )


def test_the_general_check_can_actually_see_a_new_undeclared_field() -> None:
    """**0 件ではなく上限を主張する側の陽性対照。**照合そのものが動いていることを、
    見つかるはずの合成例で示す。これが無いと、走査が壊れて 0 件を返しても同じ緑になる。"""
    declared = _declared_names()
    synthetic = {"totally_undeclared_field"} | _writer_field_names()
    assert "totally_undeclared_field" in (synthetic - declared)
    # 合成した 1 件ぶんだけ増えることまで見る (走査が全部を未宣言と言う壊れ方も落とす)
    assert len(synthetic - declared) == len(_writer_field_names() - declared) + 1


def test_known_limits_of_the_general_check() -> None:
    """**この一般形が見ていないもの。**種類として記録しておく。

    1. 見ているのは**名前の宣言まで**で、姿の検査ではない。`{"type": "object"}` と
       だけ宣言すれば上限は満たせる。
    2. AST が拾うのは `x["名前"] = ...` の形だけである。変数をキーにした代入や
       `dict.update()` は見えない。
    3. 名前は schema の**どこかに**在ればよい。qa entry の欄が matrix cell 側に
       宣言されていても通る (場所の一致までは見ていない)。

    反転条件: matrix cell と qa entry の `additionalProperties` を閉じられた日に、
    この検査を「宣言されていない欄が schema 検証で弾かれること」へ格上げする。
    それまでは、名前が増えたことだけが見える。
    """
    kinds = {
        "名前だけの宣言": "姿を縛らない宣言でも上限を満たせる",
        "変数キーの代入": "AST が拾うのは定数キーの subscript 代入だけ",
        "場所の不一致": "schema のどこかに同名が在れば宣言済みとみなす",
    }
    assert len(kinds) == 3
    # 3 は実際に起きうる: 同名の欄が別の場所に在る例が現に schema 内に在る
    assert "reason" in SCHEMA["$defs"]["matrixCell"]["properties"]
