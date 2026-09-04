#!/usr/bin/env python3
# /// script
# name: test-compile-spec-doc-cli
# version: 0.1.0
# purpose: compile-spec-doc CLI の成功・異常系を検証する。500行上限を守るため本体の文書内容テストから分離する。
# inputs:
#   - argv: pytest 経由 (直接 argv は取らない)
# outputs:
#   - stdout: pytest 結果
#   - exit: 0=PASS / 非0=FAIL
# contexts: [C, E]
# network: false
# write-scope: none (tmp_path のみ)
# dependencies: []
# requires-python: ">=3.9"
# ///
"""run-system-spec-compile の CLI 契約を独立して検証する。"""
from __future__ import annotations

import importlib.util
import json
from pathlib import Path


SKILL_DIR = Path(__file__).resolve().parents[1]
FIXTURES = SKILL_DIR / "fixtures"
SPEC = FIXTURES / "spec-state.json"
REFS = FIXTURES / "fetched-references.json"
spec = importlib.util.spec_from_file_location("compile_spec_doc_cli", SKILL_DIR / "scripts" / "compile-spec-doc.py")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


def _parse_frontmatter(text: str) -> dict:
    fm: dict = {}
    for line in text.split("---", 2)[1].splitlines():
        if ":" in line:
            key, _, value = line.partition(":")
            fm[key.strip()] = value.strip()
    return fm


def test_cli_compile_writes_docset(tmp_path):
    out_dir = tmp_path / "system-spec"
    rc = mod.main(["compile", "--spec", str(SPEC), "--references", str(REFS), "--out-dir", str(out_dir)])
    assert rc == 0
    assert (out_dir / "index.md").is_file()
    assert _parse_frontmatter((out_dir / "database.md").read_text(encoding="utf-8"))["status"] == "confirmed"


def test_cli_compile_matches_golden(tmp_path):
    out_dir = tmp_path / "system-spec"
    assert mod.main(["compile", "--spec", str(SPEC), "--references", str(REFS), "--out-dir", str(out_dir)]) == 0
    assert (out_dir / "index.md").read_text(encoding="utf-8") == (FIXTURES / "expected-index.md").read_text(encoding="utf-8")


def test_cli_acknowledge_prior_residue_clears_only_the_reviewed_copy(tmp_path):
    """明示CLIだけが、レビュー済みの過去residueを正規writer出力から外す。"""
    out_dir = tmp_path / "system-spec"
    base_args = [
        "compile",
        "--spec",
        str(SPEC),
        "--references",
        str(REFS),
        "--out-dir",
        str(out_dir),
        "--only",
        "database.md",
    ]
    assert mod.main(base_args) == 0
    target = out_dir / "database.md"
    reviewed = "| Drizzle | `1.6.29` | 旧公式version |"
    target.write_text(target.read_text(encoding="utf-8") + reviewed + "\n", encoding="utf-8")

    assert mod.main(base_args) == 0
    assert f"- `{reviewed}`" in target.read_text(encoding="utf-8")
    assert mod.main([*base_args, "--acknowledge-prior-residue"]) == 0
    out = target.read_text(encoding="utf-8")
    assert reviewed not in out
    assert mod.RESIDUE_HEADING not in out


def test_cli_bad_spec_returns_1(tmp_path):
    rc = mod.main(["compile", "--spec", str(tmp_path / "nope.json"), "--references", str(REFS), "--out-dir", str(tmp_path / "o")])
    assert rc == 1


def test_cli_compile_error_returns_1(tmp_path):
    bad_spec = tmp_path / "bad.json"
    bad_spec.write_text(json.dumps({"platforms": [], "matrix": {}}), encoding="utf-8")
    assert mod.main(["compile", "--spec", str(bad_spec), "--references", str(REFS), "--out-dir", str(tmp_path / "o")]) == 1


def test_write_docset_creates_files(tmp_path):
    written = mod.write_docset({"a.md": "hello", "index.md": "idx\n"}, tmp_path / "out")
    assert len(written) == 2
    assert (tmp_path / "out" / "a.md").read_text(encoding="utf-8") == "hello\n"


