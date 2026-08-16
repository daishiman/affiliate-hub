#!/usr/bin/env python3
# /// script
# name: validate-repo-config
# purpose: Validate a caller-repository .dev-graph/config.json against repo-config.schema.json plus the path and secret invariants the schema cannot express.
# inputs: ["argv: --config FILE [--repo-root PATH] [--require-content-roots KEY ...]"]
# outputs: ["stdout: JSON validation report", "exit: 0=valid / 1=violation / 2=contract error"]
# requires-python = ">=3.10"
# dependencies: []
# contexts: [A, C, E]
# network: false
# write-scope: none
# ///
"""run-dev-graph-init が生成した repo-local config を決定論的に検証する。

背景 (HarnessHub-sgt):
  `run-dev-graph-init` の Execution contract 5 は「生成した config を
  repo-config.schema.json で検証する」ことを要求するが、そこで呼ばれる
  validate-graph-schema.py は **graph node しか見ない**。config を検査する経路は
  tests/test_repo_config_schema_conformance.py だけで、これは
  *plugin 同梱テンプレート* と *この repository 自身の config* しか読まない。
  つまり init が呼出し元 repository へ書き出した config は、どの決定論 script でも
  検査されず、実行者が jsonschema を都度手書きするしかなかった。

  本 script はその入口を独立ファイルとして与える。validate-graph-schema.py へ
  `--config` を足さないのは意図的で、理由は validate-receipt.py と同じ:
  script_ref の behavior closure は **file 単位の digest** なので、
  validate-graph-schema.py を 1 byte 触ると、それを script_refs に宣言する
  6 skill (init/node/decompose/render/requirements/status) の live-trial 証跡が
  まとめて失効する。検証入口を分ければ失効は init 1 件に閉じる。

検査は 3 層。
  1. schema 適合 (repo-config.schema.json)
  2. schema が表現できない path 不変条件 (repo 外脱出・宣言重複・root 実在)
  3. path_policy / GitHub 契約の秘密材料混入 (token・GitHub node ID)

2 は「schema の pattern は *文字列* しか見ない」ため必要になる。`issues` という
repo-relative 文字列は pattern を通るが、その実体が repo 外を指す symlink なら
path_policy.allow_outside_repository=false 契約に違反する。realpath 解決は
文字列検査では代替できない。

3 の実在要求は key の明示列挙で受ける。「宣言された content_roots 全件」を暗黙の
既定にしないのは、schema の required 7 key と *各 skill の生成契約* が一致しないため
(init は 6 root を作り、`system_spec` は run-dev-graph-system-spec の責務)。

Usage:
  validate-repo-config.py --config .dev-graph/config.json [--repo-root PATH]
                          [--require-content-roots KEY ...]
"""
from __future__ import annotations

import argparse
import importlib.util
import sys
from pathlib import Path, PurePosixPath
from typing import Any, Iterator, Sequence

HERE = Path(__file__).resolve().parent
PLUGIN_ROOT = HERE.parent
SCHEMA_PATH = PLUGIN_ROOT / "schemas" / "repo-config.schema.json"

sys.path.insert(0, str(HERE))
from _common import ContractError, contained, dump, load_json  # noqa: E402

# Draft 2020-12 の決定論 fallback validator の SSOT は validate-graph-schema.py 側にある。
# ハイフン名は通常 import できないため importlib で借用する (validate-receipt.py と同じ流儀)。
# main() は __main__ ガード内にあり import 時副作用は無い。
_spec = importlib.util.spec_from_file_location(
    "_dev_graph_graph_schema_validator", HERE / "validate-graph-schema.py"
)
assert _spec and _spec.loader
_vgs = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_vgs)
_schema_fallback = _vgs._schema_fallback

# repo-relative path を宣言するセクション。plan_roots は system-dev-planner が足す任意
# セクションだが、同じ config を共有する以上 containment 契約は等しく効かせる。
PATH_SECTIONS = ("content_roots", "local_state", "plan_roots")

# claude_hooks.project_plugin_link は path 宣言だが content path ではない。
# repo-relative 性と宣言重複は他の path と同じ扱いにし、realpath containment と
# 実在検査だけを hook_link_findings() へ分岐させる (理由は同関数の docstring)。
HOOK_LINK_LOCATION = "claude_hooks.project_plugin_link"

