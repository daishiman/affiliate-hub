"""lint-live-trial-task-contract.py (HarnessHub-768b) の検証。

固定する契約は 4 つある。

1. **旧前提の拒否**: 「確定成果物は事前配置済み」「正規フローを再実行禁止」という前提を
   持つ task.md を機械的に落とす。実物 (20260726T040700Z-sysspec-final/task.md) を
   入力にした回帰で固定する。この task.md は fixture が brief 1 file しか置かないのに
   確定成果物の存在を仮定し、C19 live-trial を FAIL させた原因そのものである。
2. **現行契約の非誤爆**: 正本から生成した bounded-resume task は violation 0 で通る。
3. **fixture 実体との一致**: TASK_CONTRACT の placed_inputs / absent_artifacts が
   生成器 (--kind system-spec) の実出力と一致する。宣言だけ直して build を直さない
   (あるいは逆) と、task.md 側の前提検査が全て緑のまま実 fixture だけ旧前提へ戻る。
4. **正本変更の伝播**: scenario_id / task_args_template / required_observations /
   fixture contract のいずれが動いても contract_digest が動く。受入条件5「4 種の変更が
   1 つの検証経路へ束ねられる」を digest 1 個で成立させているので、ここが崩れると
   premise block が陳腐化しても気づけない。
"""
from __future__ import annotations

import importlib.util
import json
import subprocess
import sys
from pathlib import Path

import pytest

PLUGIN = Path(__file__).resolve().parents[1]
REPO = Path(__file__).resolve().parents[3]
LINT = PLUGIN / "scripts" / "lint-live-trial-task-contract.py"
BUILDER = PLUGIN / "tests" / "fixtures" / "build_live_trial_fixture.py"
TRIALS = REPO / "eval-log" / "dev-graph" / "run-dev-graph-system-spec" / "live-trial"
# fixture 契約と矛盾する旧前提で走り FAIL した run (verdict.json を持たない)。
STALE_TASK = TRIALS / "20260726T040700Z-sysspec-final" / "task.md"
SHAPE = "system-spec"


def _lint_module():
    """lint を module として読む (契約の解決関数を検査側で再実装しないため)。"""
    name = "lint_live_trial_task_contract"
    cached = sys.modules.get(name)
    if cached is not None:
        return cached
    spec = importlib.util.spec_from_file_location(name, LINT)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


MODULE = _lint_module()


def _contract() -> dict:
    return MODULE.load_shape_contracts(REPO)[SHAPE]


def _scenario() -> dict:
    return MODULE.resolve_scenario(_contract(), MODULE.load_scenarios(REPO))


def _lint(*argv: str) -> tuple[int, dict]:
    proc = subprocess.run(
        [sys.executable, str(LINT), "--repo-root", str(REPO), *argv],
        capture_output=True, text=True, check=False,
    )
    assert proc.stdout.lstrip().startswith("{"), f"JSON が出ていない:\n{proc.stdout}{proc.stderr}"
    return proc.returncode, json.loads(proc.stdout)


def _rules(report: dict) -> set[str]:
    return {violation["rule"] for violation in report["violations"]}


def _emit_premise(fixture_path: str = "/tmp/fixture") -> str:
    proc = subprocess.run(
        [sys.executable, str(LINT), "--repo-root", str(REPO), "--emit-premise",
         "--shape", SHAPE, "--fixture-path", fixture_path],
        capture_output=True, text=True, check=False,
    )
    assert proc.returncode == 0, proc.stderr
    return proc.stdout


def _mutated(tmp_path: Path, *replacements: tuple[str, str], prefix: str = "") -> Path:
    """合格側の実物を土台に、狙った 1 点だけを壊した task.md を作る。

    合成 task.md をゼロから書くと他 rule が同時発火して「どの rule が効いたか」が
    曖昧になる。実物を土台にすれば単一 rule の効力を分離して測れる。
    """
    text = _fresh_task_text()
    for old, new in replacements:
        assert old in text, f"土台の実物に原文が無い (テストの前提が陳腐化): {old!r}"
        text = text.replace(old, new)
    path = tmp_path / "task.md"
    path.write_text(prefix + text, encoding="utf-8")
    return path


def _fresh_task_text() -> str:
    """Build a small current task from the same premise source as production."""
    return _emit_premise() + """
# bounded C19 trial
Skill({skill: "dev-graph:run-dev-graph-system-spec", args: "--repo-root /tmp/fixture --resume"})
Run validate-system-spec-resume.py and require mode reuse-confirmed.
Register both nodes only through C02 upsert-node.py.
Verify source_lineage and confirmation_evidence.
"""


