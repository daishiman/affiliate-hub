#!/usr/bin/env python3
"""PKG-002〜008 / PKG-014 sub-check 実装。

正本仕様: doc/ClaudeCodeスキルの設計書/36-plugin-package-harness-contract.md
findings schema: ../schemas/findings.schema.json

使い方:
  python3 validate-plugin-package.py --check pkg-002 --plugin harness-creator
  python3 validate-plugin-package.py --check all --plugin harness-creator

exit codes:
  0  全 PKG check pass または not_applicable
  1  1 件以上 fail
  2  schema 違反・入力エラー
"""

from __future__ import annotations
import argparse
import importlib.util
import json
import os
import re
import shlex
import sys
from datetime import datetime, timezone
from pathlib import Path

def _default_plugins_root() -> Path:
    env_plugin = os.environ.get("CLAUDE_PLUGIN_ROOT")
    if env_plugin:
        return Path(env_plugin).expanduser().resolve().parent
    return Path(__file__).resolve().parents[5] / "plugins"


def _resolve_plugin_dir(plugin: str | None, plugin_dir: str | None, plugins_root: str | None) -> Path | None:
    if plugin_dir:
        return Path(plugin_dir).expanduser().resolve()
    env_plugin = os.environ.get("CLAUDE_PLUGIN_ROOT")
    if env_plugin and (not plugin or Path(env_plugin).name == plugin):
        return Path(env_plugin).expanduser().resolve()
    if plugin:
        root = Path(plugins_root).expanduser().resolve() if plugins_root else _default_plugins_root()
        return root / plugin
    return None

PKG_IDS = ["PKG-002", "PKG-003", "PKG-004", "PKG-005", "PKG-006", "PKG-007", "PKG-008", "PKG-014"]

SKILL_FRONTMATTER_REQUIRED = {"name", "description", "kind"}
SKILL_FRONTMATTER_RECOMMENDED = {"responsibility_refs", "schema_refs", "manifest"}
PLUGIN_JSON_REQUIRED = {"name", "version", "description"}
PACKAGE_CONTRACT_REQUIRED = {"package_mode", "entry_points"}
SKILL_KINDS = {"run", "ref", "assign", "wrap", "delegate"}
LOOP_KINDS = {"run", "wrap", "delegate"}
KNOWN_COMBINATORS = {
    "with-run", "with-ref", "with-assign-generator", "with-assign-evaluator", "with-wrap", "with-delegate",
    "with-goal-seek", "with-feedback-contract", "with-evaluator", "with-hooks", "with-subagent", "with-knowledge",
}


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def parse_frontmatter(text: str) -> dict | None:
    if not text.startswith("---\n"):
        return None
    end = text.find("\n---\n", 4)
    if end < 0:
        return None
    block = text[4:end]
    result: dict = {}
    current_key = None
    for line in block.splitlines():
        m = re.match(r"^([a-zA-Z_][a-zA-Z0-9_-]*):\s*(.*)$", line)
        if m:
            key, val = m.group(1), m.group(2).strip()
            result[key] = val
            current_key = key
        elif line.strip().startswith("- ") and current_key:
            if not isinstance(result[current_key], list):
                result[current_key] = []
            result[current_key].append(line.strip()[2:].strip())
    return result


def _unquote(value: object) -> str:
    text = str(value).strip() if value is not None else ""
    if len(text) >= 2 and text[0] == text[-1] and text[0] in {'"', "'"}:
        return text[1:-1].strip()
    return text


def _as_list(value: object) -> list[str]:
    """Minimal YAML list normalizer (block list / inline flow list / scalar)."""
    if isinstance(value, list):
        raw = value
    else:
        text = _unquote(value)
        if text.startswith("[") and text.endswith("]"):
            raw = text[1:-1].split(",")
        else:
            raw = [text]
    return [item for item in (_unquote(v) for v in raw) if item and item != "[]"]


