"""C28 bd-bridge: external_ref の実在保証と orphan 棚卸し契約 (HarnessHub-mfh7)。

背景:
  `--op create` は `--graph-node-id` を必須にする一方で、その id が canonical graph に
  実在するかを検証していなかった。結果、node 登録 (C02 upsert-node.py) を伴わずに
  `external_ref: dev-graph:<id>` だけを持つ bd issue を作れ、参照先の無い dangling
  reference が常駐した。実測 (2026-07-25) で 74 件、2026-07-26 時点で 79 件。

  この参照は C28 `--op ready` で `parity_manifest_missing` に落ちる。この札は本来
  「graph 管理下なのに manifest から取りこぼした」= manifest 生成側の異常を指すもので、
  実体の無い参照が混ざると本物の取りこぼしと区別できず、警告が信号として摩耗する。

本 test が固定する契約:
  1. REGISTERED-FIRST: create は未登録 graph_node_id を **書込前に** 拒否する。
  2. PREVIEW REPORTS: dry-run は同じ判定を **報告** する (raise しない)。2026-07-26 の
     live-trial で、dry-run も raise する実装が C14 decompose の全体 dry-run を壊した。
     decompose は「C02 で node 登録 → C28 で起票」を 1 本の run で行うため、run 全体の
     dry-run 時点では node が未登録なのが正常な中間状態で、そこで落とすと preview が
     原理的に取れない。判定は receipt の registered / unregistered に残すので、
     dry-run を素通しにしたことにはならない。
  3. ALL-OR-NOTHING: projection の 14 件は 1 件でも未登録なら 1 件も書かない。
  4. AUDIT COMPLETENESS: orphan-audit は closed も含め全件返し、silent drop を作らない。
  5. DISPOSITION: spec 実体の有無で復元先が確定するかを機械的に分ける。
  6. SCOPE: `dev-graph:` prefix の無い external_ref は対象外 (契約 §10 の管理外事象)。
  7. MERGE-PENDING: 他 ref の graph に node が在るものを失効扱いへ落とさない。
     2026-07-26 の棚卸しでは非クローズ 30 件のうち 9 件がこれで、作業ツリーだけを
     見る実装ならその 9 件を全て「真の orphan」に誤分類していた。
"""
from __future__ import annotations

import importlib.util
import io
import json
import sys
from pathlib import Path

import pytest

PLUGIN = Path(__file__).resolve().parents[1]
SCRIPTS = PLUGIN / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))


def load(path: Path, name: str):
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def call_main(module, monkeypatch, capsys, *argv):
    monkeypatch.setattr(sys, "argv", [str(module.__file__), *map(str, argv)])
    monkeypatch.setattr(sys, "stdin", io.StringIO("{}"))
    code = module.main()
    output = capsys.readouterr().out
    return code, json.loads(output) if output else None


def write_repo(root: Path, node_ids: list[str]) -> None:
    """canonical graph と content_roots を持つ最小の repository fixture を作る。"""
    state = root / ".dev-graph"
    state.mkdir(exist_ok=True)
    (state / "config.json").write_text(json.dumps({
        "local_state": {"graph": ".dev-graph/graph.json"},
        "content_roots": {"issues": "issues", "tasks": "tasks"},
    }))
    (state / "graph.json").write_text(json.dumps({"nodes": [{"graph_node_id": nid} for nid in node_ids]}))
    (root / "issues").mkdir(exist_ok=True)


def write_spec(root: Path, relative: str, node_id: str) -> None:
    path = root / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(f'---\ngraph_node_id: "{node_id}"\nartifact_kind: "issue"\n---\n\n# body\n')


@pytest.fixture
def bridge(monkeypatch):
    module = load(SCRIPTS / "bd-bridge.py", "bd_bridge_orphan")
    monkeypatch.setattr(
        module, "preflight",
        lambda root, expected=None: {"version": "1.1.0", "workspace_identity": {"workspace_id": "bdw_fixture"}},
    )
    return module


@pytest.fixture
def calls(bridge, monkeypatch):
    recorded: list[list[str]] = []

    def fake_bd(args, cwd, check=True):
        recorded.append(list(args))
        if args[0] in ("search", "list"):
            return []
        if args[0] == "show":
            return {"id": args[1], "status": "open", "dependencies": []}
        return {"id": "NEW", "ok": True}

    monkeypatch.setattr(bridge, "bd", fake_bd)
    return recorded


