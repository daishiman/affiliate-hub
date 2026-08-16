"""validate-receipt: 任意の registration receipt の真正性を単独検証する検査のテスト。

背景: live-trial の fixture は gitignore されており、commit 差分ベースの provenance 検査
(HarnessHub-dst) が届かない。実際に render の live-trial (20260721T180000-r7) で手書き
receipt が使われ、schema・stale-sha・transcript 束縛のいずれにも掛からず通過した。
その手口を機械検出できることをここで固定する。

検証ロジックは plugins/dev-graph/scripts/validate-receipt.py に独立させている
(register-package.py に足すと run-dev-graph-node の behavior closure を失効させるため)。
"""
from __future__ import annotations

import copy
import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path

PLUGIN = Path(__file__).resolve().parents[1]
SCRIPT = PLUGIN / "scripts" / "validate-receipt.py"
sys.path.insert(0, str(SCRIPT.parent))
SPEC = importlib.util.spec_from_file_location("dev_graph_validate_receipt", SCRIPT)
assert SPEC and SPEC.loader
RP = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = RP
SPEC.loader.exec_module(RP)

PHASES = [f"P{i:02d}" for i in range(1, 14)]


def genuine_receipt() -> dict:
    """register-package.py が実際に発行する形の receipt。"""
    return {
        "schema_version": "1.0.0",
        "status": "registered",
        # utc_now() は datetime.now(timezone.utc).isoformat() なので必ず小数秒を含む
        "registered_at": "2026-07-18T12:33:16.801231Z",
        "feature_package_id": "feature-package/feat-demo",
        "parent_feature": "feat-demo",
        "source_digest": "sha256:" + "a" * 64,
        "expected_count": 13,
        "applied_count": 13,
        "phase_refs": list(PHASES),
        "node_ids": [f"SYS-DEMO-P{i:02d}" for i in range(1, 14)],
        # 登録は 1 回の atomic write なので必ず +1
        "graph_revision_before": 14,
        "graph_revision_after": 15,
        "graph_digest_after": "sha256:" + "b" * 64,
        "output_path": ".dev-graph/state/graph.json",
    }


def write(tmp: Path, doc: dict) -> Path:
    path = tmp / "receipt.json"
    path.write_text(json.dumps(doc, ensure_ascii=False), encoding="utf-8")
    return path


class VerifyReceiptTest(unittest.TestCase):
    def _verify(self, doc: dict, graph: dict | None = None):
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            graph_path = None
            if graph is not None:
                graph_path = tmp / "graph.json"
                graph_path.write_text(json.dumps(graph, ensure_ascii=False), encoding="utf-8")
            return RP.validate_receipt(write(tmp, doc), graph_path)

    def test_genuine_receipt_passes(self):
        result = self._verify(genuine_receipt())
        self.assertTrue(result["valid"], result["violations"])
        self.assertEqual(result["violations"], [])

    def test_revision_gap_is_rejected(self):
        """r7 で実際に使われた手口: 登録後に 13 回 upsert した後の revision を書く。"""
        doc = genuine_receipt()
        doc["graph_revision_before"], doc["graph_revision_after"] = 1, 15
        result = self._verify(doc)
        self.assertFalse(result["valid"])
        self.assertTrue(any("graph_revision" in v for v in result["violations"]), result["violations"])

    def test_second_rounded_timestamp_is_rejected(self):
        """手書き receipt の兆候: utc_now() では起こり得ない秒丸め。"""
        doc = genuine_receipt()
        doc["registered_at"] = "2026-07-21T17:00:00Z"
        result = self._verify(doc)
        self.assertFalse(result["valid"])
        self.assertTrue(any("registered_at" in v for v in result["violations"]), result["violations"])

    def test_count_mismatch_is_rejected(self):
        doc = genuine_receipt()
        doc["node_ids"] = doc["node_ids"][:12]
        result = self._verify(doc)
        self.assertFalse(result["valid"])
        self.assertTrue(any("exact-13" in v for v in result["violations"]), result["violations"])

    def test_duplicate_node_ids_are_rejected(self):
        doc = genuine_receipt()
        doc["node_ids"] = doc["node_ids"][:12] + [doc["node_ids"][0]]
        result = self._verify(doc)
        self.assertFalse(result["valid"])
        self.assertTrue(any("重複" in v for v in result["violations"]), result["violations"])

    def test_partial_phase_refs_are_rejected(self):
        doc = genuine_receipt()
        doc["phase_refs"] = PHASES[:12] + ["P99"]
        result = self._verify(doc)
        self.assertFalse(result["valid"])
        self.assertTrue(any("phase_refs" in v for v in result["violations"]), result["violations"])

    def test_graph_digest_is_checked_against_actual_graph(self):
        """--graph 指定時は receipt の digest を実測突合する。"""
        graph = {"graph_revision": 15, "nodes": []}
        doc = genuine_receipt()
        doc["graph_digest_after"] = RP._canonical_digest(graph)
        self.assertTrue(self._verify(doc, graph)["valid"])

        doc["graph_digest_after"] = "sha256:" + "c" * 64
        result = self._verify(doc, graph)
        self.assertFalse(result["valid"])
        self.assertTrue(any("graph_digest_after" in v for v in result["violations"]), result["violations"])

    def test_forged_receipt_from_r7_is_rejected(self):
        """実際に live-trial r7 で使われた偽造 receipt の特徴を合成して検出を固定する。"""
        doc = genuine_receipt()
        doc["graph_revision_before"], doc["graph_revision_after"] = 1, 15
        doc["registered_at"] = "2026-07-21T17:00:00Z"
        result = self._verify(doc)
        self.assertFalse(result["valid"])
        # 2 つの独立した signal で捕まること (片方を潰されても残る)
        self.assertGreaterEqual(len(result["violations"]), 2, result["violations"])


if __name__ == "__main__":
    unittest.main()
