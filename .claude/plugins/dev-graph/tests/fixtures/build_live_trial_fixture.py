#!/usr/bin/env python3
# /// script
# name: build-live-trial-fixture
# purpose: Rebuild the isolated dev-graph live-trial fixture repositories deterministically from source.
# inputs: ["argv: --kind <see --help for the registered kinds> [--out DIR] [--force]"]
# outputs: ["directory: an initialized fixture git repository under eval-log/dev-graph/live-trial-fixtures/"]
# requires-python = ">=3.10"
# dependencies: []
# contexts: [A, B, C, E]
# network: false
# write-scope: the --out fixture directory only
# ///
"""live-trial 用 fixture repo の生成器 (正本)。

fixture の実体は `eval-log/dev-graph/live-trial-fixtures/` にあり `.gitignore` 対象なので、
worktree が prune されると消える。過去に「前回 trial と同じ条件で再実行できない」事故が
起きたため、**fixture データではなく生成手順を commit する** 方針を採る。このファイルが
その正本であり、trial のたびにここから作り直す。

決定論の要件:

- 時刻・乱数を一切埋め込まない。全ての timestamp は下の定数から採る。
- git commit も `GIT_AUTHOR_DATE` / `GIT_COMMITTER_DATE` を固定するので、同じ `--out` に
  対して常に同じ commit SHA になる。repo 設定を汚さないよう identity は `-c` で渡す。
- ただし `.dev-graph/config.json` の `repository_id` だけは出力先に依存する。C24
  resolve-repo-context.py が git common dir の realpath から `local:sha256:<hex>` を導出し、
  config 側の宣言と一致しなければ fail-closed で停止するため、ここで実測して書き込む。
  (ハードコードすると「起動ゲートを迂回した偽 PASS」を生むので絶対にやらない)
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any

# script として直接起動されても、pytest から file path で読み込まれても同じ形で
# shape package を解決できるようにする (sys.path[0] が呼び出し方で変わるため)。
sys.path.insert(0, str(Path(__file__).resolve().parent))

import live_trial_shapes  # noqa: E402  (上の sys.path 調整より後でなければ解決できない)
from live_trial_sync_contract import (  # noqa: E402
    CONTENT_ROOTS,
    planning_project as _planning_project,
    repo_config as _repo_config,
    sync_remote_state as _sync_remote_state,
    sync_snapshot as _sync_snapshot,
    sync_task_node as _sync_task_node,
)

PLUGIN_ROOT = Path(__file__).resolve().parents[2]
REPOSITORY_ROOT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(PLUGIN_ROOT / "lib"))
SCHEMA_PATH = PLUGIN_ROOT / "schemas" / "graph-node.schema.json"

COMMIT_DATE = "2026-07-13T07:50:00+00:00"

COMMIT_IDENTITY = ("dev-graph-fixture@example.invalid", "dev-graph fixture builder")

TASK_BODY = """# 目的

隔離された live-trial fixture が安全に検索・描画・schedule される。

## 背景

実リポジトリや外部 tracker に副作用を出さずに受け入れ挙動を確認する。

## 入力と前提条件

- 入力: `.dev-graph/state/graph.json`
- 前提: `tracker_binding=github`

## 出力と成果物

- 生成物: trial ごとの検証出力
- 更新対象: GitHub Issue/Project fields via adapter fixture

## 依存関係

- `depends_on`: N/A: 依存なし
- ブロッカー: N/A: なし

## 実装対象

- Frontend: N/A: fixture
- Backend/API: N/A: fixture
- Database/Data: N/A: fixture
- Infrastructure: N/A: fixture
- Security/Privacy: 外部副作用を禁止する
- Documentation: live-trial 証跡

## Write scope と競合制約

- `touches`: `docs/live-trial-output.md`
- 排他資源: fixture repository
- 並列実行条件: write trial と同時実行しない
- branch: fixture branch only
- worktree lease: N/A
- completion projection: N/A: 完了更新を行わない

