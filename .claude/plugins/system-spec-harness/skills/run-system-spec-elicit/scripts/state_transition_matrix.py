"""Matrix, log, and resumable-chunk transitions owned by the spec-state writer."""
from __future__ import annotations

import datetime
import hashlib
import re
from pathlib import Path

from state_transition_common import (
    CANONICAL_PLATFORMS,
    CELL_STATES,
    PLATFORM_LABELS,
    TransitionError,
    empty_foundation,
    has_entry,
    normalize_serves,
)
from state_transition_required_info import blocking_items_for_category, normalize_required_info
CATEGORY_ID_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
APPLICATION_STATES = {"applied", "not_applicable"}
DESIGN_APPLICATION_CONTRACT_VERSION = "1.0"
CURRENT_STATE_SCHEMA_VERSION = "1.2"

# 1.2 で増えた 4 節。**版の門を 1.2 へ上げるだけでは保守にならない**ので、
# ここに名前を置いて bootstrap の生成物と往復の保全チェックの両方から参照する。
# 「版は 1.2 と名乗るが 4 節が無い state」を writer が作らないための当てどころである。
SCHEMA_1_2_SECTIONS = (
    "lifecycle",
    "implementation_snapshot",
    "delivery_dependencies",
    "review_runs",
)


def normalize_design_applications(raw: object) -> list[dict]:
    """Validate chapter-specific design interpretation separately from Q&A text."""
    if not isinstance(raw, list) or not raw:
        raise TransitionError("design_applications は非空配列必須")
    normalized: list[dict] = []
    for index, item in enumerate(raw):
        label = f"design_applications[{index}]"
        if not isinstance(item, dict):
            raise TransitionError(f"{label} は object 必須")
        for key in ("knowledge_ref", "principle", "rationale"):
            value = item.get(key)
            if not isinstance(value, str) or not value.strip():
                raise TransitionError(f"{label}.{key} は非空文字列必須")
        applicability = item.get("applicability")
        if applicability not in APPLICATION_STATES:
            raise TransitionError(
                f"{label}.applicability={applicability!r} は applied|not_applicable 必須"
            )
        tradeoffs = item.get("tradeoffs")
        if (
            not isinstance(tradeoffs, list)
            or not tradeoffs
            or any(not isinstance(value, str) or not value.strip() for value in tradeoffs)
        ):
            raise TransitionError(f"{label}.tradeoffs は非空文字列の配列必須")
        normalized.append(
            {
                "knowledge_ref": item["knowledge_ref"].strip(),
                "principle": item["principle"].strip(),
                "applicability": applicability,
                "rationale": item["rationale"].strip(),
                "tradeoffs": [value.strip() for value in tradeoffs],
            }
        )
    return normalized


def set_qa_design_applications(state: dict, qa_id: str, raw: object) -> None:
    """Backfill design interpretation without rewriting the original Q&A text."""
    if not isinstance(qa_id, str) or not qa_id.strip():
        raise TransitionError("set-qa-design-applications: qa_id は非空文字列必須")
    qa_id = qa_id.strip()
    entry = next(
        (candidate for candidate in state.get("qa_log", []) if candidate.get("id") == qa_id),
        None,
    )
    if entry is None:
        raise TransitionError(
            f"set-qa-design-applications: qa_log に存在しない qa_id: {qa_id}"
        )

    normalized = normalize_design_applications(raw)
    provenance = {
        "mode": "legacy_backfill",
        "writer": "set-qa-design-applications",
    }
    existing = entry.get("design_applications")
    existing_provenance = entry.get("design_application_provenance")
    if existing_provenance is not None:
        # The shared schema permits only this exact provenance. Keep the explicit
        # guard because this function and CLI also receive hand-authored JSON
        # before the standalone schema/coverage gates run.
        if existing_provenance != provenance:
            raise TransitionError(
                f"set-qa-design-applications: 既存 provenance の上書きは拒否: {qa_id}"
            )
        if existing is None:
            raise TransitionError(
                "set-qa-design-applications: 完了済み provenance に対する "
                f"design_applications 欠落を検出: {qa_id}"
            )
        if normalize_design_applications(existing) != normalized:
            raise TransitionError(
                "set-qa-design-applications: 完了済み backfill と異なる "
                f"design_applications の再適用は拒否: {qa_id}"
            )
        # A previously completed backfill is the only idempotent replay allowed.
        entry.pop("legacy_exempt", None)
        entry.pop("legacy_exempt_reason", None)
        return

    if existing is not None:
        raise TransitionError(
            "set-qa-design-applications: provenance の無い既存 design_applications は"
            f"対話経路として保護し、legacy_backfill への変更を拒否: {qa_id}"
        )
    reason = entry.get("legacy_exempt_reason")
    if entry.get("legacy_exempt") is not True or not isinstance(reason, str) or not reason.strip():
        raise TransitionError(
            "set-qa-design-applications: legacy_exempt=true と非空の "
            f"legacy_exempt_reason を持つ旧 qa のみ補完可能: {qa_id}"
        )

    entry["design_applications"] = normalized
    entry["design_application_provenance"] = provenance
    # A successful validated backfill supersedes the temporary legacy escape.
    entry.pop("legacy_exempt", None)
    entry.pop("legacy_exempt_reason", None)


SCOPE_NOTE_WRITER = "set-qa-scope-notes"
# `answer_span` の長さの床。2026-08-20 実測: 注記対象 8 entry から取れる節見出し 19 件の
# 最短が 23 字 (`### qa-infra-web（出典未記載）`) なので 20 に置いた (遊び 3)。
# 床が無いと「。」1 文字でも部分文字列は成立し、**逐語引用したという主張だけが通る**。
# 以後この値は上げる方向にしか動かさない (下げるのは検査を緩める向き)。
SCOPE_NOTE_SPAN_MIN_LEN = 20


def _confirmed_cells_citing(state: dict, qa_id: str) -> list[tuple[str, str]]:
    """確定セルのうち、根拠として qa_id を引いているものを列挙する。"""
    found: list[tuple[str, str]] = []
    for category, row in (state.get("matrix") or {}).items():
        if not isinstance(row, dict):
            continue
        for platform, cell in row.items():
            if not isinstance(cell, dict):
                continue
            if cell.get("state") == "確定" and cell.get("qa_ref") == qa_id:
                found.append((category, platform))
    return sorted(found)


def normalize_scope_notes(raw: object, entry: dict, refs: list[tuple[str, str]]) -> dict:
    """範囲注記を検証して正規形へ落とす。問答本文 (question/answer) には触らない。

    束ねを **解消しない**。1 entry が複数論点を抱えている事実はそのまま残り、
    どの論点がどの確定セルの裏付けかが機械で読めるようになるだけである。
    だから `bundled` は注記の飾りではなく、writer が計算して突き合わせる値にしてある。
    """
    if not isinstance(raw, dict):
        raise TransitionError(f"{SCOPE_NOTE_WRITER}: scope_notes は object 必須")

    topics = raw.get("topics")
    if not isinstance(topics, list) or not topics:
        raise TransitionError(f"{SCOPE_NOTE_WRITER}: topics は非空配列必須")

    answer = entry.get("answer")
    if not isinstance(answer, str) or not answer.strip():
        raise TransitionError(f"{SCOPE_NOTE_WRITER}: answer が空の entry には注記できない")

    bundled = raw.get("bundled")
    if not isinstance(bundled, bool):
        raise TransitionError(f"{SCOPE_NOTE_WRITER}: bundled は真偽値必須")

    # `bundled` を手で false にすれば束ねが消えたことになる、という抜け道を塞ぐ。
    # false を名乗れるのは「論点が 1 件で、この entry を引く確定セルも 1 件」のときだけ。
    if bundled and len(topics) < 2:
        raise TransitionError(
            f"{SCOPE_NOTE_WRITER}: bundled=true は topics 2 件以上のときのみ "
            f"(topics={len(topics)})"
        )
    if not bundled and (len(topics) != 1 or len(refs) != 1):
        raise TransitionError(
            f"{SCOPE_NOTE_WRITER}: bundled=false は topics 1 件かつ確定セル 1 件のときのみ "
            f"(topics={len(topics)}, 確定セル={len(refs)})"
        )

    reason = raw.get("bundling_reason")
    if bundled and (not isinstance(reason, str) or not reason.strip()):
        raise TransitionError(
            f"{SCOPE_NOTE_WRITER}: bundled=true には非空の bundling_reason が必須 "
            "(束ねが残っている事実を欄に持たせる)"
        )

    normalized_topics = []
    seen_ids: set[str] = set()
    covered: list[tuple[str, str]] = []
    for index, topic in enumerate(topics):
        where = f"{SCOPE_NOTE_WRITER}: topics[{index}]"
        if not isinstance(topic, dict):
            raise TransitionError(f"{where} は object 必須")

        topic_id = topic.get("topic_id")
        if not isinstance(topic_id, str) or not topic_id.strip():
            raise TransitionError(f"{where}.topic_id は非空文字列必須")
        topic_id = topic_id.strip()
        if topic_id in seen_ids:
            raise TransitionError(f"{where}.topic_id が重複: {topic_id}")
        seen_ids.add(topic_id)

        span = topic.get("answer_span")
        if not isinstance(span, str):
            raise TransitionError(f"{where}.answer_span は文字列必須")
        if len(span) < SCOPE_NOTE_SPAN_MIN_LEN:
            raise TransitionError(
                f"{where}.answer_span が短すぎる ({len(span)} 字 < "
                f"{SCOPE_NOTE_SPAN_MIN_LEN} 字)。短い断片は逐語引用の証明にならない"
            )
        occurrences = answer.count(span)
        if occurrences == 0:
            raise TransitionError(
                f"{where}.answer_span が answer に存在しない (注記が問答を作文している)"
            )
        if occurrences > 1:
            raise TransitionError(
                f"{where}.answer_span が answer に {occurrences} 箇所ある。"
                "位置を特定できない引用は範囲注記として機能しない"
            )

        note = topic.get("note")
        if not isinstance(note, str) or not note.strip():
            raise TransitionError(f"{where}.note は非空文字列必須")

        cell = topic.get("covers_cell")
        normalized_cell = None
        if cell is not None:
            if not isinstance(cell, dict):
                raise TransitionError(f"{where}.covers_cell は object または null")
            category = cell.get("category")
            platform = cell.get("platform")
            if not isinstance(category, str) or not category.strip():
                raise TransitionError(f"{where}.covers_cell.category は非空文字列必須")
            if not isinstance(platform, str) or not platform.strip():
                raise TransitionError(f"{where}.covers_cell.platform は非空文字列必須")
            key = (category.strip(), platform.strip())
            if key not in refs:
                raise TransitionError(
                    f"{where}.covers_cell={key} は、この entry を qa_ref に持つ確定セルではない"
                )
            if key in covered:
                raise TransitionError(f"{where}.covers_cell={key} を複数の topic が名乗っている")
            covered.append(key)
            normalized_cell = {"category": key[0], "platform": key[1]}

        normalized_topics.append(
            {
                "topic_id": topic_id,
                "covers_cell": normalized_cell,
                "answer_span": span,
                "note": note.strip(),
                "origin_qa_id": (topic.get("origin_qa_id") or "").strip() or None,
            }
        )

    missing = [cell for cell in refs if cell not in covered]
    if missing:
        raise TransitionError(
            f"{SCOPE_NOTE_WRITER}: この entry を引く確定セル {missing} を名乗る topic が無い"
        )

    # covers_cell を全部 null にすれば上の `missing` 検査は素通りする——refs が空の
    # entry なら missing も空になるからである。**どのセルの裏付けでもない注記は、
    # 範囲注記ではなく感想である。**確定セルから指されていない entry に注記を付けて
    # 「範囲を明示した」と名乗れる道を、ここで閉じる。
    if not covered:
        raise TransitionError(
            f"{SCOPE_NOTE_WRITER}: covers_cell を持つ topic が 1 件も無い。"
            "確定セルから指されていない entry には範囲注記を付けられない"
        )

    normalized = {
        "bundled": bundled,
        "topics": normalized_topics,
        "recorded_with": SCOPE_NOTE_WRITER,
    }
    if bundled:
        normalized["bundling_reason"] = reason.strip()
    return normalized


def set_qa_scope_notes(state: dict, qa_id: str, raw: object) -> None:
    """束ねた問答の「どの論点がどのセルの裏付けか」を、本文を書き換えずに追記する。

    `set_qa_design_applications` の流儀に合わせる (同一内容の再適用は通し、
    異なる内容の再適用は拒否)。先例がある欄に別の流儀を持ち込まない。
    """
    if not isinstance(qa_id, str) or not qa_id.strip():
        raise TransitionError(f"{SCOPE_NOTE_WRITER}: qa_id は非空文字列必須")
    qa_id = qa_id.strip()
    entry = next(
        (candidate for candidate in state.get("qa_log", []) if candidate.get("id") == qa_id),
        None,
    )
    if entry is None:
        raise TransitionError(f"{SCOPE_NOTE_WRITER}: qa_log に存在しない qa_id: {qa_id}")

    normalized = normalize_scope_notes(raw, entry, _confirmed_cells_citing(state, qa_id))
    existing = entry.get("scope_notes")
    if existing is not None and existing != normalized:
        raise TransitionError(
            f"{SCOPE_NOTE_WRITER}: 既存 scope_notes と異なる内容の再適用は拒否: {qa_id}"
        )
    entry["scope_notes"] = normalized


