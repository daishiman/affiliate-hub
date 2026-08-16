#!/usr/bin/env python3
# /// script
# name: guard-confirmed-chapter-overwrite
# version: 0.1.0
# purpose: 確定済み仕様章 (system-spec/ の status:confirmed 章 かつ 正本 spec-state.json の
#          対応セルが『確定』・非再オープン) と 正本 spec-state.json 自身への Write/Edit/Bash 動的書換を
#          PreToolUse で遮断する defense-in-depth の層別 fail-closed hook (要件 C3 の派生安全要件)。
#          正本防御は C01/C03 の単一 writer/transition gate。本 hook は二重化の補助防御。
#          正本位置は spec-state-contract.md「正本位置」節で確定した
#          $CLAUDE_PROJECT_DIR/system-spec/spec-state.json の 1 経路のみ (配下 rglob 探索は持たない)。
# inputs:
#   - stdin: PreToolUse hook JSON ({tool_name, tool_input{file_path|command}})
#   - env: CLAUDE_PROJECT_DIR (正本 system-spec/spec-state.json の探索起点。未設定時は cwd)
# outputs:
#   - exit: 0=許可 / 2=ブロック(stderr に理由)。判定は層別:
#           (1) 正本 spec-state.json への直接/動的書換は fail-closed (確定巻き戻し防御)。
#           (2) status:confirmed 章 Write/Edit かつ 正本 spec-state 解決不能は confirmed 章限定で fail-closed。
#           (3) それ以外の章判定は誤爆回避優先 (明確に protected でないものは通す)。
# contexts: [E]
# network: false
# write-scope: none
# dependencies: []
# requires-python: ">=3.9"
# ///
"""PreToolUse(Write|Edit|MultiEdit|Bash) 確定章 / 憲法章 / 正本 spec-state.json 保護ガード。

判定ソース (章保護 = 2 系統の論理積・章粒度の集約):
  1. system-spec/ 配下の章 Markdown の frontmatter 確定マーカー `status: confirmed`
     (対象パス自身を load して判定する。別ファイルの内容には依存しない)
  2. C03 実出力 frontmatter の `spec_cells:[<cat>.<pf>, ...]` (後方互換で単一
     `cell`/`cell_id`/`spec_cell` や `category`+`platform` も可) が指す全対応セルが
     正本 spec-state.json 上で終端状態 (確定 or 対象外) かつ再オープン対象を含まないこと

正本位置 (SSOT): `spec-state.json` の判定ソースは `<root>/system-spec/spec-state.json` の 1 経路のみ。
  配下 rglob フォールバックは持たない (同梱 fixture 等を判定ソースに拾う交差汚染を構造的に排除)。

Write|Edit|MultiEdit:
  (a) file_path が正本 spec-state.json (実パス一致) かつ確定 (非再オープン) セルを含むなら exit2
      (Bash 経路と同格の直接書換/確定巻き戻し防御)。別位置の同名 spec-state.json は正本でなく通す。
  (b) file_path が status:confirmed 章 かつ 上記 2 条件を満たす確定章なら exit2。
      spec_cells を持たない憲法章 (要件定義書・category:requirements-definition) も、
      requirements_foundation が confirmed なら確定物として exit2 (a5w.2)。
  (c) file_path が status:confirmed 章 だが 正本 spec-state を解決できない (load 不能) ときは
      confirmed 章限定で安全側 exit2 (F3 層別 fail-closed。誤爆範囲は confirmed 章に限定)。
  それ以外 (通常ファイル・未確定/再オープン章・新規章・foundation 未確定憲法章) は exit0 で素通し。

Bash:
  読み取り専用コマンド (cat/grep/ls 等・書込指標なし) は保護パス参照でも exit0。
  書込コマンド (リダイレクト/sed -i/tee/cp/mv/rm/dd/truncate/python の open(...,'w') 等) が
    - 正本 spec-state.json (system-spec/spec-state.json) を書換対象にする
    - 解決可能な確定章を書換対象にする
    - 保護領域 (system-spec/ 配下・パス境界一致) を参照する曖昧な動的書換 (glob/変数/find 経由) である
  いずれかなら安全側で exit2。再オープン章・新規章への具体的書込は通す。
  判定は `system-spec/` をパス境界 (完全なパスセグメント) として扱い、自plugin パスの
  `system-spec-harness/` 等を部分文字列で誤検出しない。

fail-closed 方針 (層別): 正本 spec-state を参照する危険な動的 Bash 書換 と、正本 spec-state 解決不能な
confirmed 章 Write/Edit のみ安全側で拒否する (計画 C11 exit_semantics=fail-closed-exit2)。それ以外の章判定は
「明確に protected と判定できないなら通す」を基本にする (誤爆回避優先)。全書換経路の正本防御は
C01/C03 の単一 writer/transition gate が担う。本 hook は補助 (二重化)。

block ゲートとの相補関係 (C16/C14): required-info-catalog.json の missing_effect=block item が未充足の
間は、そもそも当該セルの confirmed 遷移自体が上流の C01 R5 収集ゲート (elicit 時の prose ゲート) で
禁止される (validate-knowledge-graph.py --profile required-info は coverage certificate に blocking_items を
列挙するのみで runtime 施行はせず、C01 R5 がその certificate を消費して施行する。決定論 writer 施行 =
apply-spec-transition への block 検査組込は required-info 回答スキーマ拡張を要する follow-up)。すなわち
「未収集の必須情報を残したまま確定させない」のは上流の収集ゲート側の責務。本 hook はその結果 confirmed になった章の
事後的な上書き/巻き戻しを防ぐ層であり、block ゲートとは前段 (確定させない) / 後段 (確定を保護) の
相補的な二層をなす。本 hook 側で block 未充足を再判定・遮断することはしない (責務境界の明確化)。
"""
from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