# --- MUST_DETECT: 旧前提の拒否 (受入条件 3) ---------------------------------------


def test_stale_real_task_is_rejected() -> None:
    """旧 build-mode task は bounded scenario の current task を名乗れない。"""
    code, report = _lint("--task", str(STALE_TASK))
    assert code == 2
    rules = _rules(report)
    assert "LT-001" in rules, report["violations"]
    assert "LT-003" in rules, report["violations"]


def test_extra_arg_is_rejected(tmp_path: Path) -> None:
    task = _mutated(
        tmp_path,
        ("/tmp/fixture --resume\"})", "/tmp/fixture --resume --dry-run\"})"),
    )
    code, report = _lint("--task", str(task))
    assert code == 2
    assert "LT-006" in _rules(report)


def test_scenario_id_omission_is_rejected_as_contract_violation(tmp_path: Path) -> None:
    """単一 shape では scenario 記載漏れを一般エラーでなく LT-001 として返す。"""
    task = _mutated(
        tmp_path,
        ("C19-OUT1-positive-system-spec-lineage-r3-bounded", "C19-OUT1-redacted"),
    )
    code, report = _lint("--task", str(task))
    assert code == 2
    assert "LT-001" in _rules(report)


def test_wrong_subject_skill_is_rejected(tmp_path: Path) -> None:
    """args が同じでも被験 skill が scenario 正本と違えば LT-006。"""
    task = _mutated(
        tmp_path,
        (
            'skill: "dev-graph:run-dev-graph-system-spec"',
            'skill: "dev-graph:run-dev-graph-status"',
        ),
    )
    code, report = _lint("--task", str(task))
    assert code == 2
    assert "LT-006" in _rules(report)


def test_placed_resume_receipt_omission_is_rejected(tmp_path: Path) -> None:
    task = _mutated(
        tmp_path,
        ("system-spec/resume-receipt.json", "system-spec/missing-receipt.json"),
    )
    code, report = _lint("--task", str(task))
    assert code == 2
    assert "LT-003" in _rules(report)


def test_placed_input_omission_is_rejected(tmp_path: Path) -> None:
    task = _mutated(tmp_path, ("00-requirements-definition.md", "some-other-input.md"))
    code, report = _lint("--task", str(task))
    assert code == 2
    assert "LT-003" in _rules(report)


def test_missing_entry_point_is_rejected(tmp_path: Path) -> None:
    task = _mutated(tmp_path, ("run-system-spec-doc-fetch", "run-system-spec-docfetch"))
    code, report = _lint("--task", str(task))
    assert code == 2
    assert "LT-007" in _rules(report)


def test_resume_mode_does_not_require_expensive_nested_skill_calls(tmp_path: Path) -> None:
    task = _mutated(tmp_path)
    code, report = _lint("--task", str(task))
    assert code == 0, report["violations"]
    assert "LT-008" not in _rules(report)


def test_uncovered_observation_is_rejected(tmp_path: Path) -> None:
    """scenario の観測条件を裏づけるキーワードが消えたら落ちる。"""
    task = _mutated(tmp_path, ("upsert-node.py", "graph-writer.py"))
    code, report = _lint("--task", str(task))
    assert code == 2
    assert "LT-009" in _rules(report)


def test_tampered_premise_digest_is_rejected(tmp_path: Path) -> None:
    """premise block を貼ったあと契約側が動いた (= digest 不一致) 状態を落とす。"""
    premise = _emit_premise()
    digest = MODULE.PREMISE_BEGIN.search(premise).group("digest")
    task = _mutated(tmp_path, prefix=premise.replace(digest, "0" * len(digest)))
    code, report = _lint("--task", str(task))
    assert code == 2
    assert "LT-011" in _rules(report)


# --- MUST_PASS: 合格証跡と生成物の非誤爆 -------------------------------------------


def test_current_generated_task_passes(tmp_path: Path) -> None:
    """bounded fixture 契約から生成した task は violation 0。"""
    task = _mutated(tmp_path)
    code, report = _lint("--task", str(task))
    assert code == 0, report["violations"]
    assert report["violation_count"] == 0


