"""Catalog, state, and source-reference helpers for deterministic spec compilation."""
from __future__ import annotations

import heapq
import json
import re
from pathlib import Path
from urllib.parse import urlparse

# --- plugin 共有定数 (apply-spec-transition.py / validate-coverage-matrix.py と SSOT 整合) ---
CANONICAL_PLATFORMS = (
    "web",
    "mobile",
    "tablet",
    "desktop-windows",
    "desktop-linux",
    "desktop-macos",
)
PLATFORM_LABELS = {
    "web": "Web",
    "mobile": "モバイル",
    "tablet": "タブレット",
    "desktop-windows": "デスクトップ (Windows)",
    "desktop-linux": "デスクトップ (Linux)",
    "desktop-macos": "デスクトップ (macOS)",
}
CELL_STATES = {"未収集", "対象外", "確定"}
# 集約状態 (真理値表 4 値)。confirmed 章 = 終端 (確定/対象外)、draft 章 = 進行中 (未着手/収集中)。
TERMINAL_AGGREGATES = {"確定", "対象外"}

# カテゴリ → 設計知識参照ポインタ。「対象ファイル集合」の SSOT は
# ref-system-design-knowledge/references/resource-map.yaml の read_when 記述。ハードコード写像は
# resource-map とドリフトし「カテゴリは一例・マトリクスが本質」原則 (8 例に閉じる) を破るため、
# 該当カテゴリ id を read_when 文字列にマッチさせて設計知識 .md 集合を実行時導出する
# (category_design_refs)。非正準カテゴリでも空落ちさせず汎用ポインタを添える。
# ただし「反映順序」の SSOT は resource-map の記述順ではなく knowledge-catalog.json の depends_on
# が定める位相順 (topo_order・goal-spec C14) である。resource-map は集合のみを保証し順序は保証しない
# ため、マッチしたファイル集合を _knowledge_topo_order() でソートし直す (issue-spec-knowledge-card-
# topo-order-violation)。
DESIGN_REF_BASE = "ref-system-design-knowledge/references"
_DESIGN_KNOWLEDGE_DIR = (
    Path(__file__).resolve().parents[1] / "skills" / "ref-system-design-knowledge" / "references"
)
_READ_WHEN_PAIRS: list[tuple[str, str]] | None = None
_DOCTRINE_REGISTRY: dict | None = None
_KNOWLEDGE_CATALOG: dict | None = None
_KNOWLEDGE_TOPO_ORDER: list[str] | None = None


def _knowledge_catalog() -> dict:
    """knowledge-catalog.json (C13/C14 SSOT) を読み込む (キャッシュ)。

    不在/破損は空 dict (呼び出し側 _knowledge_topo_order が空順序へ倒し、
    category_design_refs は resource-map 出現順のまま返す = 空落ち防止)。
    """
    global _KNOWLEDGE_CATALOG
    if _KNOWLEDGE_CATALOG is None:
        try:
            _KNOWLEDGE_CATALOG = json.loads(
                (_DESIGN_KNOWLEDGE_DIR / "knowledge-catalog.json").read_text(encoding="utf-8")
            )
        except (OSError, json.JSONDecodeError):
            _KNOWLEDGE_CATALOG = {}
    return _KNOWLEDGE_CATALOG


