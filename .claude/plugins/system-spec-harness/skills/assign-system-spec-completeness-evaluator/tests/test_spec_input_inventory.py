"""入力インベントリの定義が、python と node で同じであることを縛る。

`scripts/spec_input_inventory.py` (C05 側) と `scripts/spec-freshness.mjs` (門の側) は
同じ指紋を別々に計算する。**定義がずれると、中身が同じなのに STALE が出る。**
その赤は「仕様書が変わった」と読めるが、実際には何も変わっていない。
つまりずれは、**嘘の警報**として現れ、やがて赤ごと無視されるようになる。

言語が違って実装は共有できない。だから「同じツリーで両方に計算させて一致を主張する」。
一致を主張する検査には落とし穴がある — **両方が同じように壊れると緑になる。**
そのため、ずれたときに確かに落ちることを示す陽性対照を各主張に添える。
"""
from __future__ import annotations

import hashlib
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

import spec_input_inventory as INV  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parents[6]
FRESHNESS_MJS = REPO_ROOT / "scripts" / "spec-freshness.mjs"


def _mjs_source() -> str:
    return FRESHNESS_MJS.read_text(encoding="utf-8")


def _string_array(source: str, name: str) -> list[str]:
    """`const NAME = ["a", "b"];` から値を取り出す。"""
    match = re.search(rf"const\s+{name}\s*=\s*\[(.*?)\]", source, re.S)
    assert match, f"{name} が {FRESHNESS_MJS.name} に見つからない"
    return re.findall(r'"([^"]*)"', match.group(1))


def test_the_two_implementations_declare_the_same_inputs():
    """常に走る層。片方の一覧だけを編集する、いちばん起きやすいずれを捕まえる。"""
    source = _mjs_source()
    assert _string_array(source, "INPUT_DIRS") == list(INV.INPUT_DIRS)
    assert _string_array(source, "INPUT_EXTENSIONS") == list(INV.INPUT_EXTENSIONS)
    assert _string_array(source, "INPUT_FILES") == list(INV.INPUT_FILES)


def test_the_declaration_check_can_fail():
    """陽性対照: 一覧がずれた原稿なら、上の突き合わせは落ちる。

    これが無いと、`_string_array` が常に同じ物を返す壊れ方をしたときに
    上の検査が無条件に緑になる。
    """
    doctored = _mjs_source().replace(
        'const INPUT_DIRS = ["docs/spec", "system-spec"]',
        'const INPUT_DIRS = ["docs/spec"]',
    )
    assert doctored != _mjs_source(), "差し替えが効いていない (原稿の書式が変わった)"
    assert _string_array(doctored, "INPUT_DIRS") != list(INV.INPUT_DIRS)


@pytest.mark.skipif(shutil.which("node") is None, reason="node が無い環境では言語間の一致を確かめられない")
def test_python_and_node_agree_on_the_input_digest():
    """同じツリーを両方に数えさせ、指紋が一致することを主張する。"""
    result = subprocess.run(
        [
            "node",
            "-e",
            "import('./scripts/spec-freshness.mjs').then(m=>{"
            "process.stdout.write(JSON.stringify(m.fingerprint()))})",
        ],
        cwd=REPO_ROOT,
        text=True,
        capture_output=True,
        check=True,
    )
    node = json.loads(result.stdout)
    inventory = INV.build_inventory(REPO_ROOT)
    assert inventory["sha256"] == node["sha256"]
    assert inventory["file_count"] == node["fileCount"]
    # per-file の中身まで一致させる。指紋だけ見ていると、並べている対象が
    # 違っていても畳んだ値がたまたま合う可能性を否定できない。
    assert inventory["files"] == node["files"]


@pytest.mark.skipif(shutil.which("node") is None, reason="node が無い環境では言語間の一致を確かめられない")
def test_the_digest_agreement_check_can_fail():
    """陽性対照: 数える対象を 1 件削れば、両者は必ず食い違う。

    上の一致検査が「どんな入力でも通る」形に壊れていないことを示す。
    """
    inventory = INV.build_inventory(REPO_ROOT)
    trimmed = inventory["files"][:-1]
    perturbed = hashlib.sha256(
        "\n".join(f"{entry['path']}:{entry['sha256']}" for entry in trimmed).encode("utf-8")
    ).hexdigest()
    assert perturbed != inventory["sha256"]


def test_mtime_moves_without_moving_the_digest(tmp_path):
    """mtime は記録するが、指紋の材料にはしない。

    ここを守らないと、clone や checkout をしただけで永久に STALE になる。
    毎回赤い門は読まれなくなり、**本物の書き換えを報せる力を失う**。
    """
    (tmp_path / "system-spec").mkdir(parents=True)
    target = tmp_path / "system-spec" / "index.md"
    target.write_text("同じ中身", encoding="utf-8")

    before = INV.build_inventory(tmp_path)
    import os

    os.utime(target, (1_600_000_000, 1_600_000_000))
    after = INV.build_inventory(tmp_path)

    assert after["sha256"] == before["sha256"], "中身が同じなのに指紋が動いた (mtime が混ざっている)"
    assert after["files"][0]["mtime"] != before["files"][0]["mtime"], "mtime が記録されていない"
    assert after["files"][0]["mtime"] == 1_600_000_000


def test_content_change_does_move_the_digest(tmp_path):
    """陽性対照: 中身が変われば指紋は動く。

    上の検査だけだと「指紋が常に一定」という壊れ方でも緑になる。
    """
    (tmp_path / "system-spec").mkdir(parents=True)
    target = tmp_path / "system-spec" / "index.md"
    target.write_text("最初", encoding="utf-8")
    before = INV.build_inventory(tmp_path)
    target.write_text("書き換えた", encoding="utf-8")
    after = INV.build_inventory(tmp_path)
    assert after["sha256"] != before["sha256"]
