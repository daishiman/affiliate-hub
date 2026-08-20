"""C05 監査 fork の完全 response 台帳束縛を静的に固定する。"""
import re
import unicodedata
from pathlib import Path


SKILL_ROOT = Path(__file__).resolve().parents[1]


def _contract_texts() -> dict[str, str]:
    return {
        "SKILL.md": (SKILL_ROOT / "SKILL.md").read_text(encoding="utf-8"),
        "R1-score.md": (SKILL_ROOT / "prompts" / "R1-score.md").read_text(encoding="utf-8"),
        "R2-delegate.md": (SKILL_ROOT / "prompts" / "R2-delegate.md").read_text(encoding="utf-8"),
    }


def test_audit_fork_attribution_is_bound_by_agent_id() -> None:
    """帰属の根拠が `agent_id` の照合であることを 3 文書で固定する。

    以前この検査は「1 message = 1 foreground fork」という語の在否だけを見ていた。
    その語は手段の名前であって目的ではない。手段が撤回された後もその語は
    「撤回した」という文の中に残るので、語の在否を見る検査は撤回に気づかない。
    見るべきは、束縛の根拠 (`agent_id`) と、撤回で失われた保証 (順序の保証) と、
    撤回していない禁止 (起動受理を verdict にしない) が条文として在ることである。
    """
    for name, text in _contract_texts().items():
        assert "PostToolUse" in text, name
        assert "SubagentStop" in text, name
        assert "agent_id" in text, name
        # 撤回で失われた保証。ここが消えたら、順序に頼る推論が黙って戻る。
        assert "順序の保証" in text, name
        # 配線を直しても過去の pending 行は resolved にならない。
        assert "遡及" in text, name
        # 目的側の条項。手段の撤回に巻き込まれて一緒に消えていないこと。
        assert "撤回していない" in text, name


# 直列化の到達点を指す印。禁止しているのは語ではなく到達点なので、
# 特定の一文ではなくこの 2 つの印で拾う。表記ゆれ (全角、空白の数、
# 「メッセージ」表記、英語の言い換え) は正規化で潰す。
SERIALIZATION_MARKS = ("foreground fork", "直列")


def _normalize(line: str) -> str:
    folded = unicodedata.normalize("NFKC", line)
    folded = folded.replace("メッセージ", "message")
    return re.sub(r"\s+", " ", folded)


def states_serialization_in_force(line: str) -> bool:
    """その行が「直列化を、いま効いている規則として」述べているか。

    撤回の文脈 (同一行に「撤回」) を伴う言及は来歴なので規則ではない。
    """
    folded = _normalize(line)
    if not any(mark in folded for mark in SERIALIZATION_MARKS):
        return False
    return "撤回" not in folded


# 同じ到達点を述べる合成例。門を直すたびにこの一覧で測り直す。
PARAPHRASES_IN_FORCE = (
    "正式 evaluator は 1 message = 1 foreground fork で直列化する。",
    "正式 evaluator は 1 メッセージ = 1 foreground fork で直列化する。",
    "dispatch one message per foreground fork.",
    "正式 evaluator は 1 message  =  1 foreground fork とする。",
    "監査 fork は必ず 1 件ずつ直列に起動する。",
)

# **塞げていない穴を、文章ではなく検査として残す。**
# 直列化は「印になる語を一つも使わずに」述べられる。下の例がそれで、現在の門は
# 拾えない。拾えないことをここで固定しておくと、次に読む人が「この門は全ての
# 言い換えを塞いでいる」と誤読できなくなる。
# 反転先: 印に頼らずこの形を拾えるようにした日に、この例を PARAPHRASES_IN_FORCE
# へ移して本 test を削る。印の一覧を長くする方向では移さない (一覧が具体的で
# 網羅的に見えるほど、外側を確かめる動機が減るため)。
PARAPHRASE_NOT_CAUGHT = "前の fork の完全応答を受け取ってから次の 1 件を起動する。"


def test_gate_catches_paraphrases_of_the_retracted_means() -> None:
    for example in PARAPHRASES_IN_FORCE:
        assert states_serialization_in_force(example), example


def test_gate_ignores_retraction_context() -> None:
    retraction = "「1 message = 1 foreground fork」で直列化する手段は撤回した。"
    assert not states_serialization_in_force(retraction)


def test_known_uncaught_paraphrase_is_recorded_as_a_hole() -> None:
    """塞げていないことを検査として書く (doc comment の反転先を参照)。"""
    assert not states_serialization_in_force(PARAPHRASE_NOT_CAUGHT)


def test_retracted_means_is_never_stated_as_in_force() -> None:
    """直列化が、いま効いている規則として 3 文書のどこにも書かれていないこと。

    印を使わない言い換えは素通りする (上の hole test を参照)。素通りの範囲では
    `test_audit_fork_attribution_is_bound_by_agent_id` の下限が対になるが、
    **対は言い換えを塞いでいない**。塞ぎ切れていない事実のほうを残してある。
    """
    for name, text in _contract_texts().items():
        for lineno, line in enumerate(text.splitlines(), start=1):
            assert not states_serialization_in_force(line), (
                f"{name}:{lineno} が直列化をいま効いている規則として述べている"
            )


def test_three_auditors_keep_the_complete_response_binding() -> None:
    texts = _contract_texts()
    for name in ("SKILL.md", "R2-delegate.md"):
        text = texts[name]
        assert "AUDIT_VERDICT" in text, name
        assert "background/非同期" in text, name

    assert "3 監査は独立 context で並走し得る" not in texts["R2-delegate.md"]
    assert "並走させ得る" not in texts["R1-score.md"]


def test_five_axis_wording_includes_foundation_source_evidence() -> None:
    score = (SKILL_ROOT / "prompts" / "R1-score.md").read_text(encoding="utf-8")
    delegate = (SKILL_ROOT / "prompts" / "R2-delegate.md").read_text(encoding="utf-8")
    criteria = (SKILL_ROOT / "references" / "aspect-criteria.md").read_text(encoding="utf-8")

    for text in (score, delegate, criteria):
        assert "5 軸" in text
        assert "foundation 利用者根拠" in text
        assert "4 軸" not in text
