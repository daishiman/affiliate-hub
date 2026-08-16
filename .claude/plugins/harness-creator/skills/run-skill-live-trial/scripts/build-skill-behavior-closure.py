"""live-trial verdict が束縛する skill 挙動閉包を解決する support module。

entry point ではない。``live-trial-verdict.py`` から読み込まれ、宣言された挙動依存を
repository 内へ閉じ込めたうえで、決定論的な複合 SHA-256 を計算する。
"""
from __future__ import annotations

import csv
import hashlib
import json
import re
from pathlib import Path


_BEHAVIOR_REF_KEYS = (
    "script_refs",
    "reference_refs",
    "responsibility_refs",
    "schema_refs",
)


def _frontmatter(text: str) -> str:
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        return ""
    for index, line in enumerate(lines[1:], start=1):
        if line.strip() == "---":
            return "\n".join(lines[1:index])
    raise ValueError("SKILL.md frontmatter is not terminated")


def _clean_yaml_scalar(value: str) -> str:
    value = value.split(" #", 1)[0].strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
        value = value[1:-1]
    return value.strip()


def _frontmatter_refs(skill_md: Path) -> list[str]:
    """Extract path-like *_refs without adding a PyYAML runtime dependency."""
    lines = _frontmatter(skill_md.read_text(encoding="utf-8")).splitlines()
    refs: list[str] = []
    for index, line in enumerate(lines):
        match = re.match(r"^([A-Za-z0-9_-]+):\s*(.*)$", line)
        if not match or match.group(1) not in _BEHAVIOR_REF_KEYS:
            continue
        value = match.group(2).strip()
        if value.startswith("["):
            if not value.endswith("]"):
                raise ValueError(f"unsupported multiline flow list: {match.group(1)}")
            body = value[1:-1].strip()
            if body:
                refs.extend(
                    _clean_yaml_scalar(item)
                    for item in next(csv.reader([body], skipinitialspace=True))
                    if _clean_yaml_scalar(item)
                )
            continue
        if value:
            refs.append(_clean_yaml_scalar(value))
            continue
        for child in lines[index + 1:]:
            if child and not child[0].isspace():
                break
            item = re.match(r"^\s+-\s+(.+?)\s*$", child)
            if item:
                cleaned = _clean_yaml_scalar(item.group(1))
                if cleaned:
                    refs.append(cleaned)
    return refs


def _plugin_context(skill_dir: Path) -> tuple[Path, Path] | None:
    """Return (repo root, plugin root) only for a canonical plugins/<name>/skills path."""
    for candidate in (skill_dir, *skill_dir.parents):
        if candidate.parent.name != "plugins":
            continue
        manifest = candidate / ".claude-plugin" / "plugin.json"
        if manifest.is_file():
            return candidate.parent.parent.resolve(), candidate.resolve()
    return None


def _read_package_contract(
    plugin_root: Path, skill_name: str,
) -> tuple[Path | None, tuple[str, ...]]:
    """Read and validate package dependencies, narrowed for one target skill."""
    path = plugin_root / "references" / "package-contract.json"
    if not path.is_file():
        return None, ()
    try:
        doc = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"package contract read/parse error: {path}: {exc}") from exc
    depends = doc.get("depends_on", []) if isinstance(doc, dict) else None
    if not isinstance(depends, list) or not all(
        isinstance(item, str) and re.fullmatch(r"[a-z0-9][a-z0-9-]*", item)
        for item in depends
    ):
        raise ValueError(f"package contract depends_on must be plugin slug strings: {path}")
    if len(depends) != len(set(depends)):
        raise ValueError(f"package contract depends_on contains duplicates: {path}")
    scoped = doc.get("skill_dependencies")
    if scoped is None:
        return path, tuple(depends)
    if not isinstance(scoped, dict):
        raise ValueError(f"package contract skill_dependencies must be an object: {path}")
    entries = doc.get("entry_points", {})
    known_skills = set(entries.get("skills", [])) if isinstance(entries, dict) else set()
    for declared_skill, dependencies in scoped.items():
        if not isinstance(declared_skill, str) or not re.fullmatch(
            r"[a-z0-9][a-z0-9-]*", declared_skill
        ):
            raise ValueError(
                f"package contract skill_dependencies has invalid skill: {declared_skill!r}"
            )
        if known_skills and declared_skill not in known_skills:
            raise ValueError(
                "package contract skill_dependencies references an undeclared entry point: "
                f"{declared_skill}"
            )
        if not isinstance(dependencies, list) or not all(
            isinstance(item, str) and re.fullmatch(r"[a-z0-9][a-z0-9-]*", item)
            for item in dependencies
        ):
            raise ValueError(
                "package contract skill_dependencies values must be plugin slug arrays: "
                f"{declared_skill}"
            )
        if len(dependencies) != len(set(dependencies)):
            raise ValueError(
                f"package contract skill_dependencies contains duplicates: {declared_skill}"
            )
        undeclared = sorted(set(dependencies) - set(depends))
        if undeclared:
            raise ValueError(
                "package contract skill_dependencies must be a subset of depends_on: "
                f"{declared_skill} -> {undeclared}"
            )
    return path, tuple(scoped.get(skill_name, []))


