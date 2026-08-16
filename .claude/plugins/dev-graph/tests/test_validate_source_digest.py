"""validate-source-digest.py (R3-import の digest 流用検出ゲート) の検証。"""
from __future__ import annotations

import hashlib
import json
import subprocess
import sys
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "validate-source-digest.py"


def build_repo(tmp_path: Path, nodes: list[dict], files: dict[str, str]) -> Path:
    root = tmp_path / "repo"
    (root / ".dev-graph" / "state").mkdir(parents=True)
    (root / ".dev-graph" / "state" / "graph.json").write_text(
        json.dumps({"schema_version": "1", "nodes": nodes}), encoding="utf-8"
    )
    for rel, content in files.items():
        target = root / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
    return root


def node(node_id: str, source_path: str | None, digest: str | None) -> dict:
    sl = {}
    if source_path is not None:
        sl["source_path"] = source_path
    if digest is not None:
        sl["source_digest"] = digest
    return {"graph_node_id": node_id, "source_lineage": sl}


def sha(content: str) -> str:
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


def run(root: Path, registered: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, str(SCRIPT), "--repo-root", str(root), "--registered", registered],
        capture_output=True, text=True, check=False,
    )


def test_matching_per_path_digest_passes(tmp_path: Path) -> None:
    root = build_repo(
        tmp_path,
        [node("N1", "spec/a.md", sha("AAA")), node("N2", "spec/b.md", sha("BBB"))],
        {"spec/a.md": "AAA", "spec/b.md": "BBB"},
    )
    proc = run(root, "N1,N2")
    assert proc.returncode == 0, proc.stdout + proc.stderr
    assert json.loads(proc.stdout)["checked"] == 2


def test_reused_digest_fails_closed(tmp_path: Path) -> None:
    # N2 が N1 (a.md) の digest を流用 → b.md の実 sha と不一致 → fail
    root = build_repo(
        tmp_path,
        [node("N1", "spec/a.md", sha("AAA")), node("N2", "spec/b.md", sha("AAA"))],
        {"spec/a.md": "AAA", "spec/b.md": "BBB"},
    )
    proc = run(root, "N1,N2")
    assert proc.returncode == 2
    mism = json.loads(proc.stdout)["registered_mismatch"]
    assert mism[0]["graph_node_id"] == "N2"


def test_missing_source_file_fails_closed(tmp_path: Path) -> None:
    root = build_repo(tmp_path, [node("N1", "spec/gone.md", sha("X"))], {})
    proc = run(root, "N1")
    assert proc.returncode == 2


def test_unregistered_node_is_not_checked(tmp_path: Path) -> None:
    # OLD は digest 不一致だが registered 外なので無視
    root = build_repo(
        tmp_path,
        [node("OLD", "spec/a.md", "deadbeef"), node("N1", "spec/b.md", sha("BBB"))],
        {"spec/a.md": "AAA", "spec/b.md": "BBB"},
    )
    proc = run(root, "N1")
    assert proc.returncode == 0
    assert json.loads(proc.stdout)["checked"] == 1


def test_progress_supplies_registered(tmp_path: Path) -> None:
    root = build_repo(tmp_path, [node("N1", "spec/b.md", "deadbeef")], {"spec/b.md": "BBB"})
    progress = root / "progress.json"
    progress.write_text(json.dumps({"registered_this_run": ["N1"]}), encoding="utf-8")
    proc = subprocess.run(
        [sys.executable, str(SCRIPT), "--repo-root", str(root), "--progress", str(progress)],
        capture_output=True, text=True, check=False,
    )
    assert proc.returncode == 2  # progress 由来 registered の digest 不一致で fail


# --- HarnessHub-432: system-dev-planner 由来 node の package lineage ---------
#
# published task spec の source_lineage.source_digest は個々の task spec ではなく
# package (content-addressed generation) の canonical digest を指す。per-file 前提で
# 照合すると exact-13 task 全件が偽陽性になるため、package を検出した場合は
# canonical digest と manifest per-file sha256 の 2 段照合へ切り替える。


def build_package(root: Path, package_rel: str, specs: dict[str, str]) -> str:
    """staging-manifest.json を持つ published package を組み立て canonical digest を返す。"""
    package = root / package_rel
    package.mkdir(parents=True, exist_ok=True)
    files: dict[str, str] = {}
    for rel, content in specs.items():
        target = package / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
        files[rel] = sha(content)
    digest = hashlib.sha256()
    for rel in sorted(files):
        digest.update(rel.encode()); digest.update(b"\0")
        digest.update((package / rel).read_bytes()); digest.update(b"\0")
    canonical = digest.hexdigest()
    (package / "staging-manifest.json").write_text(
        json.dumps({"canonical_digest": "sha256:" + canonical, "files": files}), encoding="utf-8"
    )
    return canonical


