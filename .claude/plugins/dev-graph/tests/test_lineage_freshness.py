"""C14 lineage 契約の登録後検査 (lint-lineage-freshness) が固定する契約。

背景:
  `validate-source-digest.py` は自らの docstring で「既存 node の digest は本 run の
  責務外のため検査しない」と宣言している通り、**登録時にしか digest を見ない**。
  よって仕様章が再生成されると、その章に接地していた既存 node の source_digest は
  誰にも気づかれないまま古くなる。実測 (2026-09-04) で feature/architecture/
  specification 39 node のうち 13 件が腐食していた。

  同じ形の穴がもう一つある。node の status は closed/done へ動かせるが、その際に
  confirmation_status/evaluation_status が確定側であることを要求する検査が無い。
  実測で 19 件が「確定手続きを通らずに閉じた」状態だった。

本 test が固定する契約:
  1. DETECT: 章が書き換わって digest が古くなった node を LF-002 で検出する。
  2. BASELINE SILENCES: 導入時点の既知分は凍結でき、exit code に寄与しない。
     凍結できないと lint は常時赤になり、赤が普通になった時点で検査は死ぬ。
  3. BASELINE IS NOT A PARDON: 凍結の鍵には**その時に見た状態値**を含める。
     LF-002/003 は <node_id>:<記録digest>:<実際digest>、LF-001 は
     <node_id>:<confirmation_status>:<evaluation_status>。node id 単位で凍結すると
     状態が悪化しても黙る = 目的が達せられない。2026-09-04 の独立監査で LF-001 側が
     node id 単独凍結になっていたことが指摘され (19/32 件が永久凍結)、本 test を
     足して回帰を止めた。
  4. UNCONFIRMED CLOSURE: 未確定のまま閉じた node を LF-001 で検出する。
  5. TOMBSTONE EXEMPT: 墓標には確定の裏付けを求めない。求めると、誤って作った
     node を畳めなくなる (撤回そのものが不可能になる)。
  6. TASK KIND EXCLUDED: task node の source_digest は package canonical digest で
     per-file sha256 ではない。照合対象に含めると全件が偽陽性になり、本物の腐食が
     その海に埋もれる。
  7. EMIT IS IDEMPOTENT: --emit-baseline は既に凍結済みの分も併せて書き出す。
     violations だけを書くと、baseline を効かせた状態で再 emit したときに凍結行が
     黙って消え、次の run で一斉に赤くなる。
"""
from __future__ import annotations

import hashlib
import importlib.util
import json
import sys
from pathlib import Path

PLUGIN = Path(__file__).resolve().parents[1]
LIB = str(PLUGIN / "lib")
if LIB not in sys.path:
    sys.path.insert(0, LIB)

from lineage_freshness import closure_key, lineage_key, lint  # noqa: E402