def _parse_completeness_exemptions(fm: dict) -> dict[str, str]:
    """Parse only reasoned ``<category>: <reason>`` exemptions.

    An empty category, an empty reason, or a decorative scalar does not exempt
    PKG-004. This matches lint-skill-completeness.py's fail-closed contract.
    """
    exemptions: dict[str, str] = {}
    for item in _as_list(fm.get("completeness_exempt")):
        match = re.match(r"^([a-z]+)\s*[:：]\s*(\S.*)$", item)
        if match:
            exemptions[match.group(1)] = match.group(2).strip()
    return exemptions


def _frontmatter_block(text: str) -> str | None:
    if not text.startswith("---\n"):
        return None
    end = text.find("\n---\n", 4)
    return None if end < 0 else text[4:end]


def _nested_mapping_block(frontmatter: str, key: str) -> str | None:
    """Return the indented YAML block below a top-level mapping key."""
    lines = frontmatter.splitlines()
    for idx, line in enumerate(lines):
        if re.match(rf"^{re.escape(key)}:\s*(?:#.*)?$", line):
            nested: list[str] = []
            for candidate in lines[idx + 1:]:
                if candidate and not candidate[0].isspace():
                    break
                nested.append(candidate)
            return "\n".join(nested)
    return None


def _mapping_scalar(block: str | None, key: str) -> str:
    if block is None:
        return ""
    match = re.search(rf"^\s+{re.escape(key)}:\s*([^#\n]+)", block, re.MULTILINE)
    return _unquote(match.group(1)) if match else ""


def load_plugin_json(plugin_dir: Path) -> dict | None:
    pj = plugin_dir / ".claude-plugin" / "plugin.json"
    if not pj.exists():
        return None
    try:
        return json.loads(pj.read_text())
    except json.JSONDecodeError:
        return None


def load_package_contract(plugin_dir: Path) -> dict | None:
    pc = plugin_dir / "references" / "package-contract.json"
    if not pc.exists():
        return None
    try:
        return json.loads(pc.read_text())
    except json.JSONDecodeError:
        return None


def get_package_mode(plugin_dir: Path) -> str:
    pc = load_package_contract(plugin_dir)
    if pc and "package_mode" in pc:
        return pc["package_mode"]
    pj = load_plugin_json(plugin_dir)
    if pj and "package_mode" in pj:
        return pj["package_mode"]
    return "skill-only"


def make_finding(pkg_id: str, idx: int, location: str, evidence: str,
                 severity: str = "P0", suggested_fix: str = "",
                 auto_fixable: bool = False) -> dict:
    num = pkg_id.split("-")[1]
    return {
        "id": f"F-PKG{num}-{idx:03d}",
        "pkg_id": pkg_id,
        "severity": severity,
        "location": location,
        "evidence": evidence,
        "suggested_fix": suggested_fix,
        "auto_fixable": auto_fixable,
    }


