"""PKG-005〜008 / PKG-014 の runtime-oriented package checks.

``validate-plugin-package.py`` は CLI、frontmatter parser、PKG-002〜004 を
所有する。ここは実行時の wiring 検査という責務を分離し、親側の正本の解析と
finding 形式を使う。``configure`` で同じ正本ヘルパを注入するため、複製しない。
"""

import json
import os
import re
import shlex
from pathlib import Path


def configure(**dependencies):
    """Inject the parent validator's canonical helpers and constants."""
    globals().update(dependencies)


def check_pkg_005(plugin_dir: Path) -> list[dict]:
    findings: list[dict] = []
    agents_dir = plugin_dir / "agents"
    skills_dir = plugin_dir / "skills"
    if not agents_dir.exists():
        return findings
    declared_agents: set[str] = set()
    for sk_md in skills_dir.glob("*/SKILL.md") if skills_dir.exists() else []:
        fm = parse_frontmatter(sk_md.read_text())
        if fm and "subagent_refs" in fm:
            refs = fm["subagent_refs"]
            if isinstance(refs, list):
                declared_agents.update(refs)
    actual_agents = {p.stem for p in agents_dir.glob("*.md")}
    idx = 1
    for missing in sorted(declared_agents - actual_agents):
        findings.append(make_finding(
            "PKG-005", idx,
            f"{plugin_dir}/agents/{missing}.md",
            f"SKILL.md で subagent_refs 宣言があるが agent ファイルが存在しない: {missing}",
            suggested_fix=f"agents/{missing}.md を作成、または SKILL.md の subagent_refs から削除"))
        idx += 1
    return findings


def is_import_only_support_module(path: Path) -> bool:
    """Return whether a file is an import-only support module.

    The 500-line split convention creates ``.py`` helpers in hooks/ and
    scripts/. PKG-006/007 must not mistake those helpers for entry points,
    while still rejecting missing declarations for executable files.
    """
    if path.suffix != ".py":
        return False
    if not path.stem.isidentifier():
        return False
    text = path.read_text(encoding="utf-8", errors="ignore")
    if text.startswith("#!"):
        return False
    return not any(line.startswith("if __name__") for line in text.splitlines())


def check_pkg_006(plugin_dir: Path) -> list[dict]:
    findings: list[dict] = []
    hooks_dir = plugin_dir / "hooks"
    settings_dir = plugin_dir / "settings"
    if not hooks_dir.exists():
        return findings
    actual_hooks = {p for p in hooks_dir.glob("*") if p.is_file() and p.suffix in {".py", ".sh"}}
    registered: set[str] = set()

    def register_hook_name(value: str) -> None:
        """Identify a hook entrypoint with or without its extension."""
        name = Path(value).name
        registered.add(name)
        registered.add(Path(name).stem)

    plugin_json = plugin_dir / ".claude-plugin" / "plugin.json"
    if plugin_json.exists():
        try:
            data = json.loads(plugin_json.read_text())
        except json.JSONDecodeError:
            data = {}
        hooks = data.get("hooks", {})
        if isinstance(hooks, dict):
            for event_hooks in hooks.values():
                for entry in event_hooks if isinstance(event_hooks, list) else []:
                    for h in entry.get("hooks", []) if isinstance(entry, dict) else []:
                        cmd = h.get("command") if isinstance(h, dict) else None
                        if cmd:
                            try:
                                tokens = shlex.split(cmd)
                            except ValueError:
                                tokens = cmd.split()
                            for token in tokens:
                                if "/hooks/" in token:
                                    register_hook_name(token)
        entry_points = data.get("entry_points", {})
        if isinstance(entry_points, dict):
            for hook_name in entry_points.get("hooks", []):
                if isinstance(hook_name, str):
                    register_hook_name(hook_name)

    contract = load_package_contract(plugin_dir)
    if isinstance(contract, dict):
        entry_points = contract.get("entry_points", {})
        if isinstance(entry_points, dict):
            for hook_name in entry_points.get("hooks", []):
                if isinstance(hook_name, str):
                    register_hook_name(hook_name)
    if settings_dir.exists():
        for cfg in settings_dir.glob("*.json"):
            try:
                data = json.loads(cfg.read_text())
            except json.JSONDecodeError:
                continue
            hooks = data.get("hooks", {})
            if isinstance(hooks, dict):
                for event_hooks in hooks.values():
                    for h in event_hooks if isinstance(event_hooks, list) else []:
                        cmd = h.get("command") if isinstance(h, dict) else None
                        if cmd:
                            register_hook_name(cmd)
    idx = 1
    for hook in actual_hooks:
        if hook.name in registered or hook.stem in registered:
            continue
        if is_import_only_support_module(hook):
            continue
        findings.append(make_finding(
            "PKG-006", idx, str(hook),
            "hook ファイル実体は存在するが settings 断片の hooks 配列に未登録",
            suggested_fix=f"settings/*.json の hooks 配列に {hook.name} を追加"))
        idx += 1
    return findings


