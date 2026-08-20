#!/usr/bin/env python3
# /// script
# name: validate-coverage-matrix
# version: 0.1.0
# purpose: システム構成カテゴリ×canonical platform id の収集マトリクスの全セルが『未収集/対象外/確定』のいずれかで埋まり、対象外に理由・確定に qa_ref が付与され、必須プラットフォーム行が全存在し、カテゴリ集約状態が真理値表と一致し、参照先 ID (qa_log/approval_log/categories/goals) が一意であることを検証する決定論ゲート (goal-spec C7 の直接実装)。
# inputs:
#   - argv: --matrix FILE [--require-complete]
# outputs:
#   - stdout: OK summary
#   - stderr: violation 一覧
#   - exit: 0=OK / 1=violation / 2=usage error
# contexts: [E, C]
# network: false
# write-scope: none
# dependencies: [coverage_foundation.py]
# requires-python: ">=3.9"
# ///
"""カテゴリ×プラットフォーム収集マトリクス (spec-state.json) の網羅性を機械検証する。

matrix ファイル (spec-state.json) の期待形状:
{
  "categories": [{"id": "database", "label": "データベース"}, ...],
  "platforms": ["web","mobile","tablet","desktop-windows","desktop-linux","desktop-macos"],
  "matrix": {
    "<category_id>": {
      "<platform_id>": {"state": "確定", "qa_ref": "qa-001"},        # 確定は qa_ref 必須
      "<platform_id>": {"state": "対象外", "reason": "..."},          # 対象外は reason 必須
      "<platform_id>": {"state": "未収集"}                            # loop 中のみ許容
    }, ...
  },
  "qa_log": [{"id": "qa-001", ...}],          # 確定 qa_ref の参照先 (存在検証 + id 一意性検証)
  "approval_log": [{"id": "appr-001", ...}],  # 一括承認 (対象外/確定を承認ログ参照で代替可・id 一意)
  "category_aggregate": {"<category_id>": "確定"|"収集中"|"未着手"|"対象外"}  # 任意 (あれば真理値表照合)
}

集約状態の真理値表 (goal-spec C1 の 4 値):
  全セル未収集              -> 未着手
  未収集混在 (一部のみ未収集) -> 収集中
  全セル対象外              -> 対象外
  それ以外で未収集 0        -> 確定

ID 一意性 (fail-closed・既定で有効): qa_log / approval_log / categories / goals の id は参照先を
識別する前提なので、集合へ正規化する前に出現順で走査して重複を検出する。集合内包で組み立てると
重複 id が黙って 1 件へ畳み込まれ、二重採番が「参照先は実在する」という緑のまま通り抜ける
(issues/sys-qa-log-id-uniqueness-gate-20260726.md)。

要件 C9 (上位概念 anchor・opt-in): --require-foundation を付けると validate_foundation() が
requirements_foundation の U1-U5 非空・各『確定』セルの serves_goals トレース (実在 goal へ ≥1)・
どのゴールにも資さない確定セル (drift 候補) を追加検証する。既定 (--matrix / --require-complete) は
従来どおりで validate() を一切変えないため後方互換 (foundation 検証は完全にオプトイン)。
検証本体は同ディレクトリの coverage_foundation.py (import-only support module) にある。
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

# 回答本文が引用する承認 id の形 (approval_log の canonical id は appr-NNN)。
_APPROVAL_ID_RE = re.compile(r"appr-\d+")

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))

from coverage_foundation import validate_foundation

CELL_STATES = {"未収集", "対象外", "確定"}
CANONICAL_PLATFORMS = (
    "web",
    "mobile",
    "tablet",
    "desktop-windows",
    "desktop-linux",
    "desktop-macos",
)
# goal-spec C1 の例示カテゴリ (canonical id)。マトリクスはこれを最低含むか除外根拠を持つ。
GOAL_SPEC_CATEGORIES = (
    "database",
    "auth",
    "ui-ux",
    "security",
    "infrastructure",
    "backend",
    "frontend",
    "maintenance-ops",
)
DESIGN_APPLICATION_CONTRACT_VERSION = "1.0"
CURRENT_STATE_SCHEMA_VERSION = "1.2"
INTERMEDIATE_STATE_SCHEMA_VERSION = "1.1"
LEGACY_STATE_SCHEMA_VERSION = "1.0"
# この検証器が『規則を書いた版』の一覧。ここに無い版の state は、規則が当たっていないのに
# 緑が出る (= 版を上げるだけで検査を素通りできる) ため、未知の版そのものを違反にする。
SUPPORTED_STATE_SCHEMA_VERSIONS = (
    LEGACY_STATE_SCHEMA_VERSION,
    INTERMEDIATE_STATE_SCHEMA_VERSION,
    CURRENT_STATE_SCHEMA_VERSION,
)
# 最新版が要求する追加節は schema 側の oneOf 分岐が正本。ここで一覧を書き写すと
# 二重管理になって片方だけ古くなるので、schema ファイルから読み出す。
STATE_SCHEMA_PATH = HERE.parent / "schemas" / "spec-state.schema.json"
DESIGN_APPLICATION_STATES = {"applied", "not_applicable"}
# C16 block item カタログ (run-system-spec-elicit 所有)。確定セルの required_info が
# 「カタログどおり全件materialize されているか」を照合するために読む。
REQUIRED_INFO_CATALOG_PATH = (
    HERE.parent / "skills" / "run-system-spec-elicit" / "references" / "required-info-catalog.json"
)
LEGACY_BACKFILL_PROVENANCE = {
    "mode": "legacy_backfill",
    "writer": "set-qa-design-applications",
}


def _current_version_required_sections() -> list[str]:
    """最新版 state が持つべき追加節を schema の oneOf 分岐から読み出す。

    `CURRENT_STATE_SCHEMA_VERSION` を上げるだけでは、上げた版が何を要求するかは決まらない。
    要求の実体は schema 側にあるので、そこを引いて『版を名乗るなら中身も在る』を照合する。
    schema が読めない場合は空を返さず呼び出し側へ違反として渡す (fail-closed)。
    """
    schema = json.loads(STATE_SCHEMA_PATH.read_text(encoding="utf-8"))
    for branch in schema.get("oneOf", []):
        version = (
            branch.get("properties", {}).get("schema_version", {}).get("const")
        )
        if version == CURRENT_STATE_SCHEMA_VERSION:
            return [
                key
                for key in branch.get("required", [])
                if key not in ("schema_version", "design_application_contract_version")
            ]
    raise KeyError(
        f"schema に schema_version={CURRENT_STATE_SCHEMA_VERSION!r} の分岐が無い"
    )


def _validate_state_schema_version(data: dict) -> list[str]:
    """state が名乗る版を、この検証器が規則を書いた版と突き合わせる。

    版の定数が定義されているだけで一度も読まれないと、新しい版の state が
    『検査された』顔をして通り抜ける。ここが唯一その定数を読む場所である。
    """
    schema_version = data.get("schema_version")
    if schema_version not in SUPPORTED_STATE_SCHEMA_VERSIONS:
        return [
            f"schema_version={schema_version!r}: この検証器が規則を持つ版は "
            f"{list(SUPPORTED_STATE_SCHEMA_VERSIONS)} のみ "
            "(未知の版は検査されないまま緑になるため違反として扱う)"
        ]
    if schema_version != CURRENT_STATE_SCHEMA_VERSION:
        return []
    try:
        required = _current_version_required_sections()
    except (OSError, ValueError, KeyError) as exc:
        return [f"state schema を参照できない ({exc})"]
    missing = [key for key in required if key not in data]
    if missing:
        return [
            f"schema_version={CURRENT_STATE_SCHEMA_VERSION!r} を名乗るが "
            f"{missing} が欠落 (版だけ上げて中身の無い state は通さない)"
        ]
    return []


def _validate_design_application_provenance(entry: dict) -> list[str]:
    """qa の参照有無に関わらず事後補完の由来を検証する。"""
    qa_id = entry.get("id", "<unknown>")
    if "design_application_provenance" not in entry:
        return []
    provenance = entry["design_application_provenance"]
    if provenance == LEGACY_BACKFILL_PROVENANCE:
        return []
    return [
        f"qa_log[{qa_id}].design_application_provenance: "
        "legacy_backfill/set-qa-design-applications の完全一致が必須"
    ]


def _validate_design_applications(entry: dict) -> list[str]:
    """確定 qa の章固有設計解釈を fail-closed に検証する。"""
    qa_id = entry.get("id", "<unknown>")
    applications = entry.get("design_applications")
    if not isinstance(applications, list) or not applications:
        return [f"qa_log[{qa_id}]: design_applications は非空配列必須"]
    findings: list[str] = []
    for index, application in enumerate(applications):
        label = f"qa_log[{qa_id}].design_applications[{index}]"
        if not isinstance(application, dict):
            findings.append(f"{label}: object でない")
            continue
        for key in ("knowledge_ref", "principle", "rationale"):
            value = application.get(key)
            if not isinstance(value, str) or not value.strip():
                findings.append(f"{label}.{key}: 非空文字列でない")
        applicability = application.get("applicability")
        if applicability not in DESIGN_APPLICATION_STATES:
            findings.append(
                f"{label}.applicability={applicability!r}: applied|not_applicable でない"
            )
        tradeoffs = application.get("tradeoffs")
        if (
            not isinstance(tradeoffs, list)
            or not tradeoffs
            or any(not isinstance(value, str) or not value.strip() for value in tradeoffs)
        ):
            findings.append(f"{label}.tradeoffs: 非空文字列の配列でない")
    return findings


def _collect_unique_ids(entries, label: str) -> tuple[set[str], list[str]]:
    """id 付きエントリ列から一意な ID 集合を作り、id の欠落と重複を finding として返す。

    集合内包 ({e.get("id") for e in ...}) で組み立てると重複 id が黙って 1 件へ畳み込まれ、
    「参照先が一意か」という前提が検査される前に消える (= 二重採番の無検出)。
    正規化より先に検査するため、出現順に走査して重複を明示的に検出する。

    Returns:
        (一意な id の集合, findings)。findings が非空なら呼び出し側が違反として扱う。
    """
    findings: list[str] = []
    seen: set[str] = set()
    counts: dict[str, int] = {}
    if not isinstance(entries, list):
        if entries is not None:
            findings.append(f"{label}: 配列でない")
        return seen, findings

    for i, entry in enumerate(entries):
        if not isinstance(entry, dict):
            findings.append(f"{label}[{i}]: エントリがオブジェクトでない")
            continue
        eid = entry.get("id")
        if not eid:
            findings.append(f"{label}[{i}]: id 欠落")
            continue
        if not isinstance(eid, str):
            findings.append(f"{label}[{i}]: id が文字列でない ({eid!r})")
            continue
        if eid in seen:
            counts[eid] = counts.get(eid, 1) + 1
        else:
            seen.add(eid)

    for eid in sorted(counts):
        findings.append(
            f"{label}: id={eid!r} が {counts[eid]} 件重複"
            " (ID が一意でなければ参照先を識別できない)"
        )
    return seen, findings


def _blocking_item_ids_by_domain(catalog_path: Path | None = None) -> dict[str, set[str]]:
    """カタログから domain → missing_effect=block の item_id 集合を作る。

    **判定をここで作り直さない。**`missing_effect == "block"` という条件そのものは
    カタログの値であり、この関数は値を読み替えずに集めるだけである。読めない/壊れている
    場合は例外を投げ、呼び出し側が違反として扱う (fail-closed) — カタログが読めないときに
    空を返すと、block item が 1 件も無いことになって検査が黙って素通りする。
    """
    path = catalog_path or REQUIRED_INFO_CATALOG_PATH
    data = json.loads(path.read_text(encoding="utf-8"))
    items = data.get("items")
    if not isinstance(items, list) or not items:
        raise ValueError(f"required-info カタログの items が非空配列でない: {path}")
    by_domain: dict[str, set[str]] = {}
    for item in items:
        if not isinstance(item, dict) or not item.get("item_id") or not item.get("domain"):
            raise ValueError(f"required-info カタログに item_id/domain 欠落の item が在る: {path}")
        if item.get("missing_effect") == "block":
            by_domain.setdefault(item["domain"], set()).add(item["item_id"])
    return by_domain


def _validate_confirmed_required_info(
    data: dict, cat_ids: list[str], catalog_path: Path | None = None
) -> list[str]:
    """確定セルの C16 block item 充足を、state 側から機械照合する (goal-spec C16)。

    **既存の 2 欄の役割分担をここで作り変えない。**この harness は「block item が 0 件の
    category は `required_info` を持たない」「数えた事実は `required_info_checks` が持つ」
    という分担を選んでおり、writer と 4 本の番人テストがその分担を固定している
    (`test_a_category_with_no_block_item_records_nothing` ほか)。したがって欄の欠落は
    違反ではなく、**欠落が正しいことを別の欄で裏取りする**のがここの役割である。

    照合するのは 3 つ:
      1. `required_info` の item_id 集合がカタログの block item 集合を**満たす** (不足なし)
      2. カタログに無い item_id が載っていない (過剰なし。載せられると充足件数を自前で増やせる)
      3. block item が 0 件で欄が無い確定セルは、`required_info_checks` に
         `blocking_item_count == 0` の記録を持つ (= 数えて 0 件。一度も数えていないのと区別する)

    3 が要るのは、欄の欠落だけを見て「0 件だから正しい」と読むと、
    **一度も確認していないセルが 0 件のセルと同じ姿で通る**からである。writer を通さず
    JSON を直接書いた state はここでしか捕まらない。
    """
    try:
        blocking = _blocking_item_ids_by_domain(catalog_path)
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        return [f"required-info カタログを参照できないため確定セルの C16 充足を判定できない ({exc})"]

    findings: list[str] = []
    matrix = data.get("matrix") or {}
    for cat_id in cat_ids:
        row = matrix.get(cat_id)
        if not isinstance(row, dict):
            continue
        expected = blocking.get(cat_id, set())
        for pf in CANONICAL_PLATFORMS:
            cell = row.get(pf)
            if not isinstance(cell, dict) or cell.get("state") != "確定":
                continue
            if "required_info" not in cell:
                # 欄が無いのは、カタログ上 block item が 0 件のときだけ正しい。
                # その「0 件だった」は required_info_checks の記録で裏を取る。
                if expected:
                    findings.append(
                        f"matrix[{cat_id}][{pf}]: 確定だが missing_effect=block item "
                        f"{sorted(expected)} の充足状態が記録されていない"
                    )
                    continue
                checks = cell.get("required_info_checks")
                if not isinstance(checks, list) or not checks:
                    findings.append(
                        f"matrix[{cat_id}][{pf}]: 確定で block item は 0 件だが、"
                        "数えた記録 (required_info_checks) が無い "
                        "(『数えて 0 件』と『一度も数えていない』が区別できない)"
                    )
                    continue
                counted = [
                    check.get("blocking_item_count")
                    for check in checks
                    if isinstance(check, dict)
                ]
                if 0 not in counted:
                    findings.append(
                        f"matrix[{cat_id}][{pf}]: block item は 0 件なのに "
                        f"required_info_checks の記録が {counted} 件で 0 を含まない "
                        "(記録とカタログが食い違っている)"
                    )
                continue
            entries = cell["required_info"]
            if not isinstance(entries, list):
                findings.append(f"matrix[{cat_id}][{pf}]: required_info が配列でない")
                continue
            actual = set()
            for index, entry in enumerate(entries):
                if not isinstance(entry, dict) or not isinstance(entry.get("item_id"), str):
                    findings.append(
                        f"matrix[{cat_id}][{pf}]: required_info[{index}] に item_id が無い"
                    )
                    continue
                actual.add(entry["item_id"])
            missing = sorted(expected - actual)
            extra = sorted(actual - expected)
            if missing:
                findings.append(
                    f"matrix[{cat_id}][{pf}]: missing_effect=block item の充足状態が欠けている: {missing}"
                )
            if extra:
                findings.append(
                    f"matrix[{cat_id}][{pf}]: カタログに無い required_info item_id: {extra} "
                    "(充足件数を自前で増やせてしまう)"
                )
    return findings


def _derive_aggregate(cells: list[str]) -> str:
    """セル状態集合から真理値表でカテゴリ集約状態を導出する。"""
    if all(c == "未収集" for c in cells):
        return "未着手"
    if all(c == "対象外" for c in cells):
        return "対象外"
    if any(c == "未収集" for c in cells):
        return "収集中"
    return "確定"


def validate(
    data: dict,
    require_complete: bool = False,
    require_counted_required_info: bool = False,
) -> list[str]:
    """`require_counted_required_info` を既定 off にしてある理由。

    この検査は「確定セルは block item の充足を記録しているか、記録が無いことを
    `required_info_checks` で裏取りしているか」を要求する。**既存の合成 matrix は
    その記録を持たない** — 本文の検査 (aggregate 導出・design_applications 契約など) を
    見るための最小の matrix であり、C16 の記録欄はそこに含まれていない。既定 on にすると、
    確定セルを 1 つでも作る合成 matrix が全部落ちる (実測 19 本)。

    そこで既定を変えず opt-in にした。**これは検査を緩めたのではなく、既存の
    「valid complete とは何か」の定義を、この作業の裁量で書き換えないための線引きである。**
    既定に入れるかどうかは、全 fixture へ記録欄を足す是非とセットで決める話であり、
    その判断はこの検査の追加とは別の変更に属する。
    """

    findings: list[str] = []

    categories = data.get("categories")
    matrix = data.get("matrix")
    if not isinstance(categories, list) or not categories:
        findings.append("categories: 非空配列でない")
        return findings
    if not isinstance(matrix, dict) or not matrix:
        findings.append("matrix: 非空オブジェクトでない")
        return findings

    cat_ids = []
    for c in categories:
        if not isinstance(c, dict) or not c.get("id"):
            findings.append(f"categories: id 欠落エントリ ({c!r})")
            continue
        # 重複 category id は同一 matrix 行を二重評価し、片方の定義を静かに握り潰す
        if c["id"] in cat_ids:
            findings.append(f"categories: id={c['id']!r} が重複 (matrix 行が二重に評価される)")
            continue
        cat_ids.append(c["id"])

    # カテゴリ軸床: goal-spec 例示カテゴリを最低含むか除外根拠 (excluded_categories) を持つ
    excluded = set(data.get("excluded_categories", {}) or {})
    missing_cat = [
        g for g in GOAL_SPEC_CATEGORIES if g not in cat_ids and g not in excluded
    ]
    if missing_cat:
        findings.append(
            f"カテゴリ軸床: goal-spec 例示カテゴリ {missing_cat} が未定義かつ除外根拠 (excluded_categories) 無し"
        )

    # 参照先 ID の一意性検査 (集合化で重複を潰す前に検査する)
    qa_ids, qa_findings = _collect_unique_ids(data.get("qa_log"), "qa_log")
    approval_ids, approval_findings = _collect_unique_ids(data.get("approval_log"), "approval_log")
    findings.extend(qa_findings)
    findings.extend(approval_findings)
    # 両ログは ref_ids へ統合されるため、ログを跨いだ id 衝突も参照先を一意に定められなくする
    collision = sorted(qa_ids & approval_ids)
    if collision:
        findings.append(
            f"qa_log/approval_log: id {collision} が両ログに重複 (qa_ref の参照先が一意に定まらない)"
        )
    ref_ids = qa_ids | approval_ids
    # 承認主張の突合用に qa_log entry の本文 (question + answer) を id 索引する。
    qa_entry_text: dict[str, str] = {}
    qa_entries: dict[str, dict] = {}
    for entry in data.get("qa_log") or []:
        if isinstance(entry, dict) and isinstance(entry.get("id"), str):
            qa_entries[entry["id"]] = entry
            qa_entry_text[entry["id"]] = " ".join(
                str(entry.get(key, "")) for key in ("question", "answer")
            )
            findings.extend(_validate_design_application_provenance(entry))

    unresolved = 0
    confirmed_qa_refs: set[str] = set()
    confirmed_non_qa_refs: set[str] = set()
    for cat_id in cat_ids:
        row = matrix.get(cat_id)
        if not isinstance(row, dict):
            findings.append(f"matrix[{cat_id}]: 行が存在しない/オブジェクトでない")
            continue

        # 必須プラットフォーム行の全存在
        missing_pf = [p for p in CANONICAL_PLATFORMS if p not in row]
        if missing_pf:
            findings.append(f"matrix[{cat_id}]: 必須 platform {missing_pf} が欠落")

        cells: list[str] = []
        for pf in CANONICAL_PLATFORMS:
            cell = row.get(pf)
            if cell is None:
                continue
            if not isinstance(cell, dict):
                findings.append(f"matrix[{cat_id}][{pf}]: セルがオブジェクトでない")
                continue
            state = cell.get("state")
            if state not in CELL_STATES:
                findings.append(
                    f"matrix[{cat_id}][{pf}]: state={state!r} が {sorted(CELL_STATES)} 外"
                )
                continue
            cells.append(state)
            if state == "未収集":
                unresolved += 1
            elif state == "対象外":
                if not (cell.get("reason") or cell.get("approval_ref") in approval_ids):
                    findings.append(
                        f"matrix[{cat_id}][{pf}]: 対象外だが reason も approval_ref も無い"
                    )
            elif state == "確定":
                qa_ref = cell.get("qa_ref")
                if not qa_ref:
                    findings.append(f"matrix[{cat_id}][{pf}]: 確定だが qa_ref が空")
                elif qa_ref not in ref_ids:
                    findings.append(
                        f"matrix[{cat_id}][{pf}]: 確定 qa_ref={qa_ref!r} が qa_log/approval_log に不在"
                    )
                elif qa_ref in qa_entries:
                    confirmed_qa_refs.add(qa_ref)
                else:
                    confirmed_non_qa_refs.add(qa_ref)
                # 複数裏付け (qa_refs[])。単数 qa_ref は主参照として残り、この欄は
                # そこへ収まりきらない裏付けを足す。**足された ref も同じ検査に掛ける** —
                # 掛けないと、単数側だけ厳しく複数側は素通りという抜け道になり、
                # 裏付けを増やすほど検査が緩む形になる。
                extra_refs = cell.get("qa_refs")
                if extra_refs is not None:
                    if not isinstance(extra_refs, list) or not extra_refs:
                        findings.append(
                            f"matrix[{cat_id}][{pf}]: qa_refs は非空配列必須"
                        )
                    elif extra_refs[0] != qa_ref:
                        findings.append(
                            f"matrix[{cat_id}][{pf}]: qa_refs[0]={extra_refs[0]!r} が "
                            f"qa_ref={qa_ref!r} と不一致 (主参照は先頭に置く)"
                        )
                    elif len(set(extra_refs)) != len(extra_refs):
                        findings.append(
                            f"matrix[{cat_id}][{pf}]: qa_refs に重複がある "
                            "(同じ裏付けを二重に数えられる)"
                        )
                    else:
                        for extra in extra_refs[1:]:
                            if not isinstance(extra, str) or extra not in ref_ids:
                                findings.append(
                                    f"matrix[{cat_id}][{pf}]: qa_refs の {extra!r} が "
                                    "qa_log/approval_log に不在"
                                )
                            elif extra in qa_entries:
                                confirmed_qa_refs.add(extra)
                            else:
                                confirmed_non_qa_refs.add(extra)
                approval_ref = cell.get("approval_ref")
                if approval_ref is not None and approval_ref not in approval_ids:
                    findings.append(
                        f"matrix[{cat_id}][{pf}]: 確定 approval_ref={approval_ref!r} が approval_log に不在"
                    )
                # 承認主張 × 承認記録の突合 (F-0025)。回答本文が承認 id を引用しているのに
                # セルに approval_ref が無いと、確定セルから承認記録へ機械追跡できない。
                # 誤検出を避けるため「承認」という語ではなく appr-NNN の明示引用だけを見る。
                if approval_ref is None and qa_ref in qa_entry_text:
                    cited = _APPROVAL_ID_RE.findall(qa_entry_text[qa_ref])
                    known = sorted({c for c in cited if c in approval_ids})
                    if known:
                        findings.append(
                            f"matrix[{cat_id}][{pf}]: 確定の根拠 {qa_ref} が承認 {known} を引用しているが "
                            f"セルに approval_ref が無い (set-approval op で付与すること)"
                        )

        # 集約状態の真理値表照合 (宣言があれば)
        declared = (data.get("category_aggregate") or {}).get(cat_id)
        if declared is not None and cells:
            derived = _derive_aggregate(cells)
            if declared != derived:
                findings.append(
                    f"matrix[{cat_id}]: category_aggregate={declared!r} が真理値表導出 {derived!r} と不一致"
                )

    if require_complete and unresolved:
        findings.append(f"未収集セルが {unresolved} 件残存 (最終時は未収集 0 が必須)")

    if require_complete:
        schema_version = data.get("schema_version")
        findings.extend(_validate_state_schema_version(data))
        if require_counted_required_info:
            findings.extend(_validate_confirmed_required_info(data, cat_ids))
        marker_present = "design_application_contract_version" in data
        if not marker_present and schema_version != LEGACY_STATE_SCHEMA_VERSION:
            findings.append(
                "design_application_contract_version が欠落: schema 1.1 以降は "
                f"{DESIGN_APPLICATION_CONTRACT_VERSION!r} 必須"
            )
        if marker_present:
            version = data.get("design_application_contract_version")
        else:
            version = None
        if marker_present and version != DESIGN_APPLICATION_CONTRACT_VERSION:
            findings.append(
                "design_application_contract_version="
                f"{version!r} は {DESIGN_APPLICATION_CONTRACT_VERSION!r} 必須"
            )
        elif marker_present:
            for qa_ref in sorted(confirmed_non_qa_refs):
                findings.append(
                    f"確定 qa_ref={qa_ref!r}: schema 1.1 では design_applications を持つ "
                    "qa_log entry の参照が必須"
                )
            for qa_ref in sorted(confirmed_qa_refs):
                findings.extend(_validate_design_applications(qa_entries[qa_ref]))

    return findings


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description="収集マトリクス網羅性の決定論検証 (goal-spec C7)")
    ap.add_argument("--matrix", required=True, help="spec-state.json のパス")
    ap.add_argument(
        "--require-complete",
        action="store_true",
        help="最終時: 未収集セル 0 を必須にする (OUT1/C7 受入)",
    )
    ap.add_argument(
        "--require-foundation",
        action="store_true",
        help="上位概念 (requirements_foundation U1-U9 値ありまたは明示N/A)・decisions・goalトレースを検証 (C9・opt-in)",
    )
    ap.add_argument(
        "--require-counted-required-info",
        action="store_true",
        help=(
            "確定セルの C16 block item 充足を state 側から照合する (opt-in)。"
            "block item が 0 件の category は required_info を持たないのが正しいので、"
            "その 0 が『数えた 0』であることを required_info_checks で裏取りする。"
            "--require-complete と併用する"
        ),
    )
    args = ap.parse_args(argv)

    path = Path(args.matrix)
    if not path.is_file():
        print(f"matrix ファイルが存在しない: {args.matrix}", file=sys.stderr)
        return 2
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        print(f"matrix ファイルの JSON parse 失敗: {exc}", file=sys.stderr)
        return 2

    findings = validate(
        data,
        require_complete=args.require_complete,
        require_counted_required_info=args.require_counted_required_info,
    )
    if args.require_counted_required_info and not args.require_complete:
        findings.append(
            "--require-counted-required-info は --require-complete と併用する "
            "(未収集セルが残る途中状態では、確定セルだけを見ても C16 の充足は判定できない)"
        )
    if args.require_foundation:
        findings += validate_foundation(data)
    if findings:
        for f in findings:
            print(f"VIOLATION: {f}", file=sys.stderr)
        print(f"FAIL: {len(findings)} 件の網羅性違反", file=sys.stderr)
        return 1
    mode = "final(未収集0)" if args.require_complete else "loop"
    if args.require_counted_required_info:
        mode += "+counted-required-info(C16充足照合)"
    if args.require_foundation:
        mode += "+foundation(上位概念トレース)"
    print(f"OK: 収集マトリクス網羅性 ({mode}) を満たす")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
