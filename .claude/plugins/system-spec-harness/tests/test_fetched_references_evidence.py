# /// script
# name: test-fetched-references-evidence
# version: 0.1.0
# purpose: R3 assembler build-fetched-references.py が取得証跡の拡張 3 欄 (freshness_source / evidence_ref / evidence_sha256) を落とさないこと、および入力を読めなかった回を「0 件で成功」として記録しないことを固定する pytest。
# inputs:
#   - argv: pytest 経由 (直接 argv は取らない)
# outputs:
#   - stdout: pytest 結果
#   - exit: 0=all pass / 1=failure
# contexts: [E, C]
# network: false
# write-scope: none
# dependencies: []
# requires-python: ">=3.9"
# ///
"""R3 assembler が拡張契約を保持することと、空振りを成功と呼ばないことを固定する。

背景 (ah-u5l.1): `build-fetched-references.py assemble` は、このリポジトリが厳格 C13 で
必須にしている `freshness_source` / `evidence_ref` / `evidence_sha256` を全 15 record から
落としていた。基本 assembler は PASS するのに repo-local の `validate-source-citation.py`
が 30 違反で FAIL する、という食い違いになる。章コンパイラが手書きの節を消したのと
同じ形——**正規生成器が拡張契約を保持しない**。

3 欄は既に `REQUIRED_INPUT_FIELDS` と `OUTPUT_FIELD_ORDER` の両方へ入っている。
だがそれを確かめる検査が 1 件も無かったので、次にどちらか片方から外れた日に黙る。
**出力キーは allowlist (`{k: normalized[k] for k in OUTPUT_FIELD_ORDER ...}`) なので、
載せ忘れた欄は例外も警告も出さずに消える。**この落ち方には音が無い。

── なぜ「素材にあって出力に無い」を数えるのか ────────────────────────

「3 欄が出力に在る」だけでは足りない。**出力に在ることは、素材から来たことを意味しない。**
allowlist の側だけが正しくても、素材の側で必須になっていなければ、欄を持たない record が
そのまま通って「3 欄を持たない出力」になる。だから両側から当てる:

  (a) 3 欄を持つ素材を入れたら、3 欄が同じ値で出てくる (保持)
  (b) 3 欄のどれかを欠いた素材は、そもそも組み立てを断られる (必須)

(b) が無いと (a) は「入れたものが出てきた」だけの主張になり、欄が無い素材への振る舞いを
何も言っていない。

── 空振りを成功と呼ばない ─────────────────────────────────

`_records_from` は以前 `data.get("records", [])` で、キー名の違う JSON を渡すと 0 件が
組み上がり `OK: 0 件を … へ書き出した` と言って exit 0 で終わっていた。
**入力を読めなかったことが、成功として記録される。**しかも紛らわしいことに、
自分の出力 (`fetched-references.json`、キーは `references`) を渡した場合がまさにこれで、
往復の確認をしようとした人が最初に踏む。

塞いだのは 2 箇所で、両方に検査を当てる:
  - `_records_from`: dict なのに `records` キーが無ければ断る (`references` は名指しで断る)
  - `assemble`: 素材 0 件を断る (正しいキーで空配列が来る道)
"""
from __future__ import annotations

import hashlib
import importlib.util
import json
from pathlib import Path

import pytest

PLUGIN_ROOT = Path(__file__).resolve().parents[1]
BUILDER = (
    PLUGIN_ROOT
    / "skills"
    / "run-system-spec-doc-fetch"
    / "scripts"
    / "build-fetched-references.py"
)

# 取得証跡の拡張 3 欄。**この tuple がテストの主語である。**
# 増やすときは、増やした欄が素材側でも必須になっているかを (b) の検査で確かめること。
EVIDENCE_FIELDS = ("freshness_source", "evidence_ref", "evidence_sha256")


def _load_builder():
    """ハイフン名のスクリプトを importlib で読む (本体と同じ解き方)。"""
    spec = importlib.util.spec_from_file_location("_builder_under_test", BUILDER)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


builder = _load_builder()


