#!/usr/bin/env python3
"""scenario ``C01-OUT1-positive-idempotence-r17`` (skill: dev-graph:run-dev-graph-init) の形状。

fixture 契約:
  C01 の被験対象は「**まだ dev-graph 化されていない** repository」である。初期化そのものと、
  2 回目の初期化が何も壊さないこと (冪等 = べきとう: 何回実行しても結果が同じ性質) が
  観測対象なので、fixture は git repository だけを用意する。

置くもの:
  .git/                                本物の git toplevel (C24 が起動ゲートで要求する)
  .gitkeep                             初期 commit を打つための空ファイル
  .git/dev-graph/fixture-marker.json   --force 再生成を許可する素性 marker

置かないものと、その理由 (anti-Goodhart):
  - ``.dev-graph/`` (config.json / state / cache / locks) を置かない。置いた時点で
    「初期化済み repository」になり、C01 が作るべき構造を fixture が先に作ってしまう。
  - content root (issues/tasks/specs/architecture/features/docs/system-spec) も置かない。
    content_roots の実体化は C01 の出力そのものであり、先回りすると
    「skill が作ったのか、最初からあったのか」を trial で区別できない。
  - したがって本 shape だけは C11 (validate-graph-schema.py) の検証対象外である。
    検証すべき graph が存在しないことが、この fixture の正しい初期状態だからである。

素性 marker を ``.git/`` 配下へ置く理由:
  生成器の ``_prepare_output`` は「取り違えた path を --force で消さない」ため、
  ``.dev-graph/config.json`` の存在を素性の証拠にしている。本 shape は定義上それを
  持てないので、被験 skill から content として見えない git 内部側へ marker を置く。
  ``.dev-graph/`` へ置くと上の「未初期化であること」を壊す。

決定論性: 生成物に時刻・乱数・生成先 path 依存値を持たない
(commit も生成器の固定 COMMIT_DATE / 固定 identity で打たれる)。
"""
from __future__ import annotations

from pathlib import Path

from .base_shape import init_repository, load_base

SHAPE = "init"


def build(out: Path) -> None:
    """dev-graph 未初期化の git repository だけを生成する。"""
    base = load_base()
    init_repository(out, kind=SHAPE)
    # 空 commit を避けるための最小の追跡対象。git は空ディレクトリを追跡しないため、
    # これが無いと初期 commit が打てず HEAD が存在しない (C24 の rev-parse HEAD が失敗する)。
    (out / ".gitkeep").write_text("", encoding="utf-8")
    base._git(["add", "-A"], out)
    base._git(
        [
            "-c", f"user.email={base.COMMIT_IDENTITY[0]}",
            "-c", f"user.name={base.COMMIT_IDENTITY[1]}",
            "commit", "--no-gpg-sign", "-m", "chore(fixture): initialize dev-graph live-trial fixture",
        ],
        out,
    )
