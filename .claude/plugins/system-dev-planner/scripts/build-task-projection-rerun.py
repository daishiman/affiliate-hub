#!/usr/bin/env python3
# /// script
# name: build-task-projection-rerun
# purpose: task projection の実行契約へ、世代非依存で再解決できる validate-system-plan 再実行コマンドを冪等に配線する。
# inputs: [argv --repo-root --config --feature-package --check]
# outputs: [stdout JSON {checked, updated, missing}, exit 0 ok, exit 2 fail-closed]
# contexts: [E]
# network: false
# write-scope: <tasks>/<parent_feature>/<task-id>.md の実行契約 section / rerun 行のみ
# dependencies: [resolve-project-context.py, validate-system-plan.py]
# requires-python: ">=3.11"
# ///
"""published task spec の再実行コマンドが実在 path を指さない問題を projection 側で吸収する。

content-addressed generation の task spec 本文は byte-for-byte 不変であり手編集できない
(`references/feature-execution-package-contract.md`)。その本文には
`validate-system-plan.py --repo-root . --staging .` が書かれているが、repository root
から実行すると package file 不在で失敗する。一方 generation path を直書きすると再計画の
たびに stale になる。

そこで executor が実際に読む mutable な task projection (`tasks/<feature>/<id>.md` の
`## 実行契約`) へ、feature 別 current pointer から現行世代を解決する世代非依存コマンドを
配線する。projection は「実行入口だけを保持する」層なので、正本 spec を書き換えずに
実行可能性だけを回復できる。

1 feature の planner run からは `--feature-package <id>` を必須とし、対象 feature の
projection だけを検査・修復する。対象は P01..P13 の exact 13 でなければ失敗する。
引数を省略する全件モードは repository 全体の移行・監査用とし、各 package に
同じ exact-set 制約を掛ける。どちらのモードも対象 0 件を成功にしない。

`--check` は書き込まずに未配線を報告し、1 件でもあれば exit 2 (fail-closed)。

現行 generation が contract 1.3.0 以上なら published task spec 自身が既に
`--feature-package` の正準 command を持つ。その世代へ「spec 内の `--staging .` が壊れている」
という legacy 説明を投影すると、実在する正本と説明が矛盾する。current pointer から package を
実検証して contract version を解決し、legacy generation にだけ旧説明を残す。
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import os
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
VERIFICATION_LINE = "- verification: published task spec の Automated commands"
RERUN_PREFIX = "- rerun: "
RERUN_TEMPLATE_LEGACY = (
    "- rerun: published task spec 内の `validate-system-plan.py --repo-root . --staging .` は "
    "repository root から解決できない。再検証は世代非依存の "
    "`python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . "
    "--feature-package {package_id}` を使い、current pointer から現行世代を再解決する。"
)
RERUN_TEMPLATE_CURRENT = (
    "- rerun: current pointer から現行世代を解決する "
    "`python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . "
    "--feature-package {package_id}` で published task spec と package 全体を再検証する。"
)
FRONTMATTER_PACKAGE = re.compile(r'^feature_package_id:\s*"([^"]+)"\s*$', re.MULTILINE)
FRONTMATTER_PHASE = re.compile(r'^phase_ref:\s*"(P\d{2})"\s*$', re.MULTILINE)
EXPECTED_PHASES = {f"P{number:02d}" for number in range(1, 14)}
_PLAN_VALIDATOR = None


def _resolver():
    """全 path 検査を C09 (resolve-project-context.py) へ一元化する。

    tasks root は repo-local config 由来なので、config が absolute/`..`/symlink escape を
    宣言した場合に repository 外へ書き込まないよう、containment 検査を自前実装せず
    C09 の guard_relative_path に委ねる。
    """
    spec = importlib.util.spec_from_file_location("sdp_context", HERE / "resolve-project-context.py")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)  # type: ignore[union-attr]
    return module


def _plan_validator():
    """契約 version 解決を validate-system-plan.py の正本実装へ委譲する。"""
    global _PLAN_VALIDATOR
    if _PLAN_VALIDATOR is not None:
        return _PLAN_VALIDATOR
    spec = importlib.util.spec_from_file_location(
        "sdp_projection_plan_validator", HERE / "validate-system-plan.py"
    )
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)  # type: ignore[union-attr]
    _PLAN_VALIDATOR = module
    return _PLAN_VALIDATOR


def _projection_files(tasks_root: Path) -> list[Path]:
    return sorted(tasks_root.glob("*/*.md"))


def _guarded_target(c09, root: Path, path: Path) -> tuple[str, Path]:
    """書込先 1 件ごとに realpath containment を掛ける。

    tasks root 自体が正当でも、その配下の directory や file が repository 外への
    symlink なら書込みは repository を越える。root だけの検査では防げないため、
    glob が返した各 path を repo 相対へ戻したうえで C09 に再検査させる。
    """
    rel = path.relative_to(root).as_posix()
    return rel, c09.guard_relative_path(root, rel)


def _version_tuple(value: str) -> tuple[int, int, int]:
    match = re.fullmatch(r"(\d+)\.(\d+)\.(\d+)", value)
    if match is None:
        raise ValueError(f"contract_version が semantic version でない: {value!r}")
    major, minor, patch = (int(part) for part in match.groups())
    return major, minor, patch


def _rerun_template(package_id: str, contract_version: str) -> str:
    template = (
        RERUN_TEMPLATE_CURRENT
        if _version_tuple(contract_version) >= (1, 3, 0)
        else RERUN_TEMPLATE_LEGACY
    )
    return template.format(package_id=package_id)


def _current_contract_version(c09, root: Path, context: dict, package_id: str) -> str:
    """current generation の実バイトを検証して適用契約 version を返す。

    pointer/manifest の自己申告 version は使わない。validate-system-plan.validate() が canonical
    digest を再計算し baseline asset へ照合した report だけを正本とする。package が壊れている
    ときに projection 文面だけを更新して緑に見せないよう、validation FAIL はそのまま停止する。
    """
    validator = _plan_validator()
    published = validator._current_generation(c09, root, context, package_id)
    generation = c09.guard_relative_path(root, published)
    report = validator.validate(
        generation,
        context["repository_id"],
        repo_root=root,
    )
    if report.get("status") != "pass":
        raise ValueError(
            "current generation の deterministic validation が FAIL: "
            + json.dumps(report.get("violations", []), ensure_ascii=False)
        )
    if report.get("feature_package_id") != package_id:
        raise ValueError("current generation package identity mismatch")
    version = report.get("contract_version")
    if not isinstance(version, str):
        raise ValueError("current generation validation report に contract_version が無い")
    _version_tuple(version)
    return version


def _rewrite(text: str, package_id: str, contract_version: str) -> str | None:
    """実行契約へ rerun 行を冪等に配線する。旧projectionには最小sectionを補う。"""
    expected = _rerun_template(package_id, contract_version)
    lines = text.splitlines(keepends=True)
    section = next((i for i, line in enumerate(lines) if line.strip() == "## 実行契約"), None)
    if section is None:
        separator = "" if not text or text.endswith("\n\n") else ("\n" if text.endswith("\n") else "\n\n")
        return (
            text
            + separator
            + "## 実行契約\n\n"
            + VERIFICATION_LINE
            + " と Required evidence を全件実行・保存する。\n"
            + expected
            + "\n"
        )
    section_end = next(
        (i for i in range(section + 1, len(lines)) if lines[i].startswith("## ")),
        len(lines),
    )
    anchor = next(
        (i for i in range(section + 1, section_end) if lines[i].startswith(VERIFICATION_LINE)),
        None,
    )
    if anchor is None:
        raise ValueError("実行契約 section の verification 行が見つからない")
    existing = [
        i for i in range(section + 1, section_end) if lines[i].startswith(RERUN_PREFIX)
    ]
    if len(existing) > 1:
        raise ValueError("実行契約 section に rerun 行が複数ある")
    if existing:
        index = existing[0]
        if lines[index].rstrip("\n") == expected:
            return None
        lines[index] = expected + "\n"
        return "".join(lines)
    lines.insert(anchor + 1, expected + "\n")
    return "".join(lines)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo-root", required=True)
    parser.add_argument("--config", default=".dev-graph/config.json")
    parser.add_argument(
        "--feature-package",
        default="",
        help="対象 feature_package_id。planner の 1 feature run では必ず指定する。",
    )
    parser.add_argument("--check", action="store_true", help="書き込まず未配線を fail-closed で報告する")
    args = parser.parse_args(argv)

    c09 = _resolver()
    try:
        context = c09.build_context(["--repo-root", args.repo_root, "--config", args.config], dict(os.environ))
        root = Path(context["repo_root"])
        # content_roots は C09 が containment 検査済み。書込先を独自に組み立てない。
        tasks_root = c09.guard_relative_path(root, context["content_roots"]["tasks"]["relative"])
    except (c09.UsageError, c09.PolicyError, OSError, ValueError, KeyError) as exc:
        print(f"[build-task-projection-rerun] FAIL: repo context を解決できない: {exc}", file=sys.stderr)
        return 2

    updated: list[str] = []
    missing: list[dict] = []
    package_phases: dict[str, list[str]] = {}
    contract_versions: dict[str, str] = {}
    contract_errors: dict[str, str] = {}
    rewrites: list[tuple[str, Path, str]] = []
    files = _projection_files(tasks_root)
    checked = 0
    for path in files:
        try:
            rel, target = _guarded_target(c09, root, path)
        except c09.PolicyError as exc:
            missing.append({"path": path.as_posix(), "reason": f"repository 外へ逃げる書込先: {exc}"})
            continue
        text = target.read_text(encoding="utf-8")
        found = FRONTMATTER_PACKAGE.search(text)
        if not found:
            if not args.feature_package:
                missing.append({"path": rel, "reason": "frontmatter に feature_package_id が無い"})
            continue
        package_id = found.group(1)
        if args.feature_package and package_id != args.feature_package:
            continue
        checked += 1
        if package_id not in contract_versions and package_id not in contract_errors:
            try:
                contract_versions[package_id] = _current_contract_version(
                    c09, root, context, package_id
                )
            except (c09.PolicyError, OSError, ValueError, KeyError) as exc:
                contract_errors[package_id] = str(exc)
        found_phase = FRONTMATTER_PHASE.search(text)
        if not found_phase:
            missing.append({"path": rel, "reason": "frontmatter に phase_ref が無い"})
            continue
        package_phases.setdefault(package_id, []).append(found_phase.group(1))
        if package_id in contract_errors:
            continue
        try:
            rewritten = _rewrite(text, package_id, contract_versions[package_id])
        except ValueError as exc:
            missing.append({"path": rel, "reason": str(exc)})
            continue
        if rewritten is None:
            continue
        rewrites.append((rel, target, rewritten))

    missing.extend({
        "path": context["content_roots"]["tasks"]["relative"],
        "reason": f"feature_package_id={package_id} の current contract を解決できない: {detail}",
    } for package_id, detail in sorted(contract_errors.items()))

    if checked == 0:
        missing.append({
            "path": context["content_roots"]["tasks"]["relative"],
            "reason": (
                f"feature_package_id={args.feature_package} の task projection が 0 件"
                if args.feature_package else "task projection が 0 件"
            ),
        })

    for package_id, phases in sorted(package_phases.items()):
        found = set(phases)
        if len(phases) != 13 or found != EXPECTED_PHASES or len(found) != len(phases):
            missing.append({
                "path": context["content_roots"]["tasks"]["relative"],
                "reason": (
                    f"feature_package_id={package_id} の task projection が exact 13/P01..P13 でない: "
                    f"count={len(phases)}, missing={sorted(EXPECTED_PHASES - found)}, "
                    f"unexpected={sorted(found - EXPECTED_PHASES)}, duplicates={sorted(phase for phase in found if phases.count(phase) > 1)}"
                ),
            })

    if args.check:
        missing.extend({"path": rel, "reason": "世代非依存の rerun 行が未配線"}
                       for rel, _, _ in rewrites)
    elif not missing:
        # exact-set/frontmatter/section/containment の全 preflight 後にだけ書き込む。
        # 失敗した修復が 12/13 のような部分更新を残さない。
        for rel, target, rewritten in rewrites:
            target.write_text(rewritten, encoding="utf-8")
            updated.append(rel)

    print(json.dumps({"checked": checked, "updated": updated, "missing": missing},
                     ensure_ascii=False, indent=2))
    if missing:
        print(f"[build-task-projection-rerun] FAIL: 未配線/不正 {len(missing)} 件", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