CONFIRMED = "確定"
GUARD_NAME = "guard-confirmed-chapter-overwrite"
# 正本位置 (spec-state-contract.md「正本位置」節): <root>/system-spec/spec-state.json の 1 経路のみ。
SPEC_DIR = "system-spec"
SPEC_STATE_NAME = "spec-state.json"
# Bash コマンド内で正本 spec-state を参照しているかの判定に使う末尾構造 (system-spec/spec-state.json)。
_CANONICAL_SUFFIX = f"{SPEC_DIR}/{SPEC_STATE_NAME}"
# 章保護の終端セル状態 (確定 or 対象外)。両者とも settled であり確定章に含まれ得る
# (例: security 章 = web/mobile/tablet 確定 + desktop×3 対象外 の混在でも status:confirmed)。
TERMINAL_STATES = {"確定", "対象外"}
# writer (apply-spec-transition.py apply_cell_op reopen) が確定巻き戻し時に付す正本キー
# (reopened_from/reopen_reason) + 後方互換キー。いずれかがあれば当該セルは R4-reopen 済み。
_REOPEN_KEYS = ("reopened_from", "reopen_reason", "reopened", "reopen", "reopened_at", "reopened_by")

# 記録・生成物 (保護対象外)。確定物ではなく「都度再生成される」ファイルで、正規 writer
# (C02 build-fetched-references / C03 compile / evaluator) が上書きするのが正常動作。これらへの
# 書込は監査経路 (R4-reopen) を要さないため遮断しない。境界定義: references/hook-guard-protection-scope.md。
EXEMPT_NAMES = frozenset(
    {
        "fetched-references.json",  # C02 の取得記録 (都度全上書きが正規)
        "index.md",                 # C03 の相互参照索引 (status 無し・純生成物)
        "completeness-report.json",  # evaluator の評価レポート
        "completeness-findings.json",  # evaluator の findings
    }
)

# system-spec/ を参照する書込で in-place 変更を行うツール群 (対象ファイルを引数で受ける)。
_MUTATION_TOOLS = (
    (re.compile(r"\bsed\s+(?:-[a-zA-Z]*i|--in-place)\b"), "sed -i"),
    (re.compile(r"\btee\b"), "tee"),
    (re.compile(r"\bcp\b"), "cp"),
    (re.compile(r"\bmv\b"), "mv"),
    (re.compile(r"\brm\b"), "rm"),
    (re.compile(r"\bdd\b"), "dd"),
    (re.compile(r"\btruncate\b"), "truncate"),
    (re.compile(r"\binstall\b"), "install"),
    (re.compile(r"\bln\b"), "ln"),
)
# python ワンライナ等での書込操作。
_PY_WRITE = re.compile(
    r"""open\s*\([^)]*['"][wax]\+?b?['"]"""
    r"""|write_text\s*\("""
    r"""|\.write\s*\("""
    r"""|json\.dump\s*\("""
    r"""|os\.(?:remove|unlink|rename|replace)\s*\("""
    r"""|shutil\.(?:copy|move|rmtree)\s*\("""
)
# 出力リダイレクト (`>`/`>>`) の対象トークン。`2>&1` 等の fd 複製は (?!&) で除外。
_REDIRECT = re.compile(r"""\d*>>?\s*(?!&)("[^"]*"|'[^']*'|[^\s;|&>]+)""")
# 保護領域 (system-spec/ ディレクトリ) をパス境界 (完全なパスセグメント) で参照しているか。
# 前後をデリミタ/末尾で束ねるため、自plugin パスの `system-spec-harness` (直後が '-') には発火しない。
_PROTECTED_SEG = re.compile(r"""(?:^|[\s;|&<>()'"=/])system-spec(?:/|[\s;|&<>()'"]|$)""")


