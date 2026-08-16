"""C14 live-trial の証跡束縛・反証可能性を分離検証する。"""
from __future__ import annotations

import copy
import importlib.util
import json
import subprocess
import sys
from pathlib import Path


HERE = Path(__file__).resolve().parent
SOURCE = HERE / "test_decompose_live_trial_audit.py"
SPEC = importlib.util.spec_from_file_location("decompose_integrity_test_support", SOURCE)
assert SPEC and SPEC.loader
SUPPORT = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(SUPPORT)

AUDIT = SUPPORT.AUDIT
INTEGRITY = AUDIT.INTEGRITY
PATCH_BUILDER = HERE / "fixtures" / "build_decompose_promotion_patch.py"


def _features() -> list[dict]:
    return [
        node
        for node in SUPPORT._preview()["nodes"]
        if node["artifact_kind"] == "feature"
    ]


def test_promoted_evidence_is_bound_to_final_node_content() -> None:
    result = INTEGRITY.evidence_binding(_features())
    assert result["all_bound"] is True
    promoted = next(check for check in result["checks"] if check["promoted"])
    assert promoted["digest_matches"] is True
    assert promoted["evidence_fields_present"] is True


def test_placeholder_and_stale_digests_are_rejected() -> None:
    placeholder = _features()
    placeholder[1]["confirmation_evidence"]["evaluated_digest"] = "a" * 64
    assert INTEGRITY.evidence_binding(placeholder)["all_bound"] is False

    stale = _features()
    stale[1]["purpose"] = "changed after evaluation"
    assert INTEGRITY.evidence_binding(stale)["all_bound"] is False


def test_draft_may_omit_digest_but_may_not_forge_one() -> None:
    draft = _features()[0]
    assert INTEGRITY.evidence_binding([draft])["all_bound"] is True
    draft["confirmation_evidence"]["evaluated_digest"] = "b" * 64
    assert INTEGRITY.evidence_binding([draft])["all_bound"] is False


def test_digest_recipe_excludes_only_self_reference() -> None:
    promoted = _features()[1]
    baseline = INTEGRITY.evaluation_digest(promoted)
    changed_evidence = copy.deepcopy(promoted)
    changed_evidence["confirmation_evidence"]["evaluator"] = "another evaluator"
    assert INTEGRITY.evaluation_digest(changed_evidence) == baseline
    changed_content = copy.deepcopy(promoted)
    changed_content["title"] = "different title"
    assert INTEGRITY.evaluation_digest(changed_content) != baseline
    assert INTEGRITY.EVALUATED_DIGEST_EXCLUDED == ("confirmation_evidence",)


def test_promotion_patch_binds_digest_to_final_node(tmp_path: Path) -> None:
    root = tmp_path / "repo"
    (root / ".dev-graph" / "state").mkdir(parents=True)
    (root / ".dev-graph" / "config.json").write_text(
        json.dumps({"local_state": {"graph": ".dev-graph/state/graph.json"}}),
        encoding="utf-8",
    )
    node = _features()[0]
    graph_path = root / ".dev-graph" / "state" / "graph.json"
    graph_path.write_text(json.dumps({"nodes": [node]}), encoding="utf-8")
    output = root / "eval-log" / "promotion.json"
    built = subprocess.run(
        [
            sys.executable,
            str(PATCH_BUILDER),
            "build",
            "--repo-root",
            str(root),
            "--node-id",
            node["graph_node_id"],
            "--output",
            str(output),
            "--checked-at",
            "2026-08-02T06:30:00Z",
            "--evaluator",
            "test",
            "--evidence-ref",
            "eval-log/preview.json",
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    assert built.returncode == 0, built.stdout + built.stderr
    request = json.loads(output.read_text(encoding="utf-8"))
    promoted = {**node, **request["patch"]}
    assert request["patch"]["confirmation_evidence"]["evaluated_digest"] == (
        INTEGRITY.evaluation_digest(promoted)
    )

    graph_path.write_text(json.dumps({"nodes": [promoted]}), encoding="utf-8")
    verified = subprocess.run(
        [
            sys.executable,
            str(PATCH_BUILDER),
            "verify",
            "--repo-root",
            str(root),
            "--node-id",
            node["graph_node_id"],
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    assert verified.returncode == 0, verified.stdout + verified.stderr
    assert json.loads(verified.stdout)["matches"] is True


def test_mirror_array_diverging_from_nodes_is_rejected() -> None:
    preview = SUPPORT._preview()
    preview["features"] = copy.deepcopy(_features())
    preview["features"][0]["evaluation_status"] = "pass"
    result = INTEGRITY.preview_consistency(preview, _features())
    assert result["consistent"] is False
    assert result["divergent"][0]["reason"] == "gate_status_diverges_from_nodes"


def test_in_run_negative_controls_are_rejected(tmp_path: Path) -> None:
    result = AUDIT.audit(**SUPPORT._trial(tmp_path))
    assert result["gate_negative_controls"]["executed"] is True
    assert result["gate_negative_controls"]["all_rejected"] is True
    assert {
        control["control"]
        for control in result["gate_negative_controls"]["controls"]
    } == {"readiness_clause", "publication_intent_on_blocked_node"}


def test_helper_identity_covers_integrity_and_scenario_contract() -> None:
    covered = {
        module["path"] for module in AUDIT._helper_identity()["modules"]
    }
    assert covered == {
        path.relative_to(SUPPORT.REPO_ROOT).as_posix()
        for path in AUDIT.AUDIT_MODULES
    }
    assert any(path.endswith("audit_decompose_integrity.py") for path in covered)
    assert any(path.endswith("live-trial-positive-scenarios.json") for path in covered)
