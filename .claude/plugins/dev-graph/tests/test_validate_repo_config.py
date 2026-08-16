"""validate-repo-config.py が「init が生成した config」を実際に落とせることを固定する。

背景 (HarnessHub-sgt):
  run-dev-graph-init の Execution contract 5 は生成した config の schema 検証を
  要求するが、そこで呼ばれる validate-graph-schema.py は graph node しか見ない。
  test_repo_config_schema_conformance.py は *plugin 同梱テンプレート* と
  *この repository 自身の config* しか読まないため、呼出し元 repository へ
  書き出された config はどの決定論 script でも検査されていなかった。

  本 test は「合格する config が通る」だけでなく **壊した config が確実に落ちる**
  ことを検査する。前者だけを固定すると、検査を素通りさせる実装 (常に valid を返す
  script) でも緑になり、ゲートとして機能しない。
"""
from __future__ import annotations

import builtins
import importlib.util
import json
import subprocess
import sys
from pathlib import Path

import pytest

PLUGIN = Path(__file__).resolve().parents[1]
REPO = PLUGIN.parents[1]
SCRIPTS = PLUGIN / "scripts"
SCRIPT = SCRIPTS / "validate-repo-config.py"
TEMPLATE_PATH = PLUGIN / "templates" / "repo-config.example.json"
REPO_CONFIG_PATH = REPO / ".dev-graph" / "config.json"
INIT_SKILL_PATH = PLUGIN / "skills" / "run-dev-graph-init" / "SKILL.md"
INIT_REFERENCE_PATH = (
    PLUGIN / "skills" / "run-dev-graph-init" / "references" / "validation-contract.md"
)
# run-dev-graph-init が生成契約として持つ content root。schema required は 7 key だが
# `system_spec` は run-dev-graph-system-spec の責務なので init の実在要求には含めない。
INIT_ROOTS = ["issues", "tasks", "specifications", "architecture", "features", "documents"]
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))


def load():
    name = "validate_repo_config_under_test"
    spec = importlib.util.spec_from_file_location(name, SCRIPT)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def codes(findings: list[dict[str, str]]) -> set[str]:
    return {item["code"] for item in findings}


@pytest.fixture(scope="module")
def mod():
    return load()


@pytest.fixture
def config() -> dict:
    """plugin 同梱の正本テンプレート。各 test はこれを壊して期待違反を作る。"""
    return json.loads(TEMPLATE_PATH.read_text(encoding="utf-8"))


@pytest.fixture
def repo(tmp_path: Path) -> Path:
    root = tmp_path / "caller-repo"
    (root / ".dev-graph").mkdir(parents=True)
    return root


def write_config(repo: Path, config: dict) -> Path:
    path = repo / ".dev-graph" / "config.json"
    path.write_text(json.dumps(config, ensure_ascii=False), encoding="utf-8")
    return path


def run_cli(config_path: Path, *args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(SCRIPT), "--config", str(config_path), *args],
        capture_output=True,
        text=True,
    )


def test_canonical_assets_pass(mod, config: dict) -> None:
    """正本テンプレートと実運用 config が script 経由で通る。"""
    assert mod.validate(config) == []
    if REPO_CONFIG_PATH.is_file():
        live = json.loads(REPO_CONFIG_PATH.read_text(encoding="utf-8"))
        assert mod.validate(live, repo_root=REPO) == []


def test_missing_content_root_is_reported_as_missing_section(mod, config: dict) -> None:
    """content_roots.features 欠落 (実際に起きた drift) が missing_sections に載る。"""
    del config["content_roots"]["features"]
    violations = mod.validate(config)
    assert "schema_violation" in codes(violations)
    assert any("features" in item["detail"] for item in violations)


def test_unknown_section_is_rejected(mod, config: dict) -> None:
    """additionalProperties:false を素通りさせない (token 置き場の新設を封鎖)。"""
    config["github_token"] = "ghp_0123456789abcdef0123456789abcdef0123"
    assert "schema_violation" in codes(mod.validate(config))