# ── パス種別判定 ────────────────────────────────────────────────────────────
def _is_system_spec_md(p: Path) -> bool:
    """system-spec/ 配下の .md か (system-spec を完全なパスセグメントとして判定)。"""
    return p.suffix == ".md" and SPEC_DIR in p.parts


def project_root() -> Path:
    """正本 system-spec/spec-state.json の探索起点。env 優先・無ければ cwd。"""
    env = os.environ.get("CLAUDE_PROJECT_DIR", "").strip()
    if env and Path(env).is_dir():
        return Path(env)
    return Path.cwd()


# ── frontmatter / spec-state 読み取り ───────────────────────────────────────
def parse_frontmatter(text: str) -> dict:
    """章 Markdown の YAML 風 frontmatter (--- ... ---) をスカラ辞書へ。"""
    if not text.startswith("---"):
        return {}
    parts = text.split("---", 2)
    if len(parts) < 3:
        return {}
    fm: dict = {}
    for raw in parts[1].splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or ":" not in line:
            continue
        k, _, v = line.partition(":")
        fm[k.strip()] = v.split("#", 1)[0].strip().strip('"').strip("'")
    return fm


def _parse_spec_cells(raw) -> list[tuple[str, str]]:
    """frontmatter の spec_cells を (category, platform) 列へ。

    C03 実出力は `spec_cells: [database.web, database.mobile, ...]` (`.` 区切り list)。
    parse_frontmatter はこれをスカラ文字列 '[database.web, ...]' として渡すため
    文字列/リスト双方を受け、各要素を最初の '.' で category/platform に分割する
    (category・platform とも '.' を含まないため一意)。
    """
    if isinstance(raw, str):
        s = raw.strip()
        if s.startswith("[") and s.endswith("]"):
            s = s[1:-1]
        items = [x.strip() for x in s.split(",")]
    elif isinstance(raw, (list, tuple)):
        items = [str(x).strip() for x in raw]
    else:
        return []
    out: list[tuple[str, str]] = []
    for it in items:
        cat, sep, pf = it.partition(".")
        if sep and cat.strip() and pf.strip():
            out.append((cat.strip(), pf.strip()))
    return out


def _extract_cell_refs(fm: dict) -> list[tuple[str, str]]:
    """frontmatter から spec-state 対応セル (category, platform) 群を得る。

    C03 実出力 (`category` + `spec_cells:[<cat>.<pf>, ...]`) を第一に解釈し、後方互換で
    単一 `cell`/`cell_id`/`spec_cell` (区切り /:|) や `category`+`platform` (単数) も解釈する。
    重複は排除し frontmatter 出現順を保つ。
    """
    refs: list[tuple[str, str]] = []
    seen: set[tuple[str, str]] = set()

    def _add(cat: str, plat: str) -> None:
        key = (cat.strip(), plat.strip())
        if key[0] and key[1] and key not in seen:
            seen.add(key)
            refs.append(key)

    # C03 実形状: spec_cells list
    for cat, plat in _parse_spec_cells(fm.get("spec_cells")):
        _add(cat, plat)
    # 後方互換: 単一 cell 系キー
    for key in ("cell", "cell_id", "spec_cell"):
        v = fm.get(key)
        if isinstance(v, str) and v:
            for sep in ("/", ":", "|"):
                if sep in v:
                    cat, _, plat = v.partition(sep)
                    _add(cat, plat)
                    break
    # 後方互換: category + platform (単数)
    cat, plat = fm.get("category"), fm.get("platform")
    if cat and plat:
        _add(cat, plat)
    return refs


def canonical_spec_state_path(root: Path) -> Path:
    """正本 spec-state.json の絶対想定パス (<root>/system-spec/spec-state.json)。"""
    return root / SPEC_DIR / SPEC_STATE_NAME


def load_spec_state(root: Path) -> dict | None:
    """正本位置 <root>/system-spec/spec-state.json のみを判定ソースに読む。

    配下 rglob フォールバックは持たない (同梱 fixture 等の別 spec-state.json を
    判定ソースに拾う交差汚染を構造的に排除する。spec-state-contract.md「正本位置」節)。
    """
    p = canonical_spec_state_path(root)
    if not p.exists():
        return None
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else None
    except (OSError, json.JSONDecodeError):
        return None