def _knowledge_topo_order() -> list[str]:
    """knowledge-catalog.json の depends_on から knowledge_id の位相順を導出する (キャッシュ)。

    `validate-knowledge-graph.py --profile knowledge --order` と同一アルゴリズム
    (Kahn 法: depends_on=0 のノードから同順位は knowledge_id 昇順で取り出す) をここでも
    再実装し、compile 時に subprocess を経由せず決定論的に同じ順序を得る (goal-spec C14)。
    循環等で validate 側が拒否する不正カタログでも例外にせず、解決可能な範囲のみ順序化する。
    """
    global _KNOWLEDGE_TOPO_ORDER
    if _KNOWLEDGE_TOPO_ORDER is None:
        entries = _knowledge_catalog().get("entries") or []
        depends_on: dict[str, set[str]] = {}
        for e in entries:
            if isinstance(e, dict) and e.get("knowledge_id"):
                depends_on[e["knowledge_id"]] = set(e.get("depends_on") or [])
        dependents: dict[str, list[str]] = {kid: [] for kid in depends_on}
        indegree: dict[str, int] = {}
        for kid, deps in depends_on.items():
            indegree[kid] = len([d for d in deps if d in depends_on])
            for d in deps:
                if d in dependents:
                    dependents[d].append(kid)
        heap = sorted(kid for kid, deg in indegree.items() if deg == 0)
        heapq.heapify(heap)
        order: list[str] = []
        while heap:
            kid = heapq.heappop(heap)
            order.append(kid)
            for nxt in dependents.get(kid, []):
                indegree[nxt] -= 1
                if indegree[nxt] == 0:
                    heapq.heappush(heap, nxt)
        _KNOWLEDGE_TOPO_ORDER = order
    return _KNOWLEDGE_TOPO_ORDER


def _doctrine_registry() -> dict:
    """doctrine-anchor-registry.json (C15 SSOT) を読み込む (キャッシュ)。

    不在/破損は空 dict (呼び出し側が未帰属注記へ倒す。写像全射の検証は
    validate-knowledge-graph.py --profile doctrine が担い、本 writer は再検証しない)。
    """
    global _DOCTRINE_REGISTRY
    if _DOCTRINE_REGISTRY is None:
        try:
            _DOCTRINE_REGISTRY = json.loads(
                (_DESIGN_KNOWLEDGE_DIR / "doctrine-anchor-registry.json").read_text(
                    encoding="utf-8"
                )
            )
        except (OSError, json.JSONDecodeError):
            _DOCTRINE_REGISTRY = {}
    return _DOCTRINE_REGISTRY


def _resource_map_read_when() -> list[tuple[str, str]]:
    """resource-map.yaml から (file, read_when) 対を stdlib 最小パーサで抽出する (キャッシュ)。

    resource-map の list 構造 (`- file:` / `topic:` / `read_when:`) だけを解釈し、外部依存
    (PyYAML) を増やさない。ファイル不在・IO エラーは空リスト (呼び出し側が汎用ポインタへ倒す)。
    """
    global _READ_WHEN_PAIRS
    if _READ_WHEN_PAIRS is None:
        pairs: list[tuple[str, str]] = []
        try:
            text = (_DESIGN_KNOWLEDGE_DIR / "resource-map.yaml").read_text(encoding="utf-8")
        except OSError:
            text = ""
        cur_file: str | None = None
        for raw in text.splitlines():
            s = raw.strip()
            if s.startswith("- "):
                s = s[2:].strip()
            if s.startswith("file:"):
                cur_file = s[len("file:") :].strip()
            elif s.startswith("read_when:") and cur_file:
                pairs.append((cur_file, s[len("read_when:") :].strip()))
                cur_file = None
        _READ_WHEN_PAIRS = pairs
    return _READ_WHEN_PAIRS


def category_design_refs(cat_id: str) -> list[str]:
    """resource-map.yaml の read_when にカテゴリ id が現れる設計知識 .md を実行時導出する。

    対象ファイル集合の SSOT = resource-map.yaml。ハードコード写像を排し、read_when の
    対応関係のみを唯一の根拠にするため任意カテゴリへ開く (正準 8 例に閉じない)。
    無マッチは空 (呼び出し側 render_design_refs が汎用ポインタを添える = 空落ち防止)。
    反映順序は resource-map の記述順ではなく knowledge-catalog.json の位相順 (topo_order・
    goal-spec C14) に従って並べ替える (依存先の知識を依存元より先に反映する)。
    knowledge-catalog.json に未登録のファイル (knowledge_id 不明) は位相順の対象外として
    resource-map 出現順の相対位置を保つ (空落ち防止・未知知識を機械的に落とさない)。
    """
    matched: list[str] = []
    for fname, read_when in _resource_map_read_when():
        if fname.endswith(".md") and cat_id in read_when and fname not in matched:
            matched.append(fname)
    if len(matched) < 2:
        return matched
    file_to_id = {
        e["file"]: e["knowledge_id"]
        for e in (_knowledge_catalog().get("entries") or [])
        if isinstance(e, dict) and e.get("file") and e.get("knowledge_id")
    }
    order = _knowledge_topo_order()

    def _sort_key(item: tuple[int, str]) -> tuple[int, int]:
        original_index, fname = item
        kid = file_to_id.get(fname)
        if kid is not None and kid in order:
            return (0, order.index(kid))
        return (1, original_index)

    ranked = sorted(enumerate(matched), key=_sort_key)
    return [fname for _, fname in ranked]