SUPERSEDE_QA_WRITER = "supersede-qa"


def _cells_referencing(state: dict, qa_id: str) -> list[tuple[str, str]]:
    """qa_id を `qa_ref` または `qa_refs` のどちらかで引いているセルを列挙する。

    `_confirmed_cells_citing` は確定質疑 (`qa_ref`) しか見ない。**引かれている
    かどうか**を問うときに裏付け (`qa_refs`) を見落とすと、まだ生きている質疑を
    「誰も引いていない」と判定してしまう。
    """
    found: list[tuple[str, str]] = []
    for category, row in (state.get("matrix") or {}).items():
        if not isinstance(row, dict):
            continue
        for platform, cell in row.items():
            if not isinstance(cell, dict):
                continue
            refs = [cell.get("qa_ref")] + list(cell.get("qa_refs") or [])
            if qa_id in refs:
                found.append((category, platform))
    return sorted(found)


def qa_orphans(state: dict) -> list[str]:
    """どのセルからも引かれておらず、後継の申告も無い質疑の id 一覧。

    **孤立そのものは罪ではない。黙って孤立していることが罪である。**
    質疑を作り直したとき (v1 → v2)、古い方は誰からも引かれなくなる。それは
    正しい。ところが正本にはそれを言う欄が無かったので、機械には「置き換えた
    のか、接地を忘れたのか」が区別できず、監査は毎回同じ 2 件を欠陥として
    報告し続けた (実測 2026-08-25: `qa-uiux-web-seo-ai-search` /
    `qa-frontend-web-seo-ai-search`)。**禁じるのではなく、名乗らせる。**
    """
    orphans: list[str] = []
    for entry in state.get("qa_log") or []:
        if not isinstance(entry, dict):
            continue
        qa_id = entry.get("id")
        if not isinstance(qa_id, str) or not qa_id:
            continue
        if entry.get("superseded_by"):
            continue
        if not _cells_referencing(state, qa_id):
            orphans.append(qa_id)
    return orphans


def supersede_qa(state: dict, qa_id: str, by: object) -> None:
    """古い質疑に後継を申告させる。本文には触れない。

    条件を 3 つ置く。どれも「申告を、事実を消す道具にしない」ためである。
      - 後継が qa_log に実在すること (存在しない id への逃がしを許さない)
      - 自分自身を後継にできないこと
      - **まだセルから引かれている質疑は封じられないこと** — 引かれている
        ものを superseded にすると、確定セルの根拠が黙って死ぬ
    再適用は同じ後継なら通し、違う後継なら拒む (`set_qa_scope_notes` の流儀)。
    """
    if not isinstance(qa_id, str) or not qa_id.strip():
        raise TransitionError(f"{SUPERSEDE_QA_WRITER}: qa_id は非空文字列必須")
    if not isinstance(by, str) or not by.strip():
        raise TransitionError(f"{SUPERSEDE_QA_WRITER}: --by は非空文字列必須")
    qa_id, by = qa_id.strip(), by.strip()
    if qa_id == by:
        raise TransitionError(f"{SUPERSEDE_QA_WRITER}: 自分自身を後継にはできない: {qa_id}")
    log = state.get("qa_log") or []
    entry = next((c for c in log if isinstance(c, dict) and c.get("id") == qa_id), None)
    if entry is None:
        raise TransitionError(f"{SUPERSEDE_QA_WRITER}: qa_log に存在しない qa_id: {qa_id}")
    if not any(isinstance(c, dict) and c.get("id") == by for c in log):
        raise TransitionError(f"{SUPERSEDE_QA_WRITER}: 後継 {by} が qa_log に不在")
    citing = _cells_referencing(state, qa_id)
    if citing:
        cells = ", ".join(f"{cat}/{pf}" for cat, pf in citing)
        raise TransitionError(
            f"{SUPERSEDE_QA_WRITER}: {qa_id} はまだセルから引かれている ({cells})。"
            "先に正規 writer でセルの参照を後継へ移すこと"
        )
    existing = entry.get("superseded_by")
    if existing is not None and existing != by:
        raise TransitionError(
            f"{SUPERSEDE_QA_WRITER}: 既存 superseded_by={existing!r} と異なる再適用は拒否: {qa_id}"
        )
    entry["superseded_by"] = by


SPLIT_BUNDLE_WRITER = "split-qa-bundle"


def _answer_sections(answer: str) -> "dict[str, str]":
    """回答本文を `### ` 見出し単位へ割る。見出し行そのものを key にする。

    `scope_notes.topics[].answer_span` は見出し行を逐語で持っているので、
    ここで見出しを作り直さず、在る見出しをそのまま key にして突き合わせる。
    """
    sections: dict[str, str] = {}
    current: str | None = None
    buffer: list[str] = []
    for line in answer.split("\n"):
        if line.startswith("### "):
            if current is not None:
                sections[current] = "\n".join(buffer).strip()
            current = line.strip()
            buffer = []
        else:
            buffer.append(line)
    if current is not None:
        sections[current] = "\n".join(buffer).strip()
    return sections


def _verbatim_anchor(origin_id: str, answer: str, writer: str) -> str:
    """`answer` の中に逐語で 1 箇所だけ在る錨を取る (先頭の非空行)。

    **錨は本文から取る。呼び出し側から受け取らない。**受け取れると、本文に無い文字列を
    「ここが裏付けだ」と名乗れる。writer が実物から切り出して、1 箇所であることを
    確かめてから書くので、指し先の無い注記は原理的に書けない。

    塞げていないところ: 先頭行が定型文 (「現行構成で確定。…」) の entry が 3 件在り、
    錨だけでは entry を見分けられない。指し先は `(origin_qa_id, answer_span)` の対で
    決まるので鎖は切れないが、**錨単独では出典にならない**。
    """
    first = next((line.strip() for line in answer.split("\n") if line.strip()), "")
    if not first:
        raise TransitionError(f"{writer}: {origin_id} の answer が空で、錨を取れない")
    if answer.count(first) != 1:
        raise TransitionError(
            f"{writer}: {origin_id} の先頭行が本文に {answer.count(first)} 箇所在り、錨にならない: {first!r}"
        )
    return first


def _reanchor_topics(entries: dict, topics: list, writer: str) -> list:
    """指し先を失った `answer_span` を、`origin_qa_id` の本文へ張り直す。

    **束ねを解くと `answer_span` は指し先を失う。**束ねていた頃の span は
    束ね本文の `### 見出し` 行で、束ねを解くと見出しごと消えるためである
    (2026-08-21 実測: 18 論点中 16 件が 0 箇所)。節の中身は origin entry へ
    byte 一致のまま在るので、**指す先を「束ね本文」から「origin の本文」へ移す**。
    これで鎖は セル → 論点 → 実在する本文 に戻り、規則も 1 本になる——
    *`answer_span` は `origin_qa_id` の entry の本文に逐語で 1 箇所在る*。

    **解決している span は触らない。**触れると、この writer が「動いている指し先を
    別の場所へ移す道具」になる。直すのは壊れているものだけ。
    """
    changed: list[str] = []
    for index, topic in enumerate(topics):
        origin_id = topic.get("origin_qa_id")
        origin = entries.get(origin_id) if isinstance(origin_id, str) else None
        if origin is None:
            raise TransitionError(f"{writer}: topics[{index}].origin_qa_id が qa_log に無い: {origin_id!r}")
        answer = origin.get("answer") or ""
        span = topic.get("answer_span") or ""
        if span and answer.count(span) == 1:
            continue  # すでに解決している。動かさない。
        anchor = _verbatim_anchor(origin_id, answer, writer)
        # 消える見出し行は出典 (`docs/spec/03-…§5`) を持っていた。捨てずに残す。
        if span and "released_section_heading" not in topic:
            topic["released_section_heading"] = span
        topic["answer_span"] = anchor
        changed.append(topic.get("topic_id") or origin_id)
    return changed


def _application_key(application: dict) -> tuple:
    """design_application の同一性キー。全欄を使う (一部だけだと別物が同じに見える)。"""
    return (
        application.get("knowledge_ref"),
        application.get("principle"),
        application.get("applicability"),
        application.get("rationale"),
        tuple(application.get("tradeoffs") or []),
    )


def split_qa_bundle(state: dict, qa_id: str) -> None:
    """束ねた qa entry を論点ごとに解く。**取り込み元が実在し同一のときだけ。**

    束ねが生まれた理由は `bundling_reason` に逐語で残っている —
    「qa_ref は 1 件しか持てないため (決定論ゲートが文字列で照合する)」。
    セルが複数の裏付けを引けなかったので、本文の側を 1 件へ寄せていた。
    `qa_refs[]` でセルが複数引けるようになったので、寄せる必要が無くなった。

    **本文を削るのは、削るものが他所に byte 単位で在るときだけである。**
    取り込まれた節は取り込み元 entry の `answer` と完全一致していなければならず、
    1 文字でも違えば「取り込みではなく編集」なので拒否する。ここを緩めると、
    束ねを解く操作が本文を失う操作になる。同じ理由で design_applications も
    取り込み元が持っているものだけを外す。

    **何を削るかは引数で受け取らない。**`scope_notes.topics` と取り込み元 entry を
    writer が自分で引く。渡せると、渡す側がどの節を「取り込みだった」と名乗るか
    選べてしまい、自分の本文を他所のせいにして消せる。
    """
    if not isinstance(qa_id, str) or not qa_id.strip():
        raise TransitionError(f"{SPLIT_BUNDLE_WRITER}: qa_id は非空文字列必須")
    qa_id = qa_id.strip()
    entries = {
        candidate["id"]: candidate
        for candidate in state.get("qa_log", [])
        if isinstance(candidate, dict) and isinstance(candidate.get("id"), str)
    }
    entry = entries.get(qa_id)
    if entry is None:
        raise TransitionError(f"{SPLIT_BUNDLE_WRITER}: qa_log に存在しない qa_id: {qa_id}")

    notes = entry.get("scope_notes")
    if not isinstance(notes, dict) or not notes.get("bundled"):
        raise TransitionError(
            f"{SPLIT_BUNDLE_WRITER}: {qa_id} は scope_notes.bundled=true でない "
            "(束ねていない entry を解くことはできない)"
        )
    topics = notes.get("topics")
    if not isinstance(topics, list) or not topics:
        raise TransitionError(f"{SPLIT_BUNDLE_WRITER}: {qa_id} の scope_notes.topics が非空配列でない")

    sections = _answer_sections(entry.get("answer") or "")
    own_span: str | None = None
    absorbed: list[str] = []
    for index, topic in enumerate(topics):
        if not isinstance(topic, dict):
            raise TransitionError(f"{SPLIT_BUNDLE_WRITER}: topics[{index}] が object でない")
        origin_id = topic.get("origin_qa_id")
        span = (topic.get("answer_span") or "").strip()
        if not isinstance(origin_id, str) or not origin_id:
            raise TransitionError(f"{SPLIT_BUNDLE_WRITER}: topics[{index}].origin_qa_id が非空文字列でない")
        if span not in sections:
            raise TransitionError(
                f"{SPLIT_BUNDLE_WRITER}: topics[{index}].answer_span が本文に見つからない: {span!r}"
            )
        if origin_id == qa_id:
            if own_span is not None:
                raise TransitionError(f"{SPLIT_BUNDLE_WRITER}: {qa_id} 自身の節が 2 つ在る")
            own_span = span
            continue
        origin = entries.get(origin_id)
        if origin is None:
            raise TransitionError(
                f"{SPLIT_BUNDLE_WRITER}: 取り込み元 {origin_id} が qa_log に無い "
                "(本文を削ると内容が失われるため解けない)"
            )
        if sections[span] != (origin.get("answer") or "").strip():
            raise TransitionError(
                f"{SPLIT_BUNDLE_WRITER}: 節 {span!r} が取り込み元 {origin_id} の回答と一致しない "
                "(取り込みではなく編集された本文なので、削ると内容が失われる)"
            )
        absorbed.append(origin_id)

    if own_span is None:
        raise TransitionError(
            f"{SPLIT_BUNDLE_WRITER}: {qa_id} 自身を origin とする topic が無い "
            "(自分の節が特定できないと、何を残すか決められない)"
        )
    if not absorbed:
        raise TransitionError(f"{SPLIT_BUNDLE_WRITER}: {qa_id} に取り込まれた他 entry の節が無い")

    # 取り込み元が持つ設計適用だけを外す。自分の設計適用と同一内容のものは
    # どちらの由来か決められないので**残す** (消す側へ倒すと自分の記録が消える)。
    foreign: set[tuple] = set()
    for origin_id in absorbed:
        for application in entries[origin_id].get("design_applications", []) or []:
            if isinstance(application, dict):
                foreign.add(_application_key(application))
    kept = [
        application
        for application in entry.get("design_applications", []) or []
        if _application_key(application) not in foreign
    ]
    if not kept:
        raise TransitionError(
            f"{SPLIT_BUNDLE_WRITER}: {qa_id} の design_applications が全て取り込み元由来になる "
            "(自分の設計適用が残らない entry は解けない)"
        )

    entry["answer"] = sections[own_span]
    entry["design_applications"] = kept
    # 本文を縮めた**直後に**指し先を張り直す。ここを別便へ回すと、その間の
    # spec-state は「セルが引く論点の本文が何処にも無い」状態で出荷される
    # (2026-08-21 に実際そうなった)。縮めると壊れるものは、縮めた者が直す。
    _reanchor_topics(entries, topics, SPLIT_BUNDLE_WRITER)
    notes["bundled"] = False
    notes["split_with"] = SPLIT_BUNDLE_WRITER
    notes["split_on"] = datetime.date.today().isoformat()
    notes["absorbed_origins_released"] = sorted(absorbed)
    notes["bundling_reason"] = (
        "**この束ねは解消済みである。**束ねの理由は「qa_ref が 1 件しか持てない」ことだった。"
        "セルが qa_refs[] で複数の裏付けを引けるようになったので、本文を 1 件へ寄せる必要が"
        "無くなり、取り込んでいた節を外した。外した節は取り込み元 entry ("
        + ", ".join(sorted(absorbed))
        + ") に byte 単位で同一のまま在り、writer が一致を確かめてから外している。"
        "下の topics は、どの節がどの entry へ戻ったかの対応として残してある。"
    )

    # 裏付けの範囲はセル側の qa_refs[] へ移す。**引数で受け取らず topics から導く。**
    for category, platform in _confirmed_cells_citing(state, qa_id):
        cell = state["matrix"][category][platform]
        refs = [qa_id] + [origin for origin in sorted(absorbed)]
        existing = cell.get("qa_refs")
        if existing is not None and existing != refs:
            raise TransitionError(
                f"{SPLIT_BUNDLE_WRITER}: 既存 qa_refs と異なる内容の再適用は拒否: {category}/{platform}"
            )
        cell["qa_refs"] = refs