def _resolve_cell(spec: dict, category: str, platform: str):
    if not isinstance(spec, dict):
        return None
    row = (spec.get("matrix") or {}).get(category)
    if not isinstance(row, dict):
        return None
    return row.get(platform)


def _cell_reopened(cell: dict) -> bool:
    """セルが R4-reopen 済みか。writer 正本キー reopened_from/reopen_reason を第一に見る。

    apply-spec-transition.py の reopen は確定巻き戻し時に
    {"state":"未収集","reopened_from":"確定","reopen_reason":...} を書く。従来 hook が見ていた
    reopened/reopen/reopened_at/reopened_by は writer 実出力に存在せず死んでいたため正本キーへ整合。
    """
    return any(cell.get(k) for k in _REOPEN_KEYS)


def _cell_terminal(cell) -> bool:
    """セルが終端状態 (確定 or 対象外) かつ再オープンされていない (=保護対象) か。

    R4-reopen 済み (state が 未収集 へ戻る / reopen 正本キー付与) のセルは保護しない (通す)。
    """
    if not isinstance(cell, dict):
        return False
    if _cell_reopened(cell):
        return False
    return cell.get("state") in TERMINAL_STATES


# ── 憲法章 (要件定義書) 判定 ────────────────────────────────────────────────
# 憲法章 = spec_cells を持たないが requirements_foundation (U1-U9) を正本とする確定章。
# 対応セルが無いため従来は「対応セル不明」で通していたが (protection 漏れ)、foundation が
# confirmed のときは確定物として保護する (a5w.2)。
_CONSTITUTION_CATEGORY = "requirements-definition"
_CONSTITUTION_NAME = "00-requirements-definition.md"


def _is_constitution_chapter(p: Path, fm: dict) -> bool:
    """章 p が憲法章 (要件定義書) か。frontmatter category を第一に、ファイル名を後方互換で見る。"""
    return fm.get("category") == _CONSTITUTION_CATEGORY or p.name == _CONSTITUTION_NAME


def _foundation_confirmed(spec: dict) -> bool:
    """正本 spec-state の requirements_foundation が確定済み (confirmed:true) か。"""
    f = spec.get("requirements_foundation") if isinstance(spec, dict) else None
    return isinstance(f, dict) and bool(f.get("confirmed"))


# ── 確定章の層別判定 ────────────────────────────────────────────────────────
# chapter_verdict の戻り値 enum。
_V_PASS = "pass"                       # 明確に protected でない → 通す (誤爆回避優先)
_V_PROTECTED = "protected"             # status:confirmed かつ全対応セル終端・非再オープン → exit2
_V_CONFIRMED_UNRESOLVED = "confirmed_unresolved"  # confirmed だが正本 spec-state 解決不能 → 安全側 exit2


def chapter_verdict(p: Path, root: Path) -> str:
    """章ファイル p の確定章判定を層別に返す (対象パス自身を load して判定)。

    - `pass`: system-spec 外 / 新規 (ファイル不在) / draft / 再オープン・未終端セルを含む章。
       誤爆回避優先で通す。
    - `protected`: status:confirmed かつ対応セルが 1 つ以上解決でき、その全てが正本 spec-state 上で
       終端状態 (確定 or 対象外) かつ再オープン対象を含まない。security 章のような 確定+対象外 混在も
       status:confirmed なら (全セル終端ゆえ) 保護する。
    - `confirmed_unresolved`: status:confirmed だが 正本 spec-state を load できない (F3 層別
       fail-closed)。誤爆範囲は confirmed 章に限定される。

    章の確定マーカー (status:confirmed) は対象パス自身の frontmatter から読む。spec-state は
    再オープン/未終端で保護を「緩める」ためだけに参照する (保護を作り出すのは章自身の confirmed)。
    """
    if not _is_system_spec_md(p):
        return _V_PASS
    fpath = p if p.is_absolute() else (root / p)
    if not fpath.is_file():
        return _V_PASS  # 新規 Write
    try:
        text = fpath.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return _V_PASS
    fm = parse_frontmatter(text)
    if fm.get("status") != "confirmed":
        return _V_PASS  # draft 等
    # ここから status:confirmed。正本 spec-state が解決できないなら confirmed 章限定で fail-closed。
    spec = load_spec_state(root)
    if spec is None:
        return _V_CONFIRMED_UNRESOLVED
    refs = _extract_cell_refs(fm)
    if not refs:
        # 憲法章 (要件定義書) は spec_cells を持たないが foundation を正本とする確定章。
        # foundation が confirmed なら確定物として保護する (a5w.2)。draft foundation や
        # その他の対応セル不明章は誤爆回避で通す。
        if _is_constitution_chapter(p, fm) and _foundation_confirmed(spec):
            return _V_PROTECTED
        return _V_PASS
    # 章粒度の集約: 全対応セルが終端かつ非再オープンのときだけ保護。1 つでも
    # 非終端 / 再オープン / 解決不能セルがあれば「明確に protected」でない → 通す。
    for cat, plat in refs:
        if not _cell_terminal(_resolve_cell(spec, cat, plat)):
            return _V_PASS
    return _V_PROTECTED