def test_duplicate_declared_path_is_rejected(mod, config: dict) -> None:
    """2 つの content root が同一 path を指すと routing が破綻する。"""
    config["content_roots"]["tasks"] = config["content_roots"]["issues"]
    violations = mod.validate(config)
    assert "declared_path_collision" in codes(violations)


def test_nested_declared_paths_are_allowed(mod, config: dict) -> None:
    """入れ子は正当。plan_roots.state は local_state.graph の祖先である (回帰防止)。"""
    config["plan_roots"] = {
        "staging": ".dev-graph/staging",
        "published": ".dev-graph/plans",
        "state": ".dev-graph/state",
    }
    config["local_state"]["graph"] = ".dev-graph/state/graph.json"
    assert mod.validate(config) == []


@pytest.mark.parametrize("value", ["/absolute/issues", "../outside-issues"])
def test_non_repo_relative_path_is_rejected(mod, config: dict, value: str) -> None:
    config["content_roots"]["issues"] = value
    assert "path_not_repo_relative" in codes(mod.validate(config))


def test_symlinked_content_root_escaping_repository_is_rejected(
    mod, config: dict, repo: Path, tmp_path: Path
) -> None:
    """文字列は repo-relative でも realpath が repo 外なら path_policy 違反。

    schema の pattern は文字列しか見ないため、この経路は schema では塞げない。
    """
    outside = tmp_path / "outside-repository"
    outside.mkdir()
    (repo / "issues").symlink_to(outside, target_is_directory=True)
    violations = mod.validate(config, repo_root=repo)
    assert "path_escapes_repository" in codes(violations)
    assert any(item["location"] == "content_roots.issues" for item in violations)


def test_content_root_existence_is_opt_in(mod, config: dict, repo: Path) -> None:
    """既定では実在を要求しない (init 前の config も検証対象)。"""
    assert mod.validate(config, repo_root=repo) == []
    violations = mod.validate(config, repo_root=repo, required_content_roots=INIT_ROOTS)
    assert codes(violations) == {"content_root_missing"}
    assert len(violations) == len(INIT_ROOTS)


def test_existence_requirement_is_scoped_to_the_named_keys(mod, config: dict, repo: Path) -> None:
    """呼び手が作らない root を実在要求しない。

    回帰対象: 「宣言された content_roots 全件」を暗黙要求すると、schema required
    7 key の `system_spec` (run-dev-graph-system-spec の責務) まで巻き込み、
    6 root を作る run-dev-graph-init が正常完了しても恒久 FAIL になる。
    """
    assert "system_spec" in config["content_roots"]
    assert "system_spec" not in INIT_ROOTS
    for key in INIT_ROOTS:
        (repo / config["content_roots"][key]).mkdir(parents=True, exist_ok=True)
    assert mod.validate(config, repo_root=repo, required_content_roots=INIT_ROOTS) == []

    widened = mod.validate(config, repo_root=repo, required_content_roots=[*INIT_ROOTS, "system_spec"])
    assert [item["location"] for item in widened] == ["content_roots.system_spec"]


def test_unknown_required_key_is_reported(mod, config: dict, repo: Path) -> None:
    """存在しない key の実在要求は黙って無視せず契約ミスとして報告する。"""
    violations = mod.validate(config, repo_root=repo, required_content_roots=["not_a_root"])
    assert codes(violations) == {"content_root_key_unknown"}
    assert violations[0]["location"] == "content_roots.not_a_root"


def test_created_content_roots_satisfy_the_flag(mod, config: dict, repo: Path) -> None:
    for value in config["content_roots"].values():
        (repo / value).mkdir(parents=True, exist_ok=True)
    keys = sorted(config["content_roots"])
    assert mod.validate(config, repo_root=repo, required_content_roots=keys) == []