REANCHOR_WRITER = "reanchor-split-scope-notes"


def reanchor_split_scope_notes(state: dict, qa_id: str) -> None:
    """束ね解除で指し先を失った `scope_notes.topics[].answer_span` を張り直す。

    直す操作もまた writer を通す。手で JSON を書くと、本文に無い文字列を span に
    名乗れてしまい、**壊れた鎖を「直した」と書くだけ**になる。この writer は錨を
    `origin_qa_id` の本文から切り出すので、実在しない指し先は書けない。

    解決している span には触らない (`_reanchor_topics` 参照)。よって
    2 度目の実行は何も変えず、動いている指し先を移す道具にもならない。
    """
    if not isinstance(qa_id, str) or not qa_id.strip():
        raise TransitionError(f"{REANCHOR_WRITER}: qa_id は非空文字列必須")
    qa_id = qa_id.strip()
    entries = {
        candidate["id"]: candidate
        for candidate in state.get("qa_log", [])
        if isinstance(candidate, dict) and isinstance(candidate.get("id"), str)
    }
    entry = entries.get(qa_id)
    if entry is None:
        raise TransitionError(f"{REANCHOR_WRITER}: qa_log に存在しない qa_id: {qa_id}")
    notes = entry.get("scope_notes")
    if not isinstance(notes, dict):
        raise TransitionError(f"{REANCHOR_WRITER}: {qa_id} に scope_notes が無い")
    topics = notes.get("topics")
    if not isinstance(topics, list) or not topics:
        raise TransitionError(f"{REANCHOR_WRITER}: {qa_id} の scope_notes.topics が非空配列でない")

    changed = _reanchor_topics(entries, topics, REANCHOR_WRITER)
    if not changed:
        return
    notes["reanchored_with"] = REANCHOR_WRITER
    notes["reanchored_on"] = datetime.date.today().isoformat()


REQUOTE_WRITER = "requote-written-source"

_BLOCK_QUOTE_RE = re.compile(r"^>\s*")


def undecorate_line(line: str) -> str:
    """行頭の markdown 引用ブロック記号 (`> `) を落とす。

    **落として良い記号と、落としてはいけない文字の境目**: ここで落とすのは
    「その行が引用ブロックに属する」という**文書の組版**だけである。表の区切り (`|`)
    や箇条の印 (`- `) は落とさない——落とすと、列を削った行や項目を削った行が
    一致してしまい、切り詰めを通す穴になる。`> ` は行の中身を 1 文字も変えないので、
    落としても引用の同一性は保たれる。

    2026-08-21 実測: この正規化で逐語でない entry が 9 件から 6 件へ減った。減った
    3 件 (`qa-foundation-u1` / `u3` / `u4`) は**元から文書の文と 1 字も違わず**、
    行頭の `> ` だけが差だった。**数が減ったのは直したからではなく、
    数え方が間違っていたからである。**
    """
    return _BLOCK_QUOTE_RE.sub("", line)


_TABLE_ROW_RE = re.compile(r"^\|\s*([^|]+?)\s*\|")
_BULLET_ID_RE = re.compile(r"^([-*]\s+\*\*[^*]+\*\*\s*[:：])")


def logical_document_lines(document: str) -> "list[str]":
    """文書を「論理行」へ畳む。**折り返しの続き行を、前の行へ繋ぎ直す。**

    markdown の箇条は 1 つの項目が複数の物理行へ折り返して書かれる:

        - **FB-AC-09**: 画面の写しが**完全でないことがある**ため、
          「この画面には…」を常に表示し、
          プレビューを見てから送る。完全性を保証しない。

    引用する側は 1 行に繋いで持つので、物理行のまま突き合わせると
    **項目の 1 行目しか一致せず、残りを落とした引用が「文書どおり」に見える。**
    実際に 2026-08-21 の試走でここを踏み、FB-AC-09 と FB-AC-10 が途中で切れた形へ
    置き換わりかけた。**要件の文を静かに削る事故**なので、畳んでから突き合わせる。

    続き行の判定は字下げで行う (先頭が空白で始まり、中身が空でない行)。日本語には
    語間の空白が無いので、繋ぐときに区切りを入れない。
    """
    logical: list[str] = []
    for raw in document.split("\n"):
        stripped = raw.strip()
        if not stripped:
            continue
        if logical and raw[:1].isspace():
            logical[-1] += stripped
            continue
        logical.append(stripped)
    return logical


def quotation_anchor(line: str) -> "str | None":
    """引用行を文書の中で一意に指すための「頭」を、行の形から決める。

    **引数で錨を受け取らない**ので、呼ぶ側が「どの文書行を引いたことにするか」を
    選べない。形は 2 つだけ認める:

    - 表の行 `| 先頭セル | …` → `| 先頭セル |` まで
    - 番号付きの箇条 `- **FB-AC-07**: …` → `- **FB-AC-07**:` まで

    どちらでもない行は `None` を返し、直す側は止まる。**自由文を「だいたい似ている
    行」へ寄せると、引用のふりをした書き換えになる。**似ている度合いで選ばない理由が
    これで、閾値を持たないのは仕様である。
    """
    table = _TABLE_ROW_RE.match(line)
    if table:
        return f"| {table.group(1)} |"
    bullet = _BULLET_ID_RE.match(line)
    if bullet:
        return bullet.group(1)
    return None


def requote_written_source(state: dict, qa_id: str) -> "list[str]":
    """文書と食い違った引用行を、**文書の側の行で置き換える。**

    `reseal_written_source` が止めた 3 entry を実際に調べたところ、食い違いは
    2 方向あった (2026-08-21 実測):

    - 表の列が落ちていた (`**手動のみ**（定例なし。打つ場面は下）` → `**手動のみ**`、
      末尾 1 列まるごと消失)
    - 文書に無い 1 文が足されていた (`…確認できる。` → `…確認できる。隠さない。`)

    **どちらへ直すかは決まっている。**この entry は `kind=written-requirements`、
    つまり「文書にこう書いてある」という主張である。食い違ったとき正しいのは文書で、
    state は引用に過ぎない。だから state を文書へ合わせる。逆向き (文書を state へ
    合わせる) は、引用を根拠にして要件そのものを書き換えることになる。

    錨は `quotation_anchor` が行の形から決め、その錨で始まる文書行が**ちょうど 1 行**の
    ときだけ置き換える。0 行なら引用元を失っている、2 行以上ならどれか選べない——
    どちらも書かずに止める。

    塞げていないところ: 錨が一致していても、**その行が回答の主旨と同じことを言って
    いるか**は確かめられない。文書側が意味ごと書き換わった場合、この writer は
    黙って新しい文へ差し替える。差分は commit に残るので、読む側が見る前提である。
    """
    if not isinstance(qa_id, str) or not qa_id.strip():
        raise TransitionError(f"{REQUOTE_WRITER}: qa_id は非空文字列必須")
    qa_id = qa_id.strip()
    entry = next(
        (candidate for candidate in state.get("qa_log", []) if candidate.get("id") == qa_id),
        None,
    )
    if entry is None:
        raise TransitionError(f"{REQUOTE_WRITER}: qa_log に存在しない qa_id: {qa_id}")
    source = entry.get("source")
    if not isinstance(source, dict) or source.get("kind") != "written-requirements":
        raise TransitionError(f"{REQUOTE_WRITER}: {qa_id} は source.kind=written-requirements でない")
    path = source.get("path")
    if not isinstance(path, str) or not path.strip():
        raise TransitionError(f"{REQUOTE_WRITER}: {qa_id} の source.path が非空文字列でない")
    target = Path(path.strip())
    if not target.is_file():
        raise TransitionError(f"{REQUOTE_WRITER}: {qa_id} の source.path が実在しない: {path}")

    document = target.read_text(encoding="utf-8")
    doc_lines = logical_document_lines(document)
    quoted = {undecorate_line(line) for line in doc_lines}
    repaired: list[str] = []
    out: list[str] = []
    # **引用する側も同じ関数で畳み、同じ正規化を通してから見る。**折り返しの位置や
    # 行頭の `> ` が違うだけの行を「文書に無い」と読むと、直す必要の無いものを
    # 書き換えてしまう。ここは `unquoted_answer_lines` と同じ判定でなければならない
    # ——片方だけ緩いと、「照合は通るのに requote が書き換える」形になる。
    for stripped in logical_document_lines(entry.get("answer") or ""):
        if undecorate_line(stripped) in quoted:
            out.append(stripped)
            continue
        anchor = quotation_anchor(stripped)
        if anchor is None:
            raise TransitionError(
                f"{REQUOTE_WRITER}: {qa_id} の次の行は表の行でも番号付き箇条でもなく、"
                f"文書の何処を引いたのか決められない: {stripped[:80]!r}"
            )
        candidates = [candidate for candidate in doc_lines if candidate.startswith(anchor)]
        if len(candidates) != 1:
            raise TransitionError(
                f"{REQUOTE_WRITER}: {qa_id} の錨 {anchor!r} で始まる行が {path} に "
                f"{len(candidates)} 行ある (1 行でなければ、どれを引いたか決められない)"
            )
        out.append(candidates[0])
        repaired.append(anchor)

    if not repaired:
        return []
    entry["answer"] = "\n".join(out)
    source["requoted_with"] = REQUOTE_WRITER
    source["requoted_on"] = datetime.date.today().isoformat()
    return repaired


REQUOTE_SECTION_WRITER = "requote-written-section"

_SECTION_REF_RE = re.compile(r"^§\s*(\d+)\s+(\S.*)$")
_HEADING_RE = re.compile(r"^(#+)\s*(.*?)\s*$")


def resolve_declared_section(document: str, section: str) -> "tuple[int, int]":
    """entry が名乗る `source.section` を、文書の見出し 1 つへ解決して範囲を返す。

    **錨を引数で受け取らないのは行単位の requote と同じ。**呼ぶ側は「どの節を引いた
    ことにするか」を選べない——`source.section` は entry 自身が既に名乗っている値で、
    ここで新たに決めるものではない。

    認めるのは `§<数字> <題>` の形だけで、`§2.1` や `§2.2-2.3` のような枝番・範囲は
    解決しない (`§3 … / §4 …` のような複数指定も同じ)。**節が 1 つに決まらないなら、
    どこを引き直すのかも決まらない。**見出しは `^#+ <数字>. <題>$` にちょうど 1 行
    一致することを要求し、0 行でも 2 行以上でも書かずに止める。

    返すのは `(見出しの行番号, 節の終わり)` で、終わりは**同じ深さ以下の次の見出し**の
    直前。深い見出し (`###`) は節の中身なので含める。
    """
    ref = _SECTION_REF_RE.match(section.strip())
    if ref is None:
        raise TransitionError(
            f"{REQUOTE_SECTION_WRITER}: source.section {section!r} は "
            "`§<数字> <題>` の形でないので、文書のどの節かを決められない"
        )
    number, title = ref.group(1), ref.group(2)
    wanted = re.compile(rf"^(#+)\s*{re.escape(number)}\.\s*{re.escape(title)}\s*$")
    lines = document.split("\n")
    hits = [index for index, line in enumerate(lines) if wanted.match(line)]
    if len(hits) != 1:
        raise TransitionError(
            f"{REQUOTE_SECTION_WRITER}: {section!r} に一致する見出しが "
            f"{len(hits)} 行ある (1 行でなければ、どの節を引いたか決められない)"
        )
    start = hits[0]
    depth = len(wanted.match(lines[start]).group(1))
    end = len(lines)
    for index in range(start + 1, len(lines)):
        heading = _HEADING_RE.match(lines[index])
        if heading and heading.group(1) and len(heading.group(1)) <= depth:
            end = index
            break
    return start, end