def _created(calls: list[list[str]]) -> list[list[str]]:
    return [args for args in calls if args and args[0] == "create"]


# --- 1/2. REGISTERED-FIRST と PREVIEW PARITY ---------------------------------


def test_create_rejects_unregistered_graph_node_before_writing(bridge, calls, monkeypatch, capsys, tmp_path):
    from _common import ContractError

    write_repo(tmp_path, ["issue-registered-20260726"])
    with pytest.raises(ContractError, match="unregistered: issue-ghost-20260726"):
        call_main(
            bridge, monkeypatch, capsys, "--op", "create", "--repo-root", tmp_path,
            "--graph-node-id", "issue-ghost-20260726", "--title", "T",
        )
    assert _created(calls) == [], "拒否は bd へ 1 度も書く前に成立していなければならない"


def test_create_accepts_registered_node_and_records_registration(bridge, calls, monkeypatch, capsys, tmp_path):
    write_repo(tmp_path, ["issue-registered-20260726"])
    code, receipt = call_main(
        bridge, monkeypatch, capsys, "--op", "create", "--repo-root", tmp_path,
        "--graph-node-id", "issue-registered-20260726", "--title", "T",
    )
    assert code == 0 and len(_created(calls)) == 1
    # 検証したという事実を receipt に残す。receipt から確認できないゲートは運用上
    # 「効いているか分からないゲート」で、外れても誰も気づけない。
    assert receipt["result"]["registration"] == {
        "graph_node_ids": ["issue-registered-20260726"], "registered": True,
        "unregistered": [], "graph_node_count": 1,
    }


def test_create_dry_run_reports_the_registration_verdict_instead_of_raising(bridge, calls, monkeypatch, capsys, tmp_path):
    """dry-run は判定を payload に載せて exit 0 で返す (落とすのは書込経路だけ)。

    落とす実装だと、C02 登録を同一 run の前段に持つ skill (C14 decompose) の全体
    dry-run が原理的に通らない。preview は「今 apply したらどうなるか」の観測であって
    書込ではないので、未登録という事実は receipt で伝え、拒否は apply の側で行う。
    """
    write_repo(tmp_path, ["issue-registered-20260726"])
    code, receipt = call_main(
        bridge, monkeypatch, capsys, "--op", "create", "--repo-root", tmp_path,
        "--graph-node-id", "issue-ghost-20260726", "--title", "T", "--dry-run",
    )
    assert code == 0
    assert receipt["dry_run_preview"]["registration"] == {
        "graph_node_ids": ["issue-ghost-20260726"], "registered": False,
        "unregistered": ["issue-ghost-20260726"], "graph_node_count": 1,
    }
    code, receipt = call_main(
        bridge, monkeypatch, capsys, "--op", "create", "--repo-root", tmp_path,
        "--graph-node-id", "issue-registered-20260726", "--title", "T", "--dry-run",
    )
    assert code == 0 and receipt["dry_run_preview"]["registration"]["registered"] is True
    assert calls == [], "dry-run はどちらの判定でも bd へ書かない"


def test_dry_run_preview_stays_available_on_an_empty_canonical_graph(bridge, calls, monkeypatch, capsys, tmp_path):
    """C14 decompose の全体 dry-run が観測する状態 (graph 0 件) を回帰として固定する。

    2026-07-26 の live-trial 実走で、dry-run も raise する実装が
    tests/fixtures/audit_decompose_live_trial.py の adapter receipt 生成を
    EX_DATAERR で落とし、preview graph が正当でも scenario が成立しなくなった。
    """
    write_repo(tmp_path, [])
    code, receipt = call_main(
        bridge, monkeypatch, capsys, "--op", "create", "--repo-root", tmp_path,
        "--graph-node-id", "feat-user-auth-001", "--title", "T", "--artifact-kind", "feature", "--dry-run",
    )
    assert code == 0
    assert receipt["dry_run_preview"]["registration"]["graph_node_count"] == 0
    assert receipt["dry_run_preview"]["registration"]["unregistered"] == ["feat-user-auth-001"]
    assert calls == []