def check_pkg_002(plugin_dir: Path) -> list[dict]:
    findings: list[dict] = []
    pj = load_plugin_json(plugin_dir)
    if pj is None:
        findings.append(make_finding(
            "PKG-002", 1,
            f"{plugin_dir}/.claude-plugin/plugin.json",
            "plugin.json が存在しないか JSON 解析エラー",
            suggested_fix="plugin.json を新規作成し PLUGIN_JSON_REQUIRED キーを揃える"))
        return findings
    missing = PLUGIN_JSON_REQUIRED - pj.keys()
    for idx, key in enumerate(sorted(missing), 1):
        findings.append(make_finding(
            "PKG-002", idx,
            f"{plugin_dir}/.claude-plugin/plugin.json",
            f"必須キー欠落: {key}",
            suggested_fix=f"plugin.json に {key} を追加"))
    contract = load_package_contract(plugin_dir)
    start_idx = len(findings) + 1
    if contract is None:
        findings.append(make_finding(
            "PKG-002", start_idx,
            f"{plugin_dir}/references/package-contract.json",
            "package-contract.json が存在しないか JSON 解析エラー",
            suggested_fix="references/package-contract.json に package_mode と entry_points を追加"))
        return findings
    missing_contract = PACKAGE_CONTRACT_REQUIRED - contract.keys()
    for offset, key in enumerate(sorted(missing_contract), start_idx):
        findings.append(make_finding(
            "PKG-002", offset,
            f"{plugin_dir}/references/package-contract.json",
            f"package contract 必須キー欠落: {key}",
            suggested_fix=f"references/package-contract.json に {key} を追加"))
    scoped = contract.get("skill_dependencies")
    if scoped is not None:
        entry_points = contract.get("entry_points", {})
        declared_skills = set(
            entry_points.get("skills", []) if isinstance(entry_points, dict) else []
        )
        depends_on = contract.get("depends_on", [])
        allowed_dependencies = set(depends_on if isinstance(depends_on, list) else [])

        def scoped_finding(evidence: str) -> None:
            findings.append(make_finding(
                "PKG-002", len(findings) + 1,
                f"{plugin_dir}/references/package-contract.json#skill_dependencies",
                evidence,
                suggested_fix=(
                    "skill_dependencies を entry_points.skills のキーと "
                    "depends_on の部分集合だけで構成する"
                ),
            ))

        if not isinstance(scoped, dict):
            scoped_finding("skill_dependencies は object でなければならない")
        else:
            for skill, dependencies in scoped.items():
                if skill not in declared_skills:
                    scoped_finding(
                        f"skill_dependencies のキーが entry_points.skills 未宣言: {skill}"
                    )
                if not isinstance(dependencies, list) or not all(
                    isinstance(item, str) and item for item in dependencies
                ):
                    scoped_finding(
                        f"skill_dependencies.{skill} は plugin slug 配列でなければならない"
                    )
                    continue
                if len(dependencies) != len(set(dependencies)):
                    scoped_finding(f"skill_dependencies.{skill} に重複がある")
                undeclared = sorted(set(dependencies) - allowed_dependencies)
                if undeclared:
                    scoped_finding(
                        f"skill_dependencies.{skill} が depends_on 外を参照: {undeclared}"
                    )
    return findings


def check_pkg_003(plugin_dir: Path) -> list[dict]:
    findings: list[dict] = []
    target_name = plugin_dir.name
    plugins_root = plugin_dir.parent
    skill_names: dict[str, list[str]] = {}
    agent_names: dict[str, list[str]] = {}

    def is_equivalent_feedback_copy(skill_md: Path) -> bool:
        """Do not claim ownership of a byte-identical bundled feedback copy.

        Marketplace bundles contain a physical ``run-skill-feedback`` copy,
        while its design authority remains harness-creator.  A different copy
        is still a genuine namespace collision and must be reported.
        """
        if skill_md.parent.name != "run-skill-feedback":
            return False
        owner = skill_md.parent.parent.parent.name
        if owner == "harness-creator":
            return False
        source_dir = plugins_root / "harness-creator" / "skills" / "run-skill-feedback"
        copied_dir = skill_md.parent
        if not source_dir.is_dir() or not copied_dir.is_dir():
            return False
        source_files = sorted(path for path in source_dir.rglob("*") if path.is_file())
        copied_files = sorted(path for path in copied_dir.rglob("*") if path.is_file())
        return [
            (path.relative_to(source_dir), path.read_bytes()) for path in source_files
        ] == [
            (path.relative_to(copied_dir), path.read_bytes()) for path in copied_files
        ]

    for plug in plugins_root.iterdir():
        if not plug.is_dir() or not (plug / ".claude-plugin").exists():
            continue
        # 名前空間の「所有」は実体 (非 symlink) のみ。symlink は他 plugin の単一スキルを
        # 共有配備したもの (例: run-skill-feedback を全 plugin へ配備) であり、同一スキルの
        # 参照に過ぎず真の名前衝突ではない。所有者カウントから除外する (PKG-003 偽陽性防止)。
        for sk in (plug / "skills").glob("*/SKILL.md") if (plug / "skills").exists() else []:
            if sk.parent.is_symlink():
                continue
            if is_equivalent_feedback_copy(sk):
                continue
            name = sk.parent.name
            skill_names.setdefault(name, []).append(plug.name)
        for ag in (plug / "agents").glob("*.md") if (plug / "agents").exists() else []:
            if ag.is_symlink():
                continue
            agent_names.setdefault(ag.stem, []).append(plug.name)
    idx = 1
    for name, owners in skill_names.items():
        if len(owners) > 1 and target_name in owners:
            findings.append(make_finding(
                "PKG-003", idx,
                f"plugins/{','.join(owners)}/skills/{name}",
                f"skill 名 {name} が複数 plugin で衝突: {owners}",
                suggested_fix="kebab-case 名を一意化、または domain prefix で名前空間分離"))
            idx += 1
    for name, owners in agent_names.items():
        if len(owners) > 1 and target_name in owners:
            findings.append(make_finding(
                "PKG-003", idx,
                f"plugins/{','.join(owners)}/agents/{name}.md",
                f"agent 名 {name} が複数 plugin で衝突: {owners}",
                suggested_fix="agent 名を一意化"))
            idx += 1
    return findings