def _load_cli():
    path = PLUGIN / "scripts" / "lint-lineage-freshness.py"
    spec = importlib.util.spec_from_file_location("lint_lineage_freshness_cli", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _chapter(root: Path, text: str) -> str:
    path = root / "spec" / "ch.md"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _graph(root: Path, *nodes: dict) -> Path:
    path = root / "graph.json"
    path.write_text(json.dumps({"nodes": list(nodes)}), encoding="utf-8")
    return path


def _feature(digest: str, **over) -> dict:
    node = {
        "graph_node_id": "feat-x",
        "artifact_kind": "feature",
        "status": "active",
        "source_lineage": {"source_path": "spec/ch.md", "source_digest": digest},
    }
    node.update(over)
    return node


def test_detects_stale_lineage_and_baseline_only_freezes_that_state(tmp_path: Path) -> None:
    """契約 1/2/3: 検出する・凍結で沈黙する・腐食が進めば再び鳴る。"""
    v1 = _chapter(tmp_path, "第 1 版\n")
    v2 = _chapter(tmp_path, "第 2 版\n")  # 章が書き換わり v1 が古くなった
    graph = _graph(tmp_path, _feature(v1))

    result = lint(graph, tmp_path, frozenset(), frozenset(), "none")
    assert result["violation_count"] == 1
    assert result["violations"][0]["rule"] == "LF-002"
    assert result["exit_code"] == 2

    frozen = frozenset({lineage_key("feat-x", v1, v2)})
    result = lint(graph, tmp_path, frozenset(), frozen, "frozen")
    assert result["violation_count"] == 0
    assert result["baselined_count"] == 1
    assert result["exit_code"] == 0

    # 契約 3: 章がもう一度書き換わる = 腐食が進んだ。凍結は免罪符ではない。
    _chapter(tmp_path, "第 3 版\n")
    result = lint(graph, tmp_path, frozenset(), frozen, "frozen")
    assert result["violation_count"] == 1, "腐食が進んだのに凍結が沈黙させた"


def test_detects_closure_without_confirmation(tmp_path: Path) -> None:
    """契約 4: 確定手続きを通らずに閉じた node を検出する。"""
    digest = _chapter(tmp_path, "章\n")
    graph = _graph(tmp_path, _feature(
        digest, status="closed",
        confirmation_status="unconfirmed", evaluation_status="pending",
    ))
    result = lint(graph, tmp_path, frozenset(), frozenset(), "none")
    rules = {v["rule"] for v in result["violations"]}
    assert "LF-001" in rules

    # confirmed/pass が揃えば LF-001 は出ない。
    graph = _graph(tmp_path, _feature(
        digest, status="closed",
        confirmation_status="confirmed", evaluation_status="pass",
    ))
    result = lint(graph, tmp_path, frozenset(), frozenset(), "none")
    assert result["violation_count"] == 0


def test_closure_baseline_is_keyed_by_state_not_node_id(tmp_path: Path) -> None:
    """契約 3 の LF-001 側: 状態が悪化したら凍結を突き抜けて再び鳴る。

    node id 単独で凍結すると、`evaluation_status` が `pending` (まだ評価していない)
    から `fail` (評価して落ちた) へ変わっても二度と鳴らない。両者はまったく違う
    事態であり、後者を黙らせるのは本検査の目的を無効化する。
    """
    digest = _chapter(tmp_path, "章\n")

    def _closed(conf: str, ev: str) -> Path:
        return _graph(tmp_path, _feature(
            digest, status="closed", confirmation_status=conf, evaluation_status=ev,
        ))

    frozen = frozenset({closure_key("feat-x", "draft", "pending")})

    # 凍結した通りの状態なら沈黙する。
    result = lint(_closed("draft", "pending"), tmp_path, frozen, frozenset(), "frozen")
    assert result["violation_count"] == 0
    assert result["baselined_count"] == 1

    # 評価が実際に落ちた = 別の事態。凍結は効かない。
    result = lint(_closed("draft", "fail"), tmp_path, frozen, frozenset(), "frozen")
    assert result["violation_count"] == 1, "状態が悪化したのに凍結が沈黙させた"
    assert result["violations"][0]["rule"] == "LF-001"

    # confirmation 側が動いた場合も同様。
    result = lint(_closed("confirmed", "pending"), tmp_path, frozen, frozenset(), "frozen")
    assert result["violation_count"] == 1


def test_tombstone_is_exempt(tmp_path: Path) -> None:
    """契約 5: 墓標に確定を求めると、誤って作った node を畳めなくなる。"""
    v1 = _chapter(tmp_path, "第 1 版\n")
    _chapter(tmp_path, "第 2 版\n")
    graph = _graph(tmp_path, _feature(
        v1, status="tombstoned",
        confirmation_status="unconfirmed", evaluation_status="pending",
    ))
    result = lint(graph, tmp_path, frozenset(), frozenset(), "none")
    assert result["violation_count"] == 0


def test_task_kind_excluded_from_digest_check(tmp_path: Path) -> None:
    """契約 6: task の digest は package canonical digest。照合すると偽陽性になる。"""
    v1 = _chapter(tmp_path, "第 1 版\n")
    _chapter(tmp_path, "第 2 版\n")
    graph = _graph(tmp_path, _feature(v1, graph_node_id="task-x", artifact_kind="task"))
    result = lint(graph, tmp_path, frozenset(), frozenset(), "none")
    assert result["violation_count"] == 0
    assert result["lineage_checked"] == 0


def test_emit_baseline_is_idempotent(tmp_path: Path) -> None:
    """契約 7: 凍結済みを効かせたまま再 emit しても、凍結行が消えない。"""
    cli = _load_cli()
    v1 = _chapter(tmp_path, "第 1 版\n")
    _chapter(tmp_path, "第 2 版\n")
    graph = _graph(
        tmp_path,
        _feature(v1),
        _feature(v1, graph_node_id="feat-y", status="closed",
                 confirmation_status="draft", evaluation_status="pending"),
    )

    first = cli._build_baseline(lint(graph, tmp_path, frozenset(), frozenset(), "none"))
    assert first["baselined_unconfirmed_closures"] and first["baselined_stale_lineage"]

    # 1 回目の凍結を効かせた状態で再 emit する。ここで空になってはいけない。
    frozen = lint(
        graph, tmp_path,
        frozenset(first["baselined_unconfirmed_closures"]),
        frozenset(first["baselined_stale_lineage"]),
        "frozen",
    )
    assert frozen["violation_count"] == 0
    second = cli._build_baseline(frozen)
    assert second == first, "再 emit で凍結行が消えた (次の run で一斉に赤くなる)"


def test_missing_source_path_is_reported(tmp_path: Path) -> None:
    """LF-003: source_path が消えた node を、digest 不一致と別 rule で分ける。"""
    graph = _graph(tmp_path, _feature("0" * 64))
    result = lint(graph, tmp_path, frozenset(), frozenset(), "none")
    assert [v["rule"] for v in result["violations"]] == ["LF-003"]