def test_apply_still_rejects_what_the_preview_flagged_as_unregistered(bridge, calls, monkeypatch, capsys, tmp_path):
    """preview を緩めても書込経路は緩まない (dangling reference の入口は閉じたまま)。"""
    from _common import ContractError

    write_repo(tmp_path, ["issue-registered-20260726"])
    code, receipt = call_main(
        bridge, monkeypatch, capsys, "--op", "create", "--repo-root", tmp_path,
        "--graph-node-id", "issue-ghost-20260726", "--title", "T", "--dry-run",
    )
    assert code == 0 and receipt["dry_run_preview"]["registration"]["registered"] is False
    with pytest.raises(ContractError, match="unregistered: issue-ghost-20260726"):
        call_main(
            bridge, monkeypatch, capsys, "--op", "create", "--repo-root", tmp_path,
            "--graph-node-id", "issue-ghost-20260726", "--title", "T",
        )
    assert _created(calls) == []


def test_create_fails_closed_when_canonical_graph_is_unresolvable(bridge, calls, monkeypatch, capsys, tmp_path):
    """graph を指せない repository で起票を素通しすると、検証の無い状態へ戻る。"""
    from _common import ContractError

    (tmp_path / ".dev-graph").mkdir()
    (tmp_path / ".dev-graph" / "config.json").write_text(json.dumps({"local_state": {}}))
    with pytest.raises(ContractError, match="local_state.graph"):
        call_main(
            bridge, monkeypatch, capsys, "--op", "create", "--repo-root", tmp_path,
            "--graph-node-id", "issue-x-20260726", "--title", "T",
        )
    assert calls == []


# --- 3. ALL-OR-NOTHING (projection) ------------------------------------------


def _projection(root: Path) -> Path:
    manifest = {
        "source_digest": "sha256:" + "a" * 64,
        "feature": {"graph_node_id": "F", "title": "Feature F"},
        "children": [
            {
                "graph_node_id": f"T{i:02d}", "parent_feature": "F", "phase_ref": f"P{i:02d}",
                "title": f"Phase {i:02d}", "depends_on": [] if i == 1 else [f"T{i - 1:02d}"],
            }
            for i in range(1, 14)
        ],
    }
    path = root / "projection.json"
    path.write_text(json.dumps(manifest))
    return path


def test_projection_create_writes_nothing_when_any_member_is_unregistered(bridge, calls, monkeypatch, capsys, tmp_path):
    from _common import ContractError

    # P13 だけを欠かす。途中まで書けてしまうと、epic だけが dangling reference で残り、
    # 再実行時に冪等経路が「登録済み」と誤認する。
    write_repo(tmp_path, ["F", *(f"T{i:02d}" for i in range(1, 13))])
    projection = _projection(tmp_path)
    with pytest.raises(ContractError, match="unregistered: T13"):
        call_main(bridge, monkeypatch, capsys, "--op", "create", "--repo-root", tmp_path, "--projection-manifest", projection)
    assert _created(calls) == []


def test_projection_dry_run_reports_registration_for_all_fourteen(bridge, calls, monkeypatch, capsys, tmp_path):
    write_repo(tmp_path, ["F", *(f"T{i:02d}" for i in range(1, 14))])
    projection = _projection(tmp_path)
    code, receipt = call_main(
        bridge, monkeypatch, capsys, "--op", "create", "--repo-root", tmp_path,
        "--projection-manifest", projection, "--dry-run",
    )
    assert code == 0
    assert len(receipt["dry_run_preview"]["projection"]["registration"]["graph_node_ids"]) == 14
    assert calls == []


def test_projection_dry_run_names_the_unregistered_members_without_raising(bridge, calls, monkeypatch, capsys, tmp_path):
    """14 件のうち欠けている 1 件を preview が名指しする (件数だけの報告にしない)。"""
    write_repo(tmp_path, ["F", *(f"T{i:02d}" for i in range(1, 13))])
    projection = _projection(tmp_path)
    code, receipt = call_main(
        bridge, monkeypatch, capsys, "--op", "create", "--repo-root", tmp_path,
        "--projection-manifest", projection, "--dry-run",
    )
    assert code == 0
    registration = receipt["dry_run_preview"]["projection"]["registration"]
    assert registration["registered"] is False and registration["unregistered"] == ["T13"]
    assert calls == []


# --- 4/5/6. orphan-audit -----------------------------------------------------


@pytest.fixture
def audit_rows(bridge, monkeypatch):
    rows: list[dict] = []
    monkeypatch.setattr(bridge, "bd", lambda args, cwd, check=True: rows if args[0] == "list" else {"ok": True})
    return rows


