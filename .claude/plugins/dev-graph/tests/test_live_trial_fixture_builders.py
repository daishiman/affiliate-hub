"""live-trial fixture 生成器 (--kind レジストリ) の契約テスト。

固定する契約は 4 つある。

1. **決定論**: 同じ ``--kind`` と同じ ``--out`` からは、何度生成しても同じ内容になる。
   fixture の実体は ``eval-log/dev-graph/live-trial-fixtures/`` (.gitignore 対象) にしか
   残らないため、生成手順だけが正本である。ここが崩れると「前回 trial と同じ条件で
   再実行できない」事故 (j24) が再発する。
2. **C11 適合**: 生成した graph が validate-graph-schema.py を通る。通らない fixture は
   被験 skill の起動ゲートで落ちるので、trial が「不完全な実走」になる。
3. **repository_id の実測**: config の repository_id は生成先の git common dir から
   導出した値でなければならない (C24 resolve-repo-context.py の fail-closed 条件)。
   ハードコードすると起動ゲートを迂回した偽 PASS を生む。
4. **repo-config 適合**: 生成した config が validate-repo-config.py を violation 0 で
   通る。2 の graph 側と対になる契約で、これが無かったために HarnessHub-n88
   (execution_tracker.mode=github と github.enabled=false の同時宣言) が 8 kind 全ての
   fixture で気づかれずに live-trial を通っていた。schema 違反 config を渡された被験
   skill は「本番なら起動ゲートで落ちる入力」で実走したことになり、trial の意味が失われる。

kind の一覧は生成器の ``BUILDERS`` から採るので、新しい kind を登録して本テストを
足し忘れても自動的に検査対象へ入る。
"""
from __future__ import annotations

import hashlib
import importlib.util
import json
import subprocess
import sys
from pathlib import Path

import pytest


PLUGIN = Path(__file__).resolve().parents[1]
BUILDER = PLUGIN / "tests" / "fixtures" / "build_live_trial_fixture.py"
VALIDATOR = PLUGIN / "scripts" / "validate-graph-schema.py"
CONFIG_VALIDATOR = PLUGIN / "scripts" / "validate-repo-config.py"
SOURCE_DIGEST_VALIDATOR = PLUGIN / "scripts" / "validate-source-digest.py"
SYSTEM_PLAN_VALIDATOR = PLUGIN.parent / "system-dev-planner" / "scripts" / "validate-system-plan.py"


def _load_builder():
    """生成器を module として読む (BUILDERS の登録内容を kind 一覧の正本にするため)。"""
    name = "build_live_trial_fixture"
    cached = sys.modules.get(name)
    if cached is not None:
        return cached
    spec = importlib.util.spec_from_file_location(name, BUILDER)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


BUILDER_MODULE = _load_builder()
KINDS = sorted(BUILDER_MODULE.BUILDERS)
# C01 init の被験対象は「dev-graph 未初期化の repository」なので graph も config も
# 持たない。検証すべき state が無いことがこの kind の正しい初期状態であり、C11 と
# repo-config 検証の双方から外れる (config を先に置くと init が何を作ったか判別できない)。
KINDS_WITHOUT_GRAPH = {"init"}
KINDS_WITHOUT_CONFIG = {"init"}


def _build(kind: str, out: Path) -> dict:
    """生成器を実プロセスとして走らせ、標準出力の receipt を返す。"""
    proc = subprocess.run(
        [sys.executable, str(BUILDER), "--kind", kind, "--out", str(out), "--force"],
        capture_output=True, text=True, check=False,
    )
    assert proc.returncode == 0, f"--kind {kind} failed:\n{proc.stdout}{proc.stderr}"
    return json.loads(proc.stdout)


def _content_manifest(out: Path) -> dict[str, str]:
    """``.git`` を除く全ファイルの sha256。git tree では見えない差分も拾うため。"""
    manifest: dict[str, str] = {}
    for path in sorted(out.rglob("*")):
        if not path.is_file() or ".git" in path.relative_to(out).parts:
            continue
        manifest[str(path.relative_to(out))] = hashlib.sha256(path.read_bytes()).hexdigest()
    return manifest


def _git(out: Path, *args: str) -> str:
    proc = subprocess.run(
        ["git", "-C", str(out), *args], capture_output=True, text=True, check=True
    )
    return proc.stdout.strip()


