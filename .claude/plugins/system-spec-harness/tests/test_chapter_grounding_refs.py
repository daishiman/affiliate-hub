# /// script
# name: test-chapter-grounding-refs
# version: 0.1.0
# purpose: 章が確定セルの裏付け範囲 (qa_refs / required_info[].grounded_by) を描き、正本から導けない質疑録小節を compile が消さずに引き継ぐことを固定する pytest。
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
"""章から質疑録が消えないこと。

**何が起きていたか (2026-08-25 実測)**

章を組む側は確定セルの `qa_ref` (1 件) しか読んでいなかった。裏付けは `qa_refs` と
`required_info[].grounded_by` に範囲として積み上がるのに、そこは見ていない。

結果、確定セルへ新しい問答を足す (`extend-qa-refs`) と、それまで `qa_ref` だった
問答は章から**消える側**へ回った。8 章を組み直したところ質疑録の本文が 369 行消えた
(backend 88 / ui-ux 75 / frontend 74 …)。

消し方が静かだったのが厄介である。`--on-handwritten` は `## 節` 単位でしか手書きを
見ておらず、質疑録は `## 確定内容 (質疑録)` という**生成される**節の内側に
`### <ref> (対応セル: …)` として並ぶ。節そのものは生成物にも在るので検出は空振りし、
`refuse` は「守った」顔のまま通り、`preserve` は小節ごと本文を落とした。
**緑が損失を隠していた。**

塞ぎ方は 2 つを組で入れた。

| 口 | 直し方 |
| --- | --- |
| 正本に在る裏付けが章に出ない | 章が `qa_refs` と `required_info[].grounded_by` も読む |
| 正本から導けない質疑録が消える | 手書き検出を質疑録の `###` 小節まで下げて引き継ぐ |

前者だけだと、正本に在る裏付けまで「人が書いたもの」として末尾へ溜まり続け、章が
正本の投影であるという性質がそのぶん失われる。後者だけだと、正本を直す動機が消える。

**塞げていないところ**: 生成節の内側に人が足した**表の行**は今も落ちる (index の
実装状態/検証状態の列、収集状態表への注記など。実測で 167 行)。ここは行単位の併合
規則が要るので、この回では触っていない。**「167 行はまだ落ちる」を承知の上である。**

**向き**: ①ではなく **達成済みの下限の見張り (③)**。章が `qa_ref` だけを読む日、
質疑録の小節が引き継がれなくなる日、`refuse` が質疑録の消失を見逃す日に赤くなる。
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

PLUGIN_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PLUGIN_ROOT / "lib"))
import spec_docset_chapters as chapters  # noqa: E402
import spec_docset_foundation as foundation  # noqa: E402

PRIMARY = "qa-cell-primary"
IN_RANGE = "qa-cell-in-range"
GROUNDED_BY = "qa-cell-grounded-by"
ORPHAN = "qa-cell-orphan"

SUFFIX = " — 接地根拠 (required_info/qa_refs が名指す裏付け)"


def _spec() -> dict:
    """infrastructure/web だけが確定している最小の正本。

    裏付けを 2 通りで持たせる — `qa_refs` の範囲と `required_info[].grounded_by`。
    既存章の小見出しが 2026-08-25 の時点で自ら「required_info/qa_refs が名指す裏付け」
    と名乗っていた通り、**どちらも接地元である**。
    """
    return {
        "matrix": {
            "infrastructure": {
                "web": {
                    "state": "確定",
                    "qa_ref": PRIMARY,
                    "qa_refs": [PRIMARY, IN_RANGE],
                    "serves_goals": ["G1"],
                    "required_info": [
                        {
                            "item_id": "target-platforms",
                            "missing_effect": "block",
                            "status": "grounded",
                            "grounded_by": GROUNDED_BY,
                        }
                    ],
                }
            }
        },
        "qa_log": [
            {"id": PRIMARY, "question": "今の確定は何か", "answer": "今の答え。"},
            {"id": IN_RANGE, "question": "前の確定は何か", "answer": "前の答え。"},
            {"id": GROUNDED_BY, "question": "対象端末は", "answer": "web のみ。"},
        ],
    }


def test_grounding_reads_both_sources() -> None:
    """裏付けの出所は `qa_refs` と `required_info[].grounded_by` の両方である。"""
    got = [ref for ref, _ in chapters._grounding_cells_by_qa_ref(_spec(), "infrastructure")]
    assert got == [IN_RANGE, GROUNDED_BY]


def test_the_primary_ref_is_not_repeated_as_grounding() -> None:
    """`qa_ref` は主として 1 度だけ出る。範囲にも居るので、除かないと二重に出る。"""
    assert PRIMARY not in [
        ref for ref, _ in chapters._grounding_cells_by_qa_ref(_spec(), "infrastructure")
    ]


def test_the_chapter_renders_the_whole_range() -> None:
    """章の質疑録に、主 1 件と裏付け 2 件の**本文**が出る。"""
    text = chapters.render_confirmed_qa(_spec(), "infrastructure")
    assert f"### {PRIMARY} (対応セル: web)" in text
    assert f"### {IN_RANGE} (対応セル: web){SUFFIX}" in text
    assert f"### {GROUNDED_BY} (対応セル: web){SUFFIX}" in text
    assert "前の答え。" in text
    assert "web のみ。" in text


def test_the_suffix_wording_is_the_one_the_chapters_already_used() -> None:
    """接尾辞の文言は既存章のものをそのまま使う。

    **書式を変えると、中身が同じでも行差分としては消失に見える。**実測でも 12 件が
    これだけで「落ちた」と数えられていた。文言はここで固定する。
    """
    text = chapters.render_confirmed_qa(_spec(), "infrastructure")
    assert SUFFIX in text
    assert "接地根拠 (qa_refs が名指す裏付け)" not in text.replace(SUFFIX, "")


def test_the_application_section_covers_the_same_range() -> None:
    """`#### 本章での適用` も質疑録と同じ範囲を名指す。

    片方だけ `qa_refs` を読むと、同じ章の 2 つの節が別の範囲を名乗ることになる。
    """
    text = "\n".join(chapters._render_chapter_application(_spec(), "infrastructure"))
    assert f"##### 確定内容 {PRIMARY} (対応セル: web)" in text
    for ref in (IN_RANGE, GROUNDED_BY):
        assert f"##### 接地根拠 {ref} (対応セル: web)" in text


def test_the_grounding_body_is_a_pointer_not_a_second_copy() -> None:
    """裏付けの本文はここへ二重に置かない。**質疑録への参照だけを置く。**

    既存章 (frontend.md) が人の手でそう書いていた形である。丸ごと二重に描くと、
    同じ回答が 1 章に 2 度現れ、片方だけ直された日にどちらが正かを章から判定できない。
    """
    text = "\n".join(chapters._render_chapter_application(_spec(), "infrastructure"))
    assert f"- 本文: 「確定内容 (質疑録)」の `{IN_RANGE}` を参照" in text
    assert text.count("前の答え。") == 0
    # 主のほうは実体で描く (ポインタに退化していないこと)。
    assert "- 確定要件: 今の答え。" in text


def test_the_grounding_design_applications_are_rendered_in_full() -> None:
    """裏付けの `design_applications` は実体で描く。**ここが唯一の出口である。**

    質疑録の側には問答しか出ない。ポインタだけで済ませると、裏付け側の原則・章固有の
    根拠・トレードオフが章から丸ごと落ちる。
    """
    spec = _spec()
    for entry in spec["qa_log"]:
        if entry["id"] == IN_RANGE:
            entry["design_applications"] = [
                {
                    "principle": "前の原則",
                    "knowledge_ref": "ref-x",
                    "applicability": "applied",
                    "rationale": "前の根拠",
                    "tradeoffs": ["前の代償"],
                }
            ]
    text = "\n".join(chapters._render_chapter_application(spec, "infrastructure"))
    assert "- 原則: 前の原則 (`ref-x`)" in text
    assert "  - 章固有の根拠: 前の根拠" in text
    assert "    - 前の代償" in text


# --- 手書き検出を質疑録の `###` 小節まで下げた側 ------------------------------

GENERATED = "\n".join(
    [
        "## 確定内容 (質疑録)",
        "",
        f"### {PRIMARY} (対応セル: web)",
        "",
        "**回答**: 今の答え。",
        "",
    ]
)

ORPHAN_HEAD = f"### {ORPHAN} (対応セル: web)"
MUSING_HEAD = "#### 既存記録との食い違い (均さずに両方残す)"

EXISTING = "\n".join(
    [
        "## 確定内容 (質疑録)",
        "",
        f"### {PRIMARY} (対応セル: web)",
        "",
        "**回答**: 今の答え。",
        "",
        MUSING_HEAD,
        "",
        "この食い違いは 2026-08-23 に解消した。",
        "",
        ORPHAN_HEAD,
        "",
        "**回答**: 章にしか無い答え。",
        "",
    ]
)


def test_a_qa_subsection_missing_from_the_output_is_detected() -> None:
    """生成物に無い質疑録小節を、`##` 単位の検出が空振りする状況で拾う。"""
    assert foundation.handwritten_sections(EXISTING, GENERATED) == []
    got = foundation.handwritten_subsections(EXISTING, GENERATED)
    assert [h for h, _ in got] == [MUSING_HEAD, ORPHAN_HEAD]
    assert "章にしか無い答え。" in got[1][1]


def test_a_handwritten_musing_below_the_qa_level_is_carried_too() -> None:
    """人の考察 (`####`) も引き継ぐ。**質疑録だけを守っても足りない。**

    実測では ui-ux 章の食い違い記録が、生成される `##` 節の内側に住んでいたせいで
    丸ごと消えていた。正本のどこにも無い文なので、消えれば復元できない。
    """
    got = dict(foundation.handwritten_subsections(EXISTING, GENERATED))
    assert "この食い違いは 2026-08-23 に解消した。" in got[MUSING_HEAD]


def test_a_qa_subsection_present_in_the_output_is_left_alone() -> None:
    """生成物に在る ref は引き継がない。引き継ぐと章に二重で出る。"""
    assert foundation.handwritten_subsections(GENERATED, GENERATED) == []


def test_a_role_change_is_not_a_loss() -> None:
    """主から裏付けへ役割が変わっただけの ref は、消失として扱わない。

    見出しの文言は変わるが ref は生成物に在る。ここを取り違えると、compile のたびに
    同じ本文が末尾へ複製されて増え続ける。
    """
    demoted = GENERATED.replace(
        f"### {PRIMARY} (対応セル: web)", f"### {PRIMARY} (対応セル: web){SUFFIX}"
    )
    got = [h for h, _ in foundation.handwritten_subsections(EXISTING, demoted)]
    assert got == [MUSING_HEAD, ORPHAN_HEAD]


def test_refuse_also_stops_on_a_qa_subsection(tmp_path: Path) -> None:
    """`refuse` は質疑録小節の消失でも止まる。

    片方だけ見張ると「refuse なら安全」が嘘になる。
    """
    (tmp_path / "infrastructure.md").write_text(EXISTING, encoding="utf-8")
    with pytest.raises(foundation.CompileError) as err:
        foundation.write_docset(
            {"infrastructure.md": GENERATED}, tmp_path, on_handwritten="refuse"
        )
    assert ORPHAN in str(err.value)
    # 1 文字も書いていないこと。部分適用は差分を読みにくくする。
    assert (tmp_path / "infrastructure.md").read_text(encoding="utf-8") == EXISTING


def test_preserve_carries_the_subsection_under_its_own_heading(tmp_path: Path) -> None:
    """`preserve` は本文を残し、**正本へ未接続であることを章の上に書く**。

    生成節へ混ぜ戻さない。混ぜると正本の投影と手書きの区別が消え、次に誰かが正本を
    直す動機も消える。
    """
    (tmp_path / "infrastructure.md").write_text(EXISTING, encoding="utf-8")
    foundation.write_docset(
        {"infrastructure.md": GENERATED}, tmp_path, on_handwritten="preserve"
    )
    out = (tmp_path / "infrastructure.md").read_text(encoding="utf-8")
    assert "章にしか無い答え。" in out
    assert "## 章にしか無い記述 (正本へ未接続)" in out
    assert f"`{ORPHAN_HEAD}`" in out


def test_carrying_twice_does_not_duplicate(tmp_path: Path) -> None:
    """2 度目の compile で引き継ぎ本文が増えない。

    引き継ぎ先は生成物に無い `## 節` なので、次の回は `handwritten_sections` が節ごと
    拾う。小節側も同じ本文を拾うと**回を重ねるごとに章が太る**。冪等でない引き継ぎは、
    引き継がないのと同じくらい悪い。
    """
    (tmp_path / "infrastructure.md").write_text(EXISTING, encoding="utf-8")
    for _ in range(2):
        foundation.write_docset(
            {"infrastructure.md": GENERATED}, tmp_path, on_handwritten="preserve"
        )
    out = (tmp_path / "infrastructure.md").read_text(encoding="utf-8")
    assert out.count("章にしか無い答え。") == 1
    assert out.count("## 章にしか無い記述 (正本へ未接続)") == 1


# --- 節でも小節でもない 1 行を報告として残す側 --------------------------------

STRAY = "| セキュリティ | `partial` (PoC認証のみ) | 人が手で足した列 |"


def _with_stray(text: str) -> str:
    """生成節の内側へ、見出しを持たない 1 行を差し込む。

    表の行なので、切り出して末尾へ移せば意味が壊れる。**引き継ぐ場所が無い行**である。
    """
    lines = text.splitlines()
    lines.insert(lines.index("**回答**: 今の答え。") + 1, STRAY)
    return "\n".join(lines) + "\n"


def test_a_stray_line_is_reported_at_the_end(tmp_path: Path) -> None:
    """節にも小節にも属さない行は、本文ではなく**報告として**章末へ写す。

    黙って消すと差分を見るまで誰も気づかない。生成節へ差し戻すと正本の投影と手書きの
    区別が消える。写しなら、消えず・表も壊れず・正本へ戻す動機が章の上に残る。
    """
    (tmp_path / "infrastructure.md").write_text(_with_stray(GENERATED), encoding="utf-8")
    foundation.write_docset(
        {"infrastructure.md": GENERATED}, tmp_path, on_handwritten="preserve"
    )
    out = (tmp_path / "infrastructure.md").read_text(encoding="utf-8")
    assert foundation.RESIDUE_HEADING in out
    assert f"- `{STRAY}`" in out


def test_the_residue_section_is_rebuilt_not_stacked(tmp_path: Path) -> None:
    """報告節は毎回作り直す。**写しを既存本文として数えると、回ごとに倍になる。**

    2 回目の既存本文には 1 回目の写しが入っている。それを「章に在って生成物に無い行」と
    数えると、写しの写しが積まれる。数回で章が読めなくなる。
    """
    (tmp_path / "infrastructure.md").write_text(_with_stray(GENERATED), encoding="utf-8")
    for _ in range(3):
        foundation.write_docset(
            {"infrastructure.md": GENERATED}, tmp_path, on_handwritten="preserve"
        )
    out = (tmp_path / "infrastructure.md").read_text(encoding="utf-8")
    assert out.count(foundation.RESIDUE_HEADING) == 1
    assert out.count(f"- `{STRAY}`") == 1


def test_the_residue_survives_when_the_line_is_gone_from_the_body(tmp_path: Path) -> None:
    """**写しが最後の一部になる。**落とすだけでは、その行がこの世から消える。

    2 回目の既存本文に元の行はもう無い (1 回目で生成本文へ置き換わった)。写しだけが
    残っている。それを数えずに落とすと、報告節が空になって消え、行も一緒に消える。
    """
    (tmp_path / "infrastructure.md").write_text(_with_stray(GENERATED), encoding="utf-8")
    foundation.write_docset(
        {"infrastructure.md": GENERATED}, tmp_path, on_handwritten="preserve"
    )
    body, carried = foundation.split_residue(
        (tmp_path / "infrastructure.md").read_text(encoding="utf-8")
    )
    assert STRAY not in body  # 本文にはもう無い
    assert carried == [STRAY]  # 写しだけが持っている


def test_acknowledging_prior_residue_removes_the_reviewed_copy(tmp_path: Path) -> None:
    """明示ackした旧residueは次回へ持ち越さない。

    版更新で正しく消えた旧行を人がレビューしても、default carryしか無ければ章末から
    正規writerで消せない。ackは本文を書き換えず、前回までの写しだけを対象にする。
    """
    target = tmp_path / "infrastructure.md"
    target.write_text(_with_stray(GENERATED), encoding="utf-8")
    foundation.write_docset(
        {"infrastructure.md": GENERATED}, tmp_path, on_handwritten="preserve"
    )
    assert f"- `{STRAY}`" in target.read_text(encoding="utf-8")

    losses: list = []
    foundation.write_docset(
        {"infrastructure.md": GENERATED},
        tmp_path,
        on_handwritten="preserve",
        loss_report=losses,
        acknowledge_prior_residue=True,
    )

    out = target.read_text(encoding="utf-8")
    assert foundation.RESIDUE_HEADING not in out
    assert STRAY not in out
    assert losses == []


def test_acknowledging_prior_residue_still_reports_a_new_loss(tmp_path: Path) -> None:
    """ackと同じrunで本文から新たに消える行は、旧写しと一緒に捨てない。"""
    target = tmp_path / "infrastructure.md"
    target.write_text(_with_stray(GENERATED), encoding="utf-8")
    foundation.write_docset(
        {"infrastructure.md": GENERATED}, tmp_path, on_handwritten="preserve"
    )

    new_stray = "| runtime | `2.0.0` | 今回初めて消える行 |"
    current = target.read_text(encoding="utf-8")
    target.write_text(
        current.replace("**回答**: 今の答え。", f"**回答**: 今の答え。\n{new_stray}"),
        encoding="utf-8",
    )
    losses: list = []
    foundation.write_docset(
        {"infrastructure.md": GENERATED},
        tmp_path,
        on_handwritten="preserve",
        loss_report=losses,
        acknowledge_prior_residue=True,
    )

    out = target.read_text(encoding="utf-8")
    assert f"- `{STRAY}`" not in out
    assert f"- `{new_stray}`" in out
    assert losses == [("infrastructure.md", [new_stray])]


def test_refuse_writes_nothing_when_it_stops(tmp_path: Path) -> None:
    """節の消失で止まった回は 1 文字も書かない。報告だけ書き足すのは部分適用である。"""
    original = _with_stray(EXISTING)
    (tmp_path / "infrastructure.md").write_text(original, encoding="utf-8")
    with pytest.raises(foundation.CompileError):
        foundation.write_docset(
            {"infrastructure.md": GENERATED}, tmp_path, on_handwritten="refuse"
        )
    assert (tmp_path / "infrastructure.md").read_text(encoding="utf-8") == original


def test_refuse_still_reports_the_lines_it_lets_through(tmp_path: Path) -> None:
    """`refuse` が通した回でも、消えた行は報告する。

    行の消失は refuse の停止条件ではない — 版の更新のように正しく消える行が混ざるので、
    ここで止めると通る回が無くなる。だが**通す回に黙って消すのは別の話**である。
    「refuse なら消えていない」と読めてしまうのが、いちばん危ない緑である。
    """
    (tmp_path / "infrastructure.md").write_text(_with_stray(GENERATED), encoding="utf-8")
    foundation.write_docset(
        {"infrastructure.md": GENERATED}, tmp_path, on_handwritten="refuse"
    )
    out = (tmp_path / "infrastructure.md").read_text(encoding="utf-8")
    assert f"- `{STRAY}`" in out


def test_the_loss_report_matches_what_the_section_says(tmp_path: Path) -> None:
    """呼び手へ返す報告と、章に書く報告が同じものであること。

    2 経路が別々に数えると、CLI が「31 行」と言い章が別の数を名乗る。どちらを信じるかの
    判断がそこで発生し、報告そのものが信用を失う。
    """
    (tmp_path / "infrastructure.md").write_text(_with_stray(GENERATED), encoding="utf-8")
    losses: list = []
    foundation.write_docset(
        {"infrastructure.md": GENERATED},
        tmp_path,
        on_handwritten="preserve",
        loss_report=losses,
    )
    out = (tmp_path / "infrastructure.md").read_text(encoding="utf-8")
    assert [l for _, lines in losses for l in lines] == [STRAY]
    assert f"{len(losses[0][1])} 行" in out


def test_nothing_is_carried_when_nothing_is_missing(tmp_path: Path) -> None:
    """床: 消えるものが無ければ、引き継ぎ節を足さない。

    これが無いと、上の 2 つは「常に節を足す」実装でも緑になる。
    """
    (tmp_path / "infrastructure.md").write_text(GENERATED, encoding="utf-8")
    foundation.write_docset(
        {"infrastructure.md": GENERATED}, tmp_path, on_handwritten="preserve"
    )
    out = (tmp_path / "infrastructure.md").read_text(encoding="utf-8")
    assert "章にしか無い質疑録" not in out
