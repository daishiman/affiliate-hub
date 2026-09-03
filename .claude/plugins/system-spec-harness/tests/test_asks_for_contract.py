# /// script
# name: test-asks-for-contract
# version: 0.1.0
# purpose: 質問が狙った対象を出題時に記録する asks_for 契約を、legacy 除外の id 集合固定・上限・新規 entry の必須化・狙い外確定の検出で固定する pytest。
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
"""`asks_for` (質問が狙った対象) を writer 側で固定する。

**なぜ被覆ではなくこれなのか。**軸4 (トレーサビリティ) の被覆検査が効くのは、
数える元の単位 (確定セル) が名乗りとは独立に matrix 側に在るからである。軸2 (束ね) の
元の単位は「質問文の中の論点」で、名乗りを突き合わせる相手がどこにも無い。論点を
後から数えようとすると、数える人が本文を読んで論点を切り出すことになり、
それは名乗りの言い換えにしかならない。

そこで単位を替える。**狙った対象 (セル / U 欄) なら質問文の外に置ける。**出題時に
`asks_for` として記録しておくと、後から `asks_for` に無いセルが同じ qa を引いて確定した
とき、「狙っていなかった対象を同じ問答で確定させた」が名乗りに頼らず差として出る
(`asks_for_drift`)。

**塞げていない穴は `test_known_blind_spot_*` に書いてある。**この検査は 1 セルだけを
狙った質問の中に複数論点が入っている形を見つけられない。
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

ELICIT_SCRIPTS = (
    Path(__file__).resolve().parent.parent / "skills/run-system-spec-elicit/scripts"
)
sys.path.insert(0, str(ELICIT_SCRIPTS))
import state_transition_matrix as stm  # noqa: E402
from state_transition_common import TransitionError  # noqa: E402

PLATFORMS = list(stm.CANONICAL_PLATFORMS)


def _state() -> dict:
    state = stm.bootstrap_state()
    state["categories"] = [{"id": "database", "label": "データ"}]
    state["matrix"] = {"database": {pf: {"state": "未収集"} for pf in PLATFORMS}}
    stm.recompute_aggregates(state)
    return state


def _turn(qa_id: str, **over) -> dict:
    turn = {"qa_id": qa_id, "question": "DB 方式は?", "answer": "D1。", "ops": [], "source": {"kind": "user-dialogue"}}
    turn.update(over)
    return turn


# ── 条件 1-a: legacy は件数ではなく id の集合で凍結する ────────────────────
def test_legacy_is_frozen_as_ids_that_already_exist():
    state = _state()
    stm.apply_turn(state, _turn("qa-old-1"))
    stm.apply_turn(state, _turn("qa-old-2"))
    stm.enable_asks_for_contract(state, ["qa-old-2", "qa-old-1"])
    # 集合として保持され、順序に依存しない
    assert state["asks_for_contract"]["legacy_ids"] == ["qa-old-1", "qa-old-2"]
    assert state["asks_for_contract"]["version"] == stm.ASKS_FOR_CONTRACT_VERSION


def test_legacy_cannot_name_an_id_that_does_not_exist_yet():
    """**入れ替えの防波堤。**件数だけを縛ると、古い id を外して新しい id を
    入れる入れ替えが通り、除外枠が無期限に生き続ける。有効化の時点で qa_log に
    実在する id しか登録させないことでその道を閉じる。"""
    state = _state()
    stm.apply_turn(state, _turn("qa-old-1"))
    with pytest.raises(TransitionError, match="実在しない") as caught:
        stm.enable_asks_for_contract(state, ["qa-old-1", "qa-future-1"])
    assert "qa-future-1" in str(caught.value)
    assert "asks_for_contract" not in state


def test_contract_cannot_be_re_enabled():
    """再有効化を許すと legacy 集合そのものを差し替えられる。"""
    state = _state()
    stm.apply_turn(state, _turn("qa-old-1"))
    stm.apply_turn(state, _turn("qa-old-2"))
    stm.enable_asks_for_contract(state, ["qa-old-1"])
    with pytest.raises(TransitionError, match="再設定できない"):
        stm.enable_asks_for_contract(state, ["qa-old-2"])
    assert state["asks_for_contract"]["legacy_ids"] == ["qa-old-1"]


# ── 条件 1-b: 上限は下げる方向にしか動かない ───────────────────────────────
def test_legacy_max_is_thirty_and_only_moves_down():
    """2026-08-20 実測: 正本 `system-spec/spec-state.json` の qa_log は 30 entry で、
    `asks_for` を持つものは 0 件 (分母 30 = qa_log entry 数)。遊びは 0 なので、
    上げる方向は除外枠を増やす向きにしかならない。"""
    assert stm.ASKS_FOR_LEGACY_MAX == 30


def test_published_schema_mirrors_the_cap_and_accepts_the_contract():
    """**上限を 2 か所に書いたので、ずれないよう縛る。**

    `spec-state.schema.json` の top-level は `additionalProperties: false` なので、
    schema へ欄を通さない限り、契約を有効化した state は published schema から
    弾かれる。検査だけ足して通り道が無い状態を作らないための対。
    あわせて schema 側 `maxItems` が定数から離れないことを固定する
    (定数を下げて schema を置き去りにすると、schema 側だけ緩いままになる)。
    """
    schema = json.loads(
        (Path(__file__).resolve().parent.parent / "schemas" / "spec-state.schema.json").read_text(
            encoding="utf-8"
        )
    )
    contract = schema["properties"]["asks_for_contract"]
    assert contract["properties"]["legacy_ids"]["maxItems"] == stm.ASKS_FOR_LEGACY_MAX
    assert contract["properties"]["version"]["const"] == stm.ASKS_FOR_CONTRACT_VERSION


def test_legacy_over_the_cap_is_rejected():
    """**陽性対照。**上限が実際に噛むことを、超えた合成入力で示す。"""
    state = _state()
    ids = [f"qa-old-{index}" for index in range(stm.ASKS_FOR_LEGACY_MAX + 1)]
    for qa_id in ids:
        stm.apply_turn(state, _turn(qa_id))
    with pytest.raises(TransitionError, match="件までで"):
        stm.enable_asks_for_contract(state, ids)
    # 対: 上限ちょうどは通る (常に赤い検査ではない)
    stm.enable_asks_for_contract(state, ids[: stm.ASKS_FOR_LEGACY_MAX])
    assert len(state["asks_for_contract"]["legacy_ids"]) == stm.ASKS_FOR_LEGACY_MAX


# ── 条件 1-c: 新規 entry の asks_for 無しは legacy ではなく違反 ─────────────
def test_new_entry_without_asks_for_is_a_violation_not_legacy():
    state = _state()
    stm.apply_turn(state, _turn("qa-old-1"))
    stm.enable_asks_for_contract(state, ["qa-old-1"])
    with pytest.raises(TransitionError, match="asks_for 必須") as caught:
        stm.apply_turn(state, _turn("qa-new-1"))
    assert "qa-new-1" in str(caught.value)
    assert [entry["id"] for entry in state["qa_log"]] == ["qa-old-1"]


def test_new_entry_with_asks_for_passes_and_is_recorded():
    state = _state()
    stm.apply_turn(state, _turn("qa-old-1"))
    stm.enable_asks_for_contract(state, ["qa-old-1"])
    stm.apply_turn(
        state,
        _turn("qa-new-1", asks_for=[{"category": "database", "platform": "web"}]),
    )
    assert state["qa_log"][-1]["asks_for"] == [{"category": "database", "platform": "web"}]


def test_legacy_entry_id_cannot_be_reused_by_a_new_turn():
    """legacy id を名乗る新規 turn が除外を借りる道が無いこと。
    `has_entry` が追記を止めるため、legacy id の entry は当時のまま残る。"""
    state = _state()
    stm.apply_turn(state, _turn("qa-old-1"))
    stm.enable_asks_for_contract(state, ["qa-old-1"])
    stm.apply_turn(state, _turn("qa-old-1", question="別の質問", answer="別の回答"))
    assert len(state["qa_log"]) == 1
    assert state["qa_log"][0]["question"] == "DB 方式は?"
    assert "asks_for" not in state["qa_log"][0]


def test_contract_absent_state_keeps_previous_behavior():
    """契約を有効化していない state では、従来どおり `asks_for` 無しで通る。
    配布先の既存 state を一律に赤くしない (段階的採用の先例:
    `DESIGN_APPLICATION_CONTRACT_VERSION`)。"""
    state = _state()
    stm.apply_turn(state, _turn("qa-old-1"))
    assert "asks_for" not in state["qa_log"][0]


# ── 正規化 ────────────────────────────────────────────────────────────────
@pytest.mark.parametrize(
    "raw,pattern",
    [
        ([], "非空配列必須"),
        ("database/web", "非空配列必須"),
        (["database/web"], "object 必須"),
        ([{"category": "nope", "platform": "web"}], "実在しない"),
        ([{"category": "database", "platform": "ゲーム機"}], "canonical platform 必須"),
        ([{"u": "U0"}], "U1〜U9 必須"),
        (
            [
                {"category": "database", "platform": "web"},
                {"category": "database", "platform": "web"},
            ],
            "重複",
        ),
    ],
)
def test_asks_for_rejects_malformed_targets(raw, pattern):
    state = _state()
    with pytest.raises(TransitionError, match=pattern):
        stm.normalize_asks_for(raw, state, "asks_for")


def test_asks_for_accepts_u_items():
    state = _state()
    assert stm.normalize_asks_for([{"u": "U3"}], state, "asks_for") == [{"u": "U3"}]


# ── 狙い外の確定を差として出す ────────────────────────────────────────────
def test_drift_reports_cells_confirmed_outside_the_declared_targets():
    """**この検査の本体。**1 問で web を狙ったのに mobile も同じ qa を引いて確定した、
    という束ねが、本文を読まずに出る。"""
    state = _state()
    stm.apply_turn(state, _turn("qa-old-1"))
    stm.enable_asks_for_contract(state, ["qa-old-1"])
    stm.apply_turn(
        state,
        _turn("qa-new-1", asks_for=[{"category": "database", "platform": "web"}]),
    )
    state["matrix"]["database"]["web"] = {"state": "確定", "qa_ref": "qa-new-1"}
    state["matrix"]["database"]["mobile"] = {"state": "確定", "qa_ref": "qa-new-1"}
    assert stm.asks_for_drift(state, "qa-new-1") == [("database", "mobile")]
    # 対: 狙いどおりなら空 (常に赤い検査ではない)
    state["matrix"]["database"]["mobile"] = {"state": "未収集"}
    assert stm.asks_for_drift(state, "qa-new-1") == []


def test_drift_on_an_entry_without_asks_for_is_undecidable_not_zero():
    """**判定不能と 0 件を型で分ける。**

    もとはこの検査が「両方 `[]` になる」という危険を*記録*していた。記録は危険が
    在ることを残すだけで、呼び出し側が `[]` を「調べたが無かった」と読む道は
    開いたままだった。legacy entry は 30 件あるので、その誤読は「束ねは無い」という
    結論を静かに作る。呼び出し側がまだ 1 つも無いうちに分けてある。

    `None` = 判定不能 / `[]` = 狙いどおりで 0 件。
    """
    state = _state()
    stm.apply_turn(state, _turn("qa-old-1"))
    state["matrix"]["database"]["web"] = {"state": "確定", "qa_ref": "qa-old-1"}
    assert "asks_for" not in state["qa_log"][0]
    assert stm.asks_for_drift(state, "qa-old-1") is None
    # 存在しない qa_id も判定不能側 (「無い entry に束ねは無い」とは言えない)
    assert stm.asks_for_drift(state, "qa-nonexistent") is None


def test_known_unclosable_hole_deleting_the_key_re_opens_enablement():
    """**この門の内側では塞げない穴を、検査として置く。**

    `enable_asks_for_contract` の再設定拒否は `state["asks_for_contract"]` が在ることに
    依存している。JSON からそのキーを削れば、もう一度有効化でき、legacy 集合を
    別の id へ差し替えられる。

    **塞げない理由**: 塞ぐには state 全体の完全性を保証する鍵 (署名や封印) が要り、
    その鍵はこの作業場所には置けない。読める場所に鍵を置けば、鍵ごと書き換えられる
    ので守りにならないからである。難しいのではなく、**ここには置けない**。
    state の手編集を禁じているのは約束であって検査ではない、という事実がここに残る。

    **反転先**: state の完全性を別の鍵で守れるようになった日。そのときこの検査は
    赤くなり、「もう通らない」と知らせる。**`enable_asks_for_contract` の中に
    別のフラグを足す方向では塞がらない。**同じ JSON の中にある印は、同じ手で消せる。
    """
    state = _state()
    stm.apply_turn(state, _turn("qa-old-1"))
    stm.apply_turn(state, _turn("qa-old-2", asks_for=[{"u": "U1"}]))
    stm.enable_asks_for_contract(state, ["qa-old-1"])
    del state["asks_for_contract"]  # JSON を手で編集した場合と同じ状態
    stm.enable_asks_for_contract(state, ["qa-old-1", "qa-old-2"])
    assert state["asks_for_contract"]["legacy_ids"] == ["qa-old-1", "qa-old-2"]


# ── 塞げていない穴 (案 2) ─────────────────────────────────────────────────
KNOWN_BLIND_SPOT_KIND = "1 セルしか狙っていない質問の中の束ね"


def test_known_blind_spot_single_target_question_can_still_bundle():
    """**塞げていない穴を、種類として書く。**

    種類: 「1 セルしか狙っていない質問の中の束ね」。`asks_for` が 1 件なら
    `asks_for_drift` は必ず空になる。質問文が「方式と保持期間と移行手順は?」と
    3 論点を束ねていても、狙った**対象**は 1 セルなので差が出ない。
    (2026-08-20 実測: 注記済み 8 entry のうち 6 件がこの形。**実例は種類の実例として
    置くだけで、実例を足す形では運用しない。**個別の実例を数え上げても、種類が
    塞がったかどうかは分からない。)

    **反転先**: 論点が名乗りとは独立に在る registry を得た日。そのとき本検査は
    「1 セル狙いの entry も論点 registry と突き合わされていること」へ反転させる。
    **`asks_for` の語彙を増やす方向では反転させない。**論点名を `asks_for` に足すと、
    名乗る側と数える側が同じ人になり、軸4 の被覆が効いていた理由 (元の単位が
    別の場所に在る) を失う。目録を伸ばして外側を閉じたつもりになる形そのものである。
    """
    state = _state()
    stm.apply_turn(state, _turn("qa-old-1"))
    stm.enable_asks_for_contract(state, ["qa-old-1"])
    stm.apply_turn(
        state,
        _turn(
            "qa-bundled",
            question="DB の方式と保持期間と移行手順は?",
            asks_for=[{"category": "database", "platform": "web"}],
        ),
    )
    state["matrix"]["database"]["web"] = {"state": "確定", "qa_ref": "qa-bundled"}
    # 3 論点を束ねているのに、狙いが 1 セルなので差は出ない
    assert stm.asks_for_drift(state, "qa-bundled") == []
    assert KNOWN_BLIND_SPOT_KIND
