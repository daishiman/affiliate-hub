"""C19 R3 import adapter の決定論的な入力組立を検証する。"""
from __future__ import annotations

import hashlib
import json
import subprocess
import sys
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "build-system-spec-import.py"
CONTRACT = Path(__file__).resolve().parents[1] / "references" / "system-spec-import-contract.json"


def build_confirmed_system_spec(tmp_path: Path, verdict: str = "PASS") -> Path:
    root = tmp_path / "repo"
    spec = root / "system-spec"
    spec.mkdir(parents=True)
    (spec / "index.md").write_text(
        "---\nkind: index\n---\n\n# compiled specification\n\nIndex source fact.\n",
        encoding="utf-8",
    )
    (spec / "00-requirements-definition.md").write_text(
        "---\nstatus: confirmed\n---\n\n# confirmed requirements\n\nRequirements source fact.\n",
        encoding="utf-8",
    )
    (spec / "completeness-report.json").write_text(
        json.dumps({"verdict": verdict}), encoding="utf-8"
    )
    return root


def write_contract(root: Path, mutate) -> Path:
    contract = json.loads(CONTRACT.read_text(encoding="utf-8"))
    mutate(contract)
    path = root / "contract.json"
    path.write_text(json.dumps(contract), encoding="utf-8")
    return path


def run(
    root: Path, *, out_dir: str = ".dev-graph/tmp/import", contract: Path | None = None
) -> subprocess.CompletedProcess[str]:
    command = [sys.executable, str(SCRIPT), "--repo-root", str(root), "--out-dir", out_dir]
    if contract is not None:
        command.extend(["--contract", str(contract)])
    return subprocess.run(
        command,
        text=True,
        capture_output=True,
        check=False,
    )


def test_prepares_two_schema_shaped_c02_inputs_and_source_derived_bodies(tmp_path: Path) -> None:
    root = build_confirmed_system_spec(tmp_path)
    proc = run(root)
    assert proc.returncode == 0, proc.stdout + proc.stderr

    out = root / ".dev-graph" / "tmp" / "import"
    architecture = json.loads((out / "architecture.node.json").read_text(encoding="utf-8"))
    specification = json.loads((out / "specification.node.json").read_text(encoding="utf-8"))
    report_digest = hashlib.sha256(
        (root / "system-spec" / "completeness-report.json").read_bytes()
    ).hexdigest()

    assert architecture["graph_node_id"] == "arch-system-spec-overview"
    assert architecture["artifact_kind"] == "architecture"
    assert architecture["artifact_subtypes"] == ["backend", "data", "security"]
    assert architecture["source_lineage"]["source_path"] == "system-spec/00-requirements-definition.md"
    assert architecture["confirmation_evidence"]["evaluated_digest"] == report_digest
    assert specification["architecture_refs"] == ["arch-system-spec-overview"]
    assert specification["source_lineage"]["source_path"] == "system-spec/index.md"

    assert (out / "architecture.body.md").read_text(encoding="utf-8") == (
        "# confirmed requirements\n\nRequirements source fact.\n"
    )
    assert (out / "specification.body.md").read_text(encoding="utf-8") == (
        "# compiled specification\n\nIndex source fact.\n"
    )


def test_verbatim_source_body_is_import_data_not_duplicated_compile_logic() -> None:
    """C19 OUT1 の「ロジック複製 0」を source body 複写禁止と誤読させない。"""
    skill = (SCRIPT.parents[1] / "skills" / "run-dev-graph-system-spec" / "SKILL.md").read_text(
        encoding="utf-8"
    )

    assert "source body の verbatim import (素材の取込み)" in skill
    assert "elicitation/compile の処理ロジック" in skill
    assert "後者だけが OUT1 の禁止対象" in skill


def test_source_content_change_changes_only_its_matching_import_body(tmp_path: Path) -> None:
    root = build_confirmed_system_spec(tmp_path)
    (root / "system-spec" / "index.md").write_text(
        "# updated index\n\nActual caller-repository content.\n", encoding="utf-8"
    )
    proc = run(root)
    assert proc.returncode == 0, proc.stdout + proc.stderr

    out = root / ".dev-graph" / "tmp" / "import"
    assert "Actual caller-repository content." in (out / "specification.body.md").read_text(encoding="utf-8")
    assert "Actual caller-repository content." not in (out / "architecture.body.md").read_text(encoding="utf-8")


def test_refuses_unconfirmed_evaluator_output(tmp_path: Path) -> None:
    root = build_confirmed_system_spec(tmp_path, verdict="FAIL")
    proc = run(root)
    assert proc.returncode != 0
    assert "verdict must be PASS" in proc.stderr


def test_refuses_contract_artifact_path_that_escapes_repo_root(tmp_path: Path) -> None:
    root = build_confirmed_system_spec(tmp_path)
    contract = write_contract(root, lambda value: value["artifacts"].update({"index": "../escape.md"}))
    proc = run(root, contract=contract)

    assert proc.returncode != 0
    assert "artifact path escapes repo root" in proc.stderr


def test_refuses_out_dir_that_escapes_repo_root(tmp_path: Path) -> None:
    root = build_confirmed_system_spec(tmp_path)
    proc = run(root, out_dir="../escape")

    assert proc.returncode != 0
    assert "--out-dir must be contained" in proc.stderr


def test_refuses_contract_with_static_product_body(tmp_path: Path) -> None:
    root = build_confirmed_system_spec(tmp_path)
    contract = write_contract(root, lambda value: value.update({"bodies": {"specification": "static prose"}}))
    proc = run(root, contract=contract)

    assert proc.returncode != 0
    assert "must not contain bodies" in proc.stderr