## GitHub publication

- Mode: issue_and_projects
- Project aliases: planning
- Issue labels/milestone: live-trial, safe
- Publication gate: `status=active && confirmation_status=confirmed && evaluation_status=pass && implementation_readiness.status=complete`
- Completion policy: manual
- PR linkage requirement: linked_pr_merged
- Closed without merge: keep_active
- Local reconciliation: manual sync

## 実行手順

1. adapter fixture 経由で GitHub Issue/Project を同期する。

## 受入条件

- [ ] 同一状態の二回目 sync で changes=0 である。

## 検証方法

- 自動検証: adapter fixture による決定論的検証
- 手動検証: live-trial transcript を確認する
- 証跡: trial workdir

## リスクとロールバック

- リスク: fixture の誤用
- ロールバック: fixture directory を再生成する

## Handoff

- 実装 route: human
- 次に利用するノード: LT-TASK-001
"""


class BuildError(RuntimeError):
    """生成を中断する契約違反。"""


def _git(args: list[str], cwd: Path) -> str:
    """fixture repo に対してのみ git を実行する。失敗は即座に中断する。"""
    environment = {
        **os.environ,
        "GIT_AUTHOR_DATE": COMMIT_DATE,
        "GIT_COMMITTER_DATE": COMMIT_DATE,
    }
    cp = subprocess.run(
        ["git", "-C", str(cwd), *args], text=True, capture_output=True, check=False, env=environment
    )
    if cp.returncode:
        raise BuildError(f"git {' '.join(args)} failed ({cp.returncode}): {(cp.stderr or cp.stdout).strip()}")
    return cp.stdout.strip()


def _write_json(path: Path, value: Any) -> None:
    """dev-graph の atomic_json と同じ整形。以後の書き込みで無駄な差分を出さないため。"""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + "\n", encoding="utf-8"
    )


def _schema_version() -> str:
    """canonical envelope の schema_version を scripts 側の正本から読む。

    fixture 側へ "1.0.0" と書き写すと、正本が動いたときに fixture だけが古い値を持ち、
    C11 envelope 検査を「fixture では通るが本番では落ちる」状態にできる。
    """
    scripts = str(PLUGIN_ROOT / "scripts")
    if scripts not in sys.path:
        sys.path.insert(0, scripts)
    import graph_envelope  # noqa: PLC0415  (import 時の副作用を避けるため呼び出し時解決)

    return graph_envelope.SCHEMA_VERSION


def _canonical_graph(repository_id: str, graph: dict[str, Any] | None = None) -> dict[str, Any]:
    """``{graph_revision, nodes}`` だけの graph を canonical envelope へ引き上げる。

    C02 の正規 writer (build-graph-store.py / upsert-node.py) が store へ書く形は
    exact-4-key の ``{schema_version, repository_id, graph_revision, nodes}`` で、C11 は
    canonical store path に対してこの 4 key を要求する。``schema_version``/``repository_id``
    を欠いた store を fixture が置くと、被験 skill は「本番なら起動ゲートで落ちる入力」で
    実走することになり trial の意味が失われる。
    """
    source = graph or {"graph_revision": 0, "nodes": []}
    return {
        "schema_version": _schema_version(),
        "repository_id": repository_id,
        "graph_revision": source.get("graph_revision", 0),
        "nodes": source.get("nodes", []),
    }


def _write_graph(out: Path, repository_id: str, graph: dict[str, Any] | None = None) -> None:
    """canonical envelope を保証したうえで graph store を書く単一の入口。

    graph store への書き込みを本 helper に集約するのは、``_write_json`` を直に呼ぶ経路が
    増えるたびに envelope の付与漏れが起きうるため。既存 store を読み直して nodes を
    追記する経路 (shape_render / shape_requirements) は、生成点がここを通る限り envelope を
    そのまま持ち越すので追加の処置を要しない。
    """
    _write_json(out / ".dev-graph" / "state" / "graph.json", _canonical_graph(repository_id, graph))


def _artifact_bytes(node: dict[str, Any], body: str) -> bytes:
    """C02 upsert-node.py が生成するのと同じ frontmatter 形式で artifact を書く。

    sync の apply は既存 artifact の本文を再利用して frontmatter を書き直す。初期状態を
    別形式で置くと初回 apply で本文以外の巨大 diff が出て、write_count の観測が濁る。
    """
    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    order = list(schema.get("properties") or {})
    keys = [key for key in order if key in node] + sorted(set(node) - set(order))
    lines = ["---"]
    lines.extend(
        f"{key}: {json.dumps(node[key], ensure_ascii=False, sort_keys=True, separators=(',', ':'))}"
        for key in keys
    )
    lines.extend(["---", "", body.rstrip(), ""])
    return "\n".join(lines).encode("utf-8")


def _init_repository(out: Path) -> Path:
    """本物の git repo を作る。C24 が git common dir の所有権を実測で検証するため必須。

    origin remote は付けない。付けると repository_id が github:owner/repo になり、
    「隔離 fixture なのに実 repository を名乗る」ことになる。
    """
    out.mkdir(parents=True, exist_ok=True)
    _git(["init", "-b", "main"], out)
    common = Path(_git(["rev-parse", "--git-common-dir"], out))
    return (common if common.is_absolute() else out / common).resolve(strict=True)


def _repository_id(common: Path) -> str:
    """resolve-repo-context.py の repository_id_for と同一式。"""
    return "local:sha256:" + hashlib.sha256(str(common.resolve(strict=True)).encode("utf-8")).hexdigest()


def _finalize(out: Path) -> None:
    """content root を実体化し、初期 commit を打つ。

    HEAD が無いと C24 の `git rev-parse HEAD` が失敗して起動ゲートを通れない。
    """
    for relative in sorted(set(CONTENT_ROOTS.values())):
        directory = out / relative
        directory.mkdir(parents=True, exist_ok=True)
        keep = directory / ".gitkeep"
        if not keep.exists():
            keep.write_text("", encoding="utf-8")
    (out / "eval-log").mkdir(parents=True, exist_ok=True)
    _git(["add", "-A"], out)
    _git(
        [
            "-c", f"user.email={COMMIT_IDENTITY[0]}",
            "-c", f"user.name={COMMIT_IDENTITY[1]}",
            "commit", "--no-gpg-sign", "-m", "chore(fixture): initialize dev-graph live-trial fixture",
        ],
        out,
    )


def build_sync(out: Path) -> None:
    """C03 run-dev-graph-sync と C15 run-dev-graph-schedule が共有する fixture。"""
    common = _init_repository(out)
    node = _sync_task_node()
    repository_id = _repository_id(common)
    _write_json(
        out / ".dev-graph" / "config.json",
        _repo_config(repository_id, tracker_mode="github", projects=[_planning_project()]),
    )
    _write_graph(out, repository_id, {"graph_revision": 1, "nodes": [node]})
    _write_json(out / ".dev-graph" / "remote.json", _sync_remote_state())
    _write_json(out / ".dev-graph" / "state" / "sync-snapshot.json", _sync_snapshot())
    artifact = out / node["file_path"]
    artifact.parent.mkdir(parents=True, exist_ok=True)
    artifact.write_bytes(_artifact_bytes(node, TASK_BODY))
    # lease 台帳の正本は worktree ではなく git common dir 側。C15 は他の場所を渡されると
    # 「lease snapshot is not the git-common authority」で停止する。
    _write_json(common / "dev-graph" / "leases.json", {"leases": []})
    _finalize(out)


def build_decompose(out: Path) -> None:
    """C14 run-dev-graph-decompose の --dry-run マクロ分解用 fixture。

    分解結果は draft preview として提示されるだけなので graph は空でよい。全 node が
    tracker_binding=none 前提のため Projects 定義も持たせない。Projects を持たない以上
    GitHub トラッカーは宣言できないので、mode は execution-tracker-contract §1 の既定
    (ソロ + AI エージェント開発の private repo = beads) を採る。
    """
    common = _init_repository(out)
    repository_id = _repository_id(common)
    _write_json(
        out / ".dev-graph" / "config.json",
        _repo_config(repository_id, tracker_mode="beads", projects=[]),
    )
    _write_graph(out, repository_id)
    _write_json(common / "dev-graph" / "leases.json", {"leases": []})
    _finalize(out)


def _shape_builder(shape: str):
    """live_trial_shapes の shape module を遅延解決する thin adapter。

    shape 本体は 1 scenario 1 module として live_trial_shapes/ 側に置く (本 file を
    これ以上肥大させないため)。import が遅延なのは、shape module が本 file の repo 骨格
    helper を参照する = 相互参照になるため。
    """
    def _build(out: Path) -> None:
        live_trial_shapes.load(shape)(out)

    _build.__doc__ = f"live_trial_shapes.{shape} が定義する scenario 固有の fixture。"
    return _build


BUILDERS = {
    "sync": build_sync,
    "decompose": build_decompose,
    **{shape: _shape_builder(shape) for shape in sorted(live_trial_shapes.SHAPE_MODULES)},
}


def _is_owned_fixture(out: Path) -> bool:
    """--force で削除してよい、本生成器が作った fixture か。

    通常は ``.dev-graph/config.json`` の存在が素性の証拠になる。ただし C01 init の
    fixture は「dev-graph 未初期化の repository」であることが scenario の前提なので
    それを持てない。そのため shape 側が git 内部 (被験 skill から content として
    見えない場所) へ置く marker も証拠として認める。
    """
    return (out / ".dev-graph" / "config.json").is_file() or (
        out / ".git" / "dev-graph" / "fixture-marker.json"
    ).is_file()


def _prepare_output(out: Path, force: bool) -> None:
    """既存ディレクトリの扱い。取り違えた path を消さないよう素性を確認してから消す。"""
    if not out.exists():
        return
    if not out.is_dir():
        raise BuildError(f"--out exists and is not a directory: {out}")
    if not force:
        raise BuildError(f"--out already exists (pass --force to rebuild): {out}")
    if any(out.iterdir()) and not _is_owned_fixture(out):
        raise BuildError(f"--force refuses to delete a directory that is not a dev-graph fixture: {out}")
    shutil.rmtree(out)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Build an isolated dev-graph live-trial fixture repository")
    parser.add_argument("--kind", required=True, choices=sorted(BUILDERS))
    parser.add_argument("--out", help="fixture output directory (default: eval-log/dev-graph/live-trial-fixtures/<kind>)")
    parser.add_argument("--force", action="store_true", help="rebuild an existing fixture directory")
    args = parser.parse_args(argv)

    out = Path(args.out).expanduser() if args.out else (
        REPOSITORY_ROOT / "eval-log" / "dev-graph" / "live-trial-fixtures" / args.kind
    )
    out = out.resolve() if out.exists() else Path(os.path.abspath(out))
    _prepare_output(out, args.force)
    BUILDERS[args.kind](out)
    out = out.resolve(strict=True)
    common = Path(_git(["rev-parse", "--git-common-dir"], out))
    common = (common if common.is_absolute() else out / common).resolve(strict=True)
    print(
        json.dumps(
            {
                "kind": args.kind,
                "repo_root": str(out),
                "git_common_dir": str(common),
                "repository_id": _repository_id(common),
                "leases": str(common / "dev-graph" / "leases.json"),
                "head_sha": _git(["rev-parse", "HEAD"], out),
            },
            ensure_ascii=False,
            indent=2,
            sort_keys=True,
        )
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (BuildError, OSError) as exc:
        print(str(exc), file=sys.stderr)
        raise SystemExit(1)