def test_load_json_roundtrip(tmp_path):
    path = tmp_path / "x.json"
    path.write_text(json.dumps({"k": 1}), encoding="utf-8")
    assert mod.load_json(str(path)) == {"k": 1}


# --------------------------------------------------------------------------- #
# 手書き節の保全 (fail-closed)                                                  #
#                                                                              #
# compile は正本からの純関数導出しか生成しない。よって既存章にあって生成物に無い #
# 節は人が後から書いたものであり、黙って上書きすると差分を見るまで気づかれない。 #
# 2026-08-23 時点の system-spec では frontend / auth / security /               #
# maintenance-ops / ui-ux の 5 章が ## As-Is / ## To-Be / ## Delta / ## 履歴 を  #
# 持ち、compile を走らせれば全部消えていた。                                    #
# --------------------------------------------------------------------------- #
GENERATED = "---\nstatus: confirmed\n---\n\n## 収集状態\n\nあ\n"
HANDWRITTEN = GENERATED.rstrip("\n") + "\n\n## As-Is\n\n手で書いた現状\n\n## 履歴\n\n手で書いた履歴\n"


def test_handwritten_sections_finds_only_what_generation_lacks():
    lost = mod.handwritten_sections(HANDWRITTEN, GENERATED)
    assert lost == ["## As-Is", "## 履歴"]


def test_handwritten_sections_is_silent_when_nothing_would_be_lost():
    assert mod.handwritten_sections(GENERATED, GENERATED) == []
    # 生成側にだけ在る節は「消える節」ではない (向きを取り違えていないこと)
    assert mod.handwritten_sections(GENERATED, HANDWRITTEN) == []


def test_write_docset_refuses_and_writes_nothing_when_sections_would_be_lost(tmp_path):
    out = tmp_path / "out"
    out.mkdir()
    (out / "a.md").write_text(HANDWRITTEN, encoding="utf-8")
    (out / "b.md").write_text("## 収集状態\n\nい\n", encoding="utf-8")
    try:
        mod.write_docset({"a.md": GENERATED, "b.md": "## 収集状態\n\nう\n"}, out)
    except Exception as exc:  # CompileError
        assert "As-Is" in str(exc) and "履歴" in str(exc)
    else:
        raise AssertionError("手書き節があるのに書き込みが通った")
    # 危ない章が 1 つでもあれば、無事な章も書き換えない (部分適用しない)
    assert (out / "a.md").read_text(encoding="utf-8") == HANDWRITTEN
    assert (out / "b.md").read_text(encoding="utf-8") == "## 収集状態\n\nい\n"


def test_write_docset_preserve_carries_handwritten_sections_over(tmp_path):
    out = tmp_path / "out"
    out.mkdir()
    (out / "a.md").write_text(HANDWRITTEN, encoding="utf-8")
    mod.write_docset({"a.md": GENERATED}, out, on_handwritten="preserve")
    result = (out / "a.md").read_text(encoding="utf-8")
    assert "手で書いた現状" in result and "手で書いた履歴" in result
    # 生成側の内容が引き継ぎに負けていないこと
    assert "## 収集状態" in result
    # 二度走らせても増殖しないこと (preserve が自分の出力を手書きと読み直さない)
    mod.write_docset({"a.md": GENERATED}, out, on_handwritten="preserve")
    assert (out / "a.md").read_text(encoding="utf-8").count("手で書いた履歴") == 1


def test_vanishing_lines_ignores_moved_sections_and_finds_real_loss():
    # 節が末尾へ移っただけの行は消えたと数えない (行の多重集合で引くため)
    moved = "## B\n\nに\n\n## A\n\nあ\n"
    original = "## A\n\nあ\n\n## B\n\nに\n"
    assert mod.vanishing_lines(original, moved) == []
    # 生成節の中で書き換えられた行はどこにも無くなるので拾う
    assert mod.vanishing_lines("## A\n\n版 1.6.29\n", "## A\n\n版 1.7.1\n") == ["版 1.6.29"]