@pytest.fixture(scope="module")
def built(tmp_path_factory) -> dict[str, Path]:
    """全 kind を 1 度ずつ生成して共有する (requirements は上流 script を実走するため重い)。"""
    root = tmp_path_factory.mktemp("live-trial-fixtures")
    return {kind: (_build(kind, root / kind), root / kind)[1] for kind in KINDS}


@pytest.mark.parametrize("kind", KINDS)
def test_regeneration_is_byte_identical(kind: str, built: dict[str, Path]) -> None:
    """同一 --out への再生成が内容・git tree・commit sha まで一致する。"""
    out = built[kind]
    before_files = _content_manifest(out)
    before_tree = _git(out, "rev-parse", "HEAD^{tree}")
    before_head = _git(out, "rev-parse", "HEAD")

    _build(kind, out)

    assert _content_manifest(out) == before_files
    assert _git(out, "rev-parse", "HEAD^{tree}") == before_tree
    # commit sha まで一致することが「時刻を埋め込んでいない」ことの実証になる。
    assert _git(out, "rev-parse", "HEAD") == before_head


@pytest.mark.parametrize("kind", sorted(set(KINDS) - KINDS_WITHOUT_GRAPH))
def test_graph_passes_c11(kind: str, built: dict[str, Path]) -> None:
    """生成した graph が validate-graph-schema.py (C11) を violation 0 で通る。"""
    out = built[kind]
    proc = subprocess.run(
        [sys.executable, str(VALIDATOR),
         "--graph", str(out / ".dev-graph" / "state" / "graph.json"),
         "--repo-root", str(out)],
        capture_output=True, text=True, check=False,
    )
    assert proc.returncode == 0, f"C11 failed for --kind {kind}:\n{proc.stdout}{proc.stderr}"


@pytest.mark.parametrize("kind", sorted(set(KINDS) - KINDS_WITHOUT_CONFIG))
def test_config_passes_repo_config_validation(kind: str, built: dict[str, Path]) -> None:
    """生成した config が validate-repo-config.py を violation 0 で通る。

    graph 側 (C11) と対になる契約。fixture の config は被験 skill が起動時に読む入力
    そのものなので、schema 違反のまま trial を回すと「本番なら起動ゲートで落ちる条件」
    での実走になり、PASS が挙動の保証にならない。
    """
    out = built[kind]
    proc = subprocess.run(
        [sys.executable, str(CONFIG_VALIDATOR),
         "--config", str(out / ".dev-graph" / "config.json"),
         "--repo-root", str(out)],
        capture_output=True, text=True, check=False,
    )
    assert proc.returncode == 0, (
        f"repo-config validation failed for --kind {kind}:\n{proc.stdout}{proc.stderr}"
    )
    assert json.loads(proc.stdout)["violations"] == []


def test_repo_config_builder_rejects_incoherent_tracker_and_projects() -> None:
    """mode と Projects 定義の矛盾を、config を組み立てる時点で拒否する。

    schema の条件連鎖 (mode ∈ {github, both} → github.enabled=true → default Projects
    ちょうど 1 件) を builder 側の不変条件として持つ。ここが素通りすると
    HarnessHub-n88 と同じく「schema 違反 config が全 kind へ静かに配られる」再発になる。
    """
    module = BUILDER_MODULE
    with pytest.raises(ValueError):
        # GitHub トラッカー宣言に対して Projects 定義が無い。
        module._repo_config("local:sha256:" + "0" * 64, tracker_mode="github", projects=[])
    with pytest.raises(ValueError):
        # default=true が 2 件 (schema は maxContains=1)。
        duplicated = [module._planning_project(), {**module._planning_project(), "alias": "second"}]
        module._repo_config("local:sha256:" + "0" * 64, tracker_mode="github", projects=duplicated)
    with pytest.raises(ValueError):
        # GitHub 無効なのに Projects 定義を持つ (使われない設定の持ち込み)。
        module._repo_config(
            "local:sha256:" + "0" * 64, tracker_mode="beads", projects=[module._planning_project()]
        )


