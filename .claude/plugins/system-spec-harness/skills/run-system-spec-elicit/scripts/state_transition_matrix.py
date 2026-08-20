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
            for key in (
                "qa_ref",
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
        record = {
            "checked_on": datetime.date.today().isoformat(),
            "checked_with": "record-required-info-check",
            "blocking_item_count": len(blocking_items_for_category(state, category)),
        }
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
        if required_info:
            next_cell["required_info"] = required_info
        serves = normalize_serves(op.get("serves_goals"))
        if serves:
            next_cell["serves_goals"] = serves
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
        if "source" in turn:
            entry["source"] = turn["source"]
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