def test_orphan_audit_reports_every_dangling_reference_including_closed(bridge, audit_rows, monkeypatch, capsys, tmp_path):
    write_repo(tmp_path, ["issue-live-20260726"])
    audit_rows.extend([
        {"id": "B1", "status": "open", "external_ref": "dev-graph:issue-live-20260726"},
        {"id": "B2", "status": "open", "external_ref": "dev-graph:issue-ghost-open-20260726"},
        {"id": "B3", "status": "in_progress", "external_ref": "dev-graph:issue-ghost-wip-20260726"},
        {"id": "B4", "status": "closed", "external_ref": "dev-graph:issue-ghost-closed-20260726"},
    ])
    code, receipt = call_main(bridge, monkeypatch, capsys, "--op", "orphan-audit", "--repo-root", tmp_path)
    assert code == 0
    summary = receipt["orphan_summary"]
    # closed も返す。closed を落とすと「棚卸し済み」と「見なかった」を receipt から
    # 区別できず、scope_out が禁じる silent drop と同じ穴になる。
    assert summary["total"] == 3 and summary["non_closed"] == 2
    assert summary["by_status"] == {"closed": 1, "in_progress": 1, "open": 1}
    assert [row["bd_issue_id"] for row in receipt["orphans"]] == ["B4", "B2", "B3"]
    assert receipt["dev_graph_reference_count"] == 4 and receipt["graph_node_count"] == 1


def test_orphan_audit_splits_disposition_by_spec_presence(bridge, audit_rows, monkeypatch, capsys, tmp_path):
    write_repo(tmp_path, ["issue-other-20260726"])
    write_spec(tmp_path, "issues/sys-recoverable-20260726.md", "issue-recoverable-20260726")
    audit_rows.extend([
        {"id": "B1", "status": "open", "external_ref": "dev-graph:issue-recoverable-20260726"},
        {"id": "B2", "status": "open", "external_ref": "dev-graph:issue-bodiless-20260726"},
    ])
    _, receipt = call_main(bridge, monkeypatch, capsys, "--op", "orphan-audit", "--repo-root", tmp_path)
    by_id = {row["bd_issue_id"]: row for row in receipt["orphans"]}
    assert by_id["B1"]["disposition"] == "restore_node"
    assert by_id["B1"]["spec_files"] == ["issues/sys-recoverable-20260726.md"]
    assert by_id["B2"]["disposition"] == "repoint_or_close" and by_id["B2"]["spec_files"] == []
    # by_disposition は ORPHAN_DISPOSITIONS の全札を常に含む。0 件の札を省くと
    # 「該当なし」と「その札が存在しない版で走った」が receipt から区別できない。
    assert receipt["orphan_summary"]["by_disposition"] == {
        "restore_node": 1, "merge_pending": 0, "repoint_or_close": 1,
    }


def test_orphan_audit_ignores_references_outside_dev_graph(bridge, audit_rows, monkeypatch, capsys, tmp_path):
    """`dev-graph:` の無い external_ref は契約 §10 の `external_ref_absent` 側の事象。

    graph 管理外の bd 課題まで orphan として数えると、対処不要のものが対処必要に
    見え、`parity_manifest_missing` の摩耗を別の札へ移し替えるだけになる。
    """
    write_repo(tmp_path, [])
    audit_rows.extend([
        {"id": "B1", "status": "open", "external_ref": "gh:daishiman/HarnessHub#12"},
        {"id": "B2", "status": "open"},
        {"id": "B3", "status": "open", "external_ref": "dev-graph:issue-ghost-20260726"},
    ])
    _, receipt = call_main(bridge, monkeypatch, capsys, "--op", "orphan-audit", "--repo-root", tmp_path)
    assert receipt["dev_graph_reference_count"] == 1
    assert [row["graph_node_id"] for row in receipt["orphans"]] == ["issue-ghost-20260726"]


def test_orphan_audit_keeps_every_spec_that_claims_the_same_node(bridge, audit_rows, monkeypatch, capsys, tmp_path):
    """多重宣言を 1 件へ丸めると、audit が graph 側の整合破れを隠す。"""
    write_repo(tmp_path, [])
    write_spec(tmp_path, "issues/sys-a-20260726.md", "issue-dup-20260726")
    write_spec(tmp_path, "tasks/sys-b-20260726.md", "issue-dup-20260726")
    audit_rows.append({"id": "B1", "status": "open", "external_ref": "dev-graph:issue-dup-20260726"})
    _, receipt = call_main(bridge, monkeypatch, capsys, "--op", "orphan-audit", "--repo-root", tmp_path)
    assert receipt["orphans"][0]["spec_files"] == ["issues/sys-a-20260726.md", "tasks/sys-b-20260726.md"]


