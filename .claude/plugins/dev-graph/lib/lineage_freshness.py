"""graph node の「確定の裏付け」が後から崩れた状態を機械検査する決定論ロジック。

## なぜ要るか

C14 の macro lineage 契約は「feature の source_lineage.source_digest は
source_path の現在の sha256 と一致すること」を要求する。しかし
``validate-source-digest.py`` は自らの docstring で

    既存 node の digest は本 run の責務外のため検査しない

と宣言している通り、**登録時にしか見ない**。よって仕様章が再生成されると、
その章に接地していた既存 node の digest は誰にも気づかれないまま古くなる。
気づくのは、次に何かの拍子で node を触ったときだけで、そのときには
「なぜ食い違ったのか」を辿る材料がもう残っていない。

同じ形の穴がもう一つある。node の status は `closed`/`done` へ動かせるが、
その際に `confirmation_status`/`evaluation_status` が確定側であることを
要求する検査がどこにも無い。結果として「確定手続きを通さずに閉じた node」が
graph に混ざり、完了率だけが実態より良く見える。

本 module はこの 2 つを graph 全体に対して毎回検査する。

## 検査 rule

- **LF-001** — `status` が `closed`/`done` なのに `confirmation_status != confirmed`
  または `evaluation_status != pass`。確定手続きを通らずに閉じた node。
- **LF-002** — feature/architecture/specification node の
  `source_lineage.source_digest` が `source_path` の現在の sha256 と不一致。
- **LF-003** — `source_lineage.source_path` が repo 内に実在しない。

## task kind を LF-002/003 から外す理由

system-dev-planner 由来の task node が持つ `source_digest` は package の
canonical digest であって per-file sha256 ではない。素朴に照合すると全件が
MISMATCH に見え、本物の腐食が偽陽性の海に埋もれる。よって kind で絞る。

## baseline の意味と、その鍵の取り方

導入時点で既に溜まっている腐食を violation にすると lint が常時赤になり、
「赤いのが普通」になった瞬間に検査は死ぬ。よって既知分は baseline として
凍結し、exit code に寄与させない。**新規発生だけを止める。**

baseline の鍵を node id だけにしないこと。それだと同じ node の状態が
さらに悪化しても黙ってしまう。凍結しているのは「あの時点で見たあの状態」
だけであって、その node の未来ではない。よって鍵には**その時に見た状態値**を
含める。

- LF-002/003 は `<node_id>:<記録 digest>:<実際 digest>`。どちらかの digest が
  動けば (= 章がもう一度書き換われば) 別の鍵になり、再び鳴る。
- LF-001 は `<node_id>:<confirmation_status>:<evaluation_status>`。node id だけで
  凍結すると、たとえば `evaluation_status` が `pending` (未評価) から `fail`
  (評価が実際に落ちた) へ変わっても二度と鳴らない。両者は意味が違うので、
  別の状態は別の鍵として扱う。

baseline は**縮小のみが正**。増やす変更は本検査の目的を無効化する。

repo 固有の node id を本 module へ直書きしないのは qa-070 の仕組み/ナレッジ
境界による。plugins/ は他 repo へ持ち出せる portable mechanism であり、
既知の腐食は repo 固有ナレッジなので repo 側データを入力で受け取る。
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

LINT_NAME = "lint-lineage-freshness"

# 本検査は「仕様文書に接地した node」の lineage を見る。task node の digest は
# package canonical digest で per-file sha256 ではないため対象外 (docstring 参照)。
_LINEAGE_KINDS = frozenset({"feature", "architecture", "specification"})

# 閉じた扱いになる status。ここに入るには確定側の裏付けが要る、が LF-001 の主張。
_CLOSED_STATUSES = frozenset({"closed", "done"})

# 墓標は「撤回した」という記録そのものなので、根拠文書の鮮度を要求しない
# (LF-002/003 から外す)。撤回した feature が接地していた章はその後いくらでも
# 書き換わるが、墓標の側を追随させる意味が無い。
# LF-001 は _CLOSED_STATUSES に tombstoned を含めないことで元から発火しない。
_EXEMPT_STATUSES = frozenset({"tombstoned"})

_BASELINE_RELPATH = "scripts/dev-graph-lineage-baseline.json"
_BASELINE_UNCONFIRMED_KEY = "baselined_unconfirmed_closures"
_BASELINE_LINEAGE_KEY = "baselined_stale_lineage"


class LintError(Exception):
    """検査を続行できない一般エラー (exit 1)。"""


def _load_graph_nodes(graph_path: Path) -> list[dict]:
    try:
        nodes = json.loads(graph_path.read_text(encoding="utf-8"))["nodes"]
    except (OSError, json.JSONDecodeError, KeyError, TypeError) as exc:
        raise LintError(f"graph を読めません: {graph_path}: {exc}") from exc
    if not isinstance(nodes, list):
        raise LintError(f"graph の nodes[] が配列ではありません: {graph_path}")
    return nodes


def load_baseline(root: Path, explicit: Path | None) -> tuple[frozenset[str], frozenset[str], str]:
    """既知分の凍結集合を読む。ファイル不在は「凍結なし」であって エラーではない。"""
    path = explicit if explicit is not None else root / _BASELINE_RELPATH
    source = str(path) if explicit is not None else _BASELINE_RELPATH
    if not path.exists():
        return frozenset(), frozenset(), f"{source} (不在: 凍結なし)"
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise LintError(f"baseline を読めません: {path}: {exc}") from exc
    if not isinstance(payload, dict):
        raise LintError(f"baseline が object ではありません: {path}")

    def _keys(key: str) -> frozenset[str]:
        entries = payload.get(key, [])
        if not isinstance(entries, list) or any(
            not isinstance(e, str) or not e for e in entries
        ):
            raise LintError(f"baseline の {key}[] が非空文字列の配列ではありません: {path}")
        return frozenset(entries)

    return _keys(_BASELINE_UNCONFIRMED_KEY), _keys(_BASELINE_LINEAGE_KEY), source


def lineage_key(node_id: str, recorded: str, actual: str) -> str:
    """LF-002/003 の凍結鍵。どちらかの digest が動けば別の鍵になり、再び違反になる。"""
    return f"{node_id}:{recorded}:{actual}"


def closure_key(node_id: str, confirmation: object, evaluation: object) -> str:
    """LF-001 の凍結鍵。

    node id だけで凍結すると、`evaluation_status` が `pending` (まだ評価していない)
    から `fail` (評価して落ちた) へ変わっても二度と鳴らない。両者はまったく違う
    事態なので、状態値そのものを鍵に含めて別物として扱う。
    """
    return f"{node_id}:{confirmation}:{evaluation}"


def lint(
    graph_path: Path,
    root: Path,
    baselined_unconfirmed: frozenset[str],
    baselined_lineage: frozenset[str],
    baseline_source: str,
) -> dict:
    nodes = _load_graph_nodes(graph_path)

    violations: list[dict] = []
    baselined: list[dict] = []
    checked_lineage = 0
    matched_lineage = 0

    for node in nodes:
        if not isinstance(node, dict):
            continue
        node_id = node.get("graph_node_id")
        if not isinstance(node_id, str) or not node_id:
            continue
        status = node.get("status")
        kind = node.get("artifact_kind")

        # --- LF-001: 確定手続きを通らずに閉じた node -------------------------
        if status in _CLOSED_STATUSES:
            conf = node.get("confirmation_status")
            ev = node.get("evaluation_status")
            if conf != "confirmed" or ev != "pass":
                finding = {
                    "rule": "LF-001",
                    "graph_node_id": node_id,
                    "artifact_kind": kind,
                    "status": status,
                    "confirmation_status": conf,
                    "evaluation_status": ev,
                    "baseline_key": closure_key(node_id, conf, ev),
                    "detail": (
                        f"status={status} だが confirmation_status={conf} / "
                        f"evaluation_status={ev}。確定手続きを通っていない"
                    ),
                }
                key = closure_key(node_id, conf, ev)
                (baselined if key in baselined_unconfirmed else violations).append(finding)

        # --- LF-002 / LF-003: lineage の腐食 --------------------------------
        if kind not in _LINEAGE_KINDS or status in _EXEMPT_STATUSES:
            continue
        lineage = node.get("source_lineage")
        if not isinstance(lineage, dict):
            continue
        source_path = lineage.get("source_path")
        recorded = lineage.get("source_digest")
        if not isinstance(source_path, str) or not isinstance(recorded, str):
            continue
        checked_lineage += 1

        target = root / source_path
        if not target.is_file():
            finding = {
                "rule": "LF-003",
                "graph_node_id": node_id,
                "artifact_kind": kind,
                "source_path": source_path,
                "detail": f"source_path が実在しない: {source_path}",
            }
            key = lineage_key(node_id, recorded, "<missing>")
            (baselined if key in baselined_lineage else violations).append(finding)
            continue

        actual = hashlib.sha256(target.read_bytes()).hexdigest()
        if actual == recorded:
            matched_lineage += 1
            continue
        finding = {
            "rule": "LF-002",
            "graph_node_id": node_id,
            "artifact_kind": kind,
            "source_path": source_path,
            "recorded_digest": recorded,
            "actual_digest": actual,
            "baseline_key": lineage_key(node_id, recorded, actual),
            "detail": (
                f"{source_path} の現在の sha256 が source_digest と一致しない "
                f"(記録 {recorded[:12]}… / 現在 {actual[:12]}…)"
            ),
        }
        key = lineage_key(node_id, recorded, actual)
        (baselined if key in baselined_lineage else violations).append(finding)

    return {
        "lint": LINT_NAME,
        "graph": str(graph_path),
        "baseline_source": baseline_source,
        "node_count": len(nodes),
        "lineage_checked": checked_lineage,
        "lineage_matched": matched_lineage,
        "violations": violations,
        "violation_count": len(violations),
        "baselined": baselined,
        "baselined_count": len(baselined),
        "exit_code": 2 if violations else 0,
    }
