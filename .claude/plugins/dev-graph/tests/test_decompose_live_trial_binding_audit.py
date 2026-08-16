"""C14 live-trial 監査の binding 観測と provenance を分離検証する。"""
from __future__ import annotations

import importlib.util
from pathlib import Path

HERE = Path(__file__).resolve().parent
SOURCE = HERE / "test_decompose_live_trial_audit.py"
SPEC = importlib.util.spec_from_file_location("decompose_audit_test_support", SOURCE)
assert SPEC and SPEC.loader
SUPPORT = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(SUPPORT)

AUDIT = SUPPORT.AUDIT


def test_binding_projections_differ_and_disclose_why_zero(tmp_path: Path) -> None:
    result = AUDIT.audit(**SUPPORT._trial(tmp_path))
    projections = result["binding_projections"]
    assert projections["none"]["routes"] == []
    assert projections["beads"]["routes"] == ["beads_issue"]
    assert projections["github"]["routes"] == ["github_issue", "github_project_item"]
    assert {
        binding: projection["candidate_route_invocations"]
        for binding, projection in projections.items()
    } == {"none": 0, "beads": 1, "github": 2}
    invoked = {
        binding: sorted(
            Path(entry["receipt"]["argv"][1]).name
            for entry in projection["candidate_route_receipts"]
        )
        for binding, projection in projections.items()
    }
    assert invoked == {
        "none": [],
        "beads": ["bd-bridge.py"],
        "github": ["gh-bridge.py", "gh-bridge.py"],
    }
    assert result["binding_observations_distinct"] is True
    assert result["persisted_bindings"] == {
        "none": sorted(
            [SUPPORT.ARCHITECTURE_ID, SUPPORT.DRAFT_ID, SUPPORT.PROMOTED_ID]
        )
    }
    assert projections["none"]["zero_attribution"] == "binding-route-absent"
    assert projections["beads"]["zero_attribution"] == "not-exercised-by-run"
    assert projections["github"]["zero_attribution"] == "binding-route-unreachable"


def test_candidate_and_draft_zero_attribution_are_not_conflated(tmp_path: Path) -> None:
    trial = SUPPORT._trial(
        tmp_path,
        graph_nodes=SUPPORT._rebind(SUPPORT._preview()["nodes"], "beads"),
    )
    trial["run_binding"] = "beads"
    projection = AUDIT.audit(**trial)["binding_projections"]["beads"]
    assert projection["zero_attribution"] == "draft-gate"
    assert projection["draft_zero_attribution"] == "draft-gate"
    assert projection["candidate_zero_attribution"] == "external-adapter-dry-run"


def test_binding_reachability_is_decided_by_implementation_schema(tmp_path: Path) -> None:
    projections = AUDIT.audit(**SUPPORT._trial(tmp_path))["binding_projections"]
    assert projections["beads"]["route_declarable"] is True
    assert projections["github"]["route_declarable"] is False
    rules = {
        rule
        for probe in projections["github"]["declaration_probes"]
        for rule in probe["blocking_rules"]
    }
    assert rules
    assert all("github_publication.mode" in rule for rule in rules)


def test_binding_reachability_follows_mutated_implementation(tmp_path: Path) -> None:
    trial = SUPPORT._trial(tmp_path)
    trial["plugin_root"] = SUPPORT._plugin_with_gate_removed(tmp_path)
    projection = AUDIT.audit(**trial)["binding_projections"]["github"]
    assert projection["route_declarable"] is True
    assert projection["zero_attribution"] == "not-exercised-by-run"


def test_unpersisted_binding_cannot_be_claimed_by_argument(tmp_path: Path) -> None:
    trial = SUPPORT._trial(tmp_path)
    trial["run_binding"] = "github"
    result = AUDIT.audit(**trial)
    assert result["run_binding_attested"] is False
    assert result["binding_projections"]["github"]["exercised_by_run"] is False
    assert result["binding_projections"]["none"]["exercised_by_run"] is True
    assert result["pass"] is False


def test_helper_identity_is_bound_to_git_index() -> None:
    identity = AUDIT._helper_identity()
    assert identity["path"].endswith("audit_decompose_live_trial.py")
    assert identity["tracked_in_index"] is True
    assert identity["index_matches_worktree"] is True
    assert len(identity["sha256"]) == 64


def test_helper_identity_covers_every_audit_module() -> None:
    identity = AUDIT._helper_identity()
    covered = {module["path"] for module in identity["modules"]}
    assert covered == {
        path.relative_to(SUPPORT.REPO_ROOT).as_posix() for path in AUDIT.AUDIT_MODULES
    }
    assert all(module["index_matches_worktree"] for module in identity["modules"])
    single = AUDIT.STATE.composite_identity([SUPPORT.SCRIPT])
    assert single["sha256"] != identity["sha256"]


def test_adapter_suppression_requires_real_dry_run_receipt_shape() -> None:
    beads = {
        "payload": {
            "op": "create",
            "dry_run_preview": {"graph_node_id": SUPPORT.DRAFT_ID},
        }
    }
    github = {
        "payload": {
            "op": "issue-create",
            "dry_run": True,
            "mutation_suppressed": True,
        }
    }
    incomplete = {"payload": {"op": "issue-create", "dry_run": True}}
    assert AUDIT._suppression_from(beads) is True
    assert AUDIT._suppression_from(github) is True
    assert AUDIT._suppression_from(incomplete) is False