# --- 7. MERGE-PENDING: 他 ref に node が在るものを失効扱いしない ----------------


def _fake_refs(bridge, monkeypatch, graph_by_ref: dict[str, list[str]]) -> list[list[str]]:
    """`git for-each-ref` / `git show <ref>:<graph>` を差し替え、走査回数も記録する。"""
    seen: list[list[str]] = []

    def fake_git(args, root, check=True):
        seen.append(list(args))
        if args[0] == "for-each-ref":
            return "\n".join(graph_by_ref)
        if args[0] == "show":
            ref = args[1].split(":", 1)[0]
            if ref not in graph_by_ref:
                return ""
            return json.dumps({"nodes": [{"graph_node_id": n} for n in graph_by_ref[ref]]})
        return ""

    monkeypatch.setattr(bridge, "git", fake_git)
    return seen


def test_orphan_audit_marks_node_present_in_another_ref_as_merge_pending(
    bridge, audit_rows, monkeypatch, capsys, tmp_path,
):
    """未マージブランチに node が在るものは dangling ではない。参照は正しい。

    ここを `repoint_or_close` に落とすと、マージすれば解決する生きた課題を
    「失効」として畳む判断へ誘導する。作業ツリーだけを見る限り両者は同じ
    「node が無い」に見えるため、ref 横断でしか区別できない。
    """
    write_repo(tmp_path, [])
    _fake_refs(bridge, monkeypatch, {
        "refs/heads/main": [],
        "refs/heads/devgraph/feat-x": ["issue-on-branch-20260726"],
    })
    audit_rows.extend([
        {"id": "B1", "status": "open", "external_ref": "dev-graph:issue-on-branch-20260726"},
        {"id": "B2", "status": "open", "external_ref": "dev-graph:issue-nowhere-20260726"},
    ])
    _, receipt = call_main(
        bridge, monkeypatch, capsys, "--op", "orphan-audit", "--repo-root", tmp_path, "--scan-refs",
    )
    by_id = {row["bd_issue_id"]: row for row in receipt["orphans"]}
    assert by_id["B1"]["disposition"] == "merge_pending"
    assert by_id["B1"]["node_in_refs"] == ["refs/heads/devgraph/feat-x"]
    assert by_id["B2"]["disposition"] == "repoint_or_close" and by_id["B2"]["node_in_refs"] == []
    assert receipt["orphan_summary"]["by_disposition"] == {
        "restore_node": 0, "merge_pending": 1, "repoint_or_close": 1,
    }


def test_merge_pending_wins_over_repoint_even_without_local_spec(bridge, audit_rows, monkeypatch, capsys, tmp_path):
    """spec 実体の有無を先に見ると merge_pending が masked される。

    ブランチで node を作った場合、spec markdown もそのブランチ側にあり作業ツリーには
    無い。「spec が無い → repoint_or_close」を先に判定する実装は、この最も普通の
    ケースを丸ごと取り違える。
    """
    write_repo(tmp_path, [])
    _fake_refs(bridge, monkeypatch, {"refs/remotes/origin/feat-y": ["issue-branch-only-20260726"]})
    audit_rows.append({"id": "B1", "status": "open", "external_ref": "dev-graph:issue-branch-only-20260726"})
    _, receipt = call_main(
        bridge, monkeypatch, capsys, "--op", "orphan-audit", "--repo-root", tmp_path, "--scan-refs",
    )
    assert receipt["orphans"][0]["spec_files"] == []
    assert receipt["orphans"][0]["disposition"] == "merge_pending"


def test_merge_pending_wins_when_both_local_spec_and_ref_exist(bridge, audit_rows, monkeypatch, capsys, tmp_path):
    """両方該当するときは「書かない」側へ倒す。

    ここを restore_node にすると、マージで運ばれてくる同じ node を C02 upsert で
    先回りして書くことになり graph.json が衝突する。「待て」は取り消せるが
    「書いた」は取り消しに手間がかかるため、曖昧なら書かない札を選ぶ。
    """
    write_repo(tmp_path, [])
    write_spec(tmp_path, "issues/sys-both-20260726.md", "issue-both-20260726")
    _fake_refs(bridge, monkeypatch, {"refs/heads/feat-w": ["issue-both-20260726"]})
    audit_rows.append({"id": "B1", "status": "open", "external_ref": "dev-graph:issue-both-20260726"})
    _, receipt = call_main(
        bridge, monkeypatch, capsys, "--op", "orphan-audit", "--repo-root", tmp_path, "--scan-refs",
    )
    row = receipt["orphans"][0]
    assert row["spec_files"] == ["issues/sys-both-20260726.md"] and row["node_in_refs"]
    assert row["disposition"] == "merge_pending"