def package_node(node_id: str, source_path: str, digest: str) -> dict:
    return {"graph_node_id": node_id,
            "source_lineage": {"origin_kind": "system-dev-planner", "source_plugin": "system-dev-planner",
                               "source_path": source_path, "source_digest": digest}}


PKG = ".dev-graph/plans/generations/feature-package-feat-x/gen"


def test_package_digest_lineage_passes(tmp_path: Path) -> None:
    root = tmp_path / "repo"
    (root / ".dev-graph" / "state").mkdir(parents=True)
    canonical = build_package(root, PKG, {"task-specs/phase-01.md": "P1", "task-specs/phase-02.md": "P2"})
    nodes = [package_node("T1", f"{PKG}/task-specs/phase-01.md", canonical),
             package_node("T2", f"{PKG}/task-specs/phase-02.md", canonical)]
    (root / ".dev-graph" / "state" / "graph.json").write_text(
        json.dumps({"schema_version": "1", "nodes": nodes}), encoding="utf-8")
    proc = run(root, "T1,T2")
    assert proc.returncode == 0, proc.stdout + proc.stderr
    assert json.loads(proc.stdout)["checked"] == 2


def test_foreign_package_digest_fails_closed(tmp_path: Path) -> None:
    root = tmp_path / "repo"
    (root / ".dev-graph" / "state").mkdir(parents=True)
    build_package(root, PKG, {"task-specs/phase-01.md": "P1"})
    other = build_package(root, ".dev-graph/plans/generations/feature-package-feat-y/gen", {"task-specs/phase-01.md": "Z"})
    nodes = [package_node("T1", f"{PKG}/task-specs/phase-01.md", other)]
    (root / ".dev-graph" / "state" / "graph.json").write_text(
        json.dumps({"schema_version": "1", "nodes": nodes}), encoding="utf-8")
    proc = run(root, "T1")
    assert proc.returncode == 2
    assert "package canonical digest 不一致" in json.loads(proc.stdout)["registered_mismatch"][0]["reason"]


def test_mutated_generation_file_fails_closed(tmp_path: Path) -> None:
    # immutable generation の task spec を手編集すると manifest per-file sha と乖離する
    root = tmp_path / "repo"
    (root / ".dev-graph" / "state").mkdir(parents=True)
    canonical = build_package(root, PKG, {"task-specs/phase-01.md": "P1"})
    (root / PKG / "task-specs" / "phase-01.md").write_text("TAMPERED", encoding="utf-8")
    nodes = [package_node("T1", f"{PKG}/task-specs/phase-01.md", canonical)]
    (root / ".dev-graph" / "state" / "graph.json").write_text(
        json.dumps({"schema_version": "1", "nodes": nodes}), encoding="utf-8")
    proc = run(root, "T1")
    assert proc.returncode == 2
    assert "immutable generation の改変" in json.loads(proc.stdout)["registered_mismatch"][0]["reason"]


def test_source_path_outside_manifest_fails_closed(tmp_path: Path) -> None:
    root = tmp_path / "repo"
    (root / ".dev-graph" / "state").mkdir(parents=True)
    canonical = build_package(root, PKG, {"task-specs/phase-01.md": "P1"})
    (root / PKG / "task-specs" / "stray.md").write_text("STRAY", encoding="utf-8")
    nodes = [package_node("T1", f"{PKG}/task-specs/stray.md", canonical)]
    (root / ".dev-graph" / "state" / "graph.json").write_text(
        json.dumps({"schema_version": "1", "nodes": nodes}), encoding="utf-8")
    proc = run(root, "T1")
    assert proc.returncode == 2
    assert "package manifest に載っていない" in json.loads(proc.stdout)["registered_mismatch"][0]["reason"]


def test_planner_origin_without_package_manifest_fails_closed(tmp_path: Path) -> None:
    root = build_repo(
        tmp_path,
        [package_node("T1", "spec/phase-01.md", sha("P1"))],
        {"spec/phase-01.md": "P1"},
    )
    proc = run(root, "T1")
    assert proc.returncode == 2
    assert "package staging-manifest.json が無い" in \
        json.loads(proc.stdout)["registered_mismatch"][0]["reason"]


def test_absolute_source_path_outside_repo_fails_closed(tmp_path: Path) -> None:
    outside = tmp_path / "outside.md"
    outside.write_text("OUTSIDE", encoding="utf-8")
    root = build_repo(
        tmp_path,
        [node("N1", str(outside.resolve()), sha("OUTSIDE"))],
        {},
    )
    proc = run(root, "N1")
    assert proc.returncode == 2
    assert "repository boundary 外" in json.loads(proc.stdout)["registered_mismatch"][0]["reason"]