def requote_written_section(state: dict, qa_id: str) -> bool:
    """節ごと書き換わった引用を、**その entry が名乗る節の現在の本文で置き換える。**

    行単位の `requote_written_source` が使えない形がある (2026-08-21 実測):
    `qa-database-web-analytics` の引く `§5` は、`date:` が `business_date:` へ、
    `revenue_pending: number` が `decimal` へ変わり、`成果の状態変化…` の 1 項目は
    **文書から消えていた。**消えた行に対応する文書行は無いので、錨で 1 対 1 に
    引き直すことができない。**節が版ごと書き換わったのであって、行が動いたのではない。**

    向きは行単位のときと同じ: `kind=written-requirements` は「文書にこう書いてある」と
    いう主張なので、食い違ったら正しいのは文書で、state を文書へ合わせる。

    **行単位より危ない。**回答まるごとを差し替えるので、回答に引用でない文
    (書いた人の補足) が混ざっていれば、それも消える。だから下の門で拒否する。
    """
    if not isinstance(qa_id, str) or not qa_id.strip():
        raise TransitionError(f"{REQUOTE_SECTION_WRITER}: qa_id は非空文字列必須")
    qa_id = qa_id.strip()
    entry = next(
        (candidate for candidate in state.get("qa_log", []) if candidate.get("id") == qa_id),
        None,
    )
    if entry is None:
        raise TransitionError(f"{REQUOTE_SECTION_WRITER}: qa_log に存在しない qa_id: {qa_id}")
    source = entry.get("source")
    if not isinstance(source, dict) or source.get("kind") != "written-requirements":
        raise TransitionError(
            f"{REQUOTE_SECTION_WRITER}: {qa_id} は source.kind=written-requirements でない"
        )
    path = source.get("path")
    if not isinstance(path, str) or not path.strip():
        raise TransitionError(f"{REQUOTE_SECTION_WRITER}: {qa_id} の source.path が非空文字列でない")
    target = Path(path.strip())
    if not target.is_file():
        raise TransitionError(f"{REQUOTE_SECTION_WRITER}: {qa_id} の source.path が実在しない: {path}")
    section = source.get("section")
    if not isinstance(section, str) or not section.strip():
        raise TransitionError(
            f"{REQUOTE_SECTION_WRITER}: {qa_id} は source.section を名乗っていないので、"
            "引き直す節を決められない"
        )

    document = target.read_text(encoding="utf-8")
    start, end = resolve_declared_section(document, section)
    body = "\n".join(document.split("\n")[start:end]).strip("\n")

    old_lines = logical_document_lines(entry.get("answer") or "")
    section_quoted = {undecorate_line(line) for line in logical_document_lines(body)}
    # 節の外から引いている行 = 差し替えると行き先を失う行。
    outside = [line for line in old_lines if undecorate_line(line) not in section_quoted]

    # TODO(human): 節ごとの差し替えを拒否する条件をここに書く。
    # 満たさないときは TransitionError を投げ、満たすときは何もせず下へ抜ける。
    # 使える材料: old_lines (差し替え前の論理行) / outside (節の外から引いている行) /
    #             section_quoted (節の中にある行の集合) / qa_id / section

    if body == (entry.get("answer") or "").strip("\n"):
        return False
    entry["answer"] = body
    source["requoted_with"] = REQUOTE_SECTION_WRITER
    source["requoted_on"] = datetime.date.today().isoformat()
    return True


RESEAL_WRITER = "reseal-written-source"


def unquoted_answer_lines(answer: str, document: str) -> "list[str]":
    """`answer` の非空行のうち、`document` に逐語で無い行を返す。

    **行単位で見る理由**: `written-requirements` の回答は、文書の表から必要な行だけを
    抜き出した「抜粋」であることが多く、続きの本文とは連続していない。回答全体を
    文書へ逐語照合すると、正しい抜粋まで落ちる (2026-08-21 実測: 7 entry すべてで
    回答全体は 0 箇所)。行単位なら、抜き出しは通り、**書き換えは通らない。**

    **「文書の何処かに含まれていれば良い」では足りない。**表の行は列を末尾から削っても
    元の行の**前方一致部分**なので、`line in document` は真のまま通る。実際 2026-08-21 に
    この緩い形で `| 1 速い門 | push / PR | 5 分 | **止める** |` が通り、文書側に在る
    末尾 1 列 (`型検査 / 書き方 / …`) を落とした引用が「文書どおり」として封をされた。
    だから**畳んだ論理行との完全一致**だけを認める。部分一致は引用ではない。

    **畳むのは文書側だけでは足りない。**引用する側も、文書と同じ折り返しのまま
    持っていることがある (2026-08-21: `qa-security-web-spec-intake` がそうだった)。
    片側だけ畳むと、**中身は完全に同じなのに一致しない**。両側を同じ関数で畳む。

    **体裁の記号は中身ではない。**markdown の引用ブロック (`> `) は文書側の飾りで、
    引く側がそれを落として持つのは書き換えではない。ここを見落として 2026-08-21 に
    `qa-foundation-u1` / `u3` / `u4` を「別の文へ言い換えた要約」と誤判定した。実際は
    3 件とも文書の文と 1 字も違わず、違いは行頭の `> ` だけだった。**誤判定のまま
    直す側へ回れば、文書の原文を要約で上書きしていた。**部分一致・折り返しに続いて
    同じ形で 3 度踏んでいる——**体裁の正規化を済ませてから完全一致を見る。**

    正規化を足しても切り詰めは通らない: `> ` を落とした**残り全体**の完全一致を
    要求するので、末尾の列を削った行は依然として一致しない。
    """
    quoted = {undecorate_line(line) for line in logical_document_lines(document)}
    return [
        line
        for line in logical_document_lines(answer)
        if undecorate_line(line) not in quoted
    ]


def reseal_written_source(state: dict, qa_id: str) -> None:
    """`written-requirements` entry の `source.sha256` を、**本文を確かめてから**取り直す。

    2026-08-21 の回帰: `split-qa-bundle` が answer を縮めたのに digest を取り直さず、
    確定 8 セル中 6 セルの一次根拠で `source.sha256 != sha256(answer)` になった。

    **ただし取り直すだけでは直したことにならない。**この欄の digest は
    `sha256(answer)`、つまり **answer 自身の指紋**である。answer から作る値なので、
    answer を何に書き換えても取り直せば一致する。**「文書にそう書いてある」ことを
    1 mm も示していない。**実測でも、束ね解除の前から回答は文書に逐語で在らず
    (7/7 entry で 0 箇所)、それでも digest は全件一致していた。

    そこでこの writer は、取り直す前に **answer の非空行が 1 行残らず `source.path` の
    文書に逐語で在ること**を確かめる。1 行でも無ければ書かずに止める。これで
    「文書に無い文を requirements として封をする」道が閉じる。実際、この検査を入れた
    時点で 3 entry が止まった (削られた表の列、足された 1 文)。**止まったことが、
    この検査が飾りでない証拠である。**

    `source.path` は引数で受け取らない。digest も受け取らない。どちらも受け取れると、
    呼ぶ側が「どの文書を根拠と名乗るか」「どんな指紋を名乗るか」を選べてしまう。

    塞げていないところ: 逐語で在ることは示せても、**その行が回答の主旨を支えているか**は
    機械層で確かめられない。文書中の無関係な行を並べても通る。
    """
    if not isinstance(qa_id, str) or not qa_id.strip():
        raise TransitionError(f"{RESEAL_WRITER}: qa_id は非空文字列必須")
    qa_id = qa_id.strip()
    entry = next(
        (candidate for candidate in state.get("qa_log", []) if candidate.get("id") == qa_id),
        None,
    )
    if entry is None:
        raise TransitionError(f"{RESEAL_WRITER}: qa_log に存在しない qa_id: {qa_id}")
    source = entry.get("source")
    if not isinstance(source, dict) or source.get("kind") != "written-requirements":
        raise TransitionError(
            f"{RESEAL_WRITER}: {qa_id} は source.kind=written-requirements でない "
            "(対話で聞いた entry に文書の封をしない)"
        )
    path = source.get("path")
    if not isinstance(path, str) or not path.strip():
        raise TransitionError(f"{RESEAL_WRITER}: {qa_id} の source.path が非空文字列でない")
    target = Path(path.strip())
    if not target.is_file():
        raise TransitionError(f"{RESEAL_WRITER}: {qa_id} の source.path が実在しない: {path}")

    answer = entry.get("answer") or ""
    if not answer.strip():
        raise TransitionError(f"{RESEAL_WRITER}: {qa_id} の answer が空で、封をする中身が無い")
    document = target.read_text(encoding="utf-8")
    missing = unquoted_answer_lines(answer, document)
    if missing:
        raise TransitionError(
            f"{RESEAL_WRITER}: {qa_id} の回答に、{path} へ逐語で無い行が {len(missing)} 行ある。"
            "指紋を取り直す前に、回答を文書どおりへ戻すこと: "
            + " / ".join(line[:60] for line in missing[:3])
        )

    digest = hashlib.sha256(answer.encode("utf-8")).hexdigest()
    if source.get("sha256") == digest:
        return  # すでに合っている。触らない (2 度目の実行は何も変えない)。
    source["sha256"] = digest
    source["resealed_with"] = RESEAL_WRITER
    source["resealed_on"] = datetime.date.today().isoformat()


WRITTEN_UP_WRITER = "set-qa-written-up"


def set_qa_written_up(state: dict, qa_id: str, path: object, section: object = None) -> None:
    """対話で聞いた内容を文書へ書き起こした事実を、**追記**として残す。

    **`source` は書き換えない。**対話で聞いた事実を後から「文書に書いてあった」ことに
    するのは偽造で、entry を分割して聞いていない質問を作るのと同じ構造である。実際に
    起きたことは 2 つ — 対話で聞いた (source) / それを文書へ書き起こした (written_up) —
    なので、2 つとも残す。この欄が在っても `source.kind` は永久に `user-dialogue` のまま。

    **sha256 は呼び出し側から受け取らない。**受け取ると、書き起こしていない内容の指紋を
    名乗れる。writer が実ファイルを読んで計算する。日付も writer が付ける。

    塞げていないところ: 指紋は「その時点でそのファイルがそう在った」ことしか示さない。
    **その節に本当にこの問答の内容が書かれているかは機械層で確かめられない。**
    """
    if not isinstance(qa_id, str) or not qa_id.strip():
        raise TransitionError(f"{WRITTEN_UP_WRITER}: qa_id は非空文字列必須")
    qa_id = qa_id.strip()
    entry = next(
        (candidate for candidate in state.get("qa_log", []) if candidate.get("id") == qa_id),
        None,
    )
    if entry is None:
        raise TransitionError(f"{WRITTEN_UP_WRITER}: qa_log に存在しない qa_id: {qa_id}")
    if not isinstance(path, str) or not path.strip():
        raise TransitionError(f"{WRITTEN_UP_WRITER}: path は非空文字列必須")
    path = path.strip()
    target = Path(path)
    if not target.is_file():
        raise TransitionError(f"{WRITTEN_UP_WRITER}: 書き起こし先が実在しない: {path}")
    record = {
        "path": path,
        "sha256": hashlib.sha256(target.read_bytes()).hexdigest(),
        "recorded_on": datetime.date.today().isoformat(),
        "recorded_with": WRITTEN_UP_WRITER,
    }
    if section is not None:
        if not isinstance(section, str) or not section.strip():
            raise TransitionError(f"{WRITTEN_UP_WRITER}: section を渡すなら非空文字列必須")
        record["section"] = section.strip()
    existing = entry.get("written_up")
    if existing is None:
        # 追記専用。空配列では作らない (「一度も書き起こしていない」と同じ姿にしない)。
        entry["written_up"] = [record]
        return
    if not isinstance(existing, list) or not existing:
        raise TransitionError(
            f"{WRITTEN_UP_WRITER}: 既存 written_up が非空配列でない: {qa_id}"
        )
    for previous in existing:
        if not isinstance(previous, dict):
            continue
        if (
            previous.get("path") == record["path"]
            and previous.get("section") == record.get("section")
            and previous.get("sha256") == record["sha256"]
        ):
            raise TransitionError(
                f"{WRITTEN_UP_WRITER}: 同じ path・section・sha256 の記録が既に在る: {qa_id} ({path})"
            )
    existing.append(record)


ASKS_FOR_CONTRACT_VERSION = "1.0"
ASKS_FOR_WRITER = "asks-for"
# legacy 除外の上限。2026-08-20 実測: 正本 `system-spec/spec-state.json` の qa_log は
# 30 entry で、`asks_for` を持つものは 0 件 (分母 30 = qa_log entry 数)。
#
# **上限より先に効かせるのは id の集合のほうである。**件数だけを縛ると、古い id を
# 外して新しい id を入れる入れ替えが通り、除外枠が無期限に生き続ける。だから
# `enable_asks_for_contract` は「有効化の時点で qa_log に実在する id」しか legacy に
# 登録させない。未来の id を先に登録する道をそこで閉じる。
# 以後この値は下げる方向にしか動かさない (30 -> 29 は可、30 -> 31 は不可)。
ASKS_FOR_LEGACY_MAX = 30
U_ITEM_RE = re.compile(r"^U[1-9]$")


