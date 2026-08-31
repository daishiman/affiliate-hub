#!/usr/bin/env python3
"""Verify the reference-blog feature evidence index, and refresh named entries.

既定では 1 バイトも書きません。書けるのは `--refresh <id>` を明示したときだけで、
しかも次の 2 つを守らせます。

1. **id を名指しさせる。** 一括更新は用意していません。全件を一度に更新できると、
   意図せず古くなった証跡まで黙って追従し、「いつ何が変わったのか」が消えます。
2. **stale でない id は拒む。** 「念のため refresh」を通すと、差分の無い更新で
   `captured_at` だけが進み、証跡がいつ取られたものか読めなくなります。

道具が無かった間、更新は手で digest を書き写すしかありませんでした。
写し間違えても検査は「stale」としか言わないので、間違いが直ったのか
別の値に化けたのかを誰も区別できません。
"""

from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime
from pathlib import Path
from typing import Any

EXPECTED_REQUIREMENTS = {f"A{number}" for number in range(1, 13)}
EXPECTED_PHASES = {"P01", "P06", "P07", "P09", "P10"}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def valid_timestamp(raw: object) -> bool:
    if not isinstance(raw, str):
        return False
    try:
        datetime.fromisoformat(raw.replace("Z", "+00:00"))
        return True
    except ValueError:
        return False


def verify_index(index_path: Path, repo_root: Path) -> dict[str, Any]:
    root = repo_root.resolve()
    document = json.loads(index_path.read_text(encoding="utf-8"))
    entries = document.get("entries", [])
    missing: list[str] = []
    duplicates: list[str] = []
    stale: list[str] = []
    invalid: list[str] = []
    seen_ids: set[str] = set()
    seen_paths: set[str] = set()
    covered_requirements: set[str] = set()
    covered_phases: set[str] = set()

    if document.get("schema_version") != 1:
        invalid.append("schema_version")
    if not valid_timestamp(document.get("generated_at")):
        invalid.append("generated_at")
    if not isinstance(document.get("tool_versions"), dict) or not document["tool_versions"]:
        invalid.append("tool_versions")
    if not isinstance(entries, list):
        invalid.append("entries")
        entries = []

    for position, raw_entry in enumerate(entries):
        if not isinstance(raw_entry, dict):
            invalid.append(f"entry:{position}")
            continue
        evidence_id = raw_entry.get("id")
        relative = raw_entry.get("path")
        if not isinstance(evidence_id, str) or not evidence_id:
            invalid.append(f"entry:{position}:id")
            continue
        if evidence_id in seen_ids:
            duplicates.append(f"id:{evidence_id}")
        seen_ids.add(evidence_id)
        if not isinstance(relative, str) or not relative:
            invalid.append(f"entry:{evidence_id}:path")
            continue
        if relative in seen_paths:
            duplicates.append(f"path:{relative}")
        seen_paths.add(relative)
        candidate = (root / relative).resolve()
        if not candidate.is_relative_to(root):
            invalid.append(f"entry:{evidence_id}:path-outside-root")
            continue
        if not candidate.is_file():
            missing.append(f"file:{relative}")
            continue
        expected_digest = raw_entry.get("sha256")
        if not isinstance(expected_digest, str) or len(expected_digest) != 64:
            invalid.append(f"entry:{evidence_id}:sha256")
        elif sha256(candidate) != expected_digest:
            stale.append(evidence_id)
        if not valid_timestamp(raw_entry.get("captured_at")):
            invalid.append(f"entry:{evidence_id}:captured_at")
        requirements = raw_entry.get("requirements", [])
        phases = raw_entry.get("phases", [])
        if not isinstance(requirements, list) or not all(isinstance(item, str) for item in requirements):
            invalid.append(f"entry:{evidence_id}:requirements")
        else:
            covered_requirements.update(requirements)
        if not isinstance(phases, list) or not all(isinstance(item, str) for item in phases):
            invalid.append(f"entry:{evidence_id}:phases")
        else:
            covered_phases.update(phases)

    missing.extend(
        f"requirement:{item}" for item in sorted(EXPECTED_REQUIREMENTS - covered_requirements)
    )
    missing.extend(f"phase:{item}" for item in sorted(EXPECTED_PHASES - covered_phases))
    report = {
        "ok": not missing and not duplicates and not stale and not invalid,
        "entry_count": len(entries),
        "missing": sorted(missing),
        "duplicates": sorted(set(duplicates)),
        "stale": sorted(set(stale)),
        "invalid": sorted(set(invalid)),
    }
    return report


def refresh_entries(
    index_path: Path,
    repo_root: Path,
    evidence_ids: list[str],
    now: str,
) -> dict[str, Any]:
    """名指しした entry の sha256 と captured_at だけを書き直す。

    書き換えてよいのは「検査が stale と言った id」だけです。それ以外を拒むのは
    意地悪ではなく、`captured_at` が「その証跡がいつ取られたか」を意味し続ける
    ためです。中身が変わっていないのに時刻だけ進むと、この列は嘘になります。
    """
    root = repo_root.resolve()
    before = verify_index(index_path, repo_root)
    stale = set(before["stale"])
    requested = list(dict.fromkeys(evidence_ids))

    not_stale = [item for item in requested if item not in stale]
    if not_stale:
        return {
            "ok": False,
            "refreshed": [],
            "rejected": sorted(not_stale),
            "reason": "stale ではない entry は更新できません（存在しない id を含む）",
        }

    document = json.loads(index_path.read_text(encoding="utf-8"))
    refreshed: list[str] = []
    for entry in document["entries"]:
        if entry.get("id") not in requested:
            continue
        entry["sha256"] = sha256((root / entry["path"]).resolve())
        entry["captured_at"] = now
        refreshed.append(entry["id"])

    document["generated_at"] = now
    index_path.write_text(
        json.dumps(document, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return {"ok": True, "refreshed": sorted(refreshed), "rejected": [], "reason": ""}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--index",
        type=Path,
        default=Path("docs/spec/feat-reference-blog-admin-ux/evidence/index.json"),
    )
    parser.add_argument("--repo-root", type=Path, default=Path("."))
    parser.add_argument(
        "--refresh",
        action="append",
        default=[],
        metavar="EVIDENCE_ID",
        help=(
            "指定した id の sha256 と captured_at を再計算する。"
            "複数回指定できるが、全件を一括で更新する手段は用意していない。"
        ),
    )
    args = parser.parse_args()

    if args.refresh:
        outcome = refresh_entries(
            args.index,
            args.repo_root,
            args.refresh,
            datetime.now().astimezone().isoformat(timespec="seconds"),
        )
        print(json.dumps(outcome, ensure_ascii=False, indent=2))
        if not outcome["ok"]:
            return 1

    report = verify_index(args.index, args.repo_root)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
