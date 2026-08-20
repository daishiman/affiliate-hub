#!/usr/bin/env python3
# /// script
# name: supply-neutrality
# version: 0.1.0
# purpose: 監査 fork へ渡す prompt が「所在だけを供給し、読み (適用の指示) を供給しない」
#          形になっているかを、語の一覧ではなく**文法**で判定する停止条件。
# inputs:
#   - stdin または --prompt-file: 監査 fork へ渡す prompt 全文
#   - --repo-root (任意): locator の実在確認の起点
# outputs:
#   - stdout: 判定結果 (--json で JSON)
#   - exit: 0=供給が中立形式 / 2=違反 (fork へ渡してはならない)
# contexts: [E]
# network: false
# write-scope: none
# dependencies: []
# requires-python: ">=3.9"
# ///
"""proposer ≠ approver を、心がけではなく**渡せる形の制限**として実装する。

## なぜ語の一覧ではないのか

「結論方向を含む論証を供給しない」を語の検出で守ろうとすると、同じ skill の
`tests/test_dispatch_prompt_contract.py` が既に実行できる事実として固定している 2 つの
限界に必ずぶつかる。(1) 印を持たない同義語は原理的に素通りする。(2) 印の在否は極性を
区別しないので、禁止を正しく書いた文まで赤くなり、書き手は話題を避けるようになる。
禁止語を並べる門は、この 2 点により「守れないうえに改善を罰する」向きに効く。

そこでこの門は**検出しない**。渡してよい形を先に決め、それ以外を通さない。

    条文・入力への参照は、locator だけを置ける区画の中でしか書けない。
    区画の中には散文を置けない。区画の外には参照を置けない。

適用の指示 (「これが governing clause だ」「当該事項を名指ししているのはこちらだけだ」)
は、**特定の参照に隣接した散文**としてしか成立しない。参照と散文が同じ場所に置けない
なら、その指示は書く場所を失う。片方にだけ重みを付ける操作も同様で、locator は
すべて同じ形しか取れないため、並べた時点で対等になる。禁止する代わりに、
**表現できなくする**。これが blacklist と違って外側を残さない理由である。

## 判定

区画は 2 種類。どちらも 1 行 1 locator しか置けない。

    <SUPPLIED_LOCATORS>   条文・規範文書の所在
    <SUPPLIED_INPUTS>     監査対象データの所在 (spec-state.json など)

違反として止めるもの (reason code):
  - `prose_in_block`      : 区画の中に locator 以外の行がある (= 読みを添えた)
  - `locator_outside`     : 区画の外に参照らしき token がある (= 散文に隣接した参照)
  - `unbalanced_block`    : 区画の開閉が対応していない
  - `missing_locator`     : locator が実在しない path を指している (--repo-root 指定時)
  - `nested_block`        : 区画の中で別の区画を開いた

## 塞げていないもの (正直な境界。文章ではなく test 側でも固定する)

- **序数・語での間接参照**: 「1 件目の条文が governing だ」「到達不能を名指ししている
  ほうを見よ」は path token を含まないので、この文法では止まらない。参照を消しても
  指示だけは残せる。反転先: locator に安定 ID を与え、prompt 側で ID を書けなくする
  (= 受け手が ID を知らない) 形にできた日。**除外語を足す方向では反転させない。**
- **供給の外側**: R2 が fork を起動する前に別 channel (会話・別 fork) で読みを渡す形は
  prompt を見ても分からない。台帳は `prompt_sha256` しか持たないため、事後に「何を
  渡したか」を再構成することもできない。反転先: 台帳が中立判定そのものを記録する
  ようになった日 (schema 側の変更が要る)。
- **この門は自動では走らない**: R2 は model であり、走らせずに fork することはできて
  しまう。門が保証するのは「走らせれば、偏った供給は fork へ渡せない」ことだけである。
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

SCHEMA_VERSION = "1.0"

BLOCK_KINDS = {
    "SUPPLIED_LOCATORS": "条文・規範文書の所在",
    "SUPPLIED_INPUTS": "監査対象データの所在",
}

_OPEN_RE = re.compile(r"^<(" + "|".join(BLOCK_KINDS) + r")>$")
_CLOSE_RE = re.compile(r"^</(" + "|".join(BLOCK_KINDS) + r")>$")

# locator の形。path 本体 + 任意の anchor。散文が混ざれば空白が入るので落ちる。
_LOCATOR_RE = re.compile(r"^[A-Za-z0-9._/-]+(?:#[^\s]+)?$")

# 区画の外に置いてはならない参照 token。**拡張子と節記号は閉じた集合**であり、
# 同義語のように無限に外側が生えない (これが blacklist と違う点)。
_REFERENCE_EXTENSIONS = ("md", "py", "json", "jsonl", "mjs", "ts", "tsx", "sh")
_OUTSIDE_REFERENCE_RES = (
    ("path", re.compile(r"[A-Za-z0-9._/-]+\.(?:" + "|".join(_REFERENCE_EXTENSIONS) + r")\b")),
    ("section", re.compile(r"§\s*\d")),
    ("line", re.compile(r"\bL\d+(?:\.\d+)*\b")),
)


class Violation(dict):
    """1 件の停止理由。dict なので JSON へそのまま出せる。"""

    def __init__(self, code: str, line_no: int, text: str, detail: str) -> None:
        super().__init__(code=code, line=line_no, text=text.strip(), detail=detail)


def check_prompt(prompt: str, repo_root: Path | None = None) -> list[Violation]:
    """供給 prompt を検査し、停止理由の一覧を返す (空なら通過)。"""
    violations: list[Violation] = []
    open_kind: str | None = None
    open_line = 0

    for line_no, raw in enumerate(prompt.splitlines(), start=1):
        line = raw.strip()
        opened = _OPEN_RE.match(line)
        closed = _CLOSE_RE.match(line)

        if opened:
            if open_kind is not None:
                violations.append(Violation(
                    "nested_block", line_no, line,
                    f"{open_kind} が L{open_line} から開いたままである",
                ))
            else:
                open_kind, open_line = opened.group(1), line_no
            continue

        if closed:
            if open_kind != closed.group(1):
                violations.append(Violation(
                    "unbalanced_block", line_no, line,
                    f"開いていない {closed.group(1)} を閉じている",
                ))
            open_kind = None
            continue

        if open_kind is not None:
            if not line:
                continue
            if not _LOCATOR_RE.match(line):
                violations.append(Violation(
                    "prose_in_block", line_no, line,
                    "区画には locator 1 行のみを置ける (読みを添えられない)",
                ))
                continue
            if repo_root is not None:
                target = line.split("#", 1)[0]
                if not (repo_root / target).exists():
                    violations.append(Violation(
                        "missing_locator", line_no, line,
                        f"{target} が {repo_root} に実在しない",
                    ))
            continue

        for kind, pattern in _OUTSIDE_REFERENCE_RES:
            found = pattern.search(line)
            if found:
                violations.append(Violation(
                    "locator_outside", line_no, line,
                    f"区画の外に {kind} 参照 ({found.group(0)}) がある"
                    " = 散文に隣接した参照になっている",
                ))
                break

    if open_kind is not None:
        violations.append(Violation(
            "unbalanced_block", open_line, f"<{open_kind}>", "閉じられていない",
        ))
    return violations


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="監査 fork へ渡す供給 prompt の中立形式を検査する")
    parser.add_argument("--prompt-file", type=Path, default=None, help="未指定なら stdin")
    parser.add_argument("--repo-root", type=Path, default=None, help="locator 実在確認の起点")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args(argv)

    prompt = args.prompt_file.read_text(encoding="utf-8") if args.prompt_file else sys.stdin.read()
    violations = check_prompt(prompt, args.repo_root)
    payload = {
        "schema_version": SCHEMA_VERSION,
        "verdict": "NEUTRAL_FORM" if not violations else "BIASED_SUPPLY",
        "violations": violations,
    }
    if args.json:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
    elif violations:
        for item in violations:
            print(f"L{item['line']} [{item['code']}] {item['detail']}: {item['text']}")
        print(f"停止: 供給が中立形式ではない ({len(violations)} 件)。この prompt で fork してはならない。")
    else:
        print("通過: 供給は所在のみで構成されている。")
    return 0 if not violations else 2


if __name__ == "__main__":
    raise SystemExit(main())