# criteria:OUT4 が config への保存を禁じる秘密材料の実在プレフィックス。
# 判定を prefix 完全一致に限るのは意図的で、長さやエントロピーで測ると
# option_map の "In Progress" のような正常値を落とし、かつ判定が非決定論になる
# (この script は「決定論で検証できる入口」を与えるために存在する)。
SECRET_PREFIXES = (
    "ghp_",  # classic personal access token
    "gho_",  # OAuth token
    "ghu_",  # user-to-server token
    "ghs_",  # server-to-server token
    "ghr_",  # refresh token
    "github_pat_",  # fine-grained personal access token
    "PVT_",  # Projects v2 node ID
    "PVTI_",  # Projects v2 item node ID
    "PVTF_",  # Projects v2 field node ID
    "PVTSSF_",  # Projects v2 single-select field node ID
)


def _schema_violations(document: Any, schema: dict[str, Any]) -> list[dict[str, str]]:
    """jsonschema があれば正式 validator、無ければ決定論 fallback で検証する。"""
    try:
        from jsonschema import Draft202012Validator, FormatChecker  # type: ignore
    except ImportError:
        raw = _schema_fallback(document, schema, schema)
    else:
        try:
            Draft202012Validator.check_schema(schema)
        except Exception as exc:  # noqa: BLE001 - schema 自体の破損は契約違反として扱う
            raise ContractError(f"invalid repo config schema {SCHEMA_PATH}: {exc}") from exc
        validator = Draft202012Validator(schema, format_checker=FormatChecker())
        raw = [
            (
                "$"
                + "".join(
                    f"[{part}]" if isinstance(part, int) else f".{part}"
                    for part in error.absolute_path
                ),
                error.message,
            )
            for error in sorted(
                validator.iter_errors(document),
                key=lambda err: (tuple(str(part) for part in err.absolute_path), err.message),
            )
        ]
    return [
        {"location": location, "code": "schema_violation", "detail": detail}
        for location, detail in raw
    ]


def declared_paths(config: dict[str, Any]) -> list[tuple[str, str]]:
    """config が宣言する repo-relative path を (location, value) で列挙する。"""
    pairs: list[tuple[str, str]] = []
    for section in PATH_SECTIONS:
        values = config.get(section)
        if isinstance(values, dict):
            pairs.extend(
                (f"{section}.{key}", value)
                for key, value in sorted(values.items())
                if isinstance(value, str)
            )
    hooks = config.get("claude_hooks")
    link = hooks.get("project_plugin_link") if isinstance(hooks, dict) else None
    if isinstance(link, str):
        pairs.append((HOOK_LINK_LOCATION, link))
    return pairs


def hook_link_findings(config: dict[str, Any], value: str, link_path: Path) -> list[dict[str, str]]:
    """source=project のとき project_plugin_link が hook fallback の前提を満たすか検査する。

    R5-hooks の責務境界は「fallback は plain-symlink かつ effective plugin hook 不在時のみ
    許可」と書くが、そのうち **link が実在し plain symlink である** という前提は、どの決定論
    経路にも落ちていなかった。schema の pattern は文字列しか見ないため、fallback が黙って
    成立しない config が exit 0 で通る (HarnessHub-7tn1)。

    source が plugin / disabled のときは link 値そのものが使われないので検査しない。schema 側も
    同じ条件で required を切り替えており、層の責務は「schema=key の有無」「ここ=実体の性質」に
    分かれる。

    detail へ絶対 path を載せない。receipt と eval-log へ残る出力に環境固有の絶対 path を
    保存しない契約 (R5-hooks Layer 3) があるため、repo-relative の宣言値だけを出す。

    「plain symlink」を *symlink であり解決先が実在する directory* と定義する。R5-hooks の
    fallback は link 越しに plugin root の hooks を読むため、実体コピー (directory) を許すと
    plugin 更新が伝播せず hook が古い経路を指し続ける。dangling / 非 directory は link 越しの
    read がそもそも成立しない。symlink の段数 (symlink of symlink) は落とさない: plugin の
    配布形態が package manager 経由の多段 link になることがあり、段数は fallback の成否と
    無関係だからである。

    Args:
        config: 検証対象の repo-local config 全体。
        value: config が宣言した repo-relative の link 値 (detail 用)。
        link_path: repo_root と結合した実 path。symlink は解決しない。

    Returns:
        findings: [{"location": HOOK_LINK_LOCATION, "code": ..., "detail": ...}]
        code は `project_plugin_link_` 接頭辞つきの 4 値
        (`absent` / `not_symlink` / `broken` / `not_directory`)。
    """
    hooks = config.get("claude_hooks")
    source = hooks.get("source") if isinstance(hooks, dict) else None
    if source != "project":
        return []

    def finding(code: str, reason: str) -> list[dict[str, str]]:
        return [
            {
                "location": HOOK_LINK_LOCATION,
                "code": f"project_plugin_link_{code}",
                # 宣言値だけを出す (絶対 path を成果物へ残さない契約)。
                "detail": f"{value} {reason} (source=project は hook fallback の実体を要求する)",
            }
        ]

    # is_symlink() を exists() より先に見る。exists() は link を解決するため、dangling link を
    # 「不在」と誤分類し、直すべき対象 (link 先) を報告から落としてしまう。
    if not link_path.is_symlink():
        if link_path.exists():
            return finding("not_symlink", "は symlink でない実体を指す")
        return finding("absent", "が存在しない")
    try:
        target = link_path.resolve(strict=True)
    except (OSError, RuntimeError):
        # strict=True の未解決は dangling と symlink loop の両方で起きる。前者は OSError、
        # 後者は Python version により RuntimeError/OSError(ELOOP) と分かれるため両方受ける。
        return finding("broken", "の symlink 解決先が存在しない")
    if not target.is_dir():
        return finding("not_directory", "の symlink 解決先が directory でない")
    return []