@pytest.fixture
def project_hooks(config: dict) -> dict:
    """hook fallback を使う唯一のモード。ここでだけ link の実体が契約になる。"""
    config["claude_hooks"]["source"] = "project"
    return config


def hook_link(repo: Path, config: dict) -> Path:
    return repo / config["claude_hooks"]["project_plugin_link"]


def test_project_source_requires_the_link_key(mod, project_hooks: dict) -> None:
    """source=project で key ごと欠けたら schema 層が落とす (条件付き required)。"""
    del project_hooks["claude_hooks"]["project_plugin_link"]
    violations = mod.validate(project_hooks)
    assert "schema_violation" in codes(violations)
    assert any("project_plugin_link" in item["detail"] for item in violations)


@pytest.mark.parametrize("source", ["plugin", "disabled"])
def test_unused_link_key_is_optional(mod, config: dict, source: str) -> None:
    """link を読まないモードは未使用 path の宣言を強制されない。

    無条件 required だった頃は plugin/disabled の repo が「使わないのに書かされる」path を
    持ち、その値が正しいか誰も検査しないという状態を生んでいた (HarnessHub-7tn1)。
    """
    config["claude_hooks"]["source"] = source
    del config["claude_hooks"]["project_plugin_link"]
    assert mod.validate(config) == []


def test_project_source_with_absent_link_is_rejected(mod, project_hooks: dict, repo: Path) -> None:
    """受入条件 1: source=project かつ link 不在の config が違反を出す。"""
    violations = mod.validate(project_hooks, repo_root=repo)
    assert [item["location"] for item in violations] == [mod.HOOK_LINK_LOCATION]
    assert violations[0]["code"].startswith("project_plugin_link")


def test_project_source_with_real_directory_is_rejected(
    mod, project_hooks: dict, repo: Path
) -> None:
    """plain symlink でなく実ディレクトリを置いた config は落ちる。

    R5-hooks の責務境界は fallback を「plain-symlink かつ effective plugin hook 不在時のみ」
    に限る。実体コピーを許すと plugin 更新が link 先へ伝播せず、hook が古い経路を指し続ける。
    """
    hook_link(repo, project_hooks).mkdir(parents=True)
    violations = mod.validate(project_hooks, repo_root=repo)
    assert [item["location"] for item in violations] == [mod.HOOK_LINK_LOCATION]
    assert violations[0]["code"].startswith("project_plugin_link")


def test_project_source_with_plain_symlink_passes(
    mod, project_hooks: dict, repo: Path, tmp_path: Path
) -> None:
    """正常形: repo 外の共有 plugin root への plain symlink は通る。

    plugin root が repo 外にあるのは正常な配布形態である。content path と同じ realpath
    containment をここへかけると project モードが原理的に成立しなくなるため、
    path 層は link を content path と別扱いにしている。
    """
    plugin_root = tmp_path / "shared-plugin-root"
    (plugin_root / "hooks").mkdir(parents=True)
    link = hook_link(repo, project_hooks)
    link.parent.mkdir(parents=True, exist_ok=True)
    link.symlink_to(plugin_root, target_is_directory=True)
    assert mod.validate(project_hooks, repo_root=repo) == []


def test_project_source_with_dangling_symlink_is_rejected(
    mod, project_hooks: dict, repo: Path, tmp_path: Path
) -> None:
    """symlink は在るが解決先が無い config は落ちる。

    fallback は link 越しに plugin root の hooks を読むので、dangling link では read が
    成立しない。`exists()` は link を解決するため不在と区別が付かず、この経路は
    `is_symlink()` を先に見ないと `absent` へ誤分類される。
    """
    link = hook_link(repo, project_hooks)
    link.parent.mkdir(parents=True, exist_ok=True)
    link.symlink_to(tmp_path / "never-created", target_is_directory=True)
    violations = mod.validate(project_hooks, repo_root=repo)
    assert [item["code"] for item in violations] == ["project_plugin_link_broken"]