def _canonical_category_ids() -> list[str]:
    """system-category-taxonomy.json (C04 SSOT) の正準カテゴリ id 群を返す。"""
    try:
        tax = json.loads(
            (_DESIGN_KNOWLEDGE_DIR / "system-category-taxonomy.json").read_text(encoding="utf-8")
        )
    except (OSError, json.JSONDecodeError):
        return []
    return [c["id"] for c in tax.get("categories", []) if isinstance(c, dict) and c.get("id")]


# 正準カテゴリ (taxonomy SSOT) の materialized view。値は resource-map の read_when から導出され
# ハードコードでないためドリフトしない。描画は category_design_refs() を直接使い任意カテゴリへ開く
# ため、本 dict は正準集合の参照・検証用 (R2-render の「resource-map の read_when 対応を写像」)。
CATEGORY_DESIGN_REFS: dict[str, list[str]] = {
    cat_id: category_design_refs(cat_id) for cat_id in _canonical_category_ids()
}


class CompileError(Exception):
    """入力契約違反 (必須キー欠落等) を検出したときに送出する。"""


# --------------------------------------------------------------------------- #
# 集約状態 (真理値表・validate-coverage-matrix.py._derive_aggregate と同一定義)  #
# --------------------------------------------------------------------------- #
def derive_aggregate(cells: list[str]) -> str:
    """セル状態集合からカテゴリ集約状態を真理値表で導出する。

    全セル未収集 -> 未着手 / 全セル対象外 -> 対象外 /
    未収集混在 -> 収集中 / それ以外で未収集0 -> 確定。
    """
    if not cells:
        return "未着手"
    if all(c == "未収集" for c in cells):
        return "未着手"
    if all(c == "対象外" for c in cells):
        return "対象外"
    if any(c == "未収集" for c in cells):
        return "収集中"
    return "確定"


# --------------------------------------------------------------------------- #
# spec-state 読み取りヘルパ                                                     #
# --------------------------------------------------------------------------- #
def _category_ids(spec: dict) -> list[str]:
    cats = spec.get("categories")
    if not isinstance(cats, list) or not cats:
        raise CompileError("spec-state: categories が非空配列でない")
    ids: list[str] = []
    for c in cats:
        if not isinstance(c, dict) or not c.get("id"):
            raise CompileError(f"spec-state: categories に id 欠落エントリ ({c!r})")
        ids.append(c["id"])
    return ids


def category_label(spec: dict, cat_id: str) -> str:
    for c in spec.get("categories", []):
        if isinstance(c, dict) and c.get("id") == cat_id:
            return c.get("label") or cat_id
    return cat_id


def _row(spec: dict, cat_id: str) -> dict:
    matrix = spec.get("matrix")
    if not isinstance(matrix, dict):
        raise CompileError("spec-state: matrix がオブジェクトでない")
    row = matrix.get(cat_id)
    if not isinstance(row, dict):
        raise CompileError(f"spec-state: matrix[{cat_id}] 行が存在しない")
    return row


def present_platforms(spec: dict, cat_id: str) -> list[str]:
    """カテゴリ行に存在する platform を canonical 順で返す。"""
    row = _row(spec, cat_id)
    return [pf for pf in CANONICAL_PLATFORMS if pf in row]


def cell_states(spec: dict, cat_id: str) -> list[str]:
    row = _row(spec, cat_id)
    return [row[pf].get("state") for pf in CANONICAL_PLATFORMS if pf in row]


