from __future__ import annotations

import hashlib
import importlib.util
import json
import re
from pathlib import Path

import jsonschema
import pytest
import yaml


PLUGIN = Path(__file__).resolve().parents[1]
REPO = PLUGIN.parents[1]
INVENTORY = REPO / "plugin-plans" / "dev-graph" / "component-inventory.json"
EVALS = PLUGIN / "EVALS.json"
LINT = REPO / "scripts" / "lint-content-review.py"
CRITERIA_SCHEMA = PLUGIN / "schemas" / "criteria-scenario-verdict.schema.json"
LIVE_TRIAL_ROOT = (
    REPO / "plugins" / "harness-creator" / "skills" / "run-skill-live-trial"
)
LIVE_TRIAL_SCHEMA = LIVE_TRIAL_ROOT / "schemas" / "live-trial-verdict.schema.json"
LIVE_TRIAL_VERDICT = LIVE_TRIAL_ROOT / "scripts" / "live-trial-verdict.py"
POSITIVE_SCENARIOS = PLUGIN / "tests" / "fixtures" / "live-trial-positive-scenarios.json"


def _load_content_lint():
    spec = importlib.util.spec_from_file_location("dev_graph_content_review_lint", LINT)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _load_live_trial_verdict():
    spec = importlib.util.spec_from_file_location(
        "dev_graph_live_trial_verdict", LIVE_TRIAL_VERDICT
    )
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _skill_criteria(skill_path: Path) -> dict[str, dict]:
    text = skill_path.read_text(encoding="utf-8")
    assert text.startswith("---\n")
    _opening, frontmatter, _body = text.split("---", 2)
    metadata = yaml.safe_load(frontmatter)
    criteria = metadata["feedback_contract"]["criteria"]
    return {criterion["id"]: criterion for criterion in criteria}


def _positive_scenario_by_skill() -> dict[str, dict]:
    suite = json.loads(POSITIVE_SCENARIOS.read_text(encoding="utf-8"))
    return {scenario["skill"]: scenario for scenario in suite["scenarios"]}


def _contained_repo_ref(value: str) -> Path:
    ref = Path(value)
    assert not ref.is_absolute(), f"evidence ref must be repo-relative: {value}"
    path = (REPO / ref).resolve(strict=True)
    path.relative_to(REPO.resolve())
    return path


def _contained_run_evidence(verdict_path: Path, value: str) -> Path:
    """fragment を除いた evidence_ref が verdict の run 内で実在することを検査する。"""
    relative = Path(value.partition("#")[0])
    assert not relative.is_absolute(), f"run evidence ref must be relative: {value}"
    path = (verdict_path.parent / relative).resolve(strict=True)
    path.relative_to(verdict_path.parent.resolve())
    assert path.is_file(), f"run evidence ref must be a file: {value}"
    return path


def _targets() -> list[tuple[str, str, Path, set[str]]]:
    inventory = json.loads(INVENTORY.read_text(encoding="utf-8"))
    by_id = {item["id"]: item for item in inventory["components"]}
    evals = json.loads(EVALS.read_text(encoding="utf-8"))["criteria_tests"]["components"]
    return [
        (
            component_id,
            Path(contract["skill"]).parent.name,
            PLUGIN / contract["skill"],
            {item["id"] for item in by_id[component_id]["feedback_contract"]["criteria"]},
        )
        for component_id, contract in sorted(evals.items())
    ]


def _assert_scenario_contract(
    *,
    verdict: dict,
    verdict_path: Path,
    current_scenario: dict,
    component_id: str,
    criterion_id: str,
) -> None:
    """criteria acceptance が live-trial の scenario 契約を再照合する。"""
    contract = verdict["scenario_contract"]
    assert contract["scenario_id"] == verdict["scenario_id"]
    assert _contained_repo_ref(contract["scenario_file"]) == POSITIVE_SCENARIOS.resolve()
    assert contract["unobserved"] == [], (
        f"{component_id}/{criterion_id}: unobserved required_observations remain"
    )
    required = current_scenario["required_observations"]
    assert contract["required_observations"] == required
    expected_observed = [
        (index, observation) for index, observation in enumerate(required, start=1)
    ]
    actual_observed = [
        (item["index"], item["observation"]) for item in contract["observed"]
    ]
    assert actual_observed == expected_observed, (
        f"{component_id}/{criterion_id}: observed required_observations are incomplete"
    )
    assert contract["args_divergence"]["matches"] is True
    if current_scenario.get("task_contract") is not None:
        assert contract["task_contract"]["declared"] is True
        assert contract["task_contract"]["task_file_exists"] is True
        assert contract["task_contract"]["matches"] is True
    for observation in contract["observed"]:
        _contained_run_evidence(verdict_path, observation["evidence_ref"])