def check_pkg_007(plugin_dir: Path) -> list[dict]:
    findings: list[dict] = []
    scripts_dir = plugin_dir / "scripts"
    if not scripts_dir.exists():
        return findings
    idx = 1
    for sc in scripts_dir.glob("*"):
        if not sc.is_file() or sc.suffix not in {".py", ".sh"}:
            continue
        if is_import_only_support_module(sc):
            continue
        text_head = sc.read_text(errors="ignore")[:200]
        if not text_head.startswith("#!"):
            findings.append(make_finding(
                "PKG-007", idx, str(sc), "shebang 欠落",
                suggested_fix="#!/usr/bin/env python3 または #!/usr/bin/env bash を先頭に追加"))
            idx += 1
        if text_head.startswith("#!") and not os.access(sc, os.X_OK):
            findings.append(make_finding(
                "PKG-007", idx, str(sc), "実行可能ビットなし (+x)",
                suggested_fix=f"chmod +x {sc}", auto_fixable=True))
            idx += 1
    return findings


def check_pkg_008(plugin_dir: Path) -> list[dict]:
    findings: list[dict] = []
    settings_dir = plugin_dir / "settings"
    if not settings_dir.exists():
        return findings
    idx = 1
    for cfg in settings_dir.glob("*.json"):
        try:
            data = json.loads(cfg.read_text())
        except json.JSONDecodeError as exc:
            findings.append(make_finding(
                "PKG-008", idx, str(cfg), f"JSON 解析エラー: {exc}",
                suggested_fix="JSON 構文を修正"))
            idx += 1
            continue
        if "$schema" not in data:
            findings.append(make_finding(
                "PKG-008", idx, str(cfg), "$schema フィールド欠落 (34a INV-2 違反)",
                severity="P1", suggested_fix="$schema を追加"))
            idx += 1
    return findings