def test_project_source_with_symlink_to_file_is_rejected(
    mod, project_hooks: dict, repo: Path, tmp_path: Path
) -> None:
    """plugin root は directory である。file への symlink は hooks を辿れない。"""
    target = tmp_path / "not-a-plugin-root"
    target.write_text("", encoding="utf-8")
    link = hook_link(repo, project_hooks)
    link.parent.mkdir(parents=True, exist_ok=True)
    link.symlink_to(target)
    violations = mod.validate(project_hooks, repo_root=repo)
    assert [item["code"] for item in violations] == ["project_plugin_link_not_directory"]


def test_multi_hop_symlink_passes(
    mod, project_hooks: dict, repo: Path, tmp_path: Path
) -> None:
    """段数は fallback の成否と無関係なので symlink of symlink を落とさない。

    plugin の配布形態が package manager 経由の多段 link になることがある。段数で落とすと
    正常な配布を検証が拒否する。
    """
    plugin_root = tmp_path / "shared-plugin-root"
    (plugin_root / "hooks").mkdir(parents=True)
    hop = tmp_path / "hop"
    hop.symlink_to(plugin_root, target_is_directory=True)
    link = hook_link(repo, project_hooks)
    link.parent.mkdir(parents=True, exist_ok=True)
    link.symlink_to(hop, target_is_directory=True)
    assert mod.validate(project_hooks, repo_root=repo) == []


@pytest.mark.parametrize("source", ["plugin", "disabled"])
def test_unused_link_existence_is_not_required(mod, config: dict, repo: Path, source: str) -> None:
    """受入条件 2 の回帰防止: 現行運用 (source=plugin) は link 実体を持たない。"""
    config["claude_hooks"]["source"] = source
    assert mod.validate(config, repo_root=repo) == []


def test_hook_link_finding_does_not_leak_absolute_paths(
    mod, project_hooks: dict, repo: Path
) -> None:
    """report は eval-log へ残る。環境固有の絶対 path を成果物へ保存しない。"""
    violations = mod.validate(project_hooks, repo_root=repo)
    assert violations
    assert all(str(repo) not in json.dumps(item, ensure_ascii=False) for item in violations)


def test_declared_link_still_shares_the_common_path_checks(mod, project_hooks: dict) -> None:
    """content 扱いを外しても repo-relative 性と宣言重複の共通検査は効き続ける。"""
    project_hooks["claude_hooks"]["project_plugin_link"] = "../outside-plugin"
    assert "path_not_repo_relative" in codes(mod.validate(project_hooks))


def test_cli_fails_closed_on_absent_project_link(repo: Path, config: dict) -> None:
    """受入条件 1 を CLI の exit code で固定する。"""
    config["claude_hooks"]["source"] = "project"
    result = run_cli(write_config(repo, config))
    assert result.returncode == 1
    report = json.loads(result.stdout)
    assert report["valid"] is False
    assert any(
        item["location"] == "claude_hooks.project_plugin_link" for item in report["violations"]
    )


def test_fallback_validator_agrees_on_the_conditional_link_requirement(
    mod, project_hooks: dict, monkeypatch
) -> None:
    """jsonschema 不在環境でも条件付き required が同じ判定になる。

    fallback は `if` の中身を素の schema として評価するため、`if` に `required: [source]` が
    無いと source 未宣言の config で then が誤って適用される。その差分を固定する。
    """
    del project_hooks["claude_hooks"]["project_plugin_link"]
    with_library = codes(mod.validate(project_hooks))
    assert "schema_violation" in with_library

    real_import = builtins.__import__

    def without_jsonschema(name, *args, **kwargs):
        if name == "jsonschema":
            raise ImportError("deterministic fallback exercise")
        return real_import(name, *args, **kwargs)

    monkeypatch.setattr(builtins, "__import__", without_jsonschema)
    assert codes(mod.validate(project_hooks)) == with_library