def normalize_asks_for(raw: object, state: dict, where: str) -> list[dict]:
    """質問が狙った対象 (セル / U 欄) を正規化する。

    これは **軸2 (誘導質問) の束ねを外から測るための分母**である。論点そのものは
    質問文の中にしか無く、名乗りを突き合わせる相手がいない。狙った対象なら質問の
    外側に置けるので、後から `asks_for` に無いセルが同じ qa を引いて確定した場合に
    「狙っていなかった論点を同じ問答で確定させた」が差として現れる。
    """
    if not isinstance(raw, list) or not raw:
        raise TransitionError(f"{where} は非空配列必須")
    known_categories = {
        category.get("id") for category in state.get("categories", []) if isinstance(category, dict)
    }
    normalized: list[dict] = []
    seen: set[tuple] = set()
    for index, item in enumerate(raw):
        label = f"{where}[{index}]"
        if not isinstance(item, dict):
            raise TransitionError(f"{label} は object 必須")
        if "u" in item:
            u_item = item.get("u")
            if not isinstance(u_item, str) or not U_ITEM_RE.match(u_item.strip()):
                raise TransitionError(f"{label}.u は U1〜U9 必須")
            key = ("u", u_item.strip())
            entry = {"u": u_item.strip()}
        else:
            category = item.get("category")
            platform = item.get("platform")
            if not isinstance(category, str) or category.strip() not in known_categories:
                raise TransitionError(
                    f"{label}.category={category!r} は state の categories に実在しない"
                )
            if not isinstance(platform, str) or platform.strip() not in CANONICAL_PLATFORMS:
                raise TransitionError(f"{label}.platform={platform!r} は canonical platform 必須")
            key = ("cell", category.strip(), platform.strip())
            entry = {"category": category.strip(), "platform": platform.strip()}
        if key in seen:
            raise TransitionError(f"{label} が重複: {key}")
        seen.add(key)
        normalized.append(entry)
    return normalized


def enable_asks_for_contract(state: dict, legacy_ids: list[str]) -> None:
    """`asks_for` の必須化を有効にし、既存 entry だけを legacy として凍結する。

    **1 度しか呼べない。**再有効化を許すと legacy 集合を差し替えられる。
    """
    if state.get("asks_for_contract") is not None:
        raise TransitionError(f"{ASKS_FOR_WRITER}: asks_for_contract は再設定できない")
    if not isinstance(legacy_ids, list):
        raise TransitionError(f"{ASKS_FOR_WRITER}: legacy_ids は配列必須")
    existing = [entry.get("id") for entry in state.get("qa_log", [])]
    frozen: list[str] = []
    for qa_id in legacy_ids:
        if not isinstance(qa_id, str) or not qa_id.strip():
            raise TransitionError(f"{ASKS_FOR_WRITER}: legacy_ids の要素は非空文字列必須")
        qa_id = qa_id.strip()
        # 有効化の時点で実在しない id は登録できない。ここが入れ替えの防波堤で、
        # 上限 (件数) だけでは塞げない。
        if qa_id not in existing:
            raise TransitionError(
                f"{ASKS_FOR_WRITER}: legacy_ids={qa_id} は有効化時点の qa_log に実在しない"
            )
        if qa_id in frozen:
            raise TransitionError(f"{ASKS_FOR_WRITER}: legacy_ids が重複: {qa_id}")
        frozen.append(qa_id)
    if len(frozen) > ASKS_FOR_LEGACY_MAX:
        raise TransitionError(
            f"{ASKS_FOR_WRITER}: legacy 除外は {ASKS_FOR_LEGACY_MAX} 件までで、"
            f"{len(frozen)} 件は超過"
        )
    state["asks_for_contract"] = {
        "version": ASKS_FOR_CONTRACT_VERSION,
        "legacy_ids": sorted(frozen),
    }


def resolve_asks_for(state: dict, qa_id: str, raw: object) -> list[dict] | None:
    """新規 entry に載せる `asks_for` を決める。契約が無い state では従来どおり。"""
    contract = state.get("asks_for_contract")
    if raw is not None:
        return normalize_asks_for(raw, state, f"{ASKS_FOR_WRITER}: asks_for")
    if contract is None:
        return None
    # 契約が有効な state で `asks_for` を持たない新規 entry は **legacy ではなく違反**。
    # legacy は有効化時点で実在した id だけの集合であり、その id は has_entry で
    # 追記が止まるため、新規 entry が legacy に混ざる経路は無い。
    raise TransitionError(
        f"{ASKS_FOR_WRITER}: asks_for 必須 (契約 {contract.get('version')} 有効): {qa_id}"
    )


def asks_for_drift(state: dict, qa_id: str) -> list[tuple[str, str]] | None:
    """狙っていなかったのに、この qa を引いて確定したセルを返す。

    **束ねが後から発覚した形**であり、軸2 が名乗りに頼らず見られる差である。

    **戻り値は 3 種類ある。**`None` = 判定不能 (`asks_for` を持たない entry、または
    entry が無い)、`[]` = 狙いどおりで 0 件、非空 = 狙い外の確定。判定不能と 0 件を
    同じ `[]` で返すと、**呼び出し側が「調べたが無かった」と読める。**legacy entry は
    30 件あるので、その誤読は「束ねは無い」という結論を静かに作る。型で分けておけば、
    `if drift:` と書いた呼び出し側は判定不能を素通りさせるが、`is None` を書かねば
    ならない側は判定不能に気付く。
    """
    entry = next(
        (candidate for candidate in state.get("qa_log", []) if candidate.get("id") == qa_id),
        None,
    )
    if entry is None or not entry.get("asks_for"):
        return None
    intended = {
        (item["category"], item["platform"]) for item in entry["asks_for"] if "category" in item
    }
    return [cell for cell in _confirmed_cells_citing(state, qa_id) if cell not in intended]


def derive_aggregate(cells: list[str]) -> str:
    if not cells or all(state == "未収集" for state in cells):
        return "未着手"
    if all(state == "対象外" for state in cells):
        return "対象外"
    if any(state == "未収集" for state in cells):
        return "収集中"
    return "確定"


def _row_states(state: dict, category_id: str) -> list[str]:
    return [state["matrix"][category_id][platform]["state"] for platform in CANONICAL_PLATFORMS]


def recompute_aggregates(state: dict) -> None:
    state["category_aggregate"] = {
        category["id"]: derive_aggregate(_row_states(state, category["id"]))
        for category in state["categories"]
    }


def count_unresolved(state: dict) -> int:
    return sum(
        cell.get("state") == "未収集"
        for row in state.get("matrix", {}).values()
        for cell in row.values()
        if isinstance(cell, dict)
    )


# max_loops の性格。run_chunk は上限に達した時点で break するため、
# **この writer が loop_count を max_loops より上へ上げることはできない**。
# つまり上限は「目安」ではなく厳格である。
# 上限を超えた値が在れば、それは上限を緩めた証拠ではなく、この writer を
# 通っていない証拠になる。state から後者を読み取れるようにするのがこの定数の役目。
#
# ── 2026-08-20: 「置き直す」から「大きいほうを残す」へ ────────────────
#
# 以前ここには「loop_count を処理済み件数で**置き直す**ため」と書いてあった。
# 実際そう書かれていて、そこが壊れていた。既存値 7 の state に run_chunk を
# 1 件通すと 7 → 1 になり、**set_hearing_limit_policy が守っている痕跡を、
# 記録を書く道具のほうが消していた**（下の docstring「7 を 5 へ丸めれば数は
# 揃うが、揃えた瞬間に唯一の痕跡が消える」が、丸める側ではなく writer に
# よって実行されていた）。
#
# いまは `max(既存, 処理済み件数)` にしてある。**上へ動かす向きの変更ではない。**
# run_chunk が書き込む新しい値は依然 max_loops 以下で、超過値を新たに作ることは
# できない。変わったのは「既にあった超過値を消さない」ことだけである。
# したがって上の推論——超過値はこの writer の外から来た——は**そのまま成り立つ**。
# 「この writer を通った state は必ず上限以下」ではなく、
# 「この writer は上限超えを**生み出せない**」が正確な言い方であり、
# 痕跡の根拠として要るのは後者のほうである。
LOOP_LIMIT_POLICY_STRICT = "strict"
LOOP_LIMIT_POLICY_SOFT = "soft"
LOOP_LIMIT_POLICIES = (LOOP_LIMIT_POLICY_STRICT, LOOP_LIMIT_POLICY_SOFT)


def loop_limit_is_violated(progress: dict) -> bool:
    """hearing_progress が上限超過を抱えているか。"""
    loop_count = progress.get("loop_count")
    max_loops = progress.get("max_loops")
    if not isinstance(loop_count, int) or not isinstance(max_loops, int):
        return False
    return loop_count > max_loops


def set_hearing_limit_policy(state: dict, policy: str, overrun: dict | None = None) -> None:
    """上限の性格を state へ明示し、超過が在る場合はその由来を併記する。

    超過している値そのものは書き換えない。7 を 5 へ丸めれば数は揃うが、
    揃えた瞬間に「writer を通らずに書かれた」という唯一の痕跡が消える。
    直すべきは数ではなく、数が語っている事実を読めるようにすることである。
    """
    if policy not in LOOP_LIMIT_POLICIES:
        raise TransitionError(
            f"hearing_progress: max_loops_policy={policy!r} が許容値外 {list(LOOP_LIMIT_POLICIES)}"
        )
    progress = state.setdefault("hearing_progress", {})
    progress["max_loops_policy"] = policy
    if loop_limit_is_violated(progress):
        if not isinstance(overrun, dict) or not str(overrun.get("reason", "")).strip():
            raise TransitionError(
                "hearing_progress: loop_count が max_loops を超えている state には "
                "overrun.reason が必須 (超過を無記名で通さない)"
            )
        progress["limit_overrun"] = {
            "loop_count": progress.get("loop_count"),
            "max_loops": progress.get("max_loops"),
            "reason": overrun["reason"],
            "recorded_at": overrun.get("recorded_at"),
        }
    else:
        progress.pop("limit_overrun", None)


def _refresh_hearing_progress(state: dict) -> None:
    """Keep the resumable progress fields consistent with the matrix."""
    progress = state.setdefault("hearing_progress", {})
    unresolved = count_unresolved(state)
    progress["complete"] = unresolved == 0
    progress["next_question"] = None if unresolved == 0 else next_unresolved_question(state)


def bootstrap_state() -> dict:
    return {
        "schema_version": CURRENT_STATE_SCHEMA_VERSION,
        "design_application_contract_version": DESIGN_APPLICATION_CONTRACT_VERSION,
        "categories": [], "platforms": list(CANONICAL_PLATFORMS),
        "matrix": {}, "qa_log": [], "approval_log": [], "reopen_log": [],
        "category_aggregate": {}, "targets": [], "requirements_foundation": empty_foundation(),
        "decisions": [], "knowledge_candidates": [],
        "hearing_progress": {"loop_count": 0, "next_question": None, "complete": False},
        # 1.2 を名乗る以上、4 節は空でも必ず在る形で出す。schema の 1.2 分岐が
        # この 4 節を required にしているので、欠けた state はここで作れない。
        "lifecycle": {},
        "implementation_snapshot": {},
        "delivery_dependencies": [],
        "review_runs": [],
    }


def init_state(taxonomy: dict, existing_state: dict | None = None) -> dict:
    if not isinstance(taxonomy, dict):
        raise TransitionError("taxonomy は object 必須")
    platforms = taxonomy.get("platforms")
    if not isinstance(platforms, list):
        raise TransitionError("taxonomy.platforms は配列必須")
    taxonomy_platforms = [item.get("id") for item in platforms if isinstance(item, dict)]
    if taxonomy_platforms != list(CANONICAL_PLATFORMS):
        raise TransitionError("taxonomy.platforms は canonical 6 platform と順序を一致させる必要がある")
    categories = taxonomy.get("categories")
    if not isinstance(categories, list) or not categories:
        raise TransitionError("taxonomy.categories は非空配列必須")
    ids = [item.get("id") for item in categories if isinstance(item, dict)]
    if len(ids) != len(categories) or len(set(ids)) != len(ids):
        raise TransitionError("taxonomy.categories の id が不正または重複")
    if existing_state and any(
        isinstance(cell, dict) and cell.get("state") == "確定"
        for row in existing_state.get("matrix", {}).values()
        if isinstance(row, dict)
        for cell in row.values()
    ):
        raise TransitionError(
            "init --state は matrix 未着手の bootstrap state 専用。"
            "確定セルを含む state の再初期化は R4-reopen を迂回するため拒否"
        )
    if existing_state is None:
        state = bootstrap_state()
    else:
        if not isinstance(existing_state, dict):
            raise TransitionError("既存 state は object 必須")
        schema_version = existing_state.get("schema_version")
        contract_version = existing_state.get("design_application_contract_version")
        if schema_version == "1.0":
            if contract_version is not None:
                raise TransitionError(
                    "legacy schema 1.0 は design_application_contract_version 欠落時だけ"
                    "明示 migration 可能"
                )
        elif schema_version == CURRENT_STATE_SCHEMA_VERSION:
            if contract_version != DESIGN_APPLICATION_CONTRACT_VERSION:
                raise TransitionError(
                    "schema 1.1 は design_application_contract_version=1.0 必須。"
                    "marker 欠落/不一致を init で修復してはならない"
                )
        else:
            raise TransitionError(
                "既存 state の schema_version は exact 1.0 legacy または exact 1.1 current 必須"
            )
        state = dict(existing_state)
    # init は legacy 1.0 state の明示 migration boundary でもある。matrix は未収集へ
    # 再初期化されるため、旧 qa entry を design-app contract 適合と偽装せず 1.1 へ進められる。
    state["schema_version"] = CURRENT_STATE_SCHEMA_VERSION
    state["design_application_contract_version"] = DESIGN_APPLICATION_CONTRACT_VERSION
    state["categories"] = [{"id": item["id"], "label": item["label"]} for item in categories]
    state["platforms"] = list(CANONICAL_PLATFORMS)
    state["matrix"] = {
        category["id"]: {platform: {"state": "未収集"} for platform in CANONICAL_PLATFORMS}
        for category in state["categories"]
    }
    state.setdefault("qa_log", [])
    state.setdefault("approval_log", [])
    state.setdefault("reopen_log", [])
    state.setdefault("targets", [])
    state.setdefault("requirements_foundation", empty_foundation())
    state.setdefault("decisions", [])
    state.setdefault("knowledge_candidates", [])
    state["hearing_progress"] = {"loop_count": 0, "next_question": None, "complete": False}
    recompute_aggregates(state)
    _refresh_hearing_progress(state)
    return state