def check_pkg_014(plugin_dir: Path) -> list[dict]:
    """Validate declared skill kind/combinators against runtime wiring."""
    findings: list[dict] = []
    skills_dir = plugin_dir / "skills"
    if not skills_dir.exists():
        return findings
    idx = 1

    def add(location: Path, evidence: str, suggested_fix: str) -> None:
        nonlocal idx
        findings.append(make_finding(
            "PKG-014", idx, str(location), evidence, severity="P1",
            suggested_fix=suggested_fix,
        ))
        idx += 1

    for sk_md in sorted(skills_dir.glob("*/SKILL.md")):
        if sk_md.parent.is_symlink():
            continue
        text = sk_md.read_text(encoding="utf-8")
        fm = parse_frontmatter(text)
        frontmatter = _frontmatter_block(text)
        if fm is None or frontmatter is None:
            add(sk_md, "frontmatter を解析できず runtime contract を確定できない",
                "正規の SKILL.md frontmatter を追加")
            continue

        kind = _unquote(fm.get("kind"))
        if kind not in SKILL_KINDS:
            add(sk_md, f"未対応 kind または空値: {kind or '<empty>'}",
                f"kind を {sorted(SKILL_KINDS)} のいずれかに修正")
            continue
        combinators = set(_as_list(fm.get("combinators")))
        for combinator in sorted(combinators - KNOWN_COMBINATORS):
            add(sk_md, f"未定義 combinator: {combinator}",
                "run-build-skill が定義する combinator 名へ修正")

        goal_block = _nested_mapping_block(frontmatter, "goal_seek")
        feedback_block = _nested_mapping_block(frontmatter, "feedback_contract")
        feedback_exempt = feedback_block is not None and bool(_mapping_scalar(feedback_block, "skip_reason"))
        if goal_block is not None and "with-goal-seek" not in combinators:
            add(sk_md, "goal_seek runtime 宣言があるが with-goal-seek combinator が未宣言",
                "combinators に with-goal-seek を追加")
        if feedback_block is not None and not feedback_exempt and "with-feedback-contract" not in combinators:
            add(sk_md, "feedback_contract runtime 宣言があるが with-feedback-contract combinator が未宣言",
                "combinators に with-feedback-contract を追加")

        if "with-goal-seek" in combinators:
            if kind not in LOOP_KINDS:
                add(sk_md, f"with-goal-seek は loop kind 専用だが kind={kind}",
                    f"kind を {sorted(LOOP_KINDS)} のいずれかにするか combinator を外す")
            if goal_block is None:
                add(sk_md, "with-goal-seek 宣言に対する goal_seek mapping がない",
                    "goal_seek.engine/max_loops/fork を追加")
            else:
                engine = _mapping_scalar(goal_block, "engine")
                fork = _mapping_scalar(goal_block, "fork")
                max_loops = _mapping_scalar(goal_block, "max_loops")
                if engine not in {"inline", "run-goal-seek", "task-graph"}:
                    add(sk_md, f"goal_seek.engine が未対応または空: {engine or '<empty>'}",
                        "engine を inline/run-goal-seek/task-graph のいずれかに修正")
                if fork not in {"inline", "subagent", "agent-team"}:
                    add(sk_md, f"goal_seek.fork が未対応または空: {fork or '<empty>'}",
                        "fork を inline/subagent/agent-team のいずれかに修正")
                if not max_loops.isdigit() or int(max_loops) < 1:
                    add(sk_md, f"goal_seek.max_loops が 1 以上の整数でない: {max_loops or '<empty>'}",
                        "max_loops を 1 以上の整数に修正")
            if not re.search(r"^##\s+ゴールシーク実行\s*$", text, re.MULTILINE):
                add(sk_md, "with-goal-seek 宣言に対する本文のゴールシーク実行配線がない",
                    "## ゴールシーク実行 に実行ループと停止条件を追加")

        if "with-feedback-contract" in combinators and not feedback_exempt:
            if feedback_block is None:
                add(sk_md, "with-feedback-contract 宣言に対する feedback_contract mapping がない",
                    "feedback_contract.max_iterations/criteria を追加")
            else:
                max_iterations = _mapping_scalar(feedback_block, "max_iterations")
                if not max_iterations.isdigit() or int(max_iterations) < 1:
                    add(sk_md, f"feedback_contract.max_iterations が 1 以上の整数でない: {max_iterations or '<empty>'}",
                        "max_iterations を 1 以上の整数に修正")
                for scope in ("inner", "outer"):
                    if not re.search(rf"^\s+loop_scope:\s*{scope}\s*(?:#.*)?$", feedback_block, re.MULTILINE):
                        add(sk_md, f"feedback_contract.criteria に loop_scope={scope} がない",
                            f"criteria に {scope} の受入基準を 1 件以上追加")

        if "with-knowledge" in combinators and not (sk_md.parent / "knowledge").is_dir():
            add(sk_md, "with-knowledge 宣言に対する knowledge/ 実体がない",
                "knowledge/ とその schema/index を同梱")
        if "with-hooks" in combinators and not (plugin_dir / "hooks").is_dir():
            add(sk_md, "with-hooks 宣言に対する plugin hooks/ 実体がない",
                "hooks/ 実体を追加するか combinator 宣言を外す")
    return findings