def _sha256_hex(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _record(**overrides) -> dict:
    """拡張 3 欄を持つ正例の素材。上書きしたい欄だけ渡す。

    値はどれも実物の形に合わせてある——`evidence_sha256` は小文字 16 進 64 桁、
    `freshness_source` は C13 が受ける語彙、`retrieved_at` / `latest_checked_at` は
    同じ日にしてある (取得日代入の検査に引っかからないため)。
    """
    base = {
        "target_id": "react",
        "source_url": "https://react.dev/reference/react",
        "official_publisher": "Meta",
        "official_host": "react.dev",
        "version": "19.0",
        "last_updated": "2026-06-01",
        "freshness_source": "page-declared",
        "retrieved_at": "2026-07-11T00:00:00Z",
        "latest_checked_at": "2026-07-11T00:00:00Z",
        "evidence_ref": "system-spec/retrieval-evidence/react.json",
        "evidence_sha256": _sha256_hex("react-evidence"),
        "summary": "React の公式リファレンス。",
    }
    base.update(overrides)
    return {k: v for k, v in base.items() if v is not None}


class TestEvidenceFieldsSurvive:
    """(a) 拡張 3 欄が assemble を通り抜けること。"""

    def test_three_evidence_fields_are_carried_through_unchanged(self):
        rec = _record()
        out = builder.assemble([rec])["references"][0]
        for field in EVIDENCE_FIELDS:
            assert field in out, f"{field} が出力から落ちた (OUTPUT_FIELD_ORDER の載せ忘れ)"
            assert out[field] == rec[field], f"{field} の値が書き換わった"

    def test_output_field_order_declares_all_three(self):
        """allowlist の側を直に見る。

        上の検査は 1 件の record で通せば緑になるが、この検査は宣言そのものを見る。
        片方だけで済ませると、record の作り方を変えた日に静かに緑を保てる。
        """
        for field in EVIDENCE_FIELDS:
            assert field in builder.OUTPUT_FIELD_ORDER, f"{field} が出力 allowlist に無い"

    def test_evidence_ref_and_sha256_are_required_of_the_input(self):
        """(b) 3 欄のうち素材側で必須なものは、欠けたら断られる。

        `freshness_source` は C13 側の判定に委ねられており REQUIRED_INPUT_FIELDS には
        入っていない。**その差を検査に書いておく。**「3 欄すべてが必須」と書いて緑に
        するには必須の側を広げるしかなく、そうすると既存の運用が通らなくなる。
        実物と違う主張を検査に書かない。
        """
        for field in ("evidence_ref", "evidence_sha256"):
            with pytest.raises(builder.RecordError, match=field):
                builder.build_record(_record(**{field: None}))

    def test_freshness_source_is_judged_by_c13_not_by_this_builder(self):
        """`freshness_source` の妥当性は C13 の関数が判定する (規則を 2 箇所に書かない)。"""
        with pytest.raises(builder.RecordError):
            builder.build_record(_record(freshness_source="でたらめな値"))

    def test_evidence_sha256_must_be_lowercase_hex_64(self):
        """指紋の形。大文字や短い値が通ると、証跡の突合が静かに空振りする。"""
        for bad in ("NOTAHASH", _sha256_hex("x").upper(), "abc123"):
            with pytest.raises(builder.RecordError, match="evidence_sha256"):
                builder.build_record(_record(evidence_sha256=bad))


class TestEmptyIsNotSuccess:
    """入力を読めなかった回を「0 件で成功」として記録しない。"""

    def test_dict_without_records_key_is_refused(self):
        with pytest.raises(builder.RecordError, match="records"):
            builder._records_from({"targets": []})

    def test_own_output_shape_is_refused_by_name(self):
        """自分の出力を渡す道は、名指しで断る。

        `references` キーは「素材が 1 件も無い」ではなく「入力の種類を間違えた」である。
        同じ 0 件でも原因が違うので、同じ文言で断らない。
        """
        with pytest.raises(builder.RecordError, match="fetched-references"):
            builder._records_from({"references": [_record()]})

    def test_empty_record_list_is_refused(self):
        """正しいキーで空配列が来る道。ここが開いていると全滅した回が緑で残る。"""
        with pytest.raises(builder.RecordError, match="0 件"):
            builder.assemble([])

    def test_a_list_input_is_still_accepted(self):
        """断り方を足したことで、元から通っていた形まで塞いでいないこと。

        止まる例だけを並べると、通る例が消えたことに気付けない。
        """
        assert builder._records_from([_record()]) == [_record()]
        assert builder._records_from({"records": [_record()]}) == [_record()]


class TestCliRoundTrip:
    """CLI から通したときに、拡張 3 欄が実ファイルへ書き出されること。"""

    def test_assemble_writes_evidence_fields_to_disk(self, tmp_path: Path):
        import subprocess
        import sys

        records = tmp_path / "records.json"
        records.write_text(
            json.dumps({"records": [_record()]}, ensure_ascii=False), encoding="utf-8"
        )
        out = tmp_path / "fetched-references.json"

        proc = subprocess.run(
            [sys.executable, str(BUILDER), "assemble", "--records", str(records), "--out", str(out)],
            capture_output=True,
            text=True,
        )
        assert proc.returncode == 0, proc.stderr

        written = json.loads(out.read_text(encoding="utf-8"))["references"][0]
        for field in EVIDENCE_FIELDS:
            assert field in written, f"{field} がディスク上の出力から落ちた"

    def test_cli_refuses_its_own_output_as_input(self, tmp_path: Path):
        """往復を試した人が最初に踏む道。exit 0 で「OK: 0 件」を出さないこと。"""
        import subprocess
        import sys

        bad = tmp_path / "fetched-references.json"
        bad.write_text(
            json.dumps({"references": [_record()]}, ensure_ascii=False), encoding="utf-8"
        )
        out = tmp_path / "out.json"

        proc = subprocess.run(
            [sys.executable, str(BUILDER), "assemble", "--records", str(bad), "--out", str(out)],
            capture_output=True,
            text=True,
        )
        assert proc.returncode != 0, "自分の出力を入力に取って成功で終わった"
        assert not out.exists(), "断ったのに出力ファイルを残した"


class TestEvidenceDigestIsGroundedInBytes:
    """(c) evidence_sha256 が証跡ファイルの実バイトと一致すること。

    形式検査 (`SHA256_HEX`) は「64 桁の 16 進数であること」しか言わない。
    **証跡ファイルを後から書き換えても、古い digest はその形を保ったまま通る。**
    2026-09-08 の回でまさにそれが起き、注記を足した apple-hig の証跡に対して古い digest が
    残ったまま唯一の正規 writer を素通りした。digest の目的は「記録後に証跡が改変されて
    いない」ことの担保なので、担保する側が実バイトを一度も開かないなら担保になっていない。

    検査は `--repo-root` を渡したときだけ働く (assembler を repo に縛らないため) ので、
    「渡さなければ素通りする」ことも同時に固定する——素通りが仕様であって事故ではない、
    と後から読む人に分かる形にしておく。
    """

    @staticmethod
    def _repo_with_evidence(tmp_path: Path, body: str) -> Path:
        ev = tmp_path / "system-spec" / "retrieval-evidence"
        ev.mkdir(parents=True)
        (ev / "react.json").write_text(body, encoding="utf-8")
        return tmp_path

    def test_matching_digest_passes(self, tmp_path: Path):
        body = '{"content_sha256": "x"}'
        repo = self._repo_with_evidence(tmp_path, body)
        rec = _record(evidence_sha256=_sha256_hex(body))
        out = builder.assemble([rec], repo)["references"][0]
        assert out["evidence_sha256"] == _sha256_hex(body)

    def test_stale_digest_is_refused(self, tmp_path: Path):
        """証跡を書き換えて digest を据え置いた形——今回の事故そのもの。"""
        repo = self._repo_with_evidence(tmp_path, '{"content_sha256": "x"}')
        rec = _record(evidence_sha256=_sha256_hex("古い本文"))
        with pytest.raises(builder.RecordError) as exc:
            builder.assemble([rec], repo)
        assert "実バイトと不一致" in str(exc.value)

    def test_missing_evidence_file_is_refused(self, tmp_path: Path):
        """digest の形が正しくても、指す先が無ければ担保にならない。"""
        (tmp_path / "system-spec").mkdir()
        with pytest.raises(builder.RecordError) as exc:
            builder.assemble([_record()], tmp_path)
        assert "実在しない" in str(exc.value)

    def test_evidence_ref_escaping_repo_root_is_refused(self, tmp_path: Path):
        """repo 外のファイルを指して「証跡がある」と名乗れないこと。"""
        repo = self._repo_with_evidence(tmp_path, "body")
        outside = tmp_path.parent / "outside-evidence.json"
        outside.write_text("body", encoding="utf-8")
        rec = _record(
            evidence_ref="system-spec/../../outside-evidence.json",
            evidence_sha256=_sha256_hex("body"),
        )
        with pytest.raises(builder.RecordError) as exc:
            builder.assemble([rec], repo)
        assert "repo_root の外" in str(exc.value)

    def test_without_repo_root_the_check_does_not_run(self, tmp_path: Path):
        """repo_root 省略時は純関数のまま。実行しないことを明示的に固定する。"""
        rec = _record(evidence_sha256=_sha256_hex("どこにも存在しない本文"))
        assert builder.assemble([rec])["references"][0]["target_id"] == "react"

    def test_cli_repo_root_refuses_stale_digest(self, tmp_path: Path):
        """CLI 経路でも断り、断ったときに出力を残さないこと。"""
        import subprocess
        import sys

        repo = self._repo_with_evidence(tmp_path, '{"content_sha256": "x"}')
        records = tmp_path / "records.json"
        records.write_text(
            json.dumps({"records": [_record(evidence_sha256=_sha256_hex("古い本文"))]}),
            encoding="utf-8",
        )
        out = tmp_path / "out.json"
        proc = subprocess.run(
            [
                sys.executable, str(BUILDER), "assemble",
                "--records", str(records), "--repo-root", str(repo), "--out", str(out),
            ],
            capture_output=True,
            text=True,
        )
        assert proc.returncode == 1, proc.stdout + proc.stderr
        assert "実バイトと不一致" in proc.stderr
        assert not out.exists(), "断ったのに出力ファイルを残した"