def chapter_protected(p: Path, root: Path) -> bool:
    """章 p が確定章 (全対応セル終端で保護対象) か。Bash 経路の確定章遮断に使う。

    Write/Edit 経路の層別 fail-closed (`confirmed_unresolved`) は `chapter_verdict` を直接使う。
    """
    return chapter_verdict(p, root) == _V_PROTECTED


# ── 正本 spec-state.json 直接書換ガード ─────────────────────────────────────
def _is_canonical_spec_state(p: Path, root: Path) -> bool:
    """対象が正本 spec-state.json (<root>/system-spec/spec-state.json) 自身か。

    実パス一致でのみ True。別位置の同名 spec-state.json (テスト fixture 等) は正本でないため
    False (交差汚染回避)。判定対象と判定ソースが常に同一ファイルになる。
    """
    canon = canonical_spec_state_path(root)
    try:
        return p.resolve() == canon.resolve()
    except OSError:
        return False


def _token_is_canonical_spec_state(token: str) -> bool:
    """Bash トークンが正本 spec-state.json (system-spec/spec-state.json) を末尾構造で指すか。"""
    p = Path(token)
    return p.name == SPEC_STATE_NAME and len(p.parts) >= 2 and p.parts[-2] == SPEC_DIR


def spec_state_has_confirmed_cell(root: Path) -> bool:
    """正本 spec-state.json に確定 (非再オープン) セルが 1 つでもあるか。

    True のとき正本 spec-state.json は確定巻き戻しの温床になり得るため直接 Write/Edit を遮断する。
    確定セルなし (init 直後・全 未収集/対象外) は通す (新規作成/初期化を妨げない)。
    """
    spec = load_spec_state(root)
    if not isinstance(spec, dict):
        return False
    matrix = spec.get("matrix")
    if not isinstance(matrix, dict):
        return False
    for row in matrix.values():
        if not isinstance(row, dict):
            continue
        for cell in row.values():
            if isinstance(cell, dict) and not _cell_reopened(cell) and cell.get("state") == CONFIRMED:
                return True
    return False


# ── Bash 解析 ───────────────────────────────────────────────────────────────
def _redirect_targets(cmd: str) -> list[str]:
    out = []
    for m in _REDIRECT.finditer(cmd):
        t = m.group(1).strip().strip('"').strip("'")
        # /dev/null 等の捨て先は書込対象でない。`2>/dev/null`/`>/dev/null` を書込指標に
        # 数えると、保護領域を read するだけのコマンド (find/wc/grep) を誤遮断する (FP)。
        if not t or t.startswith("/dev/"):
            continue
        out.append(t)
    return out


def _system_spec_md_tokens(cmd: str) -> list[str]:
    """コマンド中の system-spec/ 配下 .md らしきトークンを抽出 (パス境界判定)。

    system-spec を完全なパスセグメントとして持つトークンのみを拾い、自plugin パスの
    `system-spec-harness/...md` (system-spec が独立セグメントでない) は拾わない。
    """
    toks = []
    for raw in re.split(r"[\s;|&<>()'\"]+", cmd):
        if not raw or not raw.endswith(".md"):
            continue
        if SPEC_DIR in Path(raw).parts:
            toks.append(raw)
    return toks


def _token_is_protected_chapter(token: str, root: Path) -> bool:
    return chapter_protected(Path(token), root)


def _refs_canonical_spec_state(cmd: str) -> bool:
    """コマンドが正本 spec-state (system-spec/spec-state.json) を参照するか。"""
    return _CANONICAL_SUFFIX in cmd


def _refs_protected_area(cmd: str) -> bool:
    """コマンドが保護領域 (system-spec/ ディレクトリ) をパス境界付きで参照するか。

    `system-spec-harness/` 等の自plugin パス部分文字列では発火しない (パスセグメント境界一致)。
    """
    return bool(_PROTECTED_SEG.search(cmd))