def test_disposition_without_ref_scan_matches_the_pre_scan_behaviour(bridge):
    """refs が空なら走査を足す前の 2 分岐と完全に一致する (既定実行の意味を変えない)。"""
    assert bridge._orphan_disposition(["issues/a.md"], []) == "restore_node"
    assert bridge._orphan_disposition([], []) == "repoint_or_close"


def test_scan_refs_is_opt_in_and_recorded_in_the_receipt(bridge, audit_rows, monkeypatch, capsys, tmp_path):
    """未走査を「他 ref に無いと確認済み」と読ませない。"""
    write_repo(tmp_path, [])
    seen = _fake_refs(bridge, monkeypatch, {"refs/heads/feat-z": ["issue-on-branch-20260726"]})
    audit_rows.append({"id": "B1", "status": "open", "external_ref": "dev-graph:issue-on-branch-20260726"})
    _, receipt = call_main(bridge, monkeypatch, capsys, "--op", "orphan-audit", "--repo-root", tmp_path)
    assert receipt["scanned_refs"] is False
    assert seen == [], "--scan-refs 未指定で git を叩くと、既定実行のコストが読めなくなる"
    assert receipt["orphans"][0]["disposition"] == "repoint_or_close"


def test_ref_scan_reads_each_ref_once(bridge, audit_rows, monkeypatch, capsys, tmp_path):
    """orphan 件数ではなく ref 件数に比例させる (N×M の git 起動を作らない)。"""
    write_repo(tmp_path, [])
    seen = _fake_refs(bridge, monkeypatch, {"refs/heads/a": [], "refs/heads/b": ["issue-1-20260726"]})
    audit_rows.extend([
        {"id": f"B{i}", "status": "open", "external_ref": f"dev-graph:issue-{i}-20260726"}
        for i in range(1, 6)
    ])
    call_main(bridge, monkeypatch, capsys, "--op", "orphan-audit", "--repo-root", tmp_path, "--scan-refs")
    assert [args[0] for args in seen] == ["for-each-ref", "show", "show"]


def test_ref_scan_skips_refs_without_a_readable_graph(bridge, audit_rows, monkeypatch, capsys, tmp_path):
    """graph を持たない/壊れた ref で棚卸し全体を落とさない。"""
    write_repo(tmp_path, [])

    def fake_git(args, root, check=True):
        if args[0] == "for-each-ref":
            return "refs/heads/no-graph\nrefs/heads/broken\nrefs/heads/ok"
        ref = args[1].split(":", 1)[0]
        if ref == "refs/heads/no-graph":
            return ""
        if ref == "refs/heads/broken":
            return "{not json"
        return json.dumps({"nodes": [{"graph_node_id": "issue-ok-20260726"}]})

    monkeypatch.setattr(bridge, "git", fake_git)
    audit_rows.append({"id": "B1", "status": "open", "external_ref": "dev-graph:issue-ok-20260726"})
    _, receipt = call_main(
        bridge, monkeypatch, capsys, "--op", "orphan-audit", "--repo-root", tmp_path, "--scan-refs",
    )
    assert receipt["orphans"][0]["node_in_refs"] == ["refs/heads/ok"]


# --- graph 読み取りの fail-closed --------------------------------------------


@pytest.mark.parametrize(
    "graph,message",
    [
        ({"nodes": {"a": {}}}, "nodes\\[\\] objects"),
        ({"nodes": [{"title": "no id"}]}, "missing graph_node_id"),
    ],
)
def test_graph_node_ids_fails_closed_on_malformed_graph(bridge, tmp_path, graph, message):
    from _common import ContractError

    write_repo(tmp_path, [])
    (tmp_path / ".dev-graph" / "graph.json").write_text(json.dumps(graph))
    with pytest.raises(ContractError, match=message):
        bridge._graph_node_ids(tmp_path)
