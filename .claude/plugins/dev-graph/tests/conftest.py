"""dev-graph plugin テストの共有 fixture。

lint-orphan-external-ref の共有疑似 repo と、C14 decompose 監査テストの hermetic bd
preflight（外部 CLI を入れないテスト用の事前確認）を提供する。

  test_lint_orphan_external_ref.py      -> lib/orphan_external_ref.py     (検査ロジック)
  test_lint_orphan_external_ref_cli.py  -> scripts/lint-orphan-external-ref.py (CLI 契約)

orphan lint の 2 ファイルは同じ疑似 repo 構築を必要とするため、ヘルパを複製せずここへ
置く。C14 用 autouse fixture は対象 3 ファイルを名前で限定し、同ディレクトリの他テスト
には影響しない。
"""
from __future__ import annotations

import importlib.util
import json
import subprocess
import sys
from pathlib import Path
from typing import Generator

import pytest

PLUGIN = Path(__file__).resolve().parents[1]
REPO_ROOT = PLUGIN.parents[1]

# baseline 検証で共有する疑似 node id。本番 baseline から借りず tmp 側に置くのは、
# 本番 baseline の縮小 (= 正しい変化) でテストが壊れないようにするため。借りると
# テストが縮小の抑止力として働いてしまい、shrink-only ratchet の目的と衝突する。
BASELINED = "issue-known-orphan-fixture"
DECOMPOSE_AUDIT_TESTS = {
    "test_decompose_live_trial_audit.py",
    "test_decompose_live_trial_binding_audit.py",
    "test_decompose_live_trial_integrity.py",
}


@pytest.fixture(autouse=True)
def hermetic_bd_for_decompose_audit(
    request: pytest.FixtureRequest,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path_factory: pytest.TempPathFactory,
) -> Generator[None, None, None]:
    """C14 監査テストの dry-run preflight を system bd の有無から分離する。

    監査は beads route の候補を ``bd-bridge.py --dry-run`` で観測するため、bridge が
    ``bd version`` と ``bd where --json`` を preflight する。本番 live-trial は実 bd を
    使うが、CI runner に bd をインストールする必要はない。対象テストだけに read-only
    preflight 応答を返す stub を注入し、create/update などへ到達したら fail-closed にする。
    """
    if Path(str(request.node.path)).name not in DECOMPOSE_AUDIT_TESTS:
        yield
        return

    stub_root = tmp_path_factory.mktemp("decompose-audit-bd")
    stub = stub_root / "bd"
    stub.write_text(
        "#!/usr/bin/env python3\n"
        "import json\n"
        "import sys\n"
        "args = sys.argv[1:]\n"
        "if args == ['version']:\n"
        "    print('bd version 1.1.0')\n"
        "elif args == ['where', '--json']:\n"
        f"    print(json.dumps({json.dumps({'database_path': str(stub_root / 'database'), 'prefix': 'Fixture', 'schema_version': '1'})}))\n"
        "else:\n"
        "    print(f'hermetic bd forbids mutation: {args}', file=sys.stderr)\n"
        "    raise SystemExit(2)\n",
        encoding="utf-8",
    )
    stub.chmod(0o755)
    monkeypatch.setenv("DEV_GRAPH_BD", str(stub))
    yield


class OrphanLintHarness:
    """lint-orphan-external-ref の path 解決・lib 読込・疑似 repo 構築をまとめる。"""

    script = PLUGIN / "scripts" / "lint-orphan-external-ref.py"
    lib = PLUGIN / "lib" / "orphan_external_ref.py"
    plugin = PLUGIN
    repo_root = REPO_ROOT
    baselined = BASELINED

    def __init__(self) -> None:
        # 検査ロジックを持つ lib を直接読む。CLI (script) は argv 解釈と出力しか持たない
        # ため、ロジックの不変条件は lib に対して固定する。CLI の挙動 (exit code /
        # --json-out / 引数エラー) は subprocess 経由で別ファイルが検証する。
        spec = importlib.util.spec_from_file_location("orphan_external_ref", self.lib)
        assert spec and spec.loader
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        self.module = module

    def md(self, node_id: str) -> str:
        """upsert-node.py が書く frontmatter と同じ形 (値は JSON) の artifact md。"""
        return f'---\ngraph_node_id: "{node_id}"\nartifact_kind: "issue"\n---\n\n# body\n'

    def repo(
        self,
        tmp_path: Path,
        node_ids: list[str],
        beads: list[dict],
        md_ids: tuple[str, ...] = (),
        baseline: tuple[str, ...] | None = (),
    ) -> tuple[Path, Path]:
        """tmp の疑似 repo を組む。baseline=None なら baseline ファイルを置かない (欠損検証用)。"""
        root = tmp_path / "repo"
        (root / ".dev-graph" / "state").mkdir(parents=True)
        (root / ".dev-graph" / "state" / "graph.json").write_text(
            json.dumps({"schema_version": "1", "nodes": [
                {"graph_node_id": node_id, "artifact_kind": "issue"} for node_id in node_ids
            ]}),
            encoding="utf-8",
        )
        issues_dir = root / "issues"
        issues_dir.mkdir(parents=True, exist_ok=True)
        for node_id in md_ids:
            (issues_dir / f"{node_id}.md").write_text(self.md(node_id), encoding="utf-8")
        if baseline is not None:
            baseline_path = root / self.module._BASELINE_RELPATH
            baseline_path.parent.mkdir(parents=True, exist_ok=True)
            baseline_path.write_text(
                json.dumps({self.module._BASELINE_KEY: list(baseline)}), encoding="utf-8",
            )
        export = root / "beads.jsonl"
        export.write_text("\n".join(json.dumps(row) for row in beads), encoding="utf-8")
        return root, export

    def issue(
        self,
        issue_id: str,
        node_id: str | None,
        status: str = "open",
        prefix: str = "dev-graph:",
    ) -> dict:
        row = {"id": issue_id, "status": status, "title": f"title of {issue_id}"}
        if node_id is not None:
            row["external_ref"] = f"{prefix}{node_id}"
        return row

    def run(self, root: Path, export: Path | None, *extra: str) -> tuple[int, dict]:
        """CLI を subprocess で実行し (exit code, JSON) を返す。"""
        args = [sys.executable, str(self.script), "--repo-root", str(root)]
        if export is not None:
            args += ["--beads-export", str(export)]
        args += list(extra)
        proc = subprocess.run(args, capture_output=True, text=True, check=False)
        assert proc.stdout, proc.stderr
        return proc.returncode, json.loads(proc.stdout)

    def git(self, root: Path, *args: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            ["git", *args],
            cwd=root,
            capture_output=True,
            text=True,
            check=True,
        )


@pytest.fixture(scope="session")
def orphan_lint() -> OrphanLintHarness:
    return OrphanLintHarness()
