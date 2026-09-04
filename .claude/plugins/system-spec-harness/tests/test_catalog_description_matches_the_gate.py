# /// script
# name: test-catalog-description-matches-the-gate
# version: 0.1.0
# purpose: required-info-catalog.json の description が名乗る門の振る舞いを、実際に confirm 経路 (normalize_required_info) を走らせて確かめる pytest。説明文と実装が離れていくのを止める。
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
"""カタログの説明文が名乗る門を、実際に走らせて確かめる。

── なぜこの検査が要るか ────────────────────────────────────

2026-08-30 まで、このカタログの `description` は末尾にこう書いていた——

    item別回答の決定論的な writer 接地検査は **future gate** として別管理する

**事実に遅れた記述だった。**接地検査は稼働していた。`apply-spec-transition` の
`confirm` op は `normalize_required_info(allow_ungrounded=False)` を通り、
block item が未接地なら確定を拒み、`grounded_by` が `qa_log` に無ければ拒む。

説明文が実装より弱く名乗ると、読んだ人は**在る門を無いものとして扱う**。
ah-3rt はこのずれから起票され、独立監査 (2026-08-23) も別の側から同じ場所に
到達した——「catalog の description は『future gate』と書いているが、実データでは
既に接地機構が稼働中」。**2 つの経路が同じ 1 行に着いたということは、
この 1 行が実際に人を誤らせていた**という意味である。

── 文言だけを見張らない ────────────────────────────────────

「`future gate` と書いてないこと」だけを検査にすると、**言い換えれば通る。**
なので説明文が名乗る振る舞いを 1 つずつ実行する。説明文を弱めるには、
まず実装を弱めなければならなくなる。

逆向きにも効く: 門を外したら**この検査が落ちる**ので、説明文だけが
「稼働中」と言い続ける状態にもならない。
"""
from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

import pytest

HARNESS = Path(__file__).resolve().parent.parent
ELICIT = HARNESS / "skills" / "run-system-spec-elicit"
CATALOG = ELICIT / "references" / "required-info-catalog.json"


