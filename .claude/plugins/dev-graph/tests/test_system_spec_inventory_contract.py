import importlib.util
import json
from pathlib import Path


DEV_GRAPH = Path(__file__).resolve().parents[1]
HARNESS = DEV_GRAPH.parent / "system-spec-harness"
CONTRACT = DEV_GRAPH / "references" / "system-spec-import-contract.json"


def test_inventory_api_is_versioned_and_provider_owned():
    contract = json.loads(CONTRACT.read_text(encoding="utf-8"))
    api = contract["provider_api"]
    assert api == {
        "path": "lib/spec_input_inventory.py",
        "version": "1.0.0",
        "symbols": ["build_inventory"],
    }

    module_path = HARNESS / api["path"]
    spec = importlib.util.spec_from_file_location("system_spec_inventory_api", module_path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    assert module.API_VERSION == api["version"]
    assert callable(module.build_inventory)


def test_resume_validator_does_not_import_evaluator_internals():
    source = (DEV_GRAPH / "scripts" / "validate-system-spec-resume.py").read_text(
        encoding="utf-8"
    )
    assert "assign-system-spec-completeness-evaluator\" / \"scripts" not in source
    assert "from spec_input_inventory import" not in source