@pytest.mark.parametrize(
    ("location", "value"),
    [
        ("issue_repository", "ghp_0123456789abcdef0123456789abcdef0123"),
        ("issue_repository", "github_pat_11ABCDEFG0123456789_abcdefghij"),
    ],
)
def test_token_material_is_rejected(mod, config: dict, location: str, value: str) -> None:
    config["github"][location] = value
    violations = mod.validate(config)
    assert "secret_material" in codes(violations)


def test_project_node_id_is_rejected(mod, config: dict) -> None:
    """criteria:OUT4 が禁じる project/item/field node ID を既知キーの値でも落とす。"""
    config["github"]["projects"][0]["field_mappings"][0]["project_field_name"] = "PVTSSF_lADOABC"
    violations = mod.validate(config)
    assert "secret_material" in codes(violations)
    assert any("field_mappings[0].project_field_name" in item["location"] for item in violations)


def test_secret_report_does_not_echo_the_value(mod, config: dict) -> None:
    """report は eval-log へ残る。秘密の二次保管場所にしない。"""
    secret = "ghp_0123456789abcdef0123456789abcdef0123"
    config["github"]["projects"][0]["owner_login"] = secret
    violations = mod.validate(config)
    assert "secret_material" in codes(violations)
    assert all(secret not in json.dumps(item, ensure_ascii=False) for item in violations)


def test_ordinary_github_values_are_not_flagged(mod, config: dict) -> None:
    """誤検知回帰: option_map ラベルや owner_login は秘密ではない。"""
    assert mod.secret_findings(config) == []
    config["github"]["projects"][0]["field_mappings"][0]["option_map"] = {
        "active": "In Progress",
        "blocked": "Blocked",
    }
    assert mod.secret_findings(config) == []


def test_github_strings_enumeration_is_deterministic(mod, config: dict) -> None:
    assert mod.github_strings(config) == mod.github_strings(config)
    assert ("github.issue_repository", config["github"]["issue_repository"]) in mod.github_strings(config)


def test_fallback_validator_agrees_with_jsonschema(mod, config: dict, monkeypatch) -> None:
    """jsonschema 不在環境でも同じ違反を検出する (zero-dependency 契約)。"""
    del config["content_roots"]["features"]
    with_library = codes(mod.validate(config))

    real_import = builtins.__import__

    def without_jsonschema(name, *args, **kwargs):
        if name == "jsonschema":
            raise ImportError("deterministic fallback exercise")
        return real_import(name, *args, **kwargs)

    monkeypatch.setattr(builtins, "__import__", without_jsonschema)
    assert codes(mod.validate(config)) == with_library


def test_cli_reports_valid_config(repo: Path, config: dict) -> None:
    result = run_cli(write_config(repo, config))
    assert result.returncode == 0, result.stderr
    report = json.loads(result.stdout)
    assert report["valid"] is True
    assert report["violations"] == []
    assert report["repository_id"] == config["repository_id"]


def test_cli_fails_closed_on_violation(repo: Path, config: dict) -> None:
    del config["content_roots"]["features"]
    result = run_cli(write_config(repo, config))
    assert result.returncode == 1
    report = json.loads(result.stdout)
    assert report["valid"] is False
    assert report["missing_sections"]


def test_cli_rejects_config_outside_the_canonical_tree(tmp_path: Path, config: dict) -> None:
    """--repo-root 無しで .dev-graph 外の config を渡したら contract error (exit 2)。"""
    stray = tmp_path / "config.json"
    stray.write_text(json.dumps(config), encoding="utf-8")
    result = run_cli(stray)
    assert result.returncode == 2
    assert "--repo-root" in result.stderr


