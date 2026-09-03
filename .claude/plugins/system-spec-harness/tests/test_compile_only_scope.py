# /// script
# name: test-compile-only-scope
# version: 0.1.0
# purpose: compile-spec-doc.py の --only が書き出す章だけを絞り、組み立ては全章通しのまま保つことを固定する pytest。
# inputs:
#   - argv: pytest 経由 (直接 argv は取らない)
# outputs:
#   - stdout: pytest 結果
#   - exit: 0=all pass / 1=failure
# contexts: [E, C]
# network: false
# write-scope: tmp_path のみ
# dependencies: []
# requires-python: ">=3.9"
# ///
"""1 セルを直したのに 10 枚全部を書き換えない。

**なぜ要るか (2026-08-25 実測)**: `infrastructure.web` と `maintenance-ops.web` の
`qa_refs` を直しただけで compile を全章へ当てると、触っていない 8 枚まで書き換わる。
そこで落ちる行を数えたところ 60 行あり、中身は index の実装状態/検証状態の列、
00 の decisions 表への注記、database の考察といった**生成節の内側に人が手で足した行**
だった。節・小節の引き継ぎでは届かない (見出しを持たない行だから)。

`system-spec/database.md` は既にこう書いている — 「再生成すると章の規範本文が消える」
「正本の回答は章より古い (`MetricRollup` の列名が旧名へ戻る)」。**全章 compile は同期
ではなく退行になる。**

`--only` は行単位の併合を実装せずにこの事故を避ける。**組み立ては常に全章を通す**ので、
index の相互参照も serves_goals も正本どおりに導出される。絞るのは書き出しだけである。

**向き**: ①新しい床。「触っていない章を巻き込まない」ことはこれまで守られていなかった。
"""
from __future__ import annotations

import importlib.util
import json
from pathlib import Path

import pytest

_PLUGIN = Path(__file__).resolve().parent.parent
COMPILE = _PLUGIN / "skills" / "run-system-spec-compile" / "scripts" / "compile-spec-doc.py"

PLATFORMS = ["web", "mobile", "tablet", "desktop-windows", "desktop-linux", "desktop-macos"]


def _load(path: Path, name: str):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


c = _load(COMPILE, "compile_spec_doc_only")


def _spec() -> dict:
    return {
        "categories": [
            {"id": "database", "label": "データベース"},
            {"id": "security", "label": "セキュリティ"},
        ],
        "platforms": PLATFORMS,
        "matrix": {
            "database": {p: {"state": "確定", "qa_ref": "qa-database"} for p in PLATFORMS},
            "security": {p: {"state": "確定", "qa_ref": "qa-security"} for p in PLATFORMS},
        },
        "qa_log": [
            {"id": "qa-database", "question": "q", "answer": "a"},
            {"id": "qa-security", "question": "q", "answer": "a"},
        ],
        "approval_log": [],
        "category_aggregate": {},
        "targets": [],
    }


@pytest.fixture()
def paths(tmp_path: Path):
    spec_path = tmp_path / "spec-state.json"
    spec_path.write_text(json.dumps(_spec(), ensure_ascii=False), encoding="utf-8")
    refs_path = tmp_path / "fetched-references.json"
    refs_path.write_text(json.dumps({"references": []}), encoding="utf-8")
    out = tmp_path / "out"
    out.mkdir()
    return spec_path, refs_path, out


def _run(paths, *extra: str) -> int:
    spec_path, refs_path, out = paths
    return c.main(
        [
            "compile",
            "--spec",
            str(spec_path),
            "--references",
            str(refs_path),
            "--out-dir",
            str(out),
            *extra,
        ]
    )


def test_without_only_every_chapter_is_written(paths) -> None:
    """床: 既定は全章を書く。これが無いと下の 2 つは「常に 1 枚だけ書く」実装でも緑になる。"""
    _, _, out = paths
    assert _run(paths) == 0
    assert {p.name for p in out.glob("*.md")} >= {"database.md", "security.md", "index.md"}


def test_only_writes_just_that_chapter(paths) -> None:
    """`--only` で指定した章だけがファイルになる。触っていない章は 1 文字も書かれない。"""
    _, _, out = paths
    assert _run(paths, "--only", "database.md") == 0
    assert {p.name for p in out.glob("*.md")} == {"database.md"}


def test_an_untouched_chapter_keeps_its_handwritten_lines(paths) -> None:
    """絞った回で、他章の**生成節の中の手書き行**が残る。ここが `--only` の存在理由である。

    節でも小節でもない 1 行なので、引き継ぎ規則では守れない。書かないことでしか守れない。
    """
    _, _, out = paths
    assert _run(paths) == 0
    hand = "| セキュリティ | `partial` (PoC認証のみ) | 人が手で足した列 |"
    sec = out / "security.md"
    sec.write_text(sec.read_text(encoding="utf-8") + hand + "\n", encoding="utf-8")
    assert _run(paths, "--only", "database.md") == 0
    assert hand in sec.read_text(encoding="utf-8")


def test_the_build_still_runs_over_every_chapter(paths) -> None:
    """絞っても index は全章分の相互参照を持つ。**組み立てを絞ると index が嘘になる。**"""
    _, _, out = paths
    assert _run(paths, "--only", "index.md") == 0
    text = (out / "index.md").read_text(encoding="utf-8")
    assert "database.md" in text and "security.md" in text


def test_a_misspelled_chapter_is_refused(paths) -> None:
    """綴り違いは 0 件書いて成功、にしない。直したつもりの章が直っていない事故になる。"""
    _, _, out = paths
    assert _run(paths, "--only", "infra.md") == 1
    assert list(out.glob("*.md")) == []