def path_findings(
    config: dict[str, Any],
    repo_root: Path | None,
    *,
    required_content_roots: Sequence[str] = (),
) -> list[dict[str, str]]:
    """path 宣言の repo 内包・重複・実在を検査する。

    重複判定は *完全一致* だけを対象にする。入れ子は禁止できない: 実運用 config の
    `plan_roots.state` (.dev-graph/state) は `local_state.graph`
    (.dev-graph/state/graph.json) の祖先であり、正当な配置である。

    実在要求 (`required_content_roots`) は **呼び手が key を明示列挙する**。「宣言された
    content_roots 全件」を暗黙の既定にしない理由は、schema の required 7 key と
    *各 skill が生成する root* が一致しないため: run-dev-graph-init は 6 root
    (issues/tasks/specs/architecture/features/docs) を作る契約で、7 番目の
    `system_spec` は run-dev-graph-system-spec が取込時に用意する別責務の root である。
    全件を暗黙要求すると init 直後の正常な repo が恒久的に FAIL する。

    `claude_hooks.project_plugin_link` だけは content path と扱いが分かれる。repo-relative 性と
    宣言重複は共通検査を通すが、realpath containment はかけず、代わりに
    `hook_link_findings()` が `source=project` のときだけ実体を検査する。
    """
    findings: list[dict[str, str]] = []
    owner_of: dict[str, str] = {}
    required = set(required_content_roots)
    declared_roots = config.get("content_roots")
    for key in sorted(required - set(declared_roots if isinstance(declared_roots, dict) else {})):
        findings.append(
            {
                "location": f"content_roots.{key}",
                "code": "content_root_key_unknown",
                "detail": f"実在要求された key が config の content_roots に無い: {key}",
            }
        )
    for location, value in declared_paths(config):
        logical = PurePosixPath(value)
        if logical.is_absolute() or ".." in logical.parts or not logical.parts:
            findings.append(
                {"location": location, "code": "path_not_repo_relative", "detail": value}
            )
            continue
        owner = owner_of.setdefault(str(logical), location)
        if owner != location:
            findings.append(
                {
                    "location": location,
                    "code": "declared_path_collision",
                    "detail": f"{value} は {owner} と同一 path を指す",
                }
            )
        if repo_root is None:
            continue
        if location == HOOK_LINK_LOCATION:
            # plugin link の実体は共有 plugin root (= repo 外) を指すのが正常な配布形態である。
            # path_policy が禁じるのは content symlink の repo 外脱出
            # (follow_content_symlinks_outside_repository) であり、plugin 資産への参照は
            # その対象ではないため realpath containment をかけない。宣言値が repo-relative で
            # あることは上の共通検査で既に効いている。
            findings.extend(hook_link_findings(config, value, repo_root / value))
            continue
        try:
            # 実在は要求しない (init 前の config も検証対象)。realpath 解決だけ行い、
            # symlink 経由の repo 外脱出を containment で落とす。
            resolved = contained(repo_root / value, repo_root, must_exist=False)
        except (ContractError, OSError) as exc:
            findings.append(
                {"location": location, "code": "path_escapes_repository", "detail": str(exc)}
            )
            continue
        section, _, key = location.partition(".")
        if section == "content_roots" and key in required and not resolved.is_dir():
            findings.append(
                {"location": location, "code": "content_root_missing", "detail": value}
            )
    return findings


