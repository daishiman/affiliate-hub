"""`.dev-graph/config.json` の sanctioned writer の契約 (HarnessHub-6in4)。

背景:
  C10 guard は `.dev-graph/config.json` を graph authority として Write/Edit・shell
  redirect・interpreter 書込みのいずれからも守る。ところがこの path を書く sanctioned な
  writer が存在せず、run-dev-graph-init は「guard の Bash 枝が 40 秒級で timeout し
  fail-open する」ことに依存して config を生成していた。guard の窓を閉じると init が
  実行不能になるため、writer をその同じ周回で追加した。

本 test が固定する契約:
  1. 書込先は `<repo-root>/.dev-graph/config.json` に固定される (`--config` は canonical
     一致のみ許可)。writer の write-scope 宣言を呼び手の引数で無効化できないこと。
  2. 検証は「呼出し後に repo へ残る内容」に対して行い、違反時は *書込前* に exit 1 で止まる。
  3. created / unchanged / updated / skipped_existing の 4 遷移が決定論で、同一入力の
     二回目は書込 0 (init の「二回目 planned changes 0」契約の土台)。
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
EXAMPLE = PLUGIN / "templates" / "repo-config.example.json"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

# init が実在まで要求する content_roots の key (SKILL.md の Execution contract と同じ集合)
REQUIRED_ROOTS = ["issues", "tasks", "specifications", "architecture", "features", "documents"]


def load(path: Path, name: str):
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


@pytest.fixture(scope="module")
def writer():
    return load(SCRIPTS / "build-repo-config.py", "dev_graph_build_repo_config")


@pytest.fixture()
def caller_repo(tmp_path: Path) -> Path:
    """content_roots の実ディレクトリを備えた呼び手 repository。"""
    root = tmp_path / "caller"
    root.mkdir()
    for relative in json.loads(EXAMPLE.read_text(encoding="utf-8"))["content_roots"].values():
        (root / relative).mkdir(parents=True, exist_ok=True)
    return root


@pytest.fixture()
def config_document() -> dict:
    document = json.loads(EXAMPLE.read_text(encoding="utf-8"))
    document["repository_id"] = "github:Acme/Demo"
    document["github"]["issue_repository"] = "Acme/Demo"
    return document


def invoke(writer, monkeypatch, capsys, root: Path, document: dict, *extra: str):
    """writer を in-process で 1 回呼び、(exit code, receipt) を返す。"""
    argv = [
        str(SCRIPTS / "build-repo-config.py"),
        "--repo-root", str(root),
        "--stdin",
        "--require-content-roots", *REQUIRED_ROOTS,
        *extra,
    ]
    monkeypatch.setattr(sys, "argv", argv)
    monkeypatch.setattr(sys, "stdin", io.StringIO(json.dumps(document)))
    code = writer.main()
    return code, json.loads(capsys.readouterr().out)


def written_config(root: Path) -> dict:
    return json.loads((root / ".dev-graph" / "config.json").read_text(encoding="utf-8"))


def test_first_call_creates_the_canonical_config(writer, monkeypatch, capsys, caller_repo, config_document):
    code, receipt = invoke(writer, monkeypatch, capsys, caller_repo, config_document)

    assert code == 0
    assert (receipt["action"], receipt["changed"], receipt["valid"]) == ("created", True, True)
    assert Path(receipt["config"]) == (caller_repo / ".dev-graph" / "config.json").resolve()
    assert written_config(caller_repo)["repository_id"] == "github:Acme/Demo"


def test_identical_second_call_is_idempotent(writer, monkeypatch, capsys, caller_repo, config_document):
    """二回目 planned changes 0 を writer 側で保証する (init の受入条件の土台)。"""
    invoke(writer, monkeypatch, capsys, caller_repo, config_document)
    stamp = (caller_repo / ".dev-graph" / "config.json").stat().st_mtime_ns

    code, receipt = invoke(writer, monkeypatch, capsys, caller_repo, config_document)

    assert code == 0
    assert receipt["action"] == "unchanged"
    assert receipt["changed"] is False
    assert (caller_repo / ".dev-graph" / "config.json").stat().st_mtime_ns == stamp


def test_changed_content_replaces_the_document(writer, monkeypatch, capsys, caller_repo, config_document):
    """全置換であって深いマージではない (config は routing authority で正本が 1 つ)。

    深いマージなら既存の 3600 が渡された document の 1800 を上書きして残る。全置換なので
    渡された document が正本になる。section 単位でマージすると「どちらが正本か」が入力
    ごとに変わり、二回目 planned changes 0 の判定が入力履歴に依存してしまう。
    """
    existing = json.loads(json.dumps(config_document))
    existing["worktrees"]["lease_ttl_seconds"] = 3600
    invoke(writer, monkeypatch, capsys, caller_repo, existing)
    assert written_config(caller_repo)["worktrees"]["lease_ttl_seconds"] == 3600

    code, receipt = invoke(writer, monkeypatch, capsys, caller_repo, config_document)

    assert code == 0
    assert (receipt["action"], receipt["changed"]) == ("updated", True)
    assert written_config(caller_repo)["worktrees"]["lease_ttl_seconds"] == 1800


def test_if_absent_preserves_a_user_edited_config(writer, monkeypatch, capsys, caller_repo, config_document):
    """scaffold 経路。init の「利用者編集済み成果物の上書 0」契約はここで満たす。"""
    invoke(writer, monkeypatch, capsys, caller_repo, config_document)
    edited = json.loads(json.dumps(config_document))
    edited["worktrees"]["lease_ttl_seconds"] = 3600
    invoke(writer, monkeypatch, capsys, caller_repo, edited)

    incoming = json.loads(json.dumps(config_document))
    incoming["worktrees"]["lease_ttl_seconds"] = 900
    code, receipt = invoke(writer, monkeypatch, capsys, caller_repo, incoming, "--if-absent")

    assert code == 0
    assert (receipt["action"], receipt["changed"]) == ("skipped_existing", False)
    assert written_config(caller_repo)["worktrees"]["lease_ttl_seconds"] == 3600


def test_dry_run_reports_the_decision_without_writing(writer, monkeypatch, capsys, caller_repo, config_document):
    code, receipt = invoke(writer, monkeypatch, capsys, caller_repo, config_document, "--dry-run")

    assert code == 0
    assert (receipt["action"], receipt["changed"], receipt["dry_run"]) == ("created", False, True)
    assert not (caller_repo / ".dev-graph" / "config.json").exists()


@pytest.mark.parametrize(
    ("mutate", "expected_code"),
    [
        # schema 違反: repository_id が `host:owner/repo` 形式でない
        (lambda d: d.__setitem__("repository_id", "not-a-valid-id"), "schema"),
        # 秘密材料: token 様の文字列を repo-local へ落とさない
        (lambda d: d["github"]["projects"][0].__setitem__("owner_login", "ghp_deadbeefdeadbeefdead"), "secret"),
    ],
)
def test_violations_stop_before_any_write(
    writer, monkeypatch, capsys, caller_repo, config_document, mutate, expected_code,
):
    mutate(config_document)

    code, receipt = invoke(writer, monkeypatch, capsys, caller_repo, config_document)

    assert code == 1
    assert receipt["action"] == "rejected"
    assert receipt["valid"] is False
    assert receipt["violations"], "違反理由を receipt へ残さずに拒否してはならない"
    assert not (caller_repo / ".dev-graph" / "config.json").exists(), "拒否したのに部分書込が起きている"


def test_missing_content_root_is_rejected(writer, monkeypatch, capsys, caller_repo, config_document):
    """content_roots は宣言だけでなく実在まで要求する (init が渡す 6 key)。"""
    (caller_repo / "issues").rmdir()

    code, receipt = invoke(writer, monkeypatch, capsys, caller_repo, config_document)

    assert code == 1
    assert receipt["action"] == "rejected"
    assert not (caller_repo / ".dev-graph" / "config.json").exists()


def test_existing_invalid_config_is_rejected_even_under_if_absent(
    writer, monkeypatch, capsys, caller_repo, config_document,
):
    """検証対象は「呼出し後に repo へ残る内容」。保全する既存側も検証をすり抜けない。"""
    target = caller_repo / ".dev-graph" / "config.json"
    target.parent.mkdir(parents=True)
    stale = json.loads(json.dumps(config_document))
    stale["repository_id"] = "not-a-valid-id"
    target.write_text(json.dumps(stale), encoding="utf-8")

    code, receipt = invoke(writer, monkeypatch, capsys, caller_repo, config_document, "--if-absent")

    assert code == 1
    assert receipt["action"] == "rejected"
    assert written_config(caller_repo)["repository_id"] == "not-a-valid-id", "拒否時に書込んでいる"


@pytest.mark.parametrize(
    "explicit",
    [".dev-graph/elsewhere.json", "config.json", "../outside/.dev-graph/config.json"],
)
def test_non_canonical_config_path_is_a_contract_error(
    writer, monkeypatch, capsys, caller_repo, config_document, explicit,
):
    """`--config` を任意 path として受けると write-scope 宣言が実効性を失う。

    guard は Bash のコマンド文字列しか見ないため、writer 内部で宣言外へ書く逸脱は
    誰も止められない。canonical 一致だけを許すことで宣言と実装を一致させる。
    """
    with pytest.raises(writer.ContractError):
        invoke(writer, monkeypatch, capsys, caller_repo, config_document, "--config", explicit)


def test_write_scope_declaration_names_only_the_repo_local_config(writer):
    """header の write-scope 宣言そのものを固定する (受入条件 2 の機械化)。"""
    header = Path(writer.__file__).read_text(encoding="utf-8").split('"""', 1)[0]
    scope = [line for line in header.splitlines() if line.startswith("# write-scope:")]
    assert scope == ["# write-scope: the caller repository .dev-graph/config.json only"]