def test_vanishing_lines_does_not_call_deduplication_a_loss():
    """**写しが 2 通から 1 通になっただけの行を、損失と呼ばないこと。**

    質疑の役割が主 (`qa_ref`) から裏付け (`qa_refs`) へ移ると、その回答は質疑録に
    1 度だけ描かれ、設計知識の側は参照ポインタになる。本文は 1 行も失われていないのに、
    多重集合の引き算では 7 行 × 2 章が「保てなかった行」として章末へ並んだ
    (2026-08-25 実測、infrastructure / maintenance-ops)。
    """
    twice = "## A\n\n同じ行\n\n## B\n\n同じ行\n"
    once = "## A\n\n同じ行\n\n## B\n"
    assert mod.vanishing_lines(twice, once) == []


def test_vanishing_lines_still_reports_a_line_that_left_the_document():
    """上が緩みでないことの陽性対照。**1 通も残らなければ、今も報告に出る。**"""
    twice = "## A\n\n同じ行\n\n## B\n\n同じ行\n"
    assert mod.vanishing_lines(twice, "## A\n\n## B\n") == ["同じ行"]


def test_write_docset_carries_handwritten_subsections_instead_of_losing_them(tmp_path):
    """生成節の内側の手書き小節は、**報告ではなく本文として**残ること。

    2026-08-23 に本物の章で実測したとき、preserve でも 351 行が消えた。
    先行質疑 (qa-security-web など) と ui-ux の食い違い記録がそこに含まれていた。
    当時この試験は「消えたことが報告に出る」を求めていた。報告は消失そのものを
    止めないので、**当時取れた最善**ではあっても、置き場所ではなかった。

    2026-08-25、`handwritten_subsections` が `###` 以下を引き継ぐようになった。
    求めるものはここで 1 段上がる——**消えたと言えることではなく、消えないこと。**
    したがって損失報告が空であることは緑であり、退行ではない。本文が
    `CARRIED_HEADING` の節に居ることを、同じ 1 件で必ず確かめる
    (報告が空なだけの緑は、引き継ぎが黙って壊れた日と見分けがつかない)。
    """
    out = tmp_path / "out"
    out.mkdir()
    # 生成側と同名の節の中に、人が書き足した小節がある
    (out / "a.md").write_text("## 収集状態\n\nあ\n\n### 先行質疑\n\n消えては困る記録\n", encoding="utf-8")
    losses: list = []
    mod.write_docset({"a.md": "## 収集状態\n\nあ\n"}, out, on_handwritten="preserve", loss_report=losses)
    written = (out / "a.md").read_text(encoding="utf-8")
    assert mod.CARRIED_HEADING in written, "引き継ぎ節そのものが立っていない"
    assert "### 先行質疑" in written
    assert "消えては困る記録" in written
    assert losses == [], f"引き継げているのに消失として報告された: {losses}"


def test_write_docset_still_reports_lines_that_have_nowhere_to_be_carried(tmp_path):
    """**引き継ぎ先が無い 1 行は、今も報告に出ること。**

    上の試験が緩みでないことの陽性対照である。小節を引き継げるようになっても、
    見出しに属さない裸の 1 行 (表の行など) は行き場が無い。表から切り離せば意味が
    壊れ、生成節へ差し戻せば正本の投影と手書きの区別が消える。だから本文ではなく
    報告として残す——この層が黙り出したら、上の緑は「引き継いだ」ではなく
    「見ていない」を意味するようになる。
    """
    out = tmp_path / "out"
    out.mkdir()
    (out / "a.md").write_text("## 収集状態\n\n| Web | 確定 | 手で足した行 |\n", encoding="utf-8")
    losses: list = []
    mod.write_docset({"a.md": "## 収集状態\n\nあ\n"}, out, on_handwritten="preserve", loss_report=losses)
    assert losses, "引き継ぎ先の無い行が消えたのに報告されなかった"
    name, lines = losses[0]
    assert name == "a.md"
    assert any("手で足した行" in l for l in lines)
    assert mod.RESIDUE_HEADING in (out / "a.md").read_text(encoding="utf-8")


def test_write_docset_rejects_unknown_mode(tmp_path):
    try:
        mod.write_docset({"a.md": GENERATED}, tmp_path / "out", on_handwritten="overwrite")
    except Exception as exc:
        assert "refuse" in str(exc)
    else:
        raise AssertionError("知らない扱い方が通った")
