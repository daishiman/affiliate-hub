#!/usr/bin/env python3
# /// script
# name: validate-route-build-reports
# purpose: Validate per-route build reports under eval-log/<slug>/build/ against handoff routes (L4 execution handover chain).
# inputs:
#   - argv: --handoff plugin-plans/<slug>/handoff-run-plugin-dev-plan.json [--reports-dir DIR] (--route ID | --complete)
# outputs:
#   - stdout: JSON {"valid": bool, "mode": str, "findings": [str, ...]}
#   - exit: 0=PASS / 1=validation failure / 2=usage or JSON error
# requires-python = ">=3.10"
# dependencies: []
# contexts: [A, B, C, E]
# network: false
# write-scope: none
# ///
"""plugin 一括 build の route 実行レポート (route-build-report) を検証する。

契約正本: references/route-build-report.md / schemas/route-build-report.schema.json

Usage:
  # route 1 本の完了直後: レポート形状 + handoff 整合 + 依存チェーンを検証
  validate-route-build-reports.py --handoff plugin-plans/<slug>/handoff-run-plugin-dev-plan.json --route C01

  # 全 route 終端: 全レポート実在 + failure ゼロ + orphan ゼロを検証
  validate-route-build-reports.py --handoff plugin-plans/<slug>/handoff-run-plugin-dev-plan.json --complete

  # 内蔵 self-test (一時ディレクトリ上で代表シナリオを検査)
  validate-route-build-reports.py --self-test

CLI 出力契約:
  stdout: JSON {"valid": bool, "mode": "route:<id>"|"complete"|"self-test", "findings": [str, ...]}
  exit:   0=PASS, 1=FAIL, 2=usage/parse error
"""
from __future__ import annotations

import importlib.util
import json
import re
import sys
from pathlib import Path, PurePosixPath

_SCRIPTS = Path(__file__).resolve().parent
sys.path.insert(0, str(_SCRIPTS))