def github_strings(config: dict[str, Any]) -> list[tuple[str, str]]:
    """github セクション配下の全 string を (location, value) で決定論順に列挙する。"""

    def walk(value: Any, location: str) -> Iterator[tuple[str, str]]:
        if isinstance(value, dict):
            for key, child in sorted(value.items()):
                yield from walk(child, f"{location}.{key}")
        elif isinstance(value, list):
            for index, child in enumerate(value):
                yield from walk(child, f"{location}[{index}]")
        elif isinstance(value, str):
            yield location, value

    return list(walk(config.get("github"), "github"))


def secret_findings(config: dict[str, Any]) -> list[dict[str, str]]:
    """github セクションへの token / GitHub node ID 混入を検査する。

    run-dev-graph-init の criteria:OUT4 は「token または project/item/field node ID を
    正本 config へ保存しない」ことを要求する。未知キーは schema の
    additionalProperties:false が落とすが、**既知キーの値** に秘密が入る経路
    (例: owner_login に PAT、project_field_name に PVT_ node ID) は schema では
    表現できないため、値そのものを検査する。

    Returns:
        findings: [{"location": ..., "code": "secret_material", "detail": ...}]
    """
    findings: list[dict[str, str]] = []
    for location, value in github_strings(config):
        # detail へ値そのものを載せない。この report は eval-log へ残るため、
        # 秘密を検出した report が秘密の二次保管場所になってはならない。
        prefix = next((item for item in SECRET_PREFIXES if value.startswith(item)), None)
        if prefix is not None:
            findings.append(
                {
                    "location": location,
                    "code": "secret_material",
                    "detail": f"{prefix}* 形式の token/node ID が保存されている (値は非出力)",
                }
            )
    return findings


def validate(
    config: dict[str, Any],
    *,
    schema: dict[str, Any] | None = None,
    repo_root: Path | None = None,
    required_content_roots: Sequence[str] = (),
) -> list[dict[str, str]]:
    canonical_schema = schema or load_json(SCHEMA_PATH)
    if not isinstance(canonical_schema, dict):
        raise ContractError(f"repo config schema must be an object: {SCHEMA_PATH}")
    if not isinstance(config, dict):
        raise ContractError("repo config must be a JSON object")
    findings = _schema_violations(config, canonical_schema)
    findings.extend(
        path_findings(config, repo_root, required_content_roots=required_content_roots)
    )
    findings.extend(secret_findings(config))
    return sorted(findings, key=lambda item: (item["location"], item["code"], item["detail"]))


def _repo_root_for(config: Path, explicit: str | None) -> Path:
    if explicit:
        root = Path(explicit).expanduser().resolve(strict=True)
        contained(config, root)
        return root
    resolved = config.resolve(strict=True)
    for parent in resolved.parents:
        if parent.name == ".dev-graph":
            return parent.parent
    raise ContractError("--repo-root is required when --config is outside the canonical .dev-graph tree")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", required=True, help="検証対象の repo-local config.json")
    parser.add_argument("--repo-root", help="containment authority。既定は config の .dev-graph 親")
    parser.add_argument(
        "--require-content-roots",
        nargs="+",
        metavar="KEY",
        default=[],
        help="実ディレクトリ実在も要求する content_roots の key を明示列挙する "
        "(呼び手ごとに生成契約が異なるため既定は空。例: init は system_spec を作らない)",
    )
    args = parser.parse_args()
    config_path = Path(args.config).expanduser().resolve(strict=True)
    repo_root = _repo_root_for(config_path, args.repo_root)
    config = load_json(config_path)
    violations = validate(
        config,
        repo_root=repo_root,
        required_content_roots=args.require_content_roots,
    )
    missing = sorted(
        {
            item["detail"]
            for item in violations
            if item["code"] == "content_root_missing"
            or (item["code"] == "schema_violation" and "required property" in item["detail"])
        }
    )
    dump(
        {
            "valid": not violations,
            "config": str(config_path),
            "schema": str(SCHEMA_PATH),
            "repository_id": config.get("repository_id") if isinstance(config, dict) else None,
            "missing_sections": missing,
            "violations": violations,
        }
    )
    return 0 if not violations else 1


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (ContractError, OSError) as exc:
        print(str(exc), file=sys.stderr)
        raise SystemExit(2)