def check_pkg_004(plugin_dir: Path) -> list[dict]:
    findings: list[dict] = []
    skills_dir = plugin_dir / "skills"
    if not skills_dir.exists():
        return findings
    idx = 1
    for sk_md in skills_dir.glob("*/SKILL.md"):
        # Symlinked compatibility skills are owned and validated by their
        # source plugin; they are not repackaged by the target plugin.
        if sk_md.parent.is_symlink():
            continue
        fm = parse_frontmatter(sk_md.read_text(encoding="utf-8"))
        if fm is None:
            findings.append(make_finding(
                "PKG-004", idx, str(sk_md),
                "frontmatter が解析できない（--- で囲まれていない）",
                suggested_fix="03章フォーマットで frontmatter を追加"))
            idx += 1
            continue
        for key in sorted(SKILL_FRONTMATTER_REQUIRED):
            if _unquote(fm.get(key)):
                continue
            findings.append(make_finding(
                "PKG-004", idx, str(sk_md),
                f"必須キー欠落: {key}（空値も欠落扱い）",
                suggested_fix=f"{key} を追加"))
            idx += 1
        exemptions = _parse_completeness_exemptions(fm)
        for key in sorted(SKILL_FRONTMATTER_RECOMMENDED):
            if key == "manifest" and exemptions.get("manifest"):
                continue
            values = _as_list(fm.get(key))
            if values:
                continue
            findings.append(make_finding(
                "PKG-004", idx, str(sk_md),
                f"推奨キー欠落または空値: {key}"
                + ("（理由付き completeness_exempt: manifest で代替可）" if key == "manifest" else ""),
                severity="P1",
                suggested_fix=(
                    "workflow-manifest.json の実体参照を追加、または理由付き manifest exemption を宣言"
                    if key == "manifest" else f"非空の {key} を追加"
                )))
            idx += 1
    return findings


