"""Source-checkout / downstream-install 共通の plugin contract 読み取り。

``plugin-plans`` は開発元だけが持つ parity peer であり、配布 plugin の実行時正本では
ない。存在しない downstream layout は受理する一方、存在する source inventory の
破損や built artifact との drift は fail-closed にする。
"""
from __future__ import annotations

import json
from pathlib import Path

import yaml


SOURCE_INVENTORY_RELATIVE = Path(
    "plugin-plans/dev-graph/component-inventory.json"
)


def repository_root(plugin_root: Path) -> Path:
    """source checkout / downstream install から実 repository root を解決する。

    開発元では ``<repo>/plugins/dev-graph``、配布先では
    ``<repo>/.claude/plugins/dev-graph`` に置かれる。単なる ``parents[N]`` は後者で
    ``.claude`` を repository と誤認するため、受理する layout を明示して解決する。
    """

    plugin = plugin_root.resolve(strict=True)
    package_root = plugin.parents[1]
    if package_root.name == ".claude":
        root = package_root.parent
        expected = root / ".claude" / "plugins" / "dev-graph"
    else:
        root = package_root
        expected = root / "plugins" / "dev-graph"
    assert expected.is_dir() and plugin == expected.resolve(strict=True), (
        f"unsupported dev-graph plugin layout: {plugin} (expected {expected})"
    )
    return root.resolve(strict=True)


def source_inventory_path(plugin_root: Path) -> Path:
    """``plugins/dev-graph`` と同じ package root にある source inventory 候補。"""

    return plugin_root.parents[1] / SOURCE_INVENTORY_RELATIVE


def optional_source_inventory(plugin_root: Path) -> dict | None:
    """source inventory が同居するときだけ検証済み payload を返す。

    単純な不在だけが downstream layout として正当である。broken symlink、非 file、
    malformed JSON、components shape 不正は source checkout の破損なので例外にする。
    """

    package_root = plugin_root.resolve(strict=True).parents[1]
    if package_root.name == ".claude":
        # 配布先の ``.claude/plugin-plans`` は caller 所有であり、開発元 inventory の
        # authority ではない。偶然同名 file があっても built plugin parity に混ぜない。
        return None

    path = source_inventory_path(plugin_root)
    if not path.exists():
        assert not path.is_symlink(), f"source inventory is a broken symlink: {path}"
        raise AssertionError(f"source layout is missing dev-graph inventory: {path}")
    assert path.is_file(), f"source inventory must be a file: {path}"
    payload = json.loads(path.read_text(encoding="utf-8"))
    assert isinstance(payload, dict), "source inventory must be a JSON object"
    components = payload.get("components")
    assert isinstance(components, list), "source inventory.components must be a list"
    ids: list[str] = []
    for component in components:
        assert isinstance(component, dict), "source inventory component must be an object"
        component_id = component.get("id")
        assert isinstance(component_id, str) and component_id, (
            "source inventory component.id must be a non-empty string"
        )
        ids.append(component_id)
    assert len(ids) == len(set(ids)), "source inventory component ids must be unique"
    return payload


def skill_frontmatter(skill_path: Path) -> dict:
    """Built SKILL.md の YAML frontmatter を strict に読む。"""

    text = skill_path.read_text(encoding="utf-8")
    assert text.startswith("---\n"), f"missing frontmatter: {skill_path}"
    parts = text.split("\n---\n", 1)
    assert len(parts) == 2, f"unterminated frontmatter: {skill_path}"
    payload = yaml.safe_load(parts[0][4:])
    assert isinstance(payload, dict), f"frontmatter must be a mapping: {skill_path}"
    return payload


def built_component_contracts(plugin_root: Path) -> list[dict]:
    """配布 plugin 内の EVALS + SKILL を downstream の自己完結した正本として読む。"""

    evals_path = plugin_root / "EVALS.json"
    evals = json.loads(evals_path.read_text(encoding="utf-8"))
    components = evals.get("criteria_tests", {}).get("components")
    assert isinstance(components, dict) and components, (
        "EVALS.criteria_tests.components must be a non-empty object"
    )
    root = plugin_root.resolve(strict=True)
    result: list[dict] = []
    for component_id, evaluation in sorted(components.items()):
        assert isinstance(component_id, str) and component_id, "component id must be non-empty"
        assert isinstance(evaluation, dict), f"{component_id}: EVALS contract must be an object"
        skill_relative = evaluation.get("skill")
        criteria = evaluation.get("criteria")
        assert isinstance(skill_relative, str) and skill_relative, (
            f"{component_id}: skill path must be non-empty"
        )
        assert isinstance(criteria, dict) and criteria, (
            f"{component_id}: criteria mapping must be non-empty"
        )
        skill_path = (plugin_root / skill_relative).resolve(strict=True)
        skill_path.relative_to(root)
        frontmatter = skill_frontmatter(skill_path)
        assert frontmatter.get("source") == (
            f"plugin-plans/dev-graph/component-inventory.json#{component_id}"
        ), f"{component_id}: built skill source pin drift"
        result.append({
            "id": component_id,
            "name": skill_path.parent.name,
            "skill_path": skill_path,
            "frontmatter": frontmatter,
            "evaluation": evaluation,
        })
    return result