@pytest.mark.parametrize("kind", sorted(set(KINDS) - KINDS_WITHOUT_GRAPH))
def test_repository_id_is_measured_from_git_common_dir(kind: str, built: dict[str, Path]) -> None:
    """config の repository_id が生成先の git common dir から導出された実測値である。

    C24 は config 宣言と実測値の不一致で fail-closed するため、ハードコードされた値や
    別 fixture から複写された値が紛れ込むと起動ゲートを通れない。
    """
    out = built[kind]
    common = Path(_git(out, "rev-parse", "--git-common-dir"))
    common = (common if common.is_absolute() else out / common).resolve(strict=True)
    expected = "local:sha256:" + hashlib.sha256(str(common).encode("utf-8")).hexdigest()
    config = json.loads((out / ".dev-graph" / "config.json").read_text(encoding="utf-8"))
    assert config["repository_id"] == expected


def test_init_fixture_is_not_dev_graph_initialized(built: dict[str, Path]) -> None:
    """C01 の被験対象は未初期化 repository である (fixture が初期化を先取りしない)。"""
    out = built["init"]
    assert (out / ".git").is_dir()
    assert _git(out, "rev-parse", "HEAD")
    assert not (out / ".dev-graph").exists()
    # content root を先に作ると「skill が作ったのか最初からあったのか」を区別できない。
    for relative in sorted(set(BUILDER_MODULE.CONTENT_ROOTS.values())):
        assert not (out / relative).exists(), relative


def test_node_fixture_declares_no_artifact_kind(built: dict[str, Path]) -> None:
    """C02 の分類が自明にならないよう、素材バッチが正解 (kind と node id) を持たない。

    fixture 側で ``artifact_kind`` を宣言すると required_observation
    「all five artifacts are routed to canonical kind paths」が試験されなくなる。
    """
    batch = json.loads((built["node"] / "mixed-artifacts.json").read_text(encoding="utf-8"))
    assert len(batch) == 5
    for artifact in batch:
        assert set(artifact) == {"title", "body", "tags"}
    # shell 展開を避けた入力コピーを goal-seek evidence 記録後に置けるよう、空の staging
    # directory は fixture commit に含める。分類済み成果物を先取りしてはいけない。
    staging = built["node"] / "inputs"
    assert staging.is_dir()
    assert [path.name for path in staging.iterdir()] == [".gitkeep"]
    # 分類先の content root も空のままであること (登録結果を先に置いていない)。
    graph = json.loads((built["node"] / ".dev-graph" / "state" / "graph.json").read_text(encoding="utf-8"))
    assert graph["nodes"] == []


def test_requirements_fixture_does_not_preseed_c04_outputs(built: dict[str, Path]) -> None:
    """C04 fixture が被験 skill の成果物を先取りしていない (baseline = 入力だけ)。

    C04 の出力契約は「要件定義書 + readiness/missing_sections 一覧 + capability-build
    handoff 参照 + graph snapshot」(plugin-plans/dev-graph/component-inventory.json:196)。
    これらを fixture が同梱すると、runner が既存ファイルを読むだけで PASS を自己申告でき、
    skill の能力が観測されなくなる。

    紛らわしいのは ``system-build-handoff.json`` と ``task-graph.json`` で、名前は C04 の
    出力語彙と衝突するが所有者は system-dev-planner である。C04 が gate 3 で走らせる
    validate-system-plan.py:37,266-267 が両方を必須 load し、欠いた状態では missing-file
    violation で exit 2 になるため、これらは削除できない *入力* である。よって「消す」
    ではなく「baseline を閉じた集合として宣言し、実 tree との exact 一致を固定する」形で
    先取りを防ぐ。
    """
    out = built["requirements"]
    common = Path(_git(out, "rev-parse", "--git-common-dir"))
    common = (common if common.is_absolute() else out / common).resolve(strict=True)
    baseline = json.loads(
        (common / "dev-graph" / "live-trial-baseline.json").read_text(encoding="utf-8")
    )

    tracked = {
        line for line in _git(out, "ls-files").splitlines()
        if line and Path(line).name != ".gitkeep"
    }
    assert set(baseline["inputs"]) == tracked
    for path, entry in baseline["inputs"].items():
        assert entry["sha256"] == hashlib.sha256((out / path).read_bytes()).hexdigest(), path

    # 衝突しやすい 2 file は system-dev-planner 所有の入力として宣言されている。
    package = "system-plan/F-LIVE-001"
    for relative in (f"{package}/system-build-handoff.json", f"{package}/task-graph.json"):
        assert "validate-system-plan.py" in baseline["inputs"][relative]["provenance"], relative
        assert relative in baseline["name_collision_warning"], relative

    # C04 が goal-spec/progress/intermediate を書く eval-log は、骨格層
    # (build_live_trial_fixture.py:522) が空 dir として用意するだけで中身は 0 件である。
    # ファイルが 1 件でもあれば実走前から成果物が置かれていることになる。
    assert [path for path in (out / "eval-log").rglob("*") if path.is_file()] == []
    assert baseline["subject_outputs_absent_at_baseline"]


