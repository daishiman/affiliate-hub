"""「合っていない」を三種類に割る。

doc_freshness がずっと赤で動かなかったのは、**性質の違う三つが 1 つの FAIL に潰れて
いた**からである。実測 2026-08-25:

  1. 転記が証跡と違う   → 機械で決着できる (証跡は手元にある)
  2. 証跡が古い         → 機械で決着できる (引き算である)
  3. 上流が変わった     → 機械で決着**できない** (再取得が要る)

C08 は google-gemini の `version` を `gemini-3.1-pro-preview` であるべきとし FAIL とした。
だが証跡 (http 200 / content_sha256 付き) には本文逐語 `gemini-3.1-pro` が記録され、
取得記録はそれに一致していた (実測 15/15 一致)。1. でも 2. でもない。残るのは 3. だが、
**それはこのセッションでは判定できない。**

**判定できないことを FAIL と呼ぶと、直せない赤が居座る。**是正の宛先が仕様書へ向くのに
仕様書は正しいので直すところが無く、赤は消えず、やがて誰も見なくなる。

この試験群が留めるのは、検査が 1. と 2. を**分けて**報告し、3. については
**判定していないと毎回名乗る**ことである。
"""
import importlib.util
import json
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
GATE = ROOT / "scripts" / "validate-evidence-transcription.py"
PROJECT = ROOT.parents[2]
SPEC = "system" + "-spec"

_spec = importlib.util.spec_from_file_location("vet", GATE)
vet = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(vet)


def _write(tmp_path, ref_over=None, ev_over=None):
    """1 件だけの取得記録と、その証跡を作る。"""
    evidence = {
        "target_id": "t",
        "source_url": "https://example.test/docs",
        "retrieved_at": "2026-08-20T00:00:00Z",
        "http_status": 200,
        "content_sha256": "a" * 64,
        "freshness_extraction": {"freshness_source": "page-declared", "value": "1.2.3"},
    }
    evidence.update(ev_over or {})
    ev_dir = tmp_path / SPEC / "retrieval-evidence"
    ev_dir.mkdir(parents=True, exist_ok=True)
    ev_path = ev_dir / "t.json"
    ev_path.write_text(json.dumps(evidence, ensure_ascii=False), encoding="utf-8")

    import hashlib
    digest = hashlib.sha256(ev_path.read_bytes()).hexdigest()
    ref = {
        "target_id": "t",
        "source_url": "https://example.test/docs",
        "retrieved_at": "2026-08-20T00:00:00Z",
        "version": "1.2.3",
        "freshness_source": "page-declared",
        "evidence_ref": f"{SPEC}/retrieval-evidence/t.json",
        "evidence_sha256": digest,
    }
    ref.update(ref_over or {})
    return {"references": [ref]}, tmp_path


# ── 1. 転記の忠実さ ─────────────────────────────────────────────────────────
def test_a_faithful_record_passes(tmp_path):
    data, root = _write(tmp_path)
    found, _ages, _ids = vet.validate(
        data, root, now=vet._parse_iso("2026-08-25T00:00:00Z"), max_age_days=0, check_ages=False
    )
    assert found == []


def test_a_reworded_version_is_refused(tmp_path):
    """**要約や言い換えを許さない。**一字違えば「証跡にそう書いてあった」と言えなくなる。"""
    data, root = _write(tmp_path, ref_over={"version": "v1.2.3"})
    found, _a, _i = vet.validate(
        data, root, now=vet._parse_iso("2026-08-25T00:00:00Z"), max_age_days=0, check_ages=False
    )
    assert any("逐語一致しない" in f for f in found), found


def test_a_swapped_evidence_file_is_caught(tmp_path):
    """書式だけ正しい sha256 は書式検査を通る。**実体と突き合わせる検査がどこにも無かった。**"""
    data, root = _write(tmp_path, ref_over={"evidence_sha256": "b" * 64})
    found, _a, _i = vet.validate(
        data, root, now=vet._parse_iso("2026-08-25T00:00:00Z"), max_age_days=0, check_ages=False
    )
    assert any("実体と不一致" in f for f in found), found