# Fix 済みの既知 live-trial failure は残さない。strict xfail を残すと fresh PASS が
# XPASS になり、回帰修正そのものを CI failure として扱ってしまう。
_KNOWN_LIVE_TRIAL_FAILURES: dict[str, str] = {}


def _targets_with_known_xfail() -> list:
    params = []
    for target in _targets():
        component_id = target[0]
        reason = _KNOWN_LIVE_TRIAL_FAILURES.get(component_id)
        marks = [pytest.mark.xfail(reason=reason, strict=True)] if reason else []
        params.append(pytest.param(*target, id=component_id, marks=marks))
    return params


@pytest.mark.parametrize(
    ("component_id", "skill_name", "skill_path", "criteria_ids"),
    _targets_with_known_xfail(),
)
def test_independent_scenario_receipt_covers_exact_criteria(
    component_id: str,
    skill_name: str,
    skill_path: Path,
    criteria_ids: set[str],
) -> None:
    receipt_path = (
        REPO / "eval-log" / "dev-graph" / skill_name / "criteria-test" / "scenario-verdict.json"
    )
    receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
    receipt_schema = json.loads(CRITERIA_SCHEMA.read_text(encoding="utf-8"))
    jsonschema.Draft202012Validator(receipt_schema).validate(receipt)
    current_sha = hashlib.sha256(skill_path.read_bytes()).hexdigest()
    assert receipt["target"] == {
        "plugin": "dev-graph",
        "skill": skill_name,
        "component_id": component_id,
        "skill_md_sha256": current_sha,
    }
    assert receipt["verdict"] == "PASS"
    assert receipt["reviewer"].strip()
    assert receipt["reviewer"] != "root"
    assert receipt["loop_scope"] == "both"
    assert receipt["iteration_limit"] == 3
    results = receipt["criteria_results"]
    assert set(results) == criteria_ids
    criteria = _skill_criteria(skill_path)
    assert set(criteria) == criteria_ids
    live_verdict_module = _load_live_trial_verdict()
    live_schema = json.loads(LIVE_TRIAL_SCHEMA.read_text(encoding="utf-8"))
    positive_scenarios = _positive_scenario_by_skill()
    for criterion_id, result in results.items():
        assert result["status"] == "PASS", f"{component_id}/{criterion_id}"
        expected_verify_by = criteria[criterion_id]["verify_by"]
        assert result["verify_by"] == expected_verify_by, (
            f"{component_id}/{criterion_id}: receipt verify_by must equal SKILL frontmatter"
        )
        assert result["evidence_kind"] in {
            "pytest", "independent-scenario-review", "hybrid", "live-trial"
        }
        assert result["test_refs"]
        assert result["observed"]
        if expected_verify_by != "live-trial":
            continue

        assert result["evidence_kind"] == "live-trial"
        verdict_ref = result["live_trial_verdict_ref"]
        assert verdict_ref in result["test_refs"]
        verdict_path = _contained_repo_ref(verdict_ref)
        expected_live_root = (
            REPO / "eval-log" / "dev-graph" / skill_name / "live-trial"
        ).resolve()
        verdict_path.relative_to(expected_live_root)
        assert verdict_path.name == "verdict.json"
        verdict = json.loads(verdict_path.read_text(encoding="utf-8"))
        jsonschema.Draft202012Validator(live_schema).validate(verdict)
        assert verdict["scenario_id"] == result["scenario_id"]
        # 受領書が束ねる scenario は fixture の現行版でなければならない。scenario を改訂した
        # まま受領書を据え置くと、改訂前の緩い契約で取った緑が現行契約の充足として通る。
        # 実際に C14 は r5 改訂後も改訂前 id の verdict を指したままだった。
        current_scenario = positive_scenarios.get(skill_name)
        assert current_scenario is not None, (
            f"{component_id}/{criterion_id}: no canonical positive scenario for {skill_name}"
        )
        assert result["scenario_id"] == current_scenario["scenario_id"], (
            f"{component_id}/{criterion_id}: receipt cites a stale scenario "
            f"({result['scenario_id']}) while the fixture declares "
            f"{current_scenario['scenario_id']}"
        )
        # verify_by=live-trial の verdict は scenario id の一致だけで PASS にしない。
        # required_observations の全回収と task_args_template の一致を必須にする。
        _assert_scenario_contract(
            verdict=verdict,
            verdict_path=verdict_path,
            current_scenario=current_scenario,
            component_id=component_id,
            criterion_id=criterion_id,
        )
        assert verdict["target_skill"] == f"dev-graph:{skill_name}"
        assert verdict["tier"] == "live"
        assert verdict["downgrade_reason"] is None
        assert verdict["actual_model"]
        assert verdict["transcript_sha256"] is not None
        assert verdict["environment"]["transcript_layer"] == "jsonl"
        assert verdict["goal_verdict"] == {"result": "PASS", "blockers": []}
        assert verdict["overall"] == {
            "launch": "PASS",
            "completion": "PASS",
            "goal_fit": "PASS",
            "verdict": "PASS",
        }
        assert verdict["skill_dir_tree_sha"] == live_verdict_module.skill_dir_tree_sha(
            skill_path.parent
        ), f"{component_id}/{criterion_id}: stale behavior closure digest"