def test_emitted_premise_round_trips(tmp_path: Path) -> None:
    """--emit-premise の出力をそのまま貼った task.md は digest 検査を通る。"""
    task = _mutated(tmp_path, prefix=_emit_premise())
    code, report = _lint("--task", str(task))
    assert code == 0, report["violations"]
    assert report["checked"][0]["has_premise_block"] is True


def test_emitted_premise_contains_every_required_task_fragment() -> None:
    premise = _emit_premise()

    for fragment in _scenario()["task_contract"]["required_fragments"]:
        assert fragment in premise


@pytest.mark.parametrize(
    "fragment",
    _scenario()["task_contract"]["required_fragments"],
)
def test_each_required_task_fragment_is_fail_closed(
    tmp_path: Path, fragment: str
) -> None:
    task = _mutated(tmp_path)
    text = task.read_text(encoding="utf-8")
    assert fragment in text
    task.write_text(
        text.replace(fragment, "<required-fragment-removed>"), encoding="utf-8"
    )

    code, report = _lint("--task", str(task))

    assert code == 2
    assert "LT-012" in _rules(report)


def test_forbidden_task_fragment_is_fail_closed(tmp_path: Path) -> None:
    contract, scenario = _contract(), dict(_scenario())
    task_contract = dict(scenario["task_contract"])
    task_contract["forbidden_fragments"] = ["FORBIDDEN_SENTINEL"]
    scenario["task_contract"] = task_contract
    task = _mutated(tmp_path)
    violations = MODULE.check_task(
        task.read_text(encoding="utf-8") + "\nFORBIDDEN_SENTINEL\n",
        contract=contract,
        scenario=scenario,
        scenarios={scenario["scenario_id"]: scenario},
    )

    assert "LT-013" in {item["rule"] for item in violations}


def test_premise_emission_is_deterministic() -> None:
    assert _emit_premise() == _emit_premise()


def test_latest_task_falls_back_to_latest_completed_run_without_receipt(tmp_path: Path) -> None:
    """receipt 不在時は verdict 保有 run の辞書順最大へ後退し、中断 run は無視する。"""
    base = (
        tmp_path
        / "eval-log"
        / "dev-graph"
        / "run-dev-graph-system-spec"
        / "live-trial"
    )
    for run_id in ("20260801T000000-old", "20260802T000000-new"):
        run = base / run_id
        run.mkdir(parents=True)
        (run / "task.md").write_text(f"# {run_id}\n", encoding="utf-8")
        (run / "verdict.json").write_text("{}\n", encoding="utf-8")
    interrupted = base / "20260803T000000-interrupted"
    interrupted.mkdir()
    (interrupted / "task.md").write_text("# interrupted\n", encoding="utf-8")

    selected = MODULE.latest_task_path(tmp_path, "run-dev-graph-system-spec")
    assert selected == base / "20260802T000000-new" / "task.md"


def test_all_mode_reports_real_repo_state_without_fixed_run_id() -> None:
    """実 repository の current/stale 状態を固定 run-id に依存せず報告する。"""
    code, report = _lint("--all")
    assert code in {0, 2}
    assert isinstance(report["violations"], list)
    if code == 2:
        assert {finding["rule"] for finding in report["violations"]} <= {"LT-003", "LT-011"}
        assert all(
            "eval-log/dev-graph/run-dev-graph-system-spec/live-trial/" in finding["task"]
            for finding in report["violations"]
        )
    assert report["checked_count"] >= 1
    assert all(entry["scenario_id"] for entry in report["checked"])
    selected = REPO / report["checked"][0]["task"]
    assert selected.is_file()
    assert selected.name == "task.md"


# --- 契約: fixture 実体との一致 (受入条件 1) ---------------------------------------


def test_contract_matches_real_fixture_build(tmp_path: Path) -> None:
    """--kind system-spec の実出力が placed_inputs / absent_artifacts と一致する。"""
    out = tmp_path / "fixture"
    proc = subprocess.run(
        [sys.executable, str(BUILDER), "--kind", SHAPE, "--out", str(out), "--force"],
        capture_output=True, text=True, check=False,
    )
    assert proc.returncode == 0, f"{proc.stdout}{proc.stderr}"
    contract = _contract()
    for relative in contract["placed_inputs"]:
        assert (out / relative).is_file(), f"placed_inputs の {relative} が生成されていない"
    for relative in contract["absent_artifacts"]:
        assert not (out / relative).exists(), f"absent_artifacts の {relative} が生成されている"
    # 業務入力は placed_inputs だけ (content root 配下に他の入力が混ざっていない)。
    # .gitkeep は scaffold が置くディレクトリ保持マーカーで、業務入力ではないので除く。
    content_files = sorted(
        path.relative_to(out).as_posix()
        for path in (out / "system-spec").rglob("*")
        if path.is_file() and path.name != ".gitkeep"
    )
    expected_system_spec = sorted(
        relative for relative in contract["placed_inputs"] if relative.startswith("system-spec/")
    )
    assert content_files == expected_system_spec