def _contained(path: Path, root: Path, label: str) -> Path:
    try:
        resolved = path.resolve(strict=True)
    except OSError as exc:
        raise ValueError(f"declared behavior dependency missing: {label}: {path}") from exc
    try:
        resolved.relative_to(root)
    except ValueError as exc:
        raise ValueError(
            f"declared behavior dependency escapes repository: {label}: {resolved}"
        ) from exc
    return resolved


def _manifest_name(plugin_root: Path, expected: str) -> Path:
    manifest_path = plugin_root / ".claude-plugin" / "plugin.json"
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"plugin manifest read/parse error: {manifest_path}: {exc}") from exc
    actual = manifest.get("name") if isinstance(manifest, dict) else None
    if actual != expected:
        raise ValueError(
            f"plugin manifest name mismatch: expected={expected} actual={actual}"
        )
    return manifest_path.resolve()


def _dependency_behavior_contract(plugin_root: Path, expected: str) -> tuple[Path, dict]:
    """Load the harness sidecar that identifies a dependency's behavior surface."""
    path = plugin_root / "references" / "package-contract.json"
    try:
        contract = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(
            f"dependency package contract read/parse error: {path}: {exc}"
        ) from exc
    if not isinstance(contract, dict) or contract.get("plugin_name") != expected:
        actual = contract.get("plugin_name") if isinstance(contract, dict) else None
        raise ValueError(
            "dependency package contract plugin_name mismatch: "
            f"expected={expected} actual={actual}"
        )
    entry_points = contract.get("entry_points")
    if not isinstance(entry_points, dict):
        raise ValueError(f"dependency package contract entry_points missing: {path}")
    for kind in ("skills", "agents", "commands", "hooks"):
        values = entry_points.get(kind, [])
        if not isinstance(values, list) or not all(
            isinstance(item, str) and item for item in values
        ):
            raise ValueError(
                f"dependency package contract entry_points.{kind} must be strings: {path}"
            )
    return path.resolve(), entry_points


def _resolve_behavior_ref(
    ref: str, *, skill_dir: Path, repo_root: Path, plugin_root: Path
) -> Path:
    """Resolve one declared *_refs entry; containment/existence is checked by caller."""
    if ref.startswith("plugins/"):
        return repo_root / ref
    skill_relative = skill_dir / ref
    if skill_relative.exists():
        return skill_relative
    if "/" not in ref and "." not in ref:
        return plugin_root / "skills" / ref / "SKILL.md"
    repo_relative = repo_root / ref
    if repo_relative.exists():
        return repo_relative
    return skill_relative