# docs/ 直下の詳細正本 (`docs/<name>-spec.md`)。system-spec/ 外で compile 対象外・手動維持・
# 再生成 writer を持たない非再生成正本 (実装粒度の確定値=データモデル/封筒暗号化/rate limit 等の唯一の所在)。
# Bash 書込 (scripted clobber / glob sweep) から守る。意図的 authoring は Edit/Write ツール経由を許可する
# (a5w.1 の docs/*-spec.md 保護。references/hook-guard-protection-scope.md §1/§4)。
_DOCS_DETAIL_SPEC = re.compile(r"(?:^|/)docs/[^/]*-spec\.md$")
_DOCS_DIRECT_GLOB = re.compile(r"(?:^|/)docs/[^/]*[*?\[][^/]*$")


def _is_docs_detail_spec_target(token: str) -> bool:
    """token が docs/ 直下の詳細正本 (<name>-spec.md) を指すか、docs/ 直下を sweep しうる
    glob (docs/*, docs/*.md, docs/*-spec.md) か。docs/features/... 等の非直下は対象外。"""
    return bool(_DOCS_DETAIL_SPEC.search(token) or _DOCS_DIRECT_GLOB.search(token))


def _target_exists(token: str, root: Path) -> bool:
    """書込先 token (相対は root 起点) が既存ファイルか。"""
    p = Path(token)
    fp = p if p.is_absolute() else (root / p)
    try:
        return fp.is_file()
    except OSError:
        return False


# ── 保護対象レジストリ (提案1: 保護対象の明示宣言) ─────────────────────────
# concrete な書込先 token に対する保護判定を 1 箇所へ集約する (散在した if 判定の SSOT)。
# 各 rule = (id, matcher(token, root)->bool, scope, reason_template)。
#   scope="all":  全書込経路で保護。Bash はここを参照し、Write/Edit/MultiEdit は decide() が
#                 realpath + 確定セル/frontmatter でより厳密に判定する (同等の保護対象)。
#   scope="bash": Bash 書込先のときのみ保護。Edit/Write ツールでの意図的 authoring は許可。
# EXEMPT_NAMES (記録・生成物) は matcher 到達前に除外。dynamic (glob/未解決変数) は本レジストリを
# 通さず dynamic-hit 側で扱う。protected 章 matcher は確定章と憲法章 (foundation confirmed) を含む。
_PROTECTION_RULES = (
    (
        "canonical-spec-state",
        lambda t, r: _token_is_canonical_spec_state(t),
        "all",
        "正本 spec-state.json への書込 ('{t}') を遮断",
    ),
    (
        "docs-detail-spec",
        lambda t, r: _is_docs_detail_spec_target(t) and _target_exists(t, r),
        "bash",
        "詳細正本 docs/*-spec.md への Bash 書換 ('{t}') を遮断 "
        "(非再生成の手動維持正本。意図的編集は Edit/Write ツールで行ってください)",
    ),
    (
        "confirmed-or-constitution-chapter",
        lambda t, r: _token_is_protected_chapter(t, r),
        "all",
        "確定章 (憲法章含む) への書込 ('{t}') を遮断",
    ),
)


def _match_protection(token: str, root: Path, *, bash: bool) -> "tuple[str, str] | None":
    """concrete な書込先 token に最初にマッチする保護 rule を返す (id, reason) | None。
    bash=False (Write/Edit/MultiEdit) では scope=='bash' の rule を適用しない。"""
    if Path(token).name in EXEMPT_NAMES:
        return None
    for rid, matcher, scope, reason in _PROTECTION_RULES:
        if scope == "bash" and not bash:
            continue
        if matcher(token, root):
            return rid, reason.format(t=token)
    return None


