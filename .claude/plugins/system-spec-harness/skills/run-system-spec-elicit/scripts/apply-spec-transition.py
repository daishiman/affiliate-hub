#!/usr/bin/env python3
# /// script
# name: apply-spec-transition
# version: 0.2.0
# purpose: spec-state の単一 writer CLI。各責務は state_transition_{matrix,foundation,knowledge}.py へ分離する。
# inputs: [bootstrap|init|add-category|apply|chunk|aggregate|set-targets|set-foundation|seal-foundation-sources|set-decision|set-knowledge-candidate|set-qa-design-applications|set-qa-scope-notes|split-qa-bundle|supersede-qa|set-chapter-note|set-qa-source|declare-excluded-category|reanchor-split-scope-notes|requote-written-source|reseal-written-source|set-qa-written-up|set-hearing-policy|enable-asks-for]
# outputs: [spec-state.json or stdout]
# network: false
# write-scope: spec-state.json
# requires-python: ">=3.9"
# ///
"""Thin CLI and compatibility facade for the split spec-state transition writer."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))
SUPPORT_SCRIPTS = Path(__file__).resolve().parents[3] / "scripts"
if str(SUPPORT_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SUPPORT_SCRIPTS))

from state_transition_common import (
    CANONICAL_PLATFORMS,
    CELL_STATES,
    DECISION_COMPARISON_AXES,
    DECISION_COST_CATEGORIES,
    FOUNDATION_KEYS,
    FOUNDATION_NA_FORBIDDEN,
    FOUNDATION_U_KEYS,
    MAX_LOOPS_DEFAULT,
    PLATFORM_LABELS,
    TransitionError,
    empty_foundation,
    foundation_goal_ids as _foundation_goal_ids,
    has_entry as _has_entry,
    is_explicit_na as _is_explicit_na,
    normalize_serves as _normalize_serves,
)
from state_transition_foundation import (
    seal_foundation_sources,
    set_decision,
    set_foundation,
)
from state_transition_knowledge import set_knowledge_candidate
from state_transition_matrix import (
    CURRENT_STATE_SCHEMA_VERSION,
    DESIGN_APPLICATION_CONTRACT_VERSION,
    LOOP_LIMIT_POLICIES,
    SCHEMA_1_2_SECTIONS,
    add_category,
    loop_limit_is_violated,
    set_hearing_limit_policy,
    apply_cell_op,
    apply_turn,
    bootstrap_state,
    count_unresolved,
    derive_aggregate,
    init_state,
    next_unresolved_question,
    reanchor_split_scope_notes,
    requote_written_source,
    reseal_written_source,
    recompute_aggregates,
    run_chunk,
    set_qa_design_applications,
    set_qa_scope_notes,
    set_qa_written_up,
    set_targets,
    split_qa_bundle,
    set_chapter_note,
    set_qa_source,
    declare_excluded_category,
    supersede_qa,
)
from state_transition_matrix import enable_asks_for_contract


def _require_writable_state(state: dict) -> None:
    """Legacy state は読み取り専用とし、明示 init migration を強制する。"""
    if (
        state.get("schema_version") != CURRENT_STATE_SCHEMA_VERSION
        or state.get("design_application_contract_version")
        != DESIGN_APPLICATION_CONTRACT_VERSION
    ):
        raise TransitionError(
            f"legacy spec-state は読み取り専用。init --state で schema "
            f"{CURRENT_STATE_SCHEMA_VERSION} / design_application_contract_version "
            f"{DESIGN_APPLICATION_CONTRACT_VERSION} へ移行してから更新すること"
        )


def _require_documented_loop_overrun(state: dict, cmd: str) -> None:
    """上限超えを抱えた state を、由来を書かないまま更に書き進めさせない。

    schema_version の門 (上) は「版が古い state を読み取り専用にする」だけで、
    版が合っている state の中身が writer の外から書かれていても素通りする。
    run_chunk は上限超えを**生み出せない** (state_transition_matrix の
    LOOP_LIMIT_POLICY_STRICT の注記を参照) ので、loop_count > max_loops は
    「この writer を通らずに書かれた」痕跡である。その痕跡が未記名のまま
    次の transition に乗ると、以後の書き込みが正規経路の産物に見えてしまう。

    上限そのものは動かさない。超過値も丸めない。要求するのは由来の記載だけである。
    set-hearing-policy は由来を書くための op なので、ここでは通す
    (通さないと、由来を書く唯一の経路が由来が無いことを理由に塞がる)。

    塞げていないところ: 由来の**中身**は読んでいない。非空文字列なら何でも通る。
    また、この門は writer を通る書込にしか掛からない — writer を通らない経路
    (キャッシュ側 install の同名 writer を含む) は、そもそもここへ来ない。

    **反転先**: 正本 state の書込経路が writer 1 つに限られることを機械で示せる日
    (例: state に writer だけが持つ鍵で署名し、署名の無い版を読まない)。
    そのとき loop_count > max_loops は起こり得なくなるので、この門は不要になる。
    """
    if cmd == "set-hearing-policy":
        return
    progress = state.get("hearing_progress")
    if not isinstance(progress, dict) or not loop_limit_is_violated(progress):
        return
    overrun = progress.get("limit_overrun")
    reason = overrun.get("reason") if isinstance(overrun, dict) else None
    if not isinstance(reason, str) or not reason.strip():
        raise TransitionError(
            f"hearing_progress: loop_count={progress.get('loop_count')} が "
            f"max_loops={progress.get('max_loops')} を超えているのに limit_overrun.reason が無い。"
            "この writer は上限超えを生み出せないため、これは writer の外から書かれた痕跡である。"
            "set-hearing-policy --overrun で由来を記録してから他の transition を行うこと"
        )


def _snapshot_versioned_sections(state: dict) -> dict:
    """1.2 固有 4 節の『読んだときの姿』を控える。"""
    return {name: state[name] for name in SCHEMA_1_2_SECTIONS if name in state}


def _require_sections_preserved(before: dict, state: dict) -> None:
    """読んだときに在った 1.2 固有 4 節が、書き戻しで落ちていないことを確かめる。

    版の門を 1.2 へ上げただけだと、**通るようになったぶん黙って壊れる**余地が生まれる。
    拒否されていたあいだは気づけたが、通る writer が 4 節を落とすと誰も気づかない。
    そこで「読めた節は書き戻しでも在る」ことを、transition のたびに機械で押さえる。
    """
    lost = sorted(name for name in before if name not in state)
    if lost:
        raise TransitionError(
            "1.2 固有節が transition で失われた: " + ", ".join(lost) +
            "。器に合わせて中身を削らないこと"
        )
    changed = sorted(
        name
        for name, value in before.items()
        if type(state.get(name)) is not type(value)
    )
    if changed:
        raise TransitionError(
            "1.2 固有節の型が transition で変わった: " + ", ".join(changed)
        )


def load_json(path: str) -> dict:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def load_json_arg(raw: str):
    stripped = raw.lstrip()
    if stripped.startswith(("{", "[")):
        return json.loads(raw)
    return json.loads(Path(raw).read_text(encoding="utf-8"))


def dump_state(state: dict) -> str:
    return json.dumps(state, ensure_ascii=False, indent=2) + "\n"


def _emit(state: dict, out: str | None) -> None:
    text = dump_state(state)
    if out:
        Path(out).write_text(text, encoding="utf-8")
    else:
        sys.stdout.write(text)


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="spec-state.json 単一 transition writer (run-system-spec-elicit)")
    sub = parser.add_subparsers(dest="cmd", required=True)
    boot = sub.add_parser("bootstrap", help="R0 用の空 state envelope を生成")
    boot.add_argument("--out")
    init = sub.add_parser("init", help="taxonomy からマトリクスを初期化")
    init.add_argument("--taxonomy", required=True)
    init.add_argument("--state", help="bootstrap済みstate (foundation/decisionsを保持)")
    init.add_argument("--out")
    add_category_parser = sub.add_parser("add-category", help="カテゴリ軸を 1 件拡張")
    add_category_parser.add_argument("--state", required=True)
    add_category_parser.add_argument("--category", required=True, help="category JSON文字列またはファイル")
    add_category_parser.add_argument("--out")
    apply = sub.add_parser("apply", help="単一セル op を適用")
    apply.add_argument("--state", required=True)
    apply.add_argument("--op", required=True, help="JSON 文字列の cell op")
    apply.add_argument("--out")
    chunk = sub.add_parser("chunk", help="ターン列を 1 invocation ぶん適用")
    chunk.add_argument("--state", required=True)
    chunk.add_argument("--turns", required=True, help="ターン列 JSON ファイル")
    chunk.add_argument("--max-loops", type=int, default=MAX_LOOPS_DEFAULT)
    chunk.add_argument("--out")
    aggregate = sub.add_parser("aggregate", help="集約状態を再計算")
    aggregate.add_argument("--state", required=True)
    aggregate.add_argument("--out")
    targets = sub.add_parser("set-targets", help="取得対象一覧 targets[] を設定")
    targets.add_argument("--state", required=True)
    targets.add_argument("--targets", required=True, help="targets JSON配列または JSON ファイル")
    targets.add_argument("--out")
    foundation = sub.add_parser("set-foundation", help="requirements_foundation (U1-U9) を設定/確定")
    foundation.add_argument("--state", required=True)
    foundation.add_argument("--foundation", required=True, help="foundation JSON文字列またはファイル")
    foundation.add_argument("--out")
    seal = sub.add_parser(
        "seal-foundation-sources",
        help="requirements_foundation の書面根拠を実ファイルへ照合してから封をする",
    )
    seal.add_argument("--state", required=True)
    seal.add_argument("--out")
    # sha256 は引数で受け取らない。writer が path のファイルを読んで計算する。
    decision = sub.add_parser("set-decision", help="意思決定支援 record を upsert")
    decision.add_argument("--state", required=True)
    decision.add_argument("--decision", required=True, help="decision JSON文字列またはファイル")
    decision.add_argument("--out")
    candidate = sub.add_parser("set-knowledge-candidate", help="knowledge candidate を lifecycle 付きで upsert")
    candidate.add_argument("--state", required=True)
    candidate.add_argument("--candidate", required=True, help="candidate JSON文字列またはファイル")
    candidate.add_argument("--out")
    qa_design = sub.add_parser(
        "set-qa-design-applications",
        help="既存 qa の質問・回答を保ったまま設計適用を追記",
    )
    qa_design.add_argument("--state", required=True)
    qa_design.add_argument("--qa-id", required=True)
    qa_design.add_argument(
        "--applications",
        required=True,
        help="design_applications JSON配列または JSON ファイル",
    )
    qa_design.add_argument("--out")
    scope_notes = sub.add_parser(
        "set-qa-scope-notes",
        help="束ねた qa の論点範囲を、質問・回答を保ったまま注記として追記",
    )
    scope_notes.add_argument("--state", required=True)
    scope_notes.add_argument("--qa-id", required=True)
    scope_notes.add_argument(
        "--scope-notes",
        required=True,
        help="scope_notes JSON object またはそれを収めた JSON ファイル",
    )
    scope_notes.add_argument("--out")
    supersede = sub.add_parser(
        "supersede-qa",
        help="作り直しで引かれなくなった質疑に、後継 (superseded_by) を申告させる",
        description=(
            "**孤立を禁じるのではなく、名乗らせる。**質疑を作り直すと古い方は誰からも"
            "引かれなくなる。それ自体は正しい。ところが正本にそれを言う欄が無いと、"
            "機械には『置き換えた』のか『接地を忘れた』のかが区別できず、監査は毎回"
            "同じ件を欠陥として報告し続ける。まだセルから引かれている質疑は封じられない。"
        ),
    )
    supersede.add_argument("--state", required=True)
    supersede.add_argument("--qa-id", required=True)
    supersede.add_argument("--by", required=True, help="後継となる qa_log の id")
    supersede.add_argument("--out")
    chapter_note = sub.add_parser(
        "set-chapter-note",
        help="章にしか居場所の無い散文へ、正本の居場所を与える (章の手書きを正本へ戻す)",
        description=(
            "章は正本の純関数なので、正本に無い散文は compile のたび消える。節の引き継ぎ "
            "(`--on-handwritten preserve`) は `##` 単位でしか効かず、生成節の内側に書かれた"
            "散文は原理上守れない。**守るのではなく、消えようのない場所へ移す。**"
            "利用者の逐語 (`qa_log[].answer`) には足さない。後から気づいた突き合わせを"
            "そこへ足すと、利用者が言っていないことが利用者の声の顔で残る。"
        ),
    )
    chapter_note.add_argument("--state", required=True)
    chapter_note.add_argument("--category", required=True)
    chapter_note.add_argument("--heading", required=True)
    chapter_note.add_argument(
        "--body-file",
        required=True,
        help="本文の入ったファイル。**手で打ち直させないための欄である。**引数へ直に書かせると、"
        "写し間違いが正本に入る",
    )
    chapter_note.add_argument("--reason", required=True, help="なぜこの散文を正本へ入れるのか")
    chapter_note.add_argument("--out")
    qa_source = sub.add_parser(
        "set-qa-source",
        help="既存の質疑へ『対話由来』という名乗りを後から与える (書面由来は set-qa-written-up)",
        description=(
            "`source` は長らく任意欄で、由来を名乗らずに質疑を作れた。作成側は塞いだが、"
            "**塞ぐ前に入ったものは、塞いだ writer では直せない。**この writer が直す。"
            "受け付けるのは `user-dialogue` の名乗りだけである。書面由来は "
            "`set-qa-written-up` が原文の path/section と digest まで要求するので、"
            "**名乗りだけで『書面に書いてある』と言える口は作らない。**"
        ),
    )
    qa_source.add_argument("--state", required=True)
    qa_source.add_argument("--qa-id", required=True)
    qa_source.add_argument(
        "--reason", required=True, help="なぜこの質疑が対話由来だと言えるのか"
    )
    qa_source.add_argument("--out")

    excl = sub.add_parser(
        "declare-excluded-category",
        help="必須情報カタログの domain に、カテゴリ行を立てない理由を名乗らせる",
        description=(
            "`--require-catalog-domain-coverage` はカタログの in_scope domain に "
            "『それを数えるカテゴリ行』を要求し、無い場合の逃げ道として "
            "excluded_categories を案内する。**その逃げ道を書く道具が無かった。**"
            "『対象外』は『作らない』ではなく『このカテゴリ行を立てない』である。"
            "誤読を防ぐため --reason を必須にし、どこで数えているのかを書かせる。"
        ),
    )
    excl.add_argument("--state", required=True)
    excl.add_argument("--category", required=True)
    excl.add_argument(
        "--reason", required=True, help="なぜ行を立てないのか / その必須情報をどこで数えているのか"
    )
    excl.add_argument("--out")
    split_bundle = sub.add_parser(
        "split-qa-bundle",
        help="束ねた qa entry を論点ごとに解き、裏付けの範囲をセルの qa_refs[] へ移す",
        description=(
            "**何を削るかは引数で受け取らない。**scope_notes.topics と取り込み元 entry を "
            "writer が自分で引き、取り込まれた節が取り込み元の回答と byte 単位で一致する"
            "ときだけ外す。渡せると、渡す側がどの節を『取り込みだった』と名乗るか選べ、"
            "自分の本文を他所のせいにして消せる。"
        ),
    )
    split_bundle.add_argument("--state", required=True)
    split_bundle.add_argument("--qa-id", required=True)
    split_bundle.add_argument("--out")
    reanchor = sub.add_parser(
        "reanchor-split-scope-notes",
        help="束ね解除で指し先を失った answer_span を、origin entry の本文へ張り直す",
        description=(
            "**錨は引数で受け取らない。**origin entry の本文から writer が切り出し、"
            "逐語で 1 箇所であることを確かめてから書く。すでに解決している span には"
            "触らないので、2 度目の実行は何も変えない。"
        ),
    )
    reanchor.add_argument("--state", required=True)
    reanchor.add_argument("--qa-id", required=True)
    reanchor.add_argument("--out")
    requote = sub.add_parser(
        "requote-written-source",
        help="文書と食い違った引用行を、文書の側の行で置き換える",
        description=(
            "**錨も置き換え先も引数で受け取らない。**行の形 (表の行 / 番号付き箇条) から "
            "writer が錨を決め、その錨で始まる文書行がちょうど 1 行のときだけ置き換える。"
            "0 行または 2 行以上なら書かずに止まる。"
        ),
    )
    requote.add_argument("--state", required=True)
    requote.add_argument("--qa-id", required=True)
    requote.add_argument("--out")
    reseal = sub.add_parser(
        "reseal-written-source",
        help="written-requirements entry の source.sha256 を、本文を文書へ照合してから取り直す",
        description=(
            "**指紋も文書の path も引数で受け取らない。**writer が source.path を読み、"
            "answer の非空行が 1 行残らず文書に逐語で在ることを確かめてから取り直す。"
            "1 行でも無ければ書かずに止まる。渡せると、文書に無い文を "
            "requirements として封をできる。"
        ),
    )
    reseal.add_argument("--state", required=True)
    reseal.add_argument("--qa-id", required=True)
    reseal.add_argument("--out")
    limit = sub.add_parser(
        "set-hearing-policy",
        help="hearing_progress の上限 (max_loops) が厳格かソフトかを明示する",
    )
    limit.add_argument("--state", required=True)
    limit.add_argument("--policy", required=True, choices=list(LOOP_LIMIT_POLICIES))
    limit.add_argument(
        "--overrun",
        help="loop_count が max_loops を超えている場合の由来 JSON (reason 必須)",
    )
    limit.add_argument("--out")
    asks_for = sub.add_parser(
        "enable-asks-for",
        help="asks_for 契約を有効化する (以後の新規 qa entry に asks_for を必須にする)",
        description=(
            "legacy 除外の id は**引数で受け取らない**。有効化した時点の qa_log の id を"
            "そのまま凍結する。名簿を外から渡せると、渡す側が誰を除外するか選べてしまい、"
            "『有効化時点で実在した entry だけ』という時点の縛りが名乗りに変わる。"
        ),
    )
    asks_for.add_argument("--state", required=True)
    asks_for.add_argument("--out")
    written_up = sub.add_parser(
        "set-qa-written-up",
        help="対話で聞いた問答を文書へ書き起こした事実を追記する",
        description=(
            "sha256 と日付は**引数で受け取らない**。writer が実ファイルを読んで計算する。"
            "受け取ると、書き起こしていない内容の指紋を名乗れる。"
            "元の source は書き換えない — 対話で聞いた事実と、それを書き起こした事実は別の 2 件である。"
        ),
    )
    written_up.add_argument("--state", required=True)
    written_up.add_argument("--qa-id", required=True)
    written_up.add_argument("--path", required=True, help="書き起こし先ファイル (実在必須)")
    written_up.add_argument("--section", help="節の見出しやアンカー (任意)")
    written_up.add_argument("--out")
    args = parser.parse_args(argv)
    try:
        if args.cmd == "bootstrap":
            _emit(bootstrap_state(), args.out)
        elif args.cmd == "init":
            _emit(init_state(load_json(args.taxonomy), load_json(args.state) if args.state else None), args.out)
        else:
            state = load_json(args.state)
            _require_writable_state(state)
            _require_documented_loop_overrun(state, args.cmd)
            sections_before = _snapshot_versioned_sections(state)
            if args.cmd == "add-category":
                add_category(state, load_json_arg(args.category))
            elif args.cmd == "apply":
                apply_turn(state, {"ops": [json.loads(args.op)]})
            elif args.cmd == "chunk":
                run_chunk(state, load_json(args.turns), max_loops=args.max_loops)
            elif args.cmd == "aggregate":
                recompute_aggregates(state)
            elif args.cmd == "set-targets":
                value = load_json_arg(args.targets)
                set_targets(state, value["targets"] if isinstance(value, dict) and "targets" in value else value)
            elif args.cmd == "set-foundation":
                set_foundation(state, load_json_arg(args.foundation))
            elif args.cmd == "seal-foundation-sources":
                summary = seal_foundation_sources(state)
                print(
                    f"封: 書面 {summary['sealed']} 件 / 対話 {summary['dialogue']} 件 "
                    f"/ 全 {summary['total']} 件",
                )
            elif args.cmd == "set-decision":
                set_decision(state, load_json_arg(args.decision))
            elif args.cmd == "set-knowledge-candidate":
                set_knowledge_candidate(state, load_json_arg(args.candidate))
            elif args.cmd == "set-qa-design-applications":
                value = load_json_arg(args.applications)
                set_qa_design_applications(
                    state,
                    args.qa_id,
                    value["design_applications"]
                    if isinstance(value, dict) and "design_applications" in value
                    else value,
                )
            elif args.cmd == "set-qa-scope-notes":
                value = load_json_arg(args.scope_notes)
                set_qa_scope_notes(
                    state,
                    args.qa_id,
                    value["scope_notes"]
                    if isinstance(value, dict) and "scope_notes" in value
                    else value,
                )
            elif args.cmd == "enable-asks-for":
                enable_asks_for_contract(
                    state,
                    [entry["id"] for entry in state.get("qa_log", []) if isinstance(entry, dict)],
                )
            elif args.cmd == "supersede-qa":
                supersede_qa(state, args.qa_id, args.by)
            elif args.cmd == "declare-excluded-category":
                declare_excluded_category(state, args.category, args.reason)
            elif args.cmd == "set-qa-source":
                set_qa_source(state, args.qa_id, args.reason)
            elif args.cmd == "set-chapter-note":
                set_chapter_note(
                    state,
                    args.category,
                    args.heading,
                    Path(args.body_file).read_text(encoding="utf-8"),
                    args.reason,
                )
            elif args.cmd == "split-qa-bundle":
                split_qa_bundle(state, args.qa_id)
            elif args.cmd == "reanchor-split-scope-notes":
                reanchor_split_scope_notes(state, args.qa_id)
            elif args.cmd == "requote-written-source":
                requote_written_source(state, args.qa_id)
            elif args.cmd == "reseal-written-source":
                reseal_written_source(state, args.qa_id)
            elif args.cmd == "set-qa-written-up":
                set_qa_written_up(state, args.qa_id, args.path, args.section)
            elif args.cmd == "set-hearing-policy":
                set_hearing_limit_policy(
                    state,
                    args.policy,
                    load_json_arg(args.overrun) if args.overrun else None,
                )
            _require_sections_preserved(sections_before, state)
            _emit(state, args.out or args.state)
    except TransitionError as exc:
        print(f"TransitionError: {exc}", file=sys.stderr)
        return 1
    except (OSError, json.JSONDecodeError) as exc:
        print(f"IO/JSON error: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