def behavior_closure_files(skill_dir: Path) -> list[tuple[str, Path]]:
    """Resolve the declared behavior closure, fail-closed on missing/unsafe refs."""
    skill_dir = Path(skill_dir).resolve()
    skill_md = skill_dir / "SKILL.md"
    if not skill_md.is_file():
        raise ValueError(f"skill dir has no SKILL.md: {skill_dir}")

    context = _plugin_context(skill_dir)
    repo_root, plugin_root = context or (skill_dir, skill_dir)
    files: dict[Path, str] = {}

    def add_file(path: Path, source: str) -> None:
        resolved = _contained(path, repo_root, source)
        if not resolved.is_file():
            raise ValueError(f"behavior dependency is not a file: {source}: {resolved}")
        label = (
            resolved.relative_to(repo_root).as_posix()
            if context else resolved.relative_to(skill_dir).as_posix()
        )
        files.setdefault(resolved, label)

    def add_tree(path: Path, source: str) -> None:
        resolved = _contained(path, repo_root, source)
        if not resolved.is_dir():
            raise ValueError(f"behavior dependency is not a directory: {source}: {resolved}")
        for child in sorted(resolved.rglob("*")):
            child_resolved = _contained(child, repo_root, source)
            if child_resolved.is_dir():
                if child.is_symlink():
                    raise ValueError(
                        "behavior dependency directory symlink is not allowed: "
                        f"{source}: {child} -> {child_resolved}"
                    )
                continue
            if (
                "__pycache__" in child.parts
                or ".pytest_cache" in child.parts
                or child.suffix == ".pyc"
            ):
                continue
            add_file(child, source)

    add_file(skill_md, "SKILL.md")
    for dirname in ("scripts", "prompts"):
        directory = skill_dir / dirname
        if directory.is_dir():
            add_tree(directory, dirname)

    declared_dependencies: tuple[str, ...] = ()
    if context:
        plugin_slug = plugin_root.name
        add_file(_manifest_name(plugin_root, plugin_slug), "native plugin manifest")
        hooks = plugin_root / "hooks"
        if hooks.is_dir():
            add_tree(hooks, "native plugin hooks")
        _contract_path, declared_dependencies = _read_package_contract(
            plugin_root, skill_dir.name
        )
        for dependency in declared_dependencies:
            dep_root = _contained(
                repo_root / "plugins" / dependency,
                repo_root,
                f"declared plugin dependency {dependency}",
            )
            try:
                dep_root.relative_to(repo_root / "plugins")
            except ValueError as exc:
                raise ValueError(
                    f"declared plugin dependency escapes plugins root: {dependency}"
                ) from exc
            add_file(_manifest_name(dep_root, dependency), f"dependency manifest {dependency}")
            dep_contract, dep_entries = _dependency_behavior_contract(dep_root, dependency)
            add_file(dep_contract, f"dependency package contract {dependency}")
            dep_hooks = dep_root / "hooks"
            if dep_hooks.is_dir():
                add_tree(dep_hooks, f"dependency hooks {dependency}")
            for skill_name in dep_entries.get("skills", []):
                add_tree(
                    dep_root / "skills" / skill_name,
                    f"dependency skill {dependency}:{skill_name}",
                )
            for agent_name in dep_entries.get("agents", []):
                add_file(
                    dep_root / "agents" / f"{agent_name}.md",
                    f"dependency agent {dependency}:{agent_name}",
                )
            for command_name in dep_entries.get("commands", []):
                add_file(
                    dep_root / "commands" / f"{command_name}.md",
                    f"dependency command {dependency}:{command_name}",
                )
            for dirname in ("scripts", "schemas"):
                directory = dep_root / dirname
                if directory.is_dir():
                    add_tree(directory, f"dependency {dirname} {dependency}")

    declared_set = set(declared_dependencies)
    for ref in _frontmatter_refs(skill_md):
        raw = Path(ref)
        if raw.is_absolute():
            raise ValueError(f"declared behavior dependency must be relative: {ref}")
        candidate = _resolve_behavior_ref(
            ref, skill_dir=skill_dir, repo_root=repo_root, plugin_root=plugin_root
        )
        resolved = _contained(candidate, repo_root, ref)
        if context:
            try:
                relative_plugins = resolved.relative_to(repo_root / "plugins")
            except ValueError:
                relative_plugins = None
            if relative_plugins and relative_plugins.parts:
                referenced_plugin = relative_plugins.parts[0]
                if referenced_plugin not in {plugin_root.name, *declared_set}:
                    raise ValueError(
                        "cross-plugin behavior dependency is not declared in "
                        f"package-contract.depends_on: {referenced_plugin} ({ref})"
                    )
        if resolved.is_dir():
            add_tree(resolved, ref)
        elif resolved.is_file():
            add_file(resolved, ref)
        else:
            raise ValueError(f"unsupported behavior dependency: {ref}: {resolved}")

    return sorted(((label, path) for path, label in files.items()), key=lambda item: item[0])


def skill_dir_tree_sha(skill_dir: Path) -> str:
    """Declared behavior closure digest (legacy field name retained for compatibility)."""
    h = hashlib.sha256()
    for label, path in behavior_closure_files(skill_dir):
        h.update(label.encode("utf-8"))
        h.update(b"\0")
        h.update(path.read_bytes())
        h.update(b"\0")
    return h.hexdigest()
