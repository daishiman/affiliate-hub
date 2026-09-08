import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from verify_evidence_index import refresh_entries, verify_index

NOW = "2026-08-30T12:00:00+09:00"


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def write_fixture(root: Path, *, bad_digest: bool = False, duplicate: bool = False) -> Path:
    evidence = root / "evidence.txt"
    evidence.write_bytes(b"ok\n")
    entries = [
        {
            "id": "all-requirements",
            "path": "evidence.txt",
            "sha256": "0" * 64 if bad_digest else digest(b"ok\n"),
            "captured_at": "2026-08-30T00:00:00Z",
            "requirements": [f"A{i}" for i in range(1, 13)],
            "phases": ["P01", "P06", "P07", "P09", "P10"],
        }
    ]
    if duplicate:
        entries.append(dict(entries[0]))
    index = root / "index.json"
    index.write_text(
        json.dumps(
            {
                "schema_version": 1,
                "generated_at": "2026-08-30T00:00:00Z",
                "tool_versions": {"verifier": "1"},
                "entries": entries,
            }
        ),
        encoding="utf-8",
    )
    return index


class VerifyEvidenceIndexTest(unittest.TestCase):
    def test_accepts_complete_current_index(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            report = verify_index(write_fixture(root), root)
        self.assertTrue(report["ok"])
        self.assertEqual(report["missing"], [])
        self.assertEqual(report["duplicates"], [])
        self.assertEqual(report["stale"], [])

    def test_detects_digest_mismatch(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            report = verify_index(write_fixture(root, bad_digest=True), root)
        self.assertFalse(report["ok"])
        self.assertEqual(report["stale"], ["all-requirements"])

    def test_detects_duplicate_ids_and_paths(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            report = verify_index(write_fixture(root, duplicate=True), root)
        self.assertFalse(report["ok"])
        self.assertEqual(report["duplicates"], ["id:all-requirements", "path:evidence.txt"])

    def test_detects_missing_requirement_and_phase_coverage(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            index = write_fixture(root)
            document = json.loads(index.read_text(encoding="utf-8"))
            document["entries"][0]["requirements"] = ["A1"]
            document["entries"][0]["phases"] = ["P01"]
            index.write_text(json.dumps(document), encoding="utf-8")
            report = verify_index(index, root)
        self.assertFalse(report["ok"])
        self.assertIn("requirement:A12", report["missing"])
        self.assertIn("phase:P10", report["missing"])


class RefreshEvidenceIndexTest(unittest.TestCase):
    """`--refresh` が「名指しした 1 件だけ」を書き直すことを確かめる。

    ここで守っているのは digest の計算ではなく、**更新の範囲**です。
    一括更新できてしまうと、直したかった 1 件のついでに、
    まだ誰も見ていない証跡まで「現在の中身が正しい」と署名されます。
    """

    def write_two_stale(self, root: Path) -> Path:
        entries = []
        for name in ("p01", "p06"):
            (root / f"{name}.txt").write_bytes(f"{name} changed\n".encode())
            entries.append(
                {
                    "id": name,
                    "path": f"{name}.txt",
                    "sha256": "0" * 64,
                    "captured_at": "2026-08-01T00:00:00Z",
                    "requirements": [f"A{i}" for i in range(1, 13)],
                    "phases": ["P01", "P06", "P07", "P09", "P10"],
                }
            )
        index = root / "index.json"
        index.write_text(
            json.dumps(
                {
                    "schema_version": 1,
                    "generated_at": "2026-08-01T00:00:00Z",
                    "tool_versions": {"verifier": "1"},
                    "entries": entries,
                }
            ),
            encoding="utf-8",
        )
        return index

    def test_refreshes_only_the_named_entry(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            index = self.write_two_stale(root)

            outcome = refresh_entries(index, root, ["p01"], NOW)
            report = verify_index(index, root)
            document = json.loads(index.read_text(encoding="utf-8"))

        self.assertTrue(outcome["ok"])
        self.assertEqual(outcome["refreshed"], ["p01"])
        # 名指ししなかった p06 は stale のまま。これが「一括更新は無い」ことの証拠。
        self.assertEqual(report["stale"], ["p06"])
        by_id = {entry["id"]: entry for entry in document["entries"]}
        self.assertEqual(by_id["p01"]["sha256"], digest(b"p01 changed\n"))
        self.assertEqual(by_id["p01"]["captured_at"], NOW)
        self.assertEqual(by_id["p06"]["captured_at"], "2026-08-01T00:00:00Z")

    def test_rejects_entry_that_is_not_stale(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            index = write_fixture(root)
            before = index.read_text(encoding="utf-8")

            outcome = refresh_entries(index, root, ["all-requirements"], NOW)

            self.assertFalse(outcome["ok"])
            self.assertEqual(outcome["rejected"], ["all-requirements"])
            # 拒んだときは 1 バイトも書かない。captured_at だけが進むのを防ぐ。
            self.assertEqual(index.read_text(encoding="utf-8"), before)

    def test_rejects_unknown_id(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            index = self.write_two_stale(root)

            outcome = refresh_entries(index, root, ["p01", "typo-in-the-id"], NOW)
            report = verify_index(index, root)

        # 1 件でも名前が通らなければ何も書かない。半端に適用されるほうが厄介なので。
        self.assertFalse(outcome["ok"])
        self.assertEqual(outcome["rejected"], ["typo-in-the-id"])
        self.assertEqual(report["stale"], ["p01", "p06"])

if __name__ == "__main__":
    unittest.main()