def _load_runtime_checks():
    path = Path(__file__).with_name("validate-plugin-package-runtime-checks.py")
    spec = importlib.util.spec_from_file_location("plugin_package_runtime_checks", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.configure(
        make_finding=make_finding,
        parse_frontmatter=parse_frontmatter,
        load_package_contract=load_package_contract,
        _as_list=_as_list,
        _unquote=_unquote,
        _frontmatter_block=_frontmatter_block,
        _nested_mapping_block=_nested_mapping_block,
        _mapping_scalar=_mapping_scalar,
        SKILL_KINDS=SKILL_KINDS,
        LOOP_KINDS=LOOP_KINDS,
        KNOWN_COMBINATORS=KNOWN_COMBINATORS,
    )
    return module


_RUNTIME_CHECKS = _load_runtime_checks()
check_pkg_005 = _RUNTIME_CHECKS.check_pkg_005
check_pkg_006 = _RUNTIME_CHECKS.check_pkg_006
check_pkg_007 = _RUNTIME_CHECKS.check_pkg_007
check_pkg_008 = _RUNTIME_CHECKS.check_pkg_008
check_pkg_014 = _RUNTIME_CHECKS.check_pkg_014
is_import_only_support_module = _RUNTIME_CHECKS.is_import_only_support_module


CHECK_FUNCTIONS = {
    "PKG-002": check_pkg_002,
    "PKG-003": check_pkg_003,
    "PKG-004": check_pkg_004,
    "PKG-005": check_pkg_005,
    "PKG-006": check_pkg_006,
    "PKG-007": check_pkg_007,
    "PKG-008": check_pkg_008,
    "PKG-014": check_pkg_014,
}

NA_FOR_SKILL_ONLY = {"PKG-003", "PKG-005", "PKG-006", "PKG-007", "PKG-008", "PKG-014"}


def run_checks(plugin_dir: Path, pkg_ids: list[str]) -> dict:
    package_mode = get_package_mode(plugin_dir)
    result_checks: dict[str, dict] = {}
    for pkg_id in pkg_ids:
        if package_mode == "skill-only" and pkg_id in NA_FOR_SKILL_ONLY:
            result_checks[pkg_id] = {
                "status": "not_applicable",
                "findings": [],
                "last_run_at": now_iso(),
                "skip_reason": f"package_mode=skill-only では {pkg_id} は適用対象外",
            }
            continue
        findings = CHECK_FUNCTIONS[pkg_id](plugin_dir)
        result_checks[pkg_id] = {
            "status": "fail" if findings else "pass",
            "findings": findings,
            "last_run_at": now_iso(),
        }
    counts = {"pass": 0, "fail": 0, "skip": 0, "not_applicable": 0}
    for v in result_checks.values():
        counts[v["status"]] += 1
    return {
        "run_id": f"pkg-validate-{plugin_dir.name}-{datetime.now().strftime('%Y%m%d-%H%M%S')[:11].replace('-', '')[:8]}-001",
        "target_plugin": plugin_dir.name,
        "package_mode": package_mode,
        "pkg_checks": result_checks,
        "verdict": {"total": len(pkg_ids), **counts},
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", default="all",
                    help="pkg-002〜pkg-008 / pkg-014 のいずれか、または all")
    ap.add_argument("--plugin", help="plugin 名（互換: --plugins-root/<name> で解決）")
    ap.add_argument("--plugin-dir", help="検査対象 plugin ディレクトリ。marketplace 単独 install ではこちらを優先")
    ap.add_argument("--plugins-root", help="兄弟 plugin を含む root。未指定時は $CLAUDE_PLUGIN_ROOT の親または dev fallback")
    ap.add_argument("--output", default="-")
    args = ap.parse_args()

    plugin_dir = _resolve_plugin_dir(args.plugin, args.plugin_dir, args.plugins_root)
    if plugin_dir is None:
        print("error: --plugin-dir, --plugin, or CLAUDE_PLUGIN_ROOT is required", file=sys.stderr)
        return 2
    if not plugin_dir.exists():
        print(f"error: plugin not found: {plugin_dir}", file=sys.stderr)
        return 2

    if args.check == "all":
        pkg_ids = PKG_IDS
    else:
        pid = args.check.upper().replace("PKG-", "PKG-")
        if not pid.startswith("PKG-"):
            pid = "PKG-" + pid.split("-")[-1]
        if pid not in PKG_IDS:
            print(f"error: unsupported --check value: {args.check} (supported: {PKG_IDS})", file=sys.stderr)
            return 2
        pkg_ids = [pid]

    result = run_checks(plugin_dir, pkg_ids)
    output = json.dumps(result, ensure_ascii=False, indent=2)
    if args.output == "-":
        print(output)
    else:
        Path(args.output).parent.mkdir(parents=True, exist_ok=True)
        Path(args.output).write_text(output)
    return 1 if result["verdict"]["fail"] > 0 else 0


if __name__ == "__main__":
    sys.exit(main())