def category_aggregate(spec: dict, cat_id: str) -> str:
    """集約状態を真理値表から導出する (宣言値ではなくセルから再計算し確定性を担保)。"""
    return derive_aggregate([s for s in cell_states(spec, cat_id) if s])


def chapter_status(aggregate: str) -> str:
    """章 frontmatter の確定マーカー。終端 (確定/対象外) は confirmed、進行中は draft。"""
    return "confirmed" if aggregate in TERMINAL_AGGREGATES else "draft"


def spec_cell_ids(spec: dict, cat_id: str) -> list[str]:
    """章に対応する spec-state マトリクスセル id (<category>.<platform>) を canonical 順で返す。"""
    return [f"{cat_id}.{pf}" for pf in present_platforms(spec, cat_id)]


# --------------------------------------------------------------------------- #
# 上位概念 (requirements_foundation) / serves_goals トレース — 要件 C9          #
# --------------------------------------------------------------------------- #
REQUIREMENTS_CHAPTER = "00-requirements-definition.md"


def requirements_foundation(spec: dict) -> dict:
    """spec-state.json の requirements_foundation を返す (不在時は空 dict)。"""
    rf = spec.get("requirements_foundation")
    return rf if isinstance(rf, dict) else {}


def foundation_status(spec: dict) -> str:
    """要件定義章の確定マーカー。requirements_foundation.confirmed が真なら confirmed。"""
    return "confirmed" if requirements_foundation(spec).get("confirmed") else "draft"


def chapter_serves_goals(spec: dict, cat_id: str) -> list[str]:
    """章 (カテゴリ) の serves_goals を、各セルの serves_goals の和集合として順序保持で返す。

    確定セルに付与された上位概念トレース (serves_goals) をカテゴリ粒度へ集約する。
    canonical platform 順に走査し、初出順で重複除去する。
    """
    row = _row(spec, cat_id)
    out: list[str] = []
    for pf in CANONICAL_PLATFORMS:
        cell = row.get(pf)
        if not isinstance(cell, dict):
            continue
        for gid in cell.get("serves_goals") or []:
            if isinstance(gid, str) and gid and gid not in out:
                out.append(gid)
    return out


# --------------------------------------------------------------------------- #
# 出典記録 (fetched-references) の章割り当て                                    #
# --------------------------------------------------------------------------- #
def _target_category_map(spec: dict) -> dict[str, str]:
    """targets[{target_id, category}] から target_id -> category を作る (category 任意)。"""
    out: dict[str, str] = {}
    for t in spec.get("targets", []) or []:
        if isinstance(t, dict) and t.get("target_id") and t.get("category"):
            out[t["target_id"]] = t["category"]
    return out


def references_by_category(spec: dict, refs_data: dict) -> tuple[dict[str, list[dict]], list[dict]]:
    """fetched-references を章 (カテゴリ) 別に振り分ける。

    target の category が解決できる参照は該当章へ、解決できない参照は
    未割当 (index の全体出典一覧へ) として返す。戻り値は (章別 dict, 未割当 list)。
    """
    cat_map = _target_category_map(spec)
    by_cat: dict[str, list[dict]] = {}
    unassigned: list[dict] = []
    refs = refs_data.get("references")
    if not isinstance(refs, list):
        raise CompileError("fetched-references: references が配列でない")
    for ref in refs:
        if not isinstance(ref, dict) or not ref.get("target_id"):
            continue
        cat = cat_map.get(ref["target_id"])
        if cat:
            by_cat.setdefault(cat, []).append(ref)
        else:
            unassigned.append(ref)
    return by_cat, unassigned


def _ref_version(ref: dict) -> str:
    return str(ref.get("version") or ref.get("last_updated") or "-")


def _ref_host(ref: dict) -> str:
    host = ref.get("official_host") or ""
    if not host and ref.get("source_url"):
        host = urlparse(ref["source_url"]).netloc
    return host or "-"


# --------------------------------------------------------------------------- #