def test_shape_docstring_quotes_current_fixture_contract() -> None:
    """shape docstring の契約引用が scenario 正本と一致する。

    今回の drift は「正本の写しが手で複製され、正本だけが動いた」形。docstring も
    同じ性質の写しなので、引用が古くなった時点で落とす。lint は task.md しか見ないため
    ここは pytest 側で押さえる。
    """
    MODULE.load_shape_contracts(REPO)  # fixtures を sys.path へ載せる副作用を借りる
    package = importlib.import_module("live_trial_shapes")
    shape = importlib.import_module(f"live_trial_shapes.{package.SHAPE_MODULES[SHAPE]}")
    squeeze = lambda text: " ".join(text.split())  # noqa: E731 — 局所の空白正規化
    assert squeeze(_scenario()["fixture_contract"]) in squeeze(shape.__doc__ or "")


def test_contract_scenario_exists_in_source_of_truth() -> None:
    scenarios = MODULE.load_scenarios(REPO)
    contract = _contract()
    assert contract["scenario_id"] in scenarios
    assert scenarios[contract["scenario_id"]]["skill"] == "run-dev-graph-system-spec"


def test_observation_keywords_track_scenario_count() -> None:
    """観測条件の件数一致 (LT-010 の前提)。scenario 側が増えたら契約も動かす。"""
    contract = _contract()
    scenario = _scenario()
    assert len(contract["observation_keywords"]) == len(scenario["required_observations"])


def test_required_entry_points_match_harness_package_contract() -> None:
    """required_entry_points が system-spec-harness の宣言と一致する。

    fixture 側に写しを持つ形なので、harness が entry point を増減したときに
    task 前提だけ旧世代のまま残ることを防ぐ。
    """
    contract_path = (
        REPO / "plugins" / "system-spec-harness" / "references" / "package-contract.json"
    )
    declared = json.loads(contract_path.read_text(encoding="utf-8"))["entry_points"]["skills"]
    assert set(_contract()["required_entry_points"]) <= set(declared)


# --- 契約: 正本変更の伝播 (受入条件 5) --------------------------------------------


def test_digest_is_deterministic() -> None:
    contract, scenario = _contract(), _scenario()
    assert MODULE.contract_digest(contract, scenario) == MODULE.contract_digest(contract, scenario)


@pytest.mark.parametrize(
    "key,value",
    [
        ("scenario_id", "C19-OUT1-renamed"),
        ("task_args_template", "--repo-root <contained-fixture-repo>"),
        ("required_observations", ["only one observation"]),
        ("task_contract", {"required_fragments": ["new-boundary"], "forbidden_fragments": []}),
        ("resource_budget", {"max_wall_clock_s": 1, "max_total_tokens": 1}),
        ("forbidden_invoked_skills", []),
    ],
)
def test_digest_moves_when_scenario_moves(key: str, value: object) -> None:
    contract, scenario = _contract(), _scenario()
    baseline = MODULE.contract_digest(contract, scenario)
    moved = dict(scenario)
    moved[key] = value
    assert MODULE.contract_digest(contract, moved) != baseline


@pytest.mark.parametrize("key", ["placed_inputs", "absent_artifacts", "required_entry_points"])
def test_digest_moves_when_fixture_contract_moves(key: str) -> None:
    contract, scenario = _contract(), _scenario()
    baseline = MODULE.contract_digest(contract, scenario)
    moved = dict(contract)
    moved[key] = (
        ("system-spec/not-current.md",)
        if not contract[key]
        else tuple(contract[key])[:-1]
    )
    assert MODULE.contract_digest(moved, scenario) != baseline


def test_args_drift_accepts_placeholder_substitution() -> None:
    """placeholder は任意 1 トークンにマッチし、空白を含む path も壊れない。"""
    assert MODULE.args_drift("--repo-root <fixture>", "--repo-root '/a b/c'") is None
    assert MODULE.args_drift("--repo-root <fixture>", "--repo-root /a --resume") is not None
    assert MODULE.args_drift("--repo-root <fixture>", "--repo-root") is not None