def test_source_path_symlink_outside_repo_fails_closed(tmp_path: Path) -> None:
    outside = tmp_path / "outside.md"
    outside.write_text("OUTSIDE", encoding="utf-8")
    root = build_repo(tmp_path, [], {})
    link = root / "spec" / "link.md"
    link.parent.mkdir(parents=True)
    link.symlink_to(outside.resolve())
    graph = {"schema_version": "1", "nodes": [node("N1", "spec/link.md", sha("OUTSIDE"))]}
    (root / ".dev-graph" / "state" / "graph.json").write_text(json.dumps(graph), encoding="utf-8")
    proc = run(root, "N1")
    assert proc.returncode == 2
    assert "repository boundary 外" in json.loads(proc.stdout)["registered_mismatch"][0]["reason"]


def test_non_planner_origin_keeps_per_file_check(tmp_path: Path) -> None:
    # package 配下でも origin_kind が system-dev-planner でなければ per-file 契約のまま
    root = tmp_path / "repo"
    (root / ".dev-graph" / "state").mkdir(parents=True)
    canonical = build_package(root, PKG, {"task-specs/phase-01.md": "P1"})
    nodes = [{"graph_node_id": "M1",
              "source_lineage": {"origin_kind": "manual", "source_path": f"{PKG}/task-specs/phase-01.md",
                                 "source_digest": canonical}}]
    (root / ".dev-graph" / "state" / "graph.json").write_text(
        json.dumps({"schema_version": "1", "nodes": nodes}), encoding="utf-8")
    proc = run(root, "M1")
    assert proc.returncode == 2
    assert "他 file 流用の疑い" in json.loads(proc.stdout)["registered_mismatch"][0]["reason"]


def test_c04_requirements_anchors_digest_gate_to_this_script() -> None:
    """C04 の readiness 照合が散文 checklist ではなく本 script の exit code へ係留されている。

    2026-07-21 live-trial r13 で、C04 が confirmation/evaluation/readiness だけを比較し
    source_digest 照合を全周回で省略、registered_mismatch 4件のまま handoff を emit する
    fail-open を検出した回帰テスト。
    """
    skill = (
        Path(__file__).resolve().parents[1]
        / "skills" / "run-dev-graph-requirements" / "SKILL.md"
    )
    text = skill.read_text(encoding="utf-8")
    _opening, frontmatter, body = text.split("---", 2)

    assert "../../scripts/validate-source-digest.py" in frontmatter, (
        "validate-source-digest.py must be a declared script_ref of C04"
    )
    assert "validate-source-digest.py" in body, (
        "SKILL body must invoke the digest gate, not describe it only in prose"
    )
    checklist = [line for line in body.splitlines() if line.startswith("- [ ]")]
    assert any(
        "validate-source-digest.py" in line and "exit 0" in line for line in checklist
    ), "完了チェックリストに script の exit 0 を条件とする項目が必要"


def test_c04_digest_gate_reaches_the_responsibility_prompt() -> None:
    """gate が SKILL.md だけでなく責務プロンプトまで届いている (片肺修正の防止)。

    SKILL.md は未達 responsibility を prompts/<R-id>.md 経由で Agent へ fork する。
    prompt 側が散文述語のままだと、分離 context の agent は script を実行する指示を
    持たず、r13 の fail-open がそのまま再現する。姉妹 skill run-dev-graph-system-spec は
    同種の gate を prompts/R3-import.md まで伝播済みで、これが前例。
    """
    prompt = (
        Path(__file__).resolve().parents[1]
        / "skills" / "run-dev-graph-requirements" / "prompts" / "R2b-readiness.md"
    )
    text = prompt.read_text(encoding="utf-8")
    assert "validate-source-digest" in text, (
        "責務プロンプトの使用資産に digest gate が必要"
    )
    checklist = [line for line in text.splitlines() if line.startswith("- [ ]")]
    assert any(
        "validate-source-digest.py" in line and "exit 0" in line for line in checklist
    ), "prompt の完了チェックリスト (停止条件) に script の exit 0 が必要"


def test_c04_validates_full_lineage_closure_and_current_package() -> None:
    """C04 は task 13 件だけでなく上流 lineage を検査し、公開後入口を使う。"""
    plugin = Path(__file__).resolve().parents[1]
    paths = [
        plugin / "skills" / "run-dev-graph-requirements" / "SKILL.md",
        plugin / "skills" / "run-dev-graph-requirements" / "prompts" / "R2b-readiness.md",
    ]
    for path in paths:
        text = path.read_text(encoding="utf-8")
        assert "選択 feature" in text
        assert "architecture_refs" in text
        assert "task 13 件" in text
        assert "--feature-package" in text
        assert "package 引数なし" in text

    skill_text = paths[0].read_text(encoding="utf-8")
    assert '--feature-package "<選択 feature node の feature_package_id>"' in skill_text
    assert "task 13 件だけの検査は closure 不足として拒否する" in skill_text