def _load(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


# `state_transition_matrix` が兄弟 module を素の名前で import するため、
# scripts/ を検索路へ入れてから読む。
sys.path.insert(0, str(ELICIT / "scripts"))
ri = _load(
    "state_transition_required_info",
    ELICIT / "scripts" / "state_transition_required_info.py",
)

DESCRIPTION = json.loads(CATALOG.read_text())["description"]

# `ui-ux` の block item は 3 つ。**カタログから引かずに書いてある**のは、
# 下の検査が「カタログが言うとおり」ではなく「実際にこの 3 つ」を要求することを
# 示すためである (カタログから引くと、カタログが空になっても検査は通る)。
UIUX_BLOCK = {"product-goal", "screen-information-priority", "target-platforms"}


def _state(qa_ids: tuple[str, ...] = ("qa-x",)) -> dict:
    # 実装が見る鍵は `id` (`qa_id` ではない。`state_transition_common.has_entry`)。
    # 最初 `qa_id` で書いたら**全ての grounded が拒まれ**、
    # 「実在確認が効いている」検査だけが通って他が落ちた——
    # 拒否側の検査は、拒否の理由が違っていても緑になる。
    return {"qa_log": [{"id": q} for q in qa_ids]}


def _entry(item_id: str, status: str) -> dict:
    entry = {"item_id": item_id, "status": status}
    if status == "grounded":
        entry["grounded_by"] = "qa-x"
    else:
        entry["reason"] = "理由"
    return entry


def _uiux(**status_by_item: str) -> list[dict]:
    """`ui-ux` の block item **3 件を必ず全部**渡す。

    実装は部分渡しを `block item の充足状態が欠けている` で拒む
    (2026-08-30 実測。1 件だけ渡すと落ちた)。**その拒否も門の一部**で、
    「触れなかった item は黙って満たされたことにする」を塞いでいる。
    ここで全件渡すのは門を避けるためではなく、**見たい門を 1 つに絞る**ためである。
    """
    named = {k.replace("_", "-"): v for k, v in status_by_item.items()}
    unknown = set(named) - UIUX_BLOCK
    assert not unknown, f"ui-ux の block item ではない: {sorted(unknown)}"
    return [_entry(i, named.get(i, "grounded")) for i in sorted(UIUX_BLOCK)]


def test_the_description_no_longer_calls_the_gate_a_future_one() -> None:
    """逆戻りへの当て。**これ 1 つでは足りない**ので、以下で振る舞いを実行する。"""
    assert "future gate" not in DESCRIPTION
    # 直した事実そのものも残す。ここが消えたら、直した経緯ごと消えている。
    assert "稼働中" in DESCRIPTION


def test_a_block_item_left_ungrounded_cannot_be_confirmed() -> None:
    """description の「status=ungrounded では確定を拒み」を実行する。"""
    with pytest.raises(ri.TransitionError) as err:
        ri.normalize_required_info(
            _state(),
            "ui-ux",
            _uiux(product_goal="ungrounded"),
            allow_ungrounded=False,
            catalog_path=CATALOG,
        )
    assert "未接地のまま確定できない" in str(err.value)


def test_the_same_entry_is_accepted_when_ungrounded_is_allowed() -> None:
    """陽性対照。上の拒否が `allow_ungrounded` に由来することを示す。

    これが無いと、上の検査は「何を入れても落ちる」でも通ってしまう。
    """
    out = ri.normalize_required_info(
        _state(),
        "ui-ux",
        _uiux(product_goal="ungrounded"),
        allow_ungrounded=True,
        catalog_path=CATALOG,
    )
    assert {e["item_id"] for e in out} == UIUX_BLOCK
    ungrounded = [e["item_id"] for e in out if e["status"] == "ungrounded"]
    assert ungrounded == ["product-goal"]


def test_grounded_by_must_name_an_entry_that_exists_in_the_qa_log() -> None:
    """description の「grounded_by は qa_log に実在する id でなければ拒む」を実行する。"""
    with pytest.raises(ri.TransitionError) as err:
        ri.normalize_required_info(
            _state(qa_ids=("qa-other",)),
            "ui-ux",
            _uiux(),
            allow_ungrounded=False,
            catalog_path=CATALOG,
        )
    assert "qa_log に存在しない grounded_by" in str(err.value)


def test_the_caller_cannot_rename_block_to_warn() -> None:
    """description の「missing_effect は呼び出し側から受け取らない」を実行する。

    呼び出し側が `warn` と名乗って渡しても、出てくる値はカタログの `block` である。
    ここが通ってしまうと、**ゲートは呼ぶ側の申告で外せる**ことになる。
    """
    entries = [e | {"missing_effect": "warn"} for e in _uiux()]
    out = ri.normalize_required_info(
        _state(), "ui-ux", entries, allow_ungrounded=False, catalog_path=CATALOG
    )
    assert {e["missing_effect"] for e in out} == {"block"}


def test_an_item_outside_the_categorys_block_set_is_refused() -> None:
    """block item の集合が category ごとに閉じていること。

    `ui-ux` に `auth-model` を書けると、**別の category の門を
    こちらで満たしたことにできる。**
    """
    with pytest.raises(ri.TransitionError) as err:
        ri.normalize_required_info(
            _state(),
            "ui-ux",
            [_entry("auth-model", "grounded")],
            allow_ungrounded=False,
            catalog_path=CATALOG,
        )
    assert "missing_effect=block item ではない" in str(err.value)


def test_the_block_set_for_ui_ux_is_exactly_the_three_items() -> None:
    """母数。上の検査群が「たまたま 1 件を見ていた」で終わらないようにする。"""
    got = {
        item["item_id"]
        for item in ri.blocking_items_for_category(_state(), "ui-ux", CATALOG)
    }
    assert got == UIUX_BLOCK
