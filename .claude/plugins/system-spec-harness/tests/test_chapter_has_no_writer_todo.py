"""章は読み物であって作業指示書ではない、を固定する。

2026-08-29 実測: `design_applications` の無い質疑を接地根拠として描くと、章に
「qa_log[].design_applications を writer 経由で補完すること」という writer 宛の
TODO が入り、`system-spec/ui-ux.md` へ 2 件出荷されていた。しかもその補完手順
(`set-qa-design-applications`) は `legacy_exempt=true` の旧 entry しか受けないので、
一般の entry では**実行できない手順を仕様書が配っていた**。

この test が落ちるのは、章の描画に作業指示が混ざったときである。記録が無いことを
事実として書くのは通す。誰かに何かをさせる文を書くのを止める。
"""

from __future__ import annotations

import sys
from pathlib import Path

PLUGIN_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PLUGIN_ROOT / "lib"))

import spec_docset_chapters as chapters  # noqa: E402

# 章の本文に現れてはいけない「作業指示」の語。
# 「〜すること」「TODO」「補完せよ」の類は、読み手ではなく writer を向いている。
FORBIDDEN = ("すること)", "TODO", "補完すること", "対応してください")


def test_unrecorded_entry_states_fact_without_instructing_a_writer() -> None:
    qa_map = {"qa-x": {"question": "Q", "answer": "A"}}
    lines = chapters._render_application_entry(qa_map, "qa-x", ["web"], label="接地根拠")
    body = "\n".join(lines)

    # 記録が無いことは残る (黙って消さない)
    assert "`unrecorded`" in body

    # だが作業指示は書かない
    for token in FORBIDDEN:
        assert token not in body, f"章に writer 宛の指示が混ざっている: {token!r}\n{body}"


def test_recorded_entry_renders_the_principle() -> None:
    qa_map = {
        "qa-y": {
            "question": "Q",
            "answer": "A",
            "design_applications": [
                {
                    "knowledge_ref": "ref:information-design",
                    "principle": "P",
                    "applicability": "applied",
                    "rationale": "R",
                }
            ],
        }
    }
    body = "\n".join(
        chapters._render_application_entry(qa_map, "qa-y", ["web"], label="接地根拠")
    )
    assert "`unrecorded`" not in body
    assert "- 原則: P" in body