# ── 書込先の精密抽出 (参照↔書込 conflation 解消・提案1) ─────────────────────
# 従来 branch2/3 は「確定物がコマンド文字列に現れる」ことを書込指標と混同していた
# (例: `rm -rf $SCRATCH && python3 compile --spec system-spec/spec-state.json` の
#  spec-state は --spec の read arg なのに mutation(rm) との共起で遮断された)。
# 以下は「実際に書き込む/削除する先」だけをツール別に抽出し、変数を一段解決して
# 確定物が書込先である場合に限って遮断する。読取 arg・cp の source・別 segment の
# mutation・記録生成物 (EXEMPT) は遮断しない。
_ASSIGN = re.compile(
    r"""(?:^|[\s;&|(])([A-Za-z_][A-Za-z0-9_]*)=("[^"]*"|'[^']*'|[^\s;|&()]*)"""
)
_VAR_REF = re.compile(r"\$\{([A-Za-z_][A-Za-z0-9_]*)\}|\$([A-Za-z_][A-Za-z0-9_]*)")
_SEG_SPLIT = re.compile(r"&&|\|\||[;\n|&]")
_CMD_WRAPPERS = frozenset({"sudo", "env", "command", "nice", "nohup", "time"})
_CP_LIKE = frozenset({"cp", "mv", "install", "ln"})
_PY_OPEN_TARGET = re.compile(r"""open\s*\(\s*['"]([^'"]+?)['"]\s*,\s*['"][wax]""")


def _parse_assignments(cmd: str) -> dict:
    """コマンド内の VAR=value 代入を集める (env 前置・複数代入対応)。読取 arg と
    書込先を識別するための一段変数解決に使う。"""
    out: dict = {}
    for m in _ASSIGN.finditer(cmd):
        out[m.group(1)] = m.group(2).strip().strip('"').strip("'")
    return out


def _resolve(token: str, variables: dict) -> str:
    """token 中の $VAR / ${VAR} を既知代入で解決する (最大 3 周・未知変数は残す)。"""
    def repl(m):
        return variables.get(m.group(1) or m.group(2), m.group(0))
    cur = token
    for _ in range(3):
        nxt = _VAR_REF.sub(repl, cur)
        if nxt == cur:
            break
        cur = nxt
    return cur


def _seg_arg_tokens(seg: str) -> list[str]:
    return [t.strip().strip('"').strip("'") for t in seg.split() if t.strip()]


def _mutation_dest_tokens(seg: str) -> list[str]:
    """segment 内 mutation ツールの実書込/削除先トークン (未解決)。
    cp/mv/install/ln は宛先 (最終 file arg)、tee/rm/truncate は対象 file 群、
    dd は of=、sed は -i 時のみ対象 file 群。source / 読取 arg / option は除く。"""
    toks = _seg_arg_tokens(seg)
    i = 0
    while i < len(toks) and (re.match(r"^[A-Za-z_]\w*=", toks[i]) or toks[i] in _CMD_WRAPPERS):
        i += 1
    if i >= len(toks):
        return []
    tool = os.path.basename(toks[i])
    rest = toks[i + 1:]
    files = [t for t in rest if not t.startswith("-")]
    if tool in _CP_LIKE:
        return files[-1:] if files else []
    if tool in ("tee", "rm", "truncate"):
        return files
    if tool == "dd":
        return [t.split("=", 1)[1] for t in rest if t.startswith("of=")]
    if tool == "sed":
        if any(re.match(r"-[a-zA-Z]*i$|--in-place", t) for t in rest if t.startswith("-")):
            return files  # -i 時のみ in-place。script token を含み得るが protected path でなければ無害
        return []
    return []


def _py_write_targets(cmd: str) -> list[str]:
    """inline python の open('X','w'|'a'|'x') の書込先 X を抽出する。"""
    return [m.group(1) for m in _PY_OPEN_TARGET.finditer(cmd)]


def _write_target_tokens(cmd: str) -> list[str]:
    """コマンドの実書込/変更先トークン (変数解決済) を返す。読取 arg は含めない。
    redirect 先 + 各 segment の mutation 宛先 + inline python open 先。"""
    variables = _parse_assignments(cmd)
    targets: list[str] = []
    for seg in (s.strip() for s in _SEG_SPLIT.split(cmd)):
        if not seg:
            continue
        for t in _redirect_targets(seg):
            targets.append(_resolve(t, variables))
        for t in _mutation_dest_tokens(seg):
            targets.append(_resolve(t, variables))
    for t in _py_write_targets(cmd):
        targets.append(_resolve(t, variables))
    return targets