def test_skill_command_requires_exactly_the_init_roots() -> None:
    """SKILL.md の実行コマンドと INIT_ROOTS の乖離を落とす。

    本 test の実質は doc↔behavior 整合の固定である。SKILL.md 側の key 列挙だけが
    増減すると、上の実在検査 test 群は緑のまま init だけが壊れる。
    """
    lines = [
        line
        for line in INIT_SKILL_PATH.read_text(encoding="utf-8").splitlines()
        if "--require-content-roots " in line
    ]
    invocations = [line.partition("--require-content-roots ")[2].split() for line in lines]
    executable = [keys for keys in invocations if not keys[0].startswith("<")]
    # 実行可能なコマンドが 1 本も無い状態を空真で通さない。この test の本命は
    # 「bash ブロックごと消える」経路の防御であり、placeholder 行だけが残っても落とす。
    assert executable, "SKILL.md に実行可能な --require-content-roots コマンドが無い"
    assert all(keys == INIT_ROOTS for keys in executable)


def test_reference_contract_lists_exactly_the_init_roots() -> None:
    """references/validation-contract.md の root 列挙と INIT_ROOTS の乖離を落とす。

    Execution contract 5 の詳細を references/ へ退避したことで、root 一覧の宣言箇所が
    「SKILL.md の実行コマンド」と「本 reference」の 2 つになった。片方だけ更新されると
    実行は 6 root なのに説明は別の集合、という食い違いが静かに残る。
    """
    text = INIT_REFERENCE_PATH.read_text(encoding="utf-8")
    listings = [line for line in text.splitlines() if line.split() == INIT_ROOTS]
    assert len(listings) == 1, f"root 一覧の宣言は過不足なく 1 箇所 (found {len(listings)})"
    # 「なぜ 7 番目を要求しないか」の根拠が本文から消えると、次の編集者が全件要求へ戻す。
    assert "system_spec" in text


def _idempotence_claim_sites() -> dict[str, bool]:
    """「二回目 init の変更が 0」を主張している SKILL.md の区画を返す。

    6 root は `--require-content-roots` の実行コマンドという機械 pin を持つのに対し、
    冪等性の主張は 4 区画に散在したまま pin が無い。1 箇所だけ削られても他の 3 箇所が
    残るため、契約が痩せたことに誰も気づかない (独立 content-review 2 者が一致して
    `[low/smell]` として指摘)。
    """
    lines = INIT_SKILL_PATH.read_text(encoding="utf-8").splitlines()
    frontmatter_end = lines.index("---", 1)
    bounds = {
        "frontmatter:acceptance_criteria": (1, frontmatter_end),
        "## Execution contract": None,
        "### 完了チェックリスト": None,
        "## Criteria acceptance": None,
    }
    for heading in [key for key, value in bounds.items() if value is None]:
        start = next(i for i, line in enumerate(lines) if line.strip() == heading)
        depth = len(heading) - len(heading.lstrip("#"))
        end = next(
            (
                i
                for i in range(start + 1, len(lines))
                if lines[i].startswith("#")
                and len(lines[i]) - len(lines[i].lstrip("#")) <= depth
            ),
            len(lines),
        )
        bounds[heading] = (start, end)
    return {
        label: any("二回目" in lines[i] for i in range(start, end))
        for label, (start, end) in bounds.items()
    }


def test_idempotence_claim_is_declared_in_every_contract_site() -> None:
    """冪等性の主張が 4 区画から欠けたら落とす。

    `_idempotence_claim_sites()` は区画ラベル -> 主張の有無 を返す。
    """
    sites = _idempotence_claim_sites()
    missing = sorted(label for label, declared in sites.items() if not declared)
    assert not missing, f"二回目 init の変更 0 契約が欠落: {missing}"


def test_cli_accepts_explicit_repo_root(tmp_path: Path, config: dict) -> None:
    stray = tmp_path / "config.json"
    stray.write_text(json.dumps(config), encoding="utf-8")
    result = run_cli(stray, "--repo-root", str(tmp_path))
    assert result.returncode == 0, result.stderr