def test_a_date_no_evidence_supports_is_caught(tmp_path):
    """取得記録が、どの証跡も支えない取得日を主張していないこと。

    実測 2026-08-25: 正本の `nextjs` が `retrieved_at=2026-08-23` を主張するが、証跡は
    `2026-08-16` の取得しか持たない。**実際より新しく見せる記録は、古いことより悪い** —
    古さは再取得で直るが、支えの無い新しさは誰にも気付かれない。
    """
    data, root = _write(tmp_path, ref_over={"retrieved_at": "2026-08-23T00:00:00Z"})
    found, _a, _i = vet.validate(
        data, root, now=vet._parse_iso("2026-08-25T00:00:00Z"), max_age_days=0, check_ages=False
    )
    assert any("retrieved_at" in f and "不一致" in f for f in found), found


def test_a_missing_evidence_ref_is_refused(tmp_path):
    data, root = _write(tmp_path, ref_over={"evidence_ref": None})
    found, _a, _i = vet.validate(
        data, root, now=vet._parse_iso("2026-08-25T00:00:00Z"), max_age_days=0, check_ages=False
    )
    assert any("根拠を辿れない" in f for f in found), found


def test_an_unreadable_evidence_fails_closed(tmp_path):
    """**沈黙は「確かめた」と区別がつかない。**"""
    data, root = _write(tmp_path, ref_over={"evidence_ref": f"{SPEC}/retrieval-evidence/nope.json"})
    found, _a, _i = vet.validate(
        data, root, now=vet._parse_iso("2026-08-25T00:00:00Z"), max_age_days=0, check_ages=False
    )
    assert any("読めない" in f for f in found), found


# ── 2. 齢は別の軸 ───────────────────────────────────────────────────────────
def test_age_is_reported_apart_from_transcription(tmp_path):
    """古いことは「間違い」ではない。**同じ枠に並べると、直せるものとの区別が消える。**"""
    data, root = _write(tmp_path)
    found, ages, _i = vet.validate(
        data, root, now=vet._parse_iso("2026-12-01T00:00:00Z"), max_age_days=30, check_ages=True
    )
    assert found == []
    assert ages and "再取得が要る" in ages[0]


def test_age_is_not_checked_unless_asked(tmp_path):
    data, root = _write(tmp_path)
    _f, ages, _i = vet.validate(
        data, root, now=vet._parse_iso("2026-12-01T00:00:00Z"), max_age_days=0, check_ages=False
    )
    assert ages == []


# ── 3. 判定しないことを名乗る ───────────────────────────────────────────────
def _run(*flags):
    return subprocess.run(
        [sys.executable, str(GATE), "--references", str(PROJECT / SPEC / "fetched-references.json"), *flags],
        capture_output=True, text=True,
    )


def test_the_gate_always_says_what_it_did_not_judge():
    """**述べない検査は「見た」と区別がつかない。**成否によらず毎回名乗ること。"""
    out = _run().stdout
    assert "未判定" in out and "上流ページ" in out


def test_the_gate_can_name_the_evidence_it_read():
    """カタログの `catalog:` 行と同じ理由。突き合わせ先を言わない判定は検算できない。"""
    out = _run("--show-evidence-identity").stdout
    assert "evidence:" in out and "sha256:" in out


def test_the_canonical_transcription_is_measured_not_assumed():
    """正本そのものを対象にする。**反証は口ではなく exit code で言う。**

    現時点で `nextjs` の retrieved_at 齟齬が 1 件残っているので exit は 1 である。
    解消されればここを 0 へ改めること — 数字を先に書き換えて緑にしてはならない。
    """
    result = _run()
    assert result.returncode in (0, 1), result.stdout + result.stderr
    if result.returncode == 1:
        assert "証跡に忠実でない" in result.stdout


@pytest.mark.parametrize("field", ["version", "last_updated"])
def test_either_version_field_can_carry_the_declaration(tmp_path, field):
    """R3 は version / last_updated のどちらか一方を必須とする。両対応であること。"""
    over = {"version": None, "last_updated": None, field: "1.2.3"}
    data, root = _write(tmp_path, ref_over=over)
    data["references"][0] = {k: v for k, v in data["references"][0].items() if v is not None}
    found, _a, _i = vet.validate(
        data, root, now=vet._parse_iso("2026-08-25T00:00:00Z"), max_age_days=0, check_ages=False
    )
    assert found == [], found