def test_live_trial_acceptance_rejects_missing_or_incomplete_scenario_contract() -> None:
    """旧形式の field 欠落と、observed の自己申告欠落を負例で固定する。"""
    receipt_path = (
        REPO
        / "eval-log/dev-graph/run-dev-graph-schedule/criteria-test/scenario-verdict.json"
    )
    receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
    verdict_path = _contained_repo_ref(
        receipt["criteria_results"]["OUT1"]["live_trial_verdict_ref"]
    )
    verdict = json.loads(verdict_path.read_text(encoding="utf-8"))
    scenario = _positive_scenario_by_skill()["run-dev-graph-schedule"]

    missing_contract = json.loads(json.dumps(verdict))
    missing_contract.pop("scenario_contract")
    with pytest.raises(KeyError, match="scenario_contract"):
        _assert_scenario_contract(
            verdict=missing_contract,
            verdict_path=verdict_path,
            current_scenario=scenario,
            component_id="C15",
            criterion_id="OUT1",
        )

    incomplete_observed = json.loads(json.dumps(verdict))
    incomplete_observed["scenario_contract"]["observed"].pop()
    with pytest.raises(AssertionError, match="observed required_observations are incomplete"):
        _assert_scenario_contract(
            verdict=incomplete_observed,
            verdict_path=verdict_path,
            current_scenario=scenario,
            component_id="C15",
            criterion_id="OUT1",
        )


def test_positive_live_trial_scenarios_cover_out1_without_eval_log_fixture_coupling() -> None:
    suite = json.loads(POSITIVE_SCENARIOS.read_text(encoding="utf-8"))
    scenarios = suite["scenarios"]
    assert suite["schema_version"] == "1.0.0"
    # C01/C15 は 2026-07-21 追加。r13 で「拒否対象が1件も無い空っぽの検証」で OUT1 が
    # 成立していたため、fixture_contract を強化して衝突・blocked・lease を実際に行使させる。
    # C05/C14/C18 は 2026-07-22 追加。9 skill 全ての live-trial 再取得時に、OUT1 が
    # live-trial verify_by なのに scenario 契約を持たない 3 skill を発見したため補完した
    # (C05 は render の進捗 X/Y、C14 は decompose の dry-run マクロ分解、C18 は status の
    # read-only 一致)。
    assert {(item["component_id"], item["criterion_id"]) for item in scenarios} == {
        ("C01", "OUT1"),
        ("C02", "OUT1"),
        ("C03", "OUT1"),
        ("C04", "OUT1"),
        ("C05", "OUT1"),
        ("C14", "OUT1"),
        ("C15", "OUT1"),
        ("C18", "OUT1"),
        ("C19", "OUT1"),
    }
    assert len({item["scenario_id"] for item in scenarios}) == len(scenarios)
    inventory_targets = {
        component_id: (skill_name, skill_path)
        for component_id, skill_name, skill_path, _criteria_ids in _targets()
    }
    for scenario in scenarios:
        assert scenario["mode"] == "positive"
        args = scenario["task_args_template"]
        assert args.strip()
        # dry-run 単独で positive を成立させる vacuous 検証を防ぐ。ただし
        # (a) --apply を併せ持つ多段実行 (C03 sync の dry-run→apply→確認 dry-run で
        #     2 回目 changes=0 を観測) と、(b) dry-run preview 自体が成果物の skill
        #     (C14 decompose: 評価前 draft の起票 0 件を観測する) は、副作用ではなく
        #     「副作用が起きないこと」を観測するのが scenario の本質なので許容する。
        if "--dry-run" in args:
            assert "--apply" in args or scenario["component_id"] == "C14", (
                f"{scenario['component_id']}: dry-run 単独の positive scenario は "
                "vacuous 検証になりうる (apply 併存か dry-run preview が本質の skill に限る)"
            )
        assert len(scenario["required_observations"]) >= 3
        assert all(item.strip() for item in scenario["required_observations"])
        skill_name, skill_path = inventory_targets[scenario["component_id"]]
        assert scenario["skill"] == skill_name
        criterion = _skill_criteria(skill_path)[scenario["criterion_id"]]
        assert criterion["loop_scope"] == "outer"
        assert criterion["verify_by"] == "live-trial"