def _load_route_report_contract() -> None:
    """ハイフン区切りの補助スクリプトを後方互換名でロードする。"""
    module_name = "route_report_contract"
    path = _SCRIPTS / "validate-route-report-contract.py"
    spec = importlib.util.spec_from_file_location(module_name, path)
    if spec is None or spec.loader is None:
        raise ImportError(f"cannot load route report contract: {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)


_load_route_report_contract()

from route_report_contract import (
    BUILDERS,
    COMPONENT_KINDS,
    OPTIONAL_KEYS,
    REQUIRED_KEYS,
    SCHEMA_PATH,
    SCHEMA_VERSION,
    SLUG_RE,
    STATUSES,
    _handoff_route_id_findings,
    _hash_target,
    _is_str_list,
    _producer_graph_hash,
    report_path,
    report_rel,
    validate_against_route,
    validate_current_handoff_evidence,
    validate_discovered_consistency,
    validate_report_shape,
)


def _repo_root_from_handoff_path(path: Path) -> Path:
    """plugin-plans/<slug>/handoff から repository root を導出する。"""
    resolved = path.resolve()
    for parent in resolved.parents:
        if parent.name == "plugin-plans":
            return parent.parent
    return Path.cwd().resolve()


def _load_report(reports_dir: Path, slug: str, route_id: str) -> tuple[dict | None, list[str]]:
    path = reports_dir / f"route-{route_id}.json"
    if not path.is_file():
        return None, [f"route {route_id}: レポート未作成 ({report_path(slug, route_id)})"]
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        return None, [f"route {route_id}: レポートが JSON として読めない ({exc})"]
    if not isinstance(data, dict):
        return None, [f"route {route_id}: レポートが JSON object でない"]
    return data, []


def validate_dependency_chain(
    report: dict, route: dict, reports_dir: Path, slug: str, repo_root: Path | None = None
) -> list[str]:
    """依存 route のレポート実在/非 failure と inputs_consumed 被覆 (fail-closed の本体)。"""
    findings: list[str] = []
    consumed = {str(PurePosixPath(p)) for p in report.get("inputs_consumed", []) if isinstance(p, str)}
    for dep_id in route.get("depends_on", []) or []:
        dep_report, errs = _load_report(reports_dir, slug, dep_id)
        if errs:
            findings.extend(f"依存 {e}" for e in errs)
            continue
        dep_status = dep_report.get("status")
        if dep_status not in STATUSES:
            findings.append(f"依存 route {dep_id}: status 不正 ({dep_status!r})")
        elif dep_status != "success":
            findings.append(f"依存 route {dep_id}: status={dep_status} のまま後続を build している")
        expected = report_rel(reports_dir, dep_id, repo_root)
        if expected not in consumed:
            findings.append(f"inputs_consumed: 依存レポート {expected} の読取宣言が無い")
    return findings


_FAILED_EVIDENCE_RE = re.compile(r"[1-9][0-9]*\s+failed")


def report_warnings(report: object) -> list[str]:
    """valid/exit に影響しない助言 WARN (既知赤の無音通過を機械層で顕在化する・S-04)。

    status=success かつ evidence のいずれかに `N failed` (N>=1) を含み deviations が空のとき、
    「責務外失敗を deviations へ記録する規約」の未遵守を WARN する。failure を success へ
    変換する際に deviation 追跡にも乗せない normalization-of-deviance (既知赤の基準線低下) を
    検出するが、valid 判定は変えない (助言のみ・fail-closed ではない)。
    """
    if not isinstance(report, dict):
        return []
    warnings: list[str] = []
    if report.get("status") == "success":
        evidence = report.get("evidence")
        deviations = report.get("deviations")
        has_failed = _is_str_list(evidence) and any(_FAILED_EVIDENCE_RE.search(e) for e in evidence)
        deviations_empty = isinstance(deviations, list) and not deviations
        if has_failed and deviations_empty:
            warnings.append(
                "evidence に失敗記録 (N failed) があるのに deviations が空: "
                "責務外失敗は deviations へ記録する規約 (既知赤の無音通過防止)"
            )
    return warnings


def validate_route(
    handoff: dict,
    reports_dir: Path,
    route_id: str,
    repo_root: Path | None = None,
    plan_dir: Path | None = None,
) -> list[str]:
    slug = handoff.get("target_plugin_slug", "")
    route_id_findings = _handoff_route_id_findings(handoff)
    if route_id_findings:
        return route_id_findings
    routes = {r.get("id"): r for r in handoff.get("routes", []) if isinstance(r, dict)}
    route = routes.get(route_id)
    if route is None:
        return [f"route {route_id}: handoff routes に存在しない"]
    report, errs = _load_report(reports_dir, slug, route_id)
    if errs:
        return errs
    findings = validate_report_shape(report)
    if report.get("route_id") not in (None, route_id):
        findings.append(f"route_id: ファイル名 route-{route_id}.json と不一致 ({report.get('route_id')!r})")
    findings.extend(validate_discovered_consistency(report))
    findings.extend(validate_against_route(report, route, slug, repo_root))
    findings.extend(validate_current_handoff_evidence(report, route, handoff, plan_dir, repo_root))
    findings.extend(validate_dependency_chain(report, route, reports_dir, slug, repo_root))
    return findings


def validate_complete(
    handoff: dict,
    reports_dir: Path,
    repo_root: Path | None = None,
    plan_dir: Path | None = None,
) -> list[str]:
    slug = handoff.get("target_plugin_slug", "")
    routes = [r for r in handoff.get("routes", []) if isinstance(r, dict)]
    findings = _handoff_route_id_findings(handoff)
    if findings:
        return findings
    for route in routes:
        rid = route.get("id", "?")
        route_findings = validate_route(handoff, reports_dir, rid, repo_root, plan_dir)
        findings.extend(f"route {rid}: {finding}" for finding in route_findings)
        if not route_findings:
            report, _ = _load_report(reports_dir, slug, rid)
            if report and report.get("status") != "success":
                findings.append(
                    f"route {rid}: status={report.get('status')} が残っている "
                    "(--complete は全 route success のみ完了)"
                )
    known_ids = {r.get("id") for r in routes}
    if reports_dir.is_dir():
        for path in sorted(reports_dir.glob("route-*.json")):
            rid = path.stem.removeprefix("route-")
            if rid not in known_ids:
                findings.append(f"orphan レポート: {path.name} は handoff routes に無い route (計画 drift)")
    return findings


def _load_handoff(path: Path) -> tuple[dict | None, str | None]:
    if not path.is_file():
        return None, f"handoff が見つからない: {path}"
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        return None, f"handoff が JSON として読めない: {exc}"
    if not isinstance(data, dict) or not isinstance(data.get("routes"), list):
        return None, "handoff に routes 配列が無い"
    slug = data.get("target_plugin_slug")
    if not (isinstance(slug, str) and SLUG_RE.match(slug)):
        return None, "handoff の target_plugin_slug が不正"
    return data, None


def _emit(valid: bool, mode: str, findings: list[str], warnings: list[str] | None = None) -> int:
    out: dict = {"valid": valid, "mode": mode, "findings": findings}
    if warnings:  # 非空時のみ additive に載せる (既存 stdout 契約 {valid,mode,findings} は後方互換)
        out["warnings"] = warnings
    print(json.dumps(out, ensure_ascii=False, indent=2))
    return 0 if valid else 1


def _self_test() -> int:
    import tempfile

    findings: list[str] = []

    def check(label: str, cond: bool) -> None:
        if not cond:
            findings.append(f"self-test: {label}")

    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        slug = "demo-plugin"
        handoff = {
            "target_plugin_slug": slug,
            "routes": [
                {"id": "C1", "component_kind": "script", "name": "lint-a", "depends_on": [],
                 "builder": "plugin-scaffold", "build_target": f"plugins/{slug}/scripts/lint-a.py"},
                {"id": "C2", "component_kind": "skill", "name": "run-b", "depends_on": ["C1"],
                 "builder": "run-skill-create", "build_target": f"plugins/{slug}/skills/run-b/"},
            ],
        }
        reports_dir = root / "eval-log" / slug / "build"
        reports_dir.mkdir(parents=True)

        def base_report(rid: str, route: dict, **over: object) -> dict:
            rep = {
                "schema_version": SCHEMA_VERSION, "plugin_slug": slug, "route_id": rid,
                "component_kind": route["component_kind"], "name": route["name"],
                "builder": route["builder"], "build_target": route["build_target"],
                "status": "success", "summary": "build 完了。lint exit0 を確認。",
                "deviations": [], "evidence": ["lint exit0"],
                "inputs_consumed": [], "handover": None,
            }
            rep.update(over)
            return rep

        r1, r2 = handoff["routes"]
        (root / r1["build_target"]).parent.mkdir(parents=True, exist_ok=True)
        (root / r1["build_target"]).write_text("# lint-a\n", encoding="utf-8")
        (root / r2["build_target"]).mkdir(parents=True, exist_ok=True)
        # (1) 依存レポート欠落: C2 は C1 レポートが無いと FAIL
        (reports_dir / "route-C2.json").write_text(json.dumps(
            base_report("C2", r2, inputs_consumed=[report_path(slug, "C1")])), encoding="utf-8")
        check("C1 欠落で C2 が FAIL", validate_route(handoff, reports_dir, "C2", root))
        # (2) チェーン充足で PASS
        (reports_dir / "route-C1.json").write_text(json.dumps(
            base_report("C1", r1, handover="run-b は lint-a の exit code 契約に依存")), encoding="utf-8")
        check("C1 単体 PASS", not validate_route(handoff, reports_dir, "C1", root))
        check("チェーン充足で C2 PASS", not validate_route(handoff, reports_dir, "C2", root))
        # (3) inputs_consumed 未宣言は FAIL
        (reports_dir / "route-C2.json").write_text(json.dumps(
            base_report("C2", r2, inputs_consumed=[])), encoding="utf-8")
        check("読取宣言なしで C2 FAIL",
              any("inputs_consumed" in f for f in validate_route(handoff, reports_dir, "C2", root)))
        (reports_dir / "route-C2.json").write_text(json.dumps(
            base_report("C2", r2, inputs_consumed=[report_path(slug, "C1")])), encoding="utf-8")
        # (4) success なのに evidence 空は FAIL
        bad = base_report("C1", r1, evidence=[])
        check("success+evidence 空 FAIL", any("evidence" in f for f in validate_report_shape(bad)))
        # (5) skipped は skip_reason 必須
        bad = base_report("C1", r1, status="skipped")
        check("skipped+skip_reason 無し FAIL", any("skip_reason" in f for f in validate_report_shape(bad)))
        ok = base_report("C1", r1, status="skipped", skip_reason="既存実体を維持", evidence=[])
        check("skipped+reason PASS", not validate_report_shape(ok))
        # (6) handoff との不一致は FAIL
        drift = base_report("C1", r1, build_target="plugins/other/x.py")
        check("build_target drift FAIL", validate_against_route(drift, r1, slug))
        missing_target = base_report("C1", r1)
        (root / r1["build_target"]).unlink()
        check("success target missing FAIL",
              any("現物が存在しない" in f for f in validate_against_route(missing_target, r1, slug, root)))
        (root / r1["build_target"]).write_text("# lint-a\n", encoding="utf-8")
        # (7) 依存 failure / skipped で後続 FAIL
        (reports_dir / "route-C1.json").write_text(json.dumps(
            base_report("C1", r1, status="failure")), encoding="utf-8")
        check("依存 failure で C2 FAIL",
              any("failure" in f for f in validate_route(handoff, reports_dir, "C2", root)))
        (reports_dir / "route-C1.json").write_text(json.dumps(
            base_report("C1", r1, status="skipped", skip_reason="domain implementation pending", evidence=[])), encoding="utf-8")
        check("依存 skipped で C2 FAIL",
              any("status=skipped" in f for f in validate_route(handoff, reports_dir, "C2", root)))
        (reports_dir / "route-C1.json").write_text(json.dumps(base_report("C1", r1)), encoding="utf-8")
        # (8) complete: 全 route 緑で PASS / orphan で FAIL
        check("complete PASS", not validate_complete(handoff, reports_dir, root))
        (reports_dir / "route-C9.json").write_text(json.dumps(base_report("C9", r1)), encoding="utf-8")
        check("orphan で complete FAIL",
              any("orphan" in f for f in validate_complete(handoff, reports_dir, root)))
        (reports_dir / "route-C9.json").unlink()
        # (9) deviations の discovered 言及 × discovered[]/corrections 突合 (残差の監査経路実証)
        mention = base_report("C1", r1, deviations=["残差は discovered へ構造化報告した"])
        check("discovered 言及+空で FAIL",
              any("discovered 言及" in f for f in validate_discovered_consistency(mention)))
        (reports_dir / "route-C1.json").write_text(json.dumps(mention), encoding="utf-8")
        check("discovered 言及+空は validate_route でも FAIL",
              any("discovered 言及" in f for f in validate_route(handoff, reports_dir, "C1", root)))
        with_form = base_report("C1", r1, deviations=["残差は discovered へ構造化報告した"],
                                discovered=[f"eval-log/{slug}/build/discovered-tasks/x.json"])
        check("discovered[] 実証で PASS", not validate_discovered_consistency(with_form))
        check("discovered[] 実証は shape も PASS", not validate_report_shape(with_form))
        corrected = base_report("C1", r1, deviations=["残差は discovered へ構造化報告した"],
                                corrections=[{"target": "deviations[0]",
                                              "correction": "discovered 非経由・deviations 開示のみ",
                                              "corrected_by": "self-test"}])
        check("corrections 訂正済で除外 PASS", not validate_discovered_consistency(corrected))
        check("corrections は shape PASS", not validate_report_shape(corrected))
        bad_corr = base_report("C1", r1, corrections=[{"target": "deviations[0]"}])
        check("corrections 形状不正 FAIL",
              any("corrections[0]" in f for f in validate_report_shape(bad_corr)))
        bad_disc = base_report("C1", r1, discovered=[""])
        check("discovered 形状不正 FAIL",
              any("discovered" in f for f in validate_report_shape(bad_disc)))
        (reports_dir / "route-C1.json").write_text(json.dumps(base_report("C1", r1)), encoding="utf-8")

    return _emit(not findings, "self-test", findings)


def main(argv: list[str]) -> int:
    args = list(argv)
    if "--self-test" in args:
        return _self_test()

    def _opt(name: str) -> str | None:
        if name in args:
            i = args.index(name)
            if i + 1 >= len(args):
                return None
            return args[i + 1]
        return None

    handoff_arg = _opt("--handoff")
    route_id = _opt("--route")
    complete = "--complete" in args
    if not handoff_arg or (route_id is None) == (not complete):
        print(json.dumps({"valid": False, "mode": "usage", "findings": [
            "usage: validate-route-build-reports.py --handoff <handoff.json> (--route <id> | --complete) [--reports-dir DIR]",
        ]}, ensure_ascii=False))
        return 2
    handoff_path = Path(handoff_arg)
    handoff, err = _load_handoff(handoff_path)
    if err:
        print(json.dumps({"valid": False, "mode": "usage", "findings": [err]}, ensure_ascii=False))
        return 2
    reports_dir_arg = _opt("--reports-dir")
    reports_dir = Path(reports_dir_arg) if reports_dir_arg else Path(
        report_path(handoff["target_plugin_slug"], "C0")).parent
    repo_root = _repo_root_from_handoff_path(handoff_path)
    plan_dir = handoff_path.resolve().parent
    slug = handoff["target_plugin_slug"]
    if route_id is not None:
        findings = validate_route(handoff, reports_dir, route_id, repo_root, plan_dir)
        report, _ = _load_report(reports_dir, slug, route_id)
        return _emit(not findings, f"route:{route_id}", findings, report_warnings(report))
    findings = validate_complete(handoff, reports_dir, repo_root, plan_dir)
    warnings: list[str] = []
    for route in handoff.get("routes", []):
        if isinstance(route, dict):
            report, _ = _load_report(reports_dir, slug, route.get("id", "?"))
            warnings.extend(report_warnings(report))
    return _emit(not findings, "complete", findings, warnings)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