def test_requirements_fixture_scope_closure_passes_source_digest(
    built: dict[str, Path],
) -> None:
    """C04 が feature の architecture closure を除外せず gate できる。"""
    out = built["requirements"]
    graph = json.loads(
        (out / ".dev-graph" / "state" / "graph.json").read_text(encoding="utf-8")
    )
    registered = ",".join(node["graph_node_id"] for node in graph["nodes"])
    proc = subprocess.run(
        [
            sys.executable,
            str(SOURCE_DIGEST_VALIDATOR),
            "--repo-root",
            str(out),
            "--registered",
            registered,
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    assert proc.returncode == 0, proc.stdout + proc.stderr
    report = json.loads(proc.stdout)
    assert report["registered_mismatch"] == []
    assert report["checked"] == len(graph["nodes"])


def test_requirements_fixture_resolves_published_package_from_current_pointer(
    built: dict[str, Path],
) -> None:
    """C04 の promotion 後入口は --feature-package で current pointer を解決できる。"""
    out = built["requirements"]
    pointer = (
        out
        / ".dev-graph"
        / "plan-state"
        / "current"
        / "feature-package-F-LIVE-001.json"
    )
    payload = json.loads(pointer.read_text(encoding="utf-8"))
    assert payload["feature_package_id"] == "feature-package/F-LIVE-001"
    assert payload["published_path"] == "system-plan/F-LIVE-001"

    proc = subprocess.run(
        [
            sys.executable,
            str(SYSTEM_PLAN_VALIDATOR),
            "--repo-root",
            str(out),
            "--feature-package",
            "feature-package/F-LIVE-001",
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    assert proc.returncode == 0, proc.stdout + proc.stderr
    report = json.loads(proc.stdout)
    assert report["status"] == "pass"


def test_status_fixture_exposes_a_dependency_edge(built: dict[str, Path]) -> None:
    """C18 が ready/blocked を区別できる最小構成 (task 2 件 + 前方依存 1 本) である。"""
    graph = json.loads(
        (built["status"] / ".dev-graph" / "state" / "graph.json").read_text(encoding="utf-8")
    )
    by_id = {node["graph_node_id"]: node for node in graph["nodes"]}
    assert set(by_id) == {"LT-TASK-001", "LT-TASK-002"}
    assert by_id["LT-TASK-001"]["depends_on"] == []
    assert by_id["LT-TASK-002"]["depends_on"] == ["LT-TASK-001"]


def test_distinct_output_paths_get_distinct_repository_ids(tmp_path: Path) -> None:
    """repository_id だけは生成先依存で正しい (C24)。他の値は生成先に依存しない。"""
    first = _build("status", tmp_path / "a")
    second = _build("status", tmp_path / "b")
    assert first["repository_id"] != second["repository_id"]
    # path 依存値は repository_id フィールドに閉じている。config だけでなく graph store も
    # canonical envelope の一部として repository_id を持つので (C11 の exact-4-key)、
    # 生の digest は 2 file で割れる。
    manifest_a = _content_manifest(tmp_path / "a")
    manifest_b = _content_manifest(tmp_path / "b")
    assert set(manifest_a) == set(manifest_b)
    differing = {key for key in manifest_a if manifest_a[key] != manifest_b[key]}
    assert differing == {".dev-graph/config.json", ".dev-graph/state/graph.json"}
    # 「repository_id に閉じている」ことは、その 1 key を落とした投影が一致することで示す。
    # digest の差分集合を数えるだけだと、同じ file の別 key が動いても検出できない。
    for relative in sorted(differing):
        document_a = json.loads((tmp_path / "a" / relative).read_text(encoding="utf-8"))
        document_b = json.loads((tmp_path / "b" / relative).read_text(encoding="utf-8"))
        assert document_a.pop("repository_id") != document_b.pop("repository_id")
        assert document_a == document_b