def add_category(state: dict, category: dict) -> None:
    if not isinstance(category, dict):
        raise TransitionError("add-category: category は object 必須")
    category_id, label = category.get("id"), category.get("label")
    if not isinstance(category_id, str) or not category_id.strip():
        raise TransitionError("add-category: id が空")
    if not isinstance(label, str) or not label.strip():
        raise TransitionError("add-category: label が空")
    category_id, label = category_id.strip(), label.strip()
    if not CATEGORY_ID_RE.fullmatch(category_id):
        raise TransitionError(f"add-category: id は kebab-case 必須 ({category_id})")
    if category_id in state["matrix"] or any(item.get("id") == category_id for item in state["categories"]):
        raise TransitionError(f"add-category: 既存カテゴリ ({category_id}) の変更は R4-reopen 経由")
    state["categories"].append({"id": category_id, "label": label})
    state["matrix"][category_id] = {platform: {"state": "未収集"} for platform in CANONICAL_PLATFORMS}
    recompute_aggregates(state)
    _refresh_hearing_progress(state)


def _cell(state: dict, category: str, platform: str) -> dict:
    if category not in state["matrix"]:
        raise TransitionError(f"未知カテゴリ: {category}")
    if platform not in state["matrix"][category]:
        raise TransitionError(f"未知 platform: {platform} (カテゴリ {category})")
    return state["matrix"][category][platform]


def _discarded_snapshots(state: dict, category: str, platform: str) -> list[dict]:
    """そのセルが reopen のたびに手放してきた値を、古い順に返す。"""
    out: list[dict] = []
    for log_entry in state.get("reopen_log") or []:
        if not isinstance(log_entry, dict):
            continue
        if log_entry.get("category") != category or log_entry.get("platform") != platform:
            continue
        discarded = log_entry.get("discarded")
        if isinstance(discarded, dict):
            out.append(discarded)
    return out


def _previous_backing(state: dict, category: str, platform: str) -> list[str]:
    """直前に手放した裏付けの範囲。`qa_refs` が無い時代の退避は `qa_ref` 単数で代用する。"""
    for discarded in reversed(_discarded_snapshots(state, category, platform)):
        refs = discarded.get("qa_refs")
        if isinstance(refs, list) and refs:
            return [ref for ref in refs if isinstance(ref, str)]
        single = discarded.get("qa_ref")
        if isinstance(single, str) and single:
            return [single]
    return []


def _confirm_qa_refs(state: dict, category: str, platform: str, op: dict) -> list[str] | None:
    """再確定するセルの裏付けの範囲 (`qa_refs`) を決める。

    **塞がっていた穴は「呼ぶ側が裏付けを名乗れない」ことではなく、足せないことだった。**

    `confirm` は長らく `qa_ref` (単数) しか書かず、reopen が退避した `qa_refs` は
    `restore-qa-refs` でしか戻せなかった。そちらは「退避値の先頭が再確定後の `qa_ref`
    と同じ」ことを要求する。つまり **新しく集めた質疑で再確定すると先頭が変わるので、
    書き戻す道が必ず塞がる。**新しい質疑を接地させたいときにだけ通れなくなる門だった。

    2026-08-24 に 3 セル (ui-ux / frontend / database × web) が現にそうなった。
    ブログ構築 UI と SEO/AI 検索の要望で reopen までは残っているのに、再確定が最後まで
    通らず、セルは**退避スナップショットと同じ値のまま `確定` に見えていた**。
    集めた質疑 7 件はどのセルからも参照されない孤立記録になった。

    `qa_ref` は元から呼ぶ側が名乗る。単数で名乗れて複数で名乗れない理由は無い。
    止めるべきは名乗ることではなく**付け替え** (別の主張へ裏付けを移すこと) だけである。
    そこで門は 2 つだけにする:

      - 先頭は `qa_ref` 自身 (`split-qa-bundle` / `restore-qa-refs` と同じ不変条件)
      - **直前に手放した裏付けを 1 件も落とせない。**足すのは自由、減らすのは拒否。

    **渡されなかったときに手放した値を引き継ぐ、はやらない。**それを既定にすると
    「古い裏付けは新しい主張も裏付ける」を機械が勝手に決めることになり、
    `restore-qa-refs` が付け替えとして止めている当のものを、こちらが黙って通す。
    名乗らなければ書かない。書かれなかった事実は `restore-qa-refs` の拒否として現れる。

    塞げていないところ: `reopen_log` を writer の外で書き換えれば「手放していない」
    ことにできる。これは `discarded` 全体と同じ穴で、ここだけ閉じられるものではない。
    """
    qa_ref = op["qa_ref"]
    raw = op.get("qa_refs")
    if raw is None:
        # **黙って引き継がない。**手放した裏付けが新しい主張も裏付けるかは、
        # 機械には決められない。決められないことを既定値で決めると、
        # `restore-qa-refs` が付け替えとして止めている当のものを、
        # こちらが黙って通す道になる。名乗らなければ書かない。
        return None
    previous = _previous_backing(state, category, platform)
    if not isinstance(raw, list) or not raw or not all(isinstance(ref, str) and ref for ref in raw):
        raise TransitionError(f"confirm の qa_refs は非空の文字列配列でない: {category}/{platform}")
    if len(set(raw)) != len(raw):
        raise TransitionError(f"confirm の qa_refs に重複が在る: {category}/{platform}")
    if raw[0] != qa_ref:
        raise TransitionError(
            f"confirm の qa_refs の先頭 {raw[0]!r} が qa_ref {qa_ref!r} と違う: "
            f"{category}/{platform} (別の主張へ裏付けを付け替えることになるため拒否)"
        )
    known = {entry.get("id") for entry in state.get("qa_log") or [] if isinstance(entry, dict)}
    missing = [ref for ref in raw if ref not in known]
    if missing:
        raise TransitionError(
            f"confirm の qa_refs に qa_log へ存在しない id が在る: "
            f"{category}/{platform} ({', '.join(missing)})"
        )
    # **落とすこと自体は禁止しない。落とすなら名指しさせる。**
    #
    # 落とすのが正しい場合が現に在る。`qa-uiux-web-seo-ai-search` と
    # `qa-frontend-web-seo-ai-search` は `design_applications` が空だったため
    # 「契約充足のため再確定」として手放され、v2 に差し替わった。schema 1.1 は
    # 確定セルが引く entry へ非空の `design_applications` を要求するので、
    # **この 2 件は引いてはいけない。**「1 件も落とせない」を貫くと、
    # 契約が禁じている entry を引き続けろ、という要求になる。
    #
    # かといって黙って落とせると付け替えと区別が付かない。そこで `qa_refs` の側では
    # なく `drops_backing` の側で名乗らせる。名指しした分だけ落ちる。**取り違えれば
    # 落ちない**ので、名指しは意思表示として機能する。
    declared_drops = op.get("drops_backing") or []
    if not isinstance(declared_drops, list) or not all(
        isinstance(ref, str) and ref for ref in declared_drops
    ):
        raise TransitionError(
            f"confirm の drops_backing は文字列配列でない: {category}/{platform}"
        )
    still_backing = [ref for ref in declared_drops if ref in raw]
    if still_backing:
        raise TransitionError(
            f"confirm の drops_backing が qa_refs にも載っている: "
            f"{category}/{platform} ({', '.join(still_backing)})。"
            "落とすと言いながら引いている"
        )
    not_preserved = [ref for ref in declared_drops if ref not in previous]
    if not_preserved:
        raise TransitionError(
            f"confirm の drops_backing に、直前に手放していない id が在る: "
            f"{category}/{platform} ({', '.join(not_preserved)})。"
            "落とせるのは、直前に裏付けだったものだけである"
        )
    dropped = [ref for ref in previous if ref not in raw and ref not in declared_drops]
    if dropped:
        raise TransitionError(
            f"confirm の qa_refs が、直前に手放した裏付けを黙って落としている: "
            f"{category}/{platform} ({', '.join(dropped)})。"
            "落とすなら drops_backing で名指しすること (黙った削除は付け替えと区別できない)"
        )
    return list(raw)


def _reject_undeclared_revert(
    state: dict, category: str, platform: str, op: dict, next_cell: dict
) -> None:
    """**手放した値へそのまま戻る再確定を、黙ってはさせない。**

    2026-08-24 の 3 セルは「reopen したのに、確定値が退避スナップショットと完全一致」
    という姿で残っていた。読む側にはそれが**新しく確定し直した結果**と見分けられない。
    reopen の理由には新しい要望が書いてあるのに、値には何も入っていなかった。

    禁止はしない。中身を変えない再確定には正当な用途が在る — 章本文だけを現行 `qa_ref`
    へ揃えるための R4-reopen が現に `reopen_log` に何件も在り、そこでは収集内容が
    変わらないのが正しい。**止めたいのは「変えないこと」ではなく「変えていないと
    言わずに変えないこと」である。**そこで `reaffirm: true` を名乗らせる。
    名乗れば通る。名乗らなければ止まる。差は監査で読める形に残る。
    """
    if op.get("reaffirm") is True:
        return
    subject = {key: next_cell[key] for key in ("qa_ref", "qa_refs", "serves_goals") if key in next_cell}
    for discarded in _discarded_snapshots(state, category, platform):
        same = {key: discarded[key] for key in ("qa_ref", "qa_refs", "serves_goals") if key in discarded}
        if same == subject:
            raise TransitionError(
                f"確定値が、手放したスナップショットと完全一致する再確定: {category}/{platform}。"
                "reopen の理由が新しい収集を主張しているのに値が動いていない。"
                "意図して同じ値へ戻すなら op に reaffirm=true を付けて名乗ること"
            )


