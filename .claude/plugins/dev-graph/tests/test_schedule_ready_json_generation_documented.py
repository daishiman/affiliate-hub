"""run-dev-graph-schedule SKILL 本文の「ready-json 生成手順」ドキュメント不変条件の回帰テスト。

守る不変条件: schedule SKILL の実行ブロックが `--ready-json` を *消費* する以上、
その JSON を *生成* する `bd-bridge.py --op ready --parity-manifest` の手順も本文に
現れていなければならない。生成手順を欠くと、平常経路の初回実行が provenance 欠落の
committed receipt を掴んで即 ContractError で停止する (HarnessHub-hiu の退行防止)。
"""

from __future__ import annotations

import re
from pathlib import Path

PLUGIN = Path(__file__).resolve().parents[1]
SKILL = PLUGIN / "skills" / "run-dev-graph-schedule" / "SKILL.md"


def _bash_blocks(text: str) -> list[str]:
    """SKILL 本文中の ```bash フェンスの中身だけを取り出す。"""
    return re.findall(r"```bash\n(.*?)```", text, flags=re.DOTALL)


def test_schedule_documents_ready_json_generation() -> None:
    text = SKILL.read_text(encoding="utf-8")
    blocks = _bash_blocks(text)
    # 実行ブロックが存在し、少なくとも 1 つが --ready-json を消費している前提を固定する。
    assert blocks, "schedule SKILL must contain at least one ```bash execution block"
    consumes_ready_json = any("--ready-json" in block for block in blocks)
    assert consumes_ready_json, "schedule SKILL must document a schedule-graph.py invocation consuming --ready-json"

    # 「--ready-json を消費するなら、その JSON を作る生成手順も本文にある」ことを固定する。
    # 生成ブロック = bd-bridge.py --op ready --parity-manifest の結果を `>` で書き出す形。
    # パスの逐語一致は固定しない (正当なパス変更でテストが割れるのを避ける)。
    def _is_generation(block: str) -> bool:
        return (
            "bd-bridge.py" in block
            and "--op ready" in block
            and "--parity-manifest" in block
            and ">" in block
        )

    generation_indices = [i for i, b in enumerate(blocks) if _is_generation(b)]
    assert generation_indices, (
        "schedule SKILL must document ready-json generation: "
        "bd-bridge.py --op ready --parity-manifest ... > <ready-json path>"
    )

    # 順序も固定する: 生成ブロックは消費ブロックより前に現れること。
    # 退行の本質は「消費だけ文書化され、初回実行が provenance 欠落の committed receipt を
    # 掴む」ことなので、生成→消費の順序こそが守るべき平常経路の不変条件。
    first_consumption = min(
        i for i, b in enumerate(blocks) if "--ready-json" in b and not _is_generation(b)
    )
    assert generation_indices[0] < first_consumption, (
        "ready-json generation must be documented before its consumption"
    )

    # parity manifest の由来要件が本文で言及されていること (契約 §10 との接続)。
    for term in ("parity_provenance", "source_graph_digest"):
        assert term in text, f"schedule SKILL must mention provenance requirement: {term}"
