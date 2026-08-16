#!/usr/bin/env python3
"""`.claude/plugins/*/.claude-plugin/plugin.json` から `.claude-plugin/marketplace.json` を再生成する。

各 plugin の manifest が唯一の真実源。plugin を足す / 消す / version を上げるたびに
このスクリプトを回せば marketplace 側は自動で揃う。手で marketplace.json を編集しない。
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
PLUGINS_DIR = REPO_ROOT / ".claude" / "plugins"
OUT = REPO_ROOT / ".claude-plugin" / "marketplace.json"

MARKETPLACE_NAME = "harness-hub"
MARKETPLACE_DESC = (
    "HarnessHub 由来のプラグイン群を affiliate-hub にベンダリングしたローカルマーケットプレイス。"
    "実体は .claude/plugins/ 配下。更新は .claude/scripts/sync-plugins.sh で行う。"
)


def entry(plugin_dir: Path) -> dict:
    manifest = json.loads((plugin_dir / ".claude-plugin" / "plugin.json").read_text("utf-8"))
    e = {
        "name": manifest.get("name", plugin_dir.name),
        "source": f"./.claude/plugins/{plugin_dir.name}",
        "description": manifest.get("description", ""),
        "version": manifest.get("version", "0.0.0"),
    }
    # category は plugin.json の表記ゆれ (Productivity / developer-tools) をそのまま尊重する
    if manifest.get("category"):
        e["category"] = manifest["category"]
    # tags が無い plugin は keywords を使う。governance 系は keywords しか持たない。
    tags = manifest.get("tags") or manifest.get("keywords")
    if tags:
        e["tags"] = tags
    return e


def main() -> int:
    if not PLUGINS_DIR.is_dir():
        print(f"error: {PLUGINS_DIR} が無い", file=sys.stderr)
        return 1

    plugins, skipped = [], []
    for d in sorted(PLUGINS_DIR.iterdir()):
        if not d.is_dir() or d.name.startswith("."):
            continue
        if not (d / ".claude-plugin" / "plugin.json").is_file():
            skipped.append(d.name)
            continue
        plugins.append(entry(d))

    if skipped:
        print(f"warn: manifest が無いのでスキップ: {', '.join(skipped)}", file=sys.stderr)

    doc = {
        "name": MARKETPLACE_NAME,
        "description": MARKETPLACE_DESC,
        "version": "1.0.0",
        "owner": {"name": "daishiman"},
        "plugins": plugins,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", "utf-8")
    print(f"wrote {OUT.relative_to(REPO_ROOT)} ({len(plugins)} plugins)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