def apply_cell_op(state: dict, op: dict) -> None:
    action, category, platform = op.get("action"), op.get("category"), op.get("platform")
    cell = _cell(state, category, platform)
    current = cell.get("state")
    if action == "reopen":
        if current != "確定":
            raise TransitionError(f"reopen 不可: {category}/{platform} は '{current}' (確定セルのみ reopen できる)")
        if not op.get("reason"):
            raise TransitionError(f"reopen には reason が必須: {category}/{platform}")
        discarded = {
            key: list(cell[key]) if isinstance(cell[key], list) else cell[key]
            # required_info もここへ入れる。入れないと reopen で充足記録だけが
            # 黙って消え、再確定のときに「元は何が接地していたか」を誰も引けない。
            # required_info_checks も同様。reopen で「数えた事実」が黙って消えると、
            # 再確定したセルが「一度も数えていない」姿へ戻る。
            # qa_refs も同じ理由で入れる。**2026-08-21 に、入っていないことを実測した。**
            # 確定 8 セルのうち 6 セルが qa_refs を持つのに、reopen の discarded には
            # 1 件も載らなかった。しかも qa_refs を書ける writer は split-qa-bundle
            # だけで、それは `scope_notes.bundled=true` を要求する——解除済みの 6 件は
            # 全部拒否されるので、**一度 reopen したら二度と戻せない。**
            # 「reopen で黙って消え、再確定のときに元は何が接地していたかを誰も引けない」
            # という上の理由が、そのまま当てはまる。
            for key in (
                "qa_ref",
                "qa_refs",
                "serves_goals",
                "serves_intents",
                "required_info",
                "required_info_checks",
            )
            if key in cell
        }
        log_entry = {
            "category": category,
            "platform": platform,
            "reason": op["reason"],
            "from": "確定",
        }
        if discarded:
            log_entry["discarded"] = discarded
        state.setdefault("reopen_log", []).append(log_entry)
        state["matrix"][category][platform] = {"state": "未収集", "reopened_from": "確定", "reopen_reason": op["reason"]}
        return
    if action == "set-serves":
        if current != "確定":
            raise TransitionError(f"set-serves 不可: {category}/{platform} は '{current}' (確定セルのみ serves_goals を付与できる)")
        serves = normalize_serves(op.get("serves_goals"))
        if not serves:
            raise TransitionError(f"set-serves には非空 serves_goals が必須: {category}/{platform}")
        cell["serves_goals"] = serves
        return
    if action == "set-approval":
        # exclude は approval_ref を cell へ持てるのに confirm は持てない、という非対称が
        # 「回答本文は承認を主張しているが、確定セルから承認記録へ機械追跡できない」
        # (F-0025) の直接原因だった。confirm の action 定義を変えると確定条件そのものへ
        # 触れることになるため、確定セル限定の後付け annotation である set-serves と
        # 同型の action を新設して対称化する (単一 writer 契約・確定巻き戻し拒否は不変)。
        if current != "確定":
            raise TransitionError(
                f"set-approval 不可: {category}/{platform} は '{current}' (確定セルのみ approval_ref を付与できる)"
            )
        approval_ref = op.get("approval_ref")
        if not isinstance(approval_ref, str) or not approval_ref.strip():
            raise TransitionError(f"set-approval には非空 approval_ref が必須: {category}/{platform}")
        approval_ref = approval_ref.strip()
        if not has_entry(state.get("approval_log", []), approval_ref):
            raise TransitionError(
                f"set-approval: approval_log に存在しない approval_ref: {approval_ref} ({category}/{platform})"
            )
        cell["approval_ref"] = approval_ref
        return
    if action == "set-required-info":
        # ゲートが無かった時代に確定したセルへ、C16 の充足状態を後から物質化する。
        # 確定セル限定の後付け annotation という点で set-serves / set-approval と同型。
        # **既存記録の上書きは拒否する。**許すと、confirm のゲートを通した記録を
        # あとから ungrounded へ書き換える経路になり、ゲートが実質無効になる。
        if current != "確定":
            raise TransitionError(
                f"set-required-info 不可: {category}/{platform} は '{current}' (確定セルのみ充足状態を付与できる)"
            )
        entries = normalize_required_info(
            state, category, op.get("required_info"), allow_ungrounded=True
        )
        if not entries:
            raise TransitionError(
                f"set-required-info: {category} に記録すべき missing_effect=block item が無い"
            )
        existing = cell.get("required_info")
        if existing is not None and existing != entries:
            raise TransitionError(
                f"set-required-info: 既存 required_info の上書きは拒否: {category}/{platform}"
            )
        cell["required_info"] = entries
        return
    if action == "record-required-info-check":
        # **数えた事実を残す欄。`set-required-info` の拒否は緩めない。**
        #
        # writer は「block item が 0 件の category に required_info を書く」ことを拒む。
        # 正しい拒否だが、そのぶん確定セルの `required_info` 欠落には由来が 2 つ生まれる
        # — 数えたら 0 件だった / 一度も数えていない。読む側にはどちらも同じ「欄が無い」
        # に見え、`asks_for_drift` で一度直したのと同じ「判定不能と 0 件の同一視」に戻る。
        #
        # 件数は**引数で受け取らない**。呼び出し側が件数を渡せると、渡す側が何件だったと
        # 名乗るかを選べる (legacy_ids を引数から外したのと同じ理由)。ここでは writer が
        # 同じカタログを自分で引いて数える。日付も同様に writer が付ける。
        #
        # 塞げていないところ: **記録された件数が、そのとき本当に数えた結果かは機械層で
        # 確かめられない。**この JSON を writer の外で書けば、数えていない件数を置ける。
        # 確かめているのは「記録が在ること」だけである。
        if current != "確定":
            raise TransitionError(
                f"record-required-info-check 不可: {category}/{platform} は '{current}' "
                "(確定セルのみ数えた事実を記録できる)"
            )
        # **件数を 2 つに分ける。**
        #
        # `blocking_item_count` は「収集必須 item が何件あるか」であって
        # 「何件が未充足か」ではない。上の docstring にも references の
        # required-info カタログにもそう書いてあるが、**欄名がそう読めない。**
        # 2026-08-24 の C07 マトリクス監査は現にこれを未充足件数と読み、
        # 充足済みの 4 セル (auth / ui-ux / security / backend × web) を
        # 「C16 block 未充足のまま確定」として差し戻し対象に挙げた。
        # 監査人は撤回したが、**次の読み手も同じ読み方をする**。
        #
        # 欄名を変えると既存記録が読めなくなるので、
        # 「数えたら 0 件だった」と「一度も数えていない」を分けたときと同じ手を採る
        # — 消さずに、**分かれていることが見える欄を足す**。
        # `unmet_blocking_items` が 0 なら、総数がいくつでも未充足は無い。
        blocking = blocking_items_for_category(state, category)
        recorded = {
            entry.get("item_id"): entry.get("status")
            for entry in (cell.get("required_info") or [])
            if isinstance(entry, dict)
        }
        blocking_ids = [
            item.get("item_id") if isinstance(item, dict) else item for item in blocking
        ]
        unmet = [
            item_id
            for item_id in blocking_ids
            if recorded.get(item_id) not in ("grounded", "not_applicable")
        ]
        record = {
            "checked_on": datetime.date.today().isoformat(),
            "checked_with": "record-required-info-check",
            "blocking_item_count": len(blocking),
            "unmet_blocking_items": len(unmet),
        }
        if unmet:
            record["unmet_item_ids"] = unmet
        checks = cell.get("required_info_checks")
        if checks is None:
            # 追記専用。空配列で作らない — 空配列は「数えて 0 件」と読める姿になり、
            # 分けようとしている 2 つをまた 1 つへ潰す。
            cell["required_info_checks"] = [record]
            return
        if not isinstance(checks, list) or not checks:
            raise TransitionError(
                f"record-required-info-check: 既存 required_info_checks が非空配列でない: "
                f"{category}/{platform}"
            )
        if any(
            existing.get("checked_on") == record["checked_on"]
            and existing.get("blocking_item_count") == record["blocking_item_count"]
            for existing in checks
            if isinstance(existing, dict)
        ):
            raise TransitionError(
                f"record-required-info-check: 同じ日に同じ件数の記録が既に在る: "
                f"{category}/{platform} ({record['checked_on']} / {record['blocking_item_count']} 件)"
            )
        checks.append(record)
        return
    if action == "restore-qa-refs":
        # **reopen で退避した `qa_refs` を、退避された値からだけ書き戻す窓口。**
        #
        # なぜ要るか: `qa_refs` を書ける writer は `split-qa-bundle` だけで、それは
        # `scope_notes.bundled=true` を要求する。束ね解除済みの entry では拒否されるので、
        # reopen → 再確定を通ると **裏付けの範囲が二度と戻せない**。退避する側 (上の
        # `discarded`) を直しただけでは、戻す道が無いままである。
        #
        # **引数で受け取らない。**`op` から refs を読めるようにすると、呼ぶ側が
        # 「このセルはこの entry 群に裏付けられている」と名乗る内容を選べてしまう。
        # `split-qa-bundle` が topics から導いて引数を拒んだのと同じ理由で、ここは
        # `reopen_log[].discarded.qa_refs` だけを出所にする。
        #
        # 退避値をそのまま戻すだけでは足りない: reopen 後に**別の qa_ref で再確定**した
        # セルへ古い refs を貼ると、裏付けが黙って別の主張へ付け替わる。`split-qa-bundle`
        # が持っていた不変条件 (`refs[0]` は、そのセルが引いている entry 自身) を
        # ここでも門にして、付け替えを機械で止める。
        #
        # 塞げていないところ: reopen_log を writer の外で書き換えれば、任意の refs を
        # 「退避されていた値」として置ける。これは discarded 全体と同じ穴で、ここだけ
        # 閉じられるものではない。
        if current != "確定":
            raise TransitionError(
                f"restore-qa-refs 不可: {category}/{platform} は '{current}' "
                "(再確定したセルにしか書き戻せない)"
            )
        preserved = None
        for log_entry in state.get("reopen_log") or []:
            if not isinstance(log_entry, dict):
                continue
            if log_entry.get("category") != category or log_entry.get("platform") != platform:
                continue
            discarded = log_entry.get("discarded")
            if isinstance(discarded, dict) and discarded.get("qa_refs"):
                # 同じセルが複数回 reopen されうるので、**最後に退避された値**を採る。
                preserved = list(discarded["qa_refs"])
        if preserved is None:
            raise TransitionError(
                f"restore-qa-refs: {category}/{platform} の reopen_log に退避された qa_refs が無い"
                " (書き戻せるのは退避された値だけで、無いものを作ることはしない)"
            )
        known = {entry.get("id") for entry in state.get("qa_log") or [] if isinstance(entry, dict)}
        missing = [ref for ref in preserved if ref not in known]
        if missing:
            raise TransitionError(
                f"restore-qa-refs: 退避された qa_refs に qa_log へ存在しない id が在る: "
                f"{category}/{platform} ({', '.join(missing)})"
            )
        if preserved[0] != cell.get("qa_ref"):
            raise TransitionError(
                f"restore-qa-refs: 退避された qa_refs の先頭 {preserved[0]!r} が、再確定後の "
                f"qa_ref {cell.get('qa_ref')!r} と違う: {category}/{platform} "
                "(別の主張へ裏付けを付け替えることになるため拒否)"
            )
        existing = cell.get("qa_refs")
        if existing is not None:
            if existing != preserved:
                raise TransitionError(
                    f"restore-qa-refs: 既存 qa_refs と異なる内容の書き戻しは拒否: "
                    f"{category}/{platform}"
                )
            return
        cell["qa_refs"] = preserved
        return
    if current == "確定":
        raise TransitionError(f"確定セルの直接変更は拒否: {category}/{platform}。変更は R4-reopen を経由すること")
    if action == "confirm":
        if not op.get("qa_ref"):
            raise TransitionError(f"confirm には qa_ref が必須: {category}/{platform}")
        # C16 block ゲート。当該 category に掛かる block item が全て接地または
        # 理由付き N/A でなければ、ここで確定を拒否する。事後監査ではなく確定の瞬間に止める。
        required_info = normalize_required_info(
            state, category, op.get("required_info"), allow_ungrounded=False
        )
        next_cell = {"state": "確定", "qa_ref": op["qa_ref"]}
        qa_refs = _confirm_qa_refs(state, category, platform, op)
        if qa_refs is not None:
            next_cell["qa_refs"] = qa_refs
        if required_info:
            next_cell["required_info"] = required_info
        serves = normalize_serves(op.get("serves_goals"))
        if serves:
            next_cell["serves_goals"] = serves
        _reject_undeclared_revert(state, category, platform, op, next_cell)
        state["matrix"][category][platform] = next_cell
    elif action == "exclude":
        if not (op.get("reason") or op.get("approval_ref")):
            raise TransitionError(f"exclude には reason か approval_ref が必須: {category}/{platform}")
        next_cell = {"state": "対象外"}
        if op.get("reason"):
            next_cell["reason"] = op["reason"]
        if op.get("approval_ref"):
            next_cell["approval_ref"] = op["approval_ref"]
        state["matrix"][category][platform] = next_cell
    else:
        raise TransitionError(f"未知 action: {action!r}")


def set_targets(state: dict, targets: list) -> None:
    if not isinstance(targets, list):
        raise TransitionError(f"targets は配列でない: {targets!r}")
    normalized, seen = [], set()
    for target in targets:
        if isinstance(target, str):
            target_id, category = target, None
        elif isinstance(target, dict):
            target_id, category = target.get("target_id"), target.get("category")
        else:
            raise TransitionError(f"target は str か object でない: {target!r}")
        if not target_id:
            raise TransitionError(f"target に target_id が必須: {target!r}")
        if target_id in seen:
            raise TransitionError(f"target_id が重複: {target_id!r}")
        seen.add(target_id)
        entry = {"target_id": target_id}
        if category:
            entry["category"] = category
        normalized.append(entry)
    state["targets"] = normalized


QA_SOURCE_KINDS = ("user-dialogue", "written-requirements")


def _require_qa_source(qa_id: str, turn: dict) -> dict:
    """質疑 entry に「どこから来たか」を必ず名乗らせる。

    **黙って落とせる欄は、いつか落ちる。**この欄は長らく `if "source" in turn` で
    任意だった。名乗らなくても writer は通り、通ったものは正本に残る。
    実測 2026-08-25: `qa_log` 40 件のうち 5 件 (`qa-uiux-web-seo-ai-search` /
    `qa-frontend-web-seo-ai-search` / `qa-backend-web-overhaul-v2` /
    `qa-frontend-web-overhaul-v2` / `qa-uiux-web-overhaul-v2`) が `source` を
    持たず、うち 3 件は確定セルが引いている**裏付けの由来が機械で辿れない確定**
    だった。独立監査 C06 がこれをトレーサビリティ FAIL として検出し、
    C05 の総合判定まで降格させた。

    **禁じるのではなく、名乗らせる。**対話由来であること自体は何も悪くない
    (12 件が正当にそう名乗っている)。悪いのは、対話由来なのか書面由来なのかを
    **誰も宣言しないまま確定できてしまう**ことである。宣言があれば、書面なら
    原文へ突き合わせられ、対話なら突き合わせ先が無いと分かる。宣言が無いと、
    **どちらなのかを問うことすらできない。**

    ここで見るのは `kind` だけである。書面の path/section/sha256 は
    `set-qa-written-up` / `seal` 系が後から埋める欄なので、作成時点で要求すると
    「まだ読んでいない原文の digest」を書かせることになる。
    """
    source = turn.get("source")
    if source is None:
        raise TransitionError(
            f"qa_log entry {qa_id!r}: source が無い。質疑は由来を名乗らずに作れない "
            f"(source.kind は {' | '.join(QA_SOURCE_KINDS)} のいずれか)。"
            "対話由来なら {\"kind\": \"user-dialogue\"} と名乗ること — "
            "名乗り自体は裏取りではないが、名乗りが無いと書面か対話かを問うことすらできない"
        )
    if not isinstance(source, dict):
        raise TransitionError(f"qa_log entry {qa_id!r}: source がオブジェクトでない: {source!r}")
    kind = source.get("kind")
    if kind not in QA_SOURCE_KINDS:
        raise TransitionError(
            f"qa_log entry {qa_id!r}: source.kind が {QA_SOURCE_KINDS} のいずれでもない: {kind!r}"
        )
    return source