@pytest.mark.parametrize(
    ("component_id", "skill_name", "skill_path", "criteria_ids"),
    _targets(),
    ids=lambda value: value if isinstance(value, str) else None,
)
def test_canonical_content_reviews_are_current_and_complete(
    component_id: str,
    skill_name: str,
    skill_path: Path,
    criteria_ids: set[str],
) -> None:
    lint = _load_content_lint()
    review_dir = REPO / "eval-log" / "dev-graph" / skill_name / "content-review"
    for filename in ("elegance-verdict.json", "rubric-verdict.json"):
        error = lint._check_verdict(
            review_dir / filename,
            "dev-graph",
            skill_name,
            filename,
        )
        assert error is None, f"{component_id}/{filename}: {error}"
        verdict = json.loads((review_dir / filename).read_text(encoding="utf-8"))
        loop = verdict["feedback_loop"]
        assert set(loop["criteria_evaluated"]) == criteria_ids
        assert loop["loop_scope"] == "both"
        assert loop["iteration_limit"] == 3
        assert loop["next_action"] == "none"


def test_positive_scenarios_are_not_vacuous_by_contract() -> None:
    """positive シナリオが「拒否対象0件」で自明成立しない fixture 契約を持つ。

    2026-07-21 live-trial r13 で、C15 は ready 3件 < --max-parallel 4 かつ resource_scope が
    入力側で完全排他だったため conflict/lease 判定が一度も行使されず、C01 は空グラフで
    C11 が vacuous に成立していた。「除外されるべき対象が実在すること」を fixture 契約へ要求する。
    """
    suite = json.loads(POSITIVE_SCENARIOS.read_text(encoding="utf-8"))
    exclusion_markers = (
        "blocked", "overlap", "conflict", "stale", "reject", "fail-closed",
        "exceeds", "differ", "outside", "not ", "no ", "never", "zero",
        "=0", "unchanged",
    )
    for scenario in suite["scenarios"]:
        observations = " ".join(scenario["required_observations"]).lower()
        assert any(marker in observations for marker in exclusion_markers), (
            f"{scenario['scenario_id']}: required_observations must assert on a case that is "
            "excluded, rejected or converges to zero; otherwise the criterion can hold vacuously"
        )


def test_declared_thresholds_are_resolvable():
    """observation が参照する閾値が実際に数値として宣言されていることを要求する。

    2026-07-25 live-trial 再取得で、C14 の observation 1 が「declared granularity
    threshold」を参照しているのに、その閾値が scenario にも SKILL.md にも数値として
    存在しないことが判明した。上の exclusion_markers 検査は observation の「文言」に
    zero/no が含まれるかしか見ないため、参照先が存在しない観測を通してしまう。
    評価者は検証不能な観測を代替検査で読み替えるか、空虚に成立させるしかなくなる。
    """
    suite = json.loads(POSITIVE_SCENARIOS.read_text(encoding="utf-8"))
    for scenario in suite["scenarios"]:
        for observation in scenario["required_observations"]:
            for field in sorted(set(re.findall(r"\b([a-z_]+_threshold)\.", observation))):
                declared = scenario.get(field)
                assert isinstance(declared, dict), (
                    f"{scenario['scenario_id']}: observation references {field} but the "
                    f"scenario declares no such object"
                )
                for key in ("metric", "max_value"):
                    assert declared.get(key) is not None, (
                        f"{scenario['scenario_id']}: {field}.{key} is unset, so the "
                        f"observation referencing it cannot be verified"
                    )
