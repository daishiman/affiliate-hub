#!/usr/bin/env python3
# /// script
# name: build-repo-config
# purpose: Write the caller repository .dev-graph/config.json through a single validated atomic writer so no tool needs to bypass the C10 guard.
# inputs: ["argv: --repo-root PATH [--config PATH] (--stdin | --from-json FILE) [--require-content-roots KEY ...] [--if-absent] [--dry-run]", "stdin: repo config JSON (--stdin 時)"]
# outputs: ["stdout: JSON write receipt", "exit: 0=written/unchanged / 1=validation violation / 2=contract error"]
# requires-python = ">=3.10"
# dependencies: [scripts/validate-repo-config.py, scripts/_common.py]
# contexts: [A, C, E]
# network: false
# write-scope: the caller repository .dev-graph/config.json only
# ///
"""`.dev-graph/config.json` の唯一の sanctioned writer。

背景 (HarnessHub-6in4):
  C10 guard (`hooks/guard-graph-schema.py`) は `.dev-graph/config.json` を graph
  authority として Write/Edit と interpreter 書込みを無条件に遮断する。ところが
  この path を書く sanctioned な writer は存在しなかった。`upsert-node.py` の
  write-scope は「1 content artifact + `.dev-graph/state/graph.json`」、
  `manage-worktree-lease.py` は git common-dir の ephemeral coordination、
  `register-package.py` は receipt だけで、いずれも config を担当しない。

  つまり run-dev-graph-init は「config を作る責務の skill」でありながら正規の
  書込経路を持たず、実際には guard が遅すぎて遮断が間に合わない
  (Bash 破壊操作枝が graph 全件の C11 検証を挟み 40 秒級だった) ことに依存して
  成功していた。guard の fail-open を閉じると init が実行不能になるため、本 script は
  その穴を同じ周回で埋めるために存在する。

責務境界:
  config の *内容* を組み立てるのは run-dev-graph-init の R2-plan であり本 script では
  ない。ここは「受け取った config を検証し、repo 内の正しい path へ atomic に置く」
  ことだけを行う。雛形が必要な呼び手は `templates/repo-config.example.json` を土台に
  すればよい。内容生成をここへ足すと、同じ既定値が 2 箇所に分岐して drift する。
  名前の `build-` は repo の script 命名ゲート (`scripts/lint-script-naming.py` の
  ALLOWED_VERBS) に従ったもので、`build-claude-settings.py` と同じ「検証済みの成果物を
  正しい場所へ生成する」役を指す。内容を発明するという意味ではない。

検証は `validate-repo-config.py` の `validate()` を借用する (schema 適合 + path 不変条件
+ 秘密材料)。writer 側へ再実装しないのは SSOT を 2 つに割らないため。検証違反は
**書込前**に exit 1 で止める。部分書込は行わない。
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
PLUGIN_ROOT = HERE.parent
CANONICAL_RELATIVE = Path(".dev-graph") / "config.json"

sys.path.insert(0, str(HERE))
from _common import ContractError, atomic_json, contained, dump, load_json  # noqa: E402

# ハイフン名の script は通常 import できないため importlib で借用する
# (validate-repo-config.py が validate-graph-schema.py を借用するのと同じ流儀)。
# main() は __main__ ガード内にあり import 時副作用は無い。
_spec = importlib.util.spec_from_file_location(
    "_dev_graph_repo_config_validator", HERE / "validate-repo-config.py"
)
assert _spec and _spec.loader
_validator = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_validator)


def canonical_config_path(root: Path, explicit: str | None) -> Path:
    """書込先を `<repo>/.dev-graph/config.json` に固定する。

    `--config` を任意 path として受けないのは意図的である。writer の write-scope 宣言は
    「caller repository の config.json のみ」であり、呼び手が渡した path をそのまま信じると
    宣言が実効性を失う (guard は Bash コマンド文字列しか見ないので、writer 内部の逸脱は
    誰も止められない)。明示された場合も canonical path と一致することだけを許す。
    """
    canonical = (root / CANONICAL_RELATIVE).resolve()
    if explicit is None:
        return canonical
    candidate = Path(explicit).expanduser()
    resolved = (candidate if candidate.is_absolute() else root / candidate).resolve()
    if resolved != canonical:
        raise ContractError(
            f"--config must be the canonical repo-local config: {canonical} (got {resolved})"
        )
    return resolved


def desired_config(args: argparse.Namespace) -> dict:
    """`--stdin` または `--from-json` から書込対象の config を読む。"""
    if args.from_json:
        source = Path(args.from_json).expanduser().resolve(strict=True)
        document = load_json(source)
    else:
        raw = sys.stdin.read()
        if not raw.strip():
            raise ContractError("--stdin was selected but no JSON arrived on stdin")
        try:
            document = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise ContractError(f"invalid JSON on stdin: {exc}") from exc
    if not isinstance(document, dict):
        raise ContractError("repo config must be a JSON object")
    return document


def digest_of(document: dict) -> str:
    canonical = json.dumps(document, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return "sha256:" + hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def decide(existing: dict | None, desired: dict, *, if_absent: bool) -> tuple[str, bool]:
    """既存 config に対する処置と、書込が必要かを決める。

    全置換であって深いマージではない。config は routing authority であり、section 単位に
    マージすると「どちらが正本か」が入力ごとに変わって決定論性を失う。呼び手 (init の
    R2-plan) は完全な config を組み立てる契約なので、受け取った document を正本とする。

    利用者が編集済みの config を保全したい scaffold 用途には `--if-absent` を使う。
    run-dev-graph-init の「利用者編集済み成果物の上書 0」契約はこの経路で満たす。
    """
    if existing is None:
        return "created", True
    if if_absent:
        return "skipped_existing", False
    if existing == desired:
        # 冪等: 内容が同じなら書かない。二回目 init の planned changes を 0 に保つ。
        return "unchanged", False
    return "updated", True


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo-root", required=True, help="caller repository root (containment authority)")
    parser.add_argument("--config", help="書込先。省略時は <repo-root>/.dev-graph/config.json")
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--stdin", action="store_true", help="config JSON を stdin から読む")
    source.add_argument("--from-json", metavar="FILE", help="config JSON を file から読む")
    parser.add_argument(
        "--require-content-roots",
        nargs="+",
        metavar="KEY",
        default=[],
        help="実ディレクトリ実在も要求する content_roots の key "
        "(init は issues tasks specifications architecture features documents を渡す)",
    )
    parser.add_argument(
        "--if-absent",
        action="store_true",
        help="既存 config があれば内容を変えない (scaffold 用。利用者編集を保全する)",
    )
    parser.add_argument("--dry-run", action="store_true", help="検証と差分判定だけ行い書込まない")
    args = parser.parse_args()

    root = Path(args.repo_root).expanduser().resolve(strict=True)
    config_path = canonical_config_path(root, args.config)
    contained(config_path, root, must_exist=False)
    document = desired_config(args)

    existing = load_json(config_path) if config_path.is_file() else None
    if existing is not None and not isinstance(existing, dict):
        raise ContractError(f"existing config is not a JSON object: {config_path}")
    action, needs_write = decide(existing, document, if_absent=args.if_absent)

    # 検証対象は「この呼出しの後に repo へ残る内容」。--if-absent で既存を保全する場合は
    # 既存側を検証する。渡された document だけ検証すると、実際に残る config が未検証になる。
    effective = document if needs_write else (existing if existing is not None else document)
    violations = _validator.validate(
        effective,
        repo_root=root,
        required_content_roots=args.require_content_roots,
    )
    if violations:
        dump(
            {
                "config": str(config_path),
                "action": "rejected",
                "changed": False,
                "dry_run": args.dry_run,
                "valid": False,
                "violations": violations,
            }
        )
        return 1

    if needs_write and not args.dry_run:
        atomic_json(config_path, document)
    dump(
        {
            "config": str(config_path),
            "repository_id": effective.get("repository_id"),
            "action": action,
            "changed": bool(needs_write and not args.dry_run),
            "dry_run": args.dry_run,
            "valid": True,
            "violations": [],
            "digest": digest_of(effective),
        }
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (ContractError, OSError) as exc:
        print(str(exc), file=sys.stderr)
        raise SystemExit(2)