QA_SOURCE_WRITER = "set-qa-source"


def set_qa_source(state: dict, qa_id: str, reason: str) -> None:
    """既に正本に居る質疑へ、**対話由来という名乗りだけ**を後から与える。

    **なぜ対話由来しか受け付けないか。**書面由来の名乗りは
    `set-qa-written-up` が担い、原文の path/section と digest まで要求する。
    ここで書面を名乗れるようにすると、**原文を読まずに「書面に書いてある」と
    言える口**ができる。名乗りだけで裏取りを飛び越えられる経路は作らない。

    **なぜ後から名乗る writer が要るか。**`source` は長らく任意欄で、名乗らずに
    質疑を作れた。作成側は `_require_qa_source` で塞いだが、**穴が開いていた
    あいだに入った 5 件はそのままでは直せない** — 塞いだ writer は新規作成しか
    見ないからである。塞ぐことと、塞ぐ前に入ったものを直すことは別の仕事である。

    実測 2026-08-25: `qa-uiux-web-seo-ai-search` / `qa-frontend-web-seo-ai-search`
    / `qa-backend-web-overhaul-v2` / `qa-frontend-web-overhaul-v2` /
    `qa-uiux-web-overhaul-v2` の 5 件。うち 3 件は確定セルが引いており、
    独立監査 C06 が「由来を機械で辿れない確定」として FAIL を出していた。

    `{"kind": "user-dialogue"}` は裏取りではない。**裏取りが存在しないことの
    宣言**である。宣言があれば「この値は原文へ突き合わせられない」と機械が
    分かる。宣言が無いと、書面か対話かを問うことすらできない。
    """
    for name, value in (("qa_id", qa_id), ("reason", reason)):
        if not isinstance(value, str) or not value.strip():
            raise TransitionError(f"{QA_SOURCE_WRITER}: {name} は非空文字列必須")
    entry = next(
        (e for e in state.get("qa_log") or [] if isinstance(e, dict) and e.get("id") == qa_id),
        None,
    )
    if entry is None:
        raise TransitionError(f"{QA_SOURCE_WRITER}: qa_log に存在しない id: {qa_id}")
    declared = {"kind": "user-dialogue"}
    existing = entry.get("source")
    if existing is not None:
        if existing != declared:
            raise TransitionError(
                f"{QA_SOURCE_WRITER}: 既に別の由来を名乗っている entry は上書きしない: "
                f"{qa_id} / {existing!r}"
            )
        return
    entry["source"] = declared


def apply_turn(state: dict, turn: dict) -> None:
    qa_id = turn.get("qa_id")
    ops = turn.get("ops", [])
    normalized_design_applications: list[dict] | None = None
    if state.get("design_application_contract_version") == DESIGN_APPLICATION_CONTRACT_VERSION:
        confirmed_refs = {
            op.get("qa_ref") or qa_id
            for op in ops
            if isinstance(op, dict) and op.get("action") == "confirm"
        }
        for qa_ref in confirmed_refs:
            if not qa_ref:
                continue
            if qa_ref == qa_id and not has_entry(state["qa_log"], qa_ref):
                normalized_design_applications = normalize_design_applications(
                    turn.get("design_applications")
                )
                continue
            existing = next(
                (entry for entry in state["qa_log"] if entry.get("id") == qa_ref),
                None,
            )
            if existing is None:
                raise TransitionError(
                    f"schema 1.1 の confirm は qa_log entry を参照する必要がある: {qa_ref}"
                )
            normalize_design_applications(existing.get("design_applications"))
    if qa_id and not has_entry(state["qa_log"], qa_id):
        entry = {"id": qa_id, "question": turn.get("question", ""), "answer": turn.get("answer", "")}
        entry["source"] = _require_qa_source(qa_id, turn)
        resolved_asks_for = resolve_asks_for(state, qa_id, turn.get("asks_for"))
        if resolved_asks_for is not None:
            entry["asks_for"] = resolved_asks_for
        if normalized_design_applications is not None:
            entry["design_applications"] = normalized_design_applications
        elif "design_applications" in turn:
            entry["design_applications"] = normalize_design_applications(turn["design_applications"])
        state["qa_log"].append(entry)
    approval_id = turn.get("approval_id")
    if approval_id and not has_entry(state["approval_log"], approval_id):
        state["approval_log"].append({"id": approval_id, "note": turn.get("approval_note", "")})
    for raw_op in ops:
        op = dict(raw_op)
        if op.get("action") == "confirm" and not op.get("qa_ref") and qa_id:
            op["qa_ref"] = qa_id
        if op.get("action") == "exclude" and not op.get("reason") and not op.get("approval_ref") and approval_id:
            op["approval_ref"] = approval_id
        # confirm と同 turn で承認を得た場合、その turn の approval_id を確定セルへ紐づける。
        # turn 境界は state に永続化されないため (LS-04)、この場でしか対応を残せない。
        if op.get("action") == "set-approval" and not op.get("approval_ref") and approval_id:
            op["approval_ref"] = approval_id
        apply_cell_op(state, op)
    recompute_aggregates(state)
    _refresh_hearing_progress(state)


def next_unresolved_question(state: dict) -> str | None:
    labels = {category["id"]: category["label"] for category in state["categories"]}
    for category in state["categories"]:
        for platform in CANONICAL_PLATFORMS:
            cell = state["matrix"][category["id"]].get(platform)
            if cell and cell.get("state") == "未収集":
                return f"{labels.get(category['id'], category['id'])}（{category['id']}）× {PLATFORM_LABELS.get(platform, platform)}（{platform}）は対象ですか? 対象なら要件を、非対象なら理由を教えてください。"
    return None


def run_chunk(state: dict, turns: list[dict], max_loops: int = 5) -> int:
    """ターン列を 1 invocation ぶん適用する。

    loop_count の意味は契約どおり **直近 1 invocation の turn 数**である。累計ではない。
    通常時（既存値が max_loops 以下）は、その意味のまま処理済み件数で置き直す。

    **例外は、既存値が max_loops を超えているときだけ。**そのときは既存値を床にし、
    下回らないようにする。以前は無条件に 0 へ落としてから処理済み件数を書いていたため、
    上限超過の記録 (limit_overrun) を持つ state にこの writer を通すと、
    その記録が指している当の値が消えた。**記録を守るための仕掛けを、
    記録を書く道具が壊していた。**

    床を `prior` ではなく `prior if prior > max_loops else 0` にしてあるのが要点である。
    無条件に `max(prior, processed)` にすると超過は確かに守れるが、**通常時の意味まで
    「これまでの最大値」へ変わってしまう**——超過と無関係な golden fixture
    (`expected-final-spec-state.json`) の値が動いたのがその証拠だった。
    **記録を守るための修正が、別の記録を書き換えていた。**守る対象は超過だけでよい。

    これは下限を上げる向きの変更である。7 を 1 にするのが緩める向き、
    7 を守るのが厳しい向き。新しく書き込む値は依然 max_loops 以下なので、
    **この writer が上限超えを生み出せない**という性質は変わらない。
    """
    progress = state["hearing_progress"]
    prior = progress.get("loop_count")
    if not isinstance(prior, int) or isinstance(prior, bool) or prior < 0:
        prior = 0
    floor = prior if prior > max_loops else 0
    progress["loop_count"] = floor
    processed = 0
    for turn in turns:
        if processed >= max_loops:
            break
        apply_turn(state, turn)
        processed += 1
        progress["loop_count"] = max(floor, processed)
    recompute_aggregates(state)
    _refresh_hearing_progress(state)
    state["hearing_progress"]["max_loops"] = max_loops
    # 上限を書くときは、その上限がどちらの性格かも同時に書く。max_loops だけが
    # 在って policy が無い state は「5 は目安か絶対か」を読む側に推測させる。
    state["hearing_progress"]["max_loops_policy"] = LOOP_LIMIT_POLICY_STRICT
    return processed


CHAPTER_NOTE_WRITER = "set-chapter-note"


EXCLUDED_CATEGORY_WRITER = "declare-excluded-category"


def declare_excluded_category(state: dict, category: str, reason: str) -> None:
    """必須情報カタログの domain に、カテゴリ行を立てない理由を名乗らせる。

    **検査は「宣言せよ」と言うのに、宣言する道具が無かった。**
    `--require-catalog-domain-coverage` はカタログの `in_scope_domains` に対して
    「それを数えるカテゴリ行」を要求し、無い場合の逃げ道として
    `excluded_categories` を案内する。しかし正本を書ける writer は
    `apply-spec-transition.py` だけで、そこにこの操作が無かった。
    **塞ぐことと、塞がれた側に出口を与えることは別の仕事である**
    (`set_qa_source` を足したときと同じ形の欠落)。

    **「対象外」は「作らない」ではない。**ここで宣言するのは「このカテゴリ**行**を
    立てない」であって、その領域を実装しないという意味ではない。実測 2026-08-25:
    `api` は `in_scope_domains` に在るが matrix に行が無い。API を作らないからでは
    なく、API 契約を backend カテゴリの質疑で扱っているからである。**誤読すると
    「API 不要」と読めてしまう**ので、`reason` を必須にして、どこで数えているのかを
    書かせる。理由の中身は harness が決められる事柄ではないため、内容の当否は問わない
    — **書かせることだけを強制する。**

    上書きは拒む。既に別の理由が立っているカテゴリを黙って書き換えると、
    経緯が消えて「最初からそう宣言していた」ように見える。
    """
    for name, value in (("category", category), ("reason", reason)):
        if not isinstance(value, str) or not value.strip():
            raise TransitionError(f"{EXCLUDED_CATEGORY_WRITER}: {name} は非空文字列必須")

    if any(
        isinstance(entry, dict) and entry.get("id") == category
        for entry in state.get("categories") or []
    ):
        raise TransitionError(
            f"{EXCLUDED_CATEGORY_WRITER}: {category!r} は matrix にカテゴリ行が在る。"
            "行が在るものを対象外と宣言すると、行と宣言のどちらが正かが決まらない"
        )

    excluded = state.get("excluded_categories")
    if excluded is None:
        excluded = {}
        state["excluded_categories"] = excluded
    if not isinstance(excluded, dict):
        raise TransitionError(
            f"{EXCLUDED_CATEGORY_WRITER}: excluded_categories が object でない: {excluded!r}"
        )

    existing = excluded.get(category)
    if existing is not None:
        if existing != reason:
            raise TransitionError(
                f"{EXCLUDED_CATEGORY_WRITER}: 既に別の理由が立っている宣言は上書きしない: "
                f"{category} / {existing!r}"
            )
        return
    excluded[category] = reason


def set_chapter_note(state: dict, category: str, heading: str, body: str, reason: str) -> None:
    """章にしか居場所の無かった散文へ、正本の居場所を与える。

    **なぜ在るか。**章は正本の純関数なので、正本に無い散文は compile のたび消える。
    消えないよう章を手で守る (`--on-handwritten preserve`) 手は `##` 単位でしか効かず、
    生成節の内側 (`###` 以下) に書かれた散文は原理上どうやっても守れない。
    実測 2026-08-25: `ui-ux.md` の `#### 既存記録との食い違い` は生成節
    `## 確定内容 (質疑録)` の中に在り、compile を回すたび消失一覧に載っていた。

    **なぜ `qa_log[].answer` に足さないか。**answer は利用者の発言の逐語記録である。
    後から気づいた突き合わせを足すと、利用者が言っていないことが利用者の声の顔で残る。
    突き合わせは突き合わせとして、別の欄に、記録者と理由を伴って置く。

    `set_qa_scope_notes` の流儀に合わせ、同一内容の再適用は通し、異なる内容の
    再適用は拒む。見出しが一致する注記は「同じ注記」とみなす。
    """
    for name, value in (("category", category), ("heading", heading), ("body", body), ("reason", reason)):
        if not isinstance(value, str) or not value.strip():
            raise TransitionError(f"{CHAPTER_NOTE_WRITER}: {name} は非空文字列必須")
    category = category.strip()
    if category not in {c.get("id") for c in (state.get("categories") or []) if isinstance(c, dict)}:
        raise TransitionError(f"{CHAPTER_NOTE_WRITER}: categories に存在しない category: {category}")

    notes = state.setdefault("chapter_notes", {})
    if not isinstance(notes, dict):
        raise TransitionError(f"{CHAPTER_NOTE_WRITER}: chapter_notes がオブジェクトでない")
    bucket = notes.setdefault(category, [])
    if not isinstance(bucket, list):
        raise TransitionError(f"{CHAPTER_NOTE_WRITER}: chapter_notes.{category} が配列でない")

    entry = {
        "heading": heading.strip(),
        "body": body.rstrip("\n"),
        "reason": reason.strip(),
        # 誰が書いたかは writer が打刻する。呼び出し側からは渡せない。
        "recorded_with": CHAPTER_NOTE_WRITER,
    }
    for existing in bucket:
        if isinstance(existing, dict) and existing.get("heading") == entry["heading"]:
            if existing != entry:
                raise TransitionError(
                    f"{CHAPTER_NOTE_WRITER}: 既存の同名注記と異なる内容の再適用は拒否: "
                    f"{category} / {entry['heading']}"
                )
            return
    bucket.append(entry)
