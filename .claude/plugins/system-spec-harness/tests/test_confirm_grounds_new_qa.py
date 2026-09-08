# /// script
# name: test-confirm-grounds-new-qa
# version: 0.1.0
# purpose: 新しく集めた質疑を再確定セルへ接地できること、接地が付け替えにならないこと、そして手放した値へ黙って戻れないことを固定する pytest。
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
"""**集めたのに、どこからも参照されない質疑が生まれない。**

**何が起きていたか (2026-08-24 実測)**

ブログ構築 UI と SEO/AI 検索の要望で `ui-ux` / `frontend` / `database` × web を
reopen し、質疑を 7 件集めた。ところが 3 セルの確定値は、reopen が手放した
スナップショットと**完全一致**したままだった。集めた 7 件はどのセルの
`qa_ref` / `qa_refs` からも参照されない孤立記録になり、それでもセルは `確定`
と表示され続けた。C07 と C06 が独立に同じ 3 セルを検出した。

**なぜ完走できなかったか**

`qa_refs` を書ける writer は 2 つしか無かった。

- `split-qa-bundle` — `scope_notes.bundled=true` を要求する。束ね解除済みでは拒否。
- `restore-qa-refs` — **退避された値からしか書けない**。しかも「退避値の先頭が
  再確定後の `qa_ref` と同じ」ことを要求する。

新しい質疑で再確定すれば先頭は必ず変わる。つまり **新しい収集を接地させたいとき
にだけ、すべての道が塞がっていた。**門が固いのではなく、道が無かった。

**開けた道と、開けなかった道**

`qa_ref` (単数) は元から呼ぶ側が名乗る。単数で名乗れて複数で名乗れない理由は無い。
止めるべきは名乗ることではなく**付け替え**だけなので、門は 2 つに絞った。

- 先頭は `qa_ref` 自身 (`split-qa-bundle` / `restore-qa-refs` と同じ不変条件)
- 直前に手放した裏付けを 1 件も落とせない。**足すのは自由、減らすのは拒否。**

渡されなかったときに手放した値を引き継ぐ、はやらない。それを既定にすると
「古い裏付けは新しい主張も裏付ける」を機械が勝手に決めることになる。

**向き**: ①でも②でもなく **達成済みの下限の見張り (③)** である。
接地の道が塞がった日、または付け替えの門が緩んだ日に赤くなる。
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

PLUGIN_ROOT = Path(__file__).resolve().parent.parent
ELICIT_SCRIPTS = PLUGIN_ROOT / "skills/run-system-spec-elicit/scripts"
sys.path.insert(0, str(ELICIT_SCRIPTS))
import state_transition_matrix as stm  # noqa: E402
from state_transition_common import TransitionError  # noqa: E402
from state_transition_required_info import blocking_items_for_category  # noqa: E402

PLATFORMS = list(stm.CANONICAL_PLATFORMS)
OLD_A, OLD_B, NEW_ID = "qa-old-a", "qa-old-b", "qa-new"


def _state() -> dict:
    """`qa_refs` を 2 件持つ確定セルを 1 つ。**writer に書かせる。**

    テストが `cell["qa_refs"] = [...]` と直に置くと、接地の門が守るべき不変条件を
    テスト側が勝手に決めることになる。`confirm` に渡して writer へ作らせる。
    """
    state = stm.bootstrap_state()
    state["categories"] = [{"id": "database", "label": "database"}]
    state["matrix"] = {"database": {pf: {"state": "未収集"} for pf in PLATFORMS}}
    state["qa_log"] = [
        {"id": OLD_A, "question": "q1", "answer": "a1"},
        {"id": OLD_B, "question": "q2", "answer": "a2"},
        {"id": NEW_ID, "question": "q3", "answer": "a3"},
    ]
    stm.recompute_aggregates(state)
    _confirm(state, OLD_A, qa_refs=[OLD_A, OLD_B])
    return state


def _confirm(state: dict, qa_ref: str, **over) -> None:
    op = {
        "action": "confirm",
        "category": "database",
        "platform": "web",
        "qa_ref": qa_ref,
        "required_info": [
            {"item_id": item["item_id"], "status": "grounded", "grounded_by": qa_ref}
            for item in blocking_items_for_category(state, "database")
        ],
    }
    op.update(over)
    stm.apply_cell_op(state, op)


def _reopen(state: dict, reason: str = "新しい要望が来た") -> None:
    stm.apply_cell_op(
        state,
        {"action": "reopen", "category": "database", "platform": "web", "reason": reason},
    )


def _cell(state: dict) -> dict:
    return state["matrix"]["database"]["web"]


# ── 道が在ること ──────────────────────────────────────────────────────
def test_a_newly_collected_entry_can_be_grounded_into_a_reconfirmed_cell() -> None:
    """**この検査の本体。**新しい entry を先頭に、古い裏付けを残したまま再確定できる。

    2026-08-24 に通れなかったのは、ちょうどこの形である。
    """
    state = _state()
    _reopen(state)
    _confirm(state, NEW_ID, qa_refs=[NEW_ID, OLD_A, OLD_B])

    assert _cell(state)["qa_ref"] == NEW_ID
    assert _cell(state)["qa_refs"] == [NEW_ID, OLD_A, OLD_B]


def test_the_grounded_entry_is_no_longer_orphaned() -> None:
    """接地の意味は「どこかのセルが引いていること」である。件数ではなく到達で見る。"""
    state = _state()
    _reopen(state)
    _confirm(state, NEW_ID, qa_refs=[NEW_ID, OLD_A, OLD_B])

    cited = set()
    for platforms in state["matrix"].values():
        for cell in platforms.values():
            if cell.get("qa_ref"):
                cited.add(cell["qa_ref"])
            cited.update(cell.get("qa_refs") or [])
    orphans = [entry["id"] for entry in state["qa_log"] if entry["id"] not in cited]
    assert orphans == []


# ── 付け替えの門 ──────────────────────────────────────────────────────
def test_the_head_must_be_the_entry_the_cell_itself_cites() -> None:
    """先頭が `qa_ref` でないと、裏付けの範囲が別の主張のものになる。"""
    state = _state()
    _reopen(state)
    with pytest.raises(TransitionError, match="裏付けを付け替える"):
        _confirm(state, NEW_ID, qa_refs=[OLD_A, NEW_ID, OLD_B])


def test_dropping_previously_preserved_backing_is_refused() -> None:
    """**足すのは自由、減らすのは拒否。**減らす操作は付け替えと区別が付かない。"""
    state = _state()
    _reopen(state)
    with pytest.raises(TransitionError, match="直前に手放した裏付けを黙って落として"):
        _confirm(state, NEW_ID, qa_refs=[NEW_ID, OLD_A])


def test_dangling_refs_are_refused() -> None:
    """指し先の無い裏付けは、裏付けが在るように見えて何も指していない。"""
    state = _state()
    _reopen(state)
    with pytest.raises(TransitionError, match="qa_log へ存在しない id"):
        _confirm(state, NEW_ID, qa_refs=[NEW_ID, OLD_A, OLD_B, "qa-nowhere"])


def test_duplicates_are_refused() -> None:
    """同じ entry を 2 回並べると、裏付けの厚みを水増しできる。"""
    state = _state()
    _reopen(state)
    with pytest.raises(TransitionError, match="重複"):
        _confirm(state, NEW_ID, qa_refs=[NEW_ID, OLD_A, OLD_B, OLD_A])


def test_nothing_is_written_when_nothing_is_declared() -> None:
    """**渡されなければ書かない。**引き継ぎを既定にすると、
    「古い裏付けは新しい主張も裏付ける」を機械が勝手に決めることになる。"""
    state = _state()
    _reopen(state)
    _confirm(state, NEW_ID)
    assert "qa_refs" not in _cell(state)


# ── 黙った逆戻りの門 ──────────────────────────────────────────────────
def test_reverting_to_a_discarded_snapshot_without_saying_so_is_refused() -> None:
    """**2026-08-24 の 3 セルが残していた姿そのもの。**

    reopen の理由は新しい収集を主張しているのに、確定値は手放したものと完全一致。
    読む側にはそれが「新しく確定し直した結果」と見分けられない。
    """
    state = _state()
    _reopen(state)
    with pytest.raises(TransitionError, match="手放したスナップショットと完全一致"):
        _confirm(state, OLD_A, qa_refs=[OLD_A, OLD_B])


def test_declaring_the_reaffirmation_lets_it_through() -> None:
    """**禁止ではない。**中身を変えない再確定には正当な用途が在る
    (章本文だけを現行 `qa_ref` へ揃える R4-reopen が現に何件も在る)。
    止めたいのは「変えないこと」ではなく「変えていないと言わずに変えないこと」である。"""
    state = _state()
    _reopen(state, reason="章本文を現行 qa_ref へ揃えるだけ。収集内容は変えない")
    _confirm(state, OLD_A, qa_refs=[OLD_A, OLD_B], reaffirm=True)
    assert _cell(state)["qa_refs"] == [OLD_A, OLD_B]


def test_a_genuinely_new_confirmation_needs_no_declaration() -> None:
    """**検出側が空振りしていない証拠。**値が動いていれば名乗りは要らない。"""
    state = _state()
    _reopen(state)
    _confirm(state, NEW_ID, qa_refs=[NEW_ID, OLD_A, OLD_B])
    assert _cell(state)["qa_ref"] == NEW_ID


# ── 落とすなら名乗る (drops_backing) ──────────────────────────────────
def test_declaring_the_drop_lets_backing_be_removed() -> None:
    """**減らすこと自体は禁止していない。**禁止しているのは黙って減らすことである。

    裏付けが後から誤りと判った、束ね直しで別 entry に吸収された、といった形で
    範囲が狭まるのは正当に起きる。止めたいのは、その縮小が付け替えと
    見分けられなくなることだけなので、`drops_backing` で名指しさせて通す。
    """
    state = _state()
    _reopen(state, reason="OLD_B の回答に誤りが見つかったので裏付けから外す")
    _confirm(state, NEW_ID, qa_refs=[NEW_ID, OLD_A], drops_backing=[OLD_B])

    assert _cell(state)["qa_refs"] == [NEW_ID, OLD_A]


def test_dropping_and_citing_the_same_entry_is_refused() -> None:
    """落とすと言いながら引いている。**宣言と結果が食い違う。**"""
    state = _state()
    _reopen(state)
    with pytest.raises(TransitionError, match="落とすと言いながら引いている"):
        _confirm(state, NEW_ID, qa_refs=[NEW_ID, OLD_A, OLD_B], drops_backing=[OLD_B])


def test_dropping_something_that_was_never_backing_is_refused() -> None:
    """**空振りの名乗りを許すと、名乗りが儀式になる。**

    直前に裏付けでなかった id を並べれば `drops_backing` は常に非空にできる。
    それを通すと、名指しさせる仕掛けが「何か書いておけば済む」欄に劣化する。
    """
    state = _state()
    _reopen(state)
    with pytest.raises(TransitionError, match="直前に手放していない id"):
        _confirm(state, NEW_ID, qa_refs=[NEW_ID, OLD_A, OLD_B], drops_backing=["qa-nowhere"])