def bash_decision(cmd: str, root: Path) -> tuple[int, str]:
    """Bash コマンドの許可 (0) / 遮断 (2) を判定する。

    実書込先を変数解決して特定し、確定物 (正本 spec-state / 確定章) が実際の
    書込先である場合に限って遮断する。読取 arg や別 segment の mutation、記録・
    生成物 (EXEMPT) への書込は誤爆させない (参照↔書込 conflation の解消・提案1)。
    """
    mutation = any(pat.search(cmd) for pat, _ in _MUTATION_TOOLS)
    py_write = bool(_PY_WRITE.search(cmd))
    if not (_redirect_targets(cmd) or mutation or py_write):
        # 書込指標なし = read-only。保護パス参照でも通す (cat/grep/ls/jq 等)。
        return 0, ""

    dynamic_hits: list[str] = []
    for t in _write_target_tokens(cmd):
        if not t:
            continue
        if any(ch in t for ch in "*?[$`"):
            # dynamic: 書込先を静的に確定できない。保護領域 (system-spec/) or docs 直下 sweep を
            # 指すなら安全側で dynamic-hit (glob は詳細正本を巻き込みうる)。
            if _refs_protected_area(t) or _is_docs_detail_spec_target(t):
                dynamic_hits.append(t)
            continue
        # concrete: 保護レジストリで判定 (spec-state / docs 詳細正本 / 確定・憲法章)。
        hit = _match_protection(t, root, bash=True)
        if hit:
            return 2, hit[1]
    if dynamic_hits:
        return 2, (
            f"保護領域内の書込先を静的に確定できない動的書換 ('{dynamic_hits[0]}') を安全側で遮断"
        )

    # find/xargs 経由の間接 mutation は書込先を静的トークンとして抽出できない (ファイルは
    # find の列挙結果として渡る) が、保護領域 (system-spec/) を走査対象にするなら確定章を
    # 一括改変しうる。書込先確定不能として安全側で遮断する (find ... | xargs sed -i 等)。
    if mutation and _refs_protected_area(cmd) and re.search(r"\bxargs\b|\bfind\b[^|]*-exec\b", cmd):
        return 2, "保護領域を find/xargs 経由で一括書換する動的コマンドを書込先確定不能として遮断"

    # inline python 書込で書込先を静的抽出できない (write_text/複雑式) 場合の保護参照
    # フォールバック。CLI script 起動 (python3 x.py ...) は _PY_WRITE 非該当ゆえ発火しない。
    if py_write and not _py_write_targets(cmd):
        if _refs_canonical_spec_state(cmd):
            return 2, "書込先不明の inline python 書込が正本 spec-state を参照するため安全側で遮断"
        for tok in _system_spec_md_tokens(cmd):
            if Path(tok).name not in EXEMPT_NAMES and _token_is_protected_chapter(tok, root):
                return 2, f"書込先不明の inline python 書込が確定章 '{tok}' を参照するため安全側で遮断"

    return 0, ""


# ── 中核ディシジョン ───────────────────────────────────────────────────────
def decide(payload: dict, root: Path) -> tuple[int, str]:
    """PreToolUse ペイロードから許可 (0) / 遮断 (2) と理由を返す。"""
    tool = payload.get("tool_name", "")
    ti = payload.get("tool_input") or {}
    if tool in ("Write", "Edit", "MultiEdit"):
        fp = ti.get("file_path") or ti.get("path") or ""
        if not fp:
            return 0, ""
        path = Path(fp)
        # (a) 正本 spec-state.json 自身への直接書換 (確定セルあり) は Bash 経路と同格に遮断。
        #     別位置の同名 spec-state.json (fixture 等) は正本でなく通す (交差汚染回避)。
        if _is_canonical_spec_state(path, root) and spec_state_has_confirmed_cell(root):
            return 2, (
                f"正本 spec-state.json '{fp}' への直接 {tool} を遮断 "
                "(確定セルを含む。確定変更は apply-spec-transition の R4-reopen 経由のみ)"
            )
        # (b)(c) 確定章判定 (層別 fail-closed)。
        verdict = chapter_verdict(path, root)
        if verdict == _V_PROTECTED:
            return 2, f"確定済み仕様章 '{fp}' への {tool} を遮断 (再オープン経由でのみ変更可)"
        if verdict == _V_CONFIRMED_UNRESOLVED:
            return 2, (
                f"status:confirmed 章 '{fp}' への {tool} を遮断 "
                "(正本 spec-state.json を解決できず確定状態を確認不能。confirmed 章限定の層別 fail-closed)"
            )
        return 0, ""
    if tool == "Bash":
        cmd = ti.get("command") or ""
        return bash_decision(cmd, root)
    return 0, ""


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except Exception:
        # 解釈不能な入力は対象を特定できず「明確に protected」でない → 素通し (誤爆回避)。
        return 0
    code, reason = decide(payload, project_root())
    if code == 2:
        sys.stderr.write(
            f"[{GUARD_NAME}] BLOCKED: {reason}。\n"
            "  確定済み仕様章 / 正本 spec-state.json は C01/C03 の単一 writer (根拠付き R4-reopen) 経由でのみ変更してください。\n"
        )
    return code


if __name__ == "__main__":
    sys.exit(main())
