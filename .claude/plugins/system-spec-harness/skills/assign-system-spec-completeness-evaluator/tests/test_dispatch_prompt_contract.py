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
# 特定の一文ではなくこの 2 つの印で拾う。
# **この一覧は伸ばさない。**同義語を足しても外側は残り続け、一覧が具体的で
# 網羅的に見えるほど外側を確かめる動機が減る。取りこぼしは KNOWN_BLIND_SPOT
# のほうへ「種類」として記録する。
SERIALIZATION_MARKS = ("foreground fork", "直列")


def _normalize(line: str) -> str:
    """表記ゆれだけを潰す。言い換えは潰さない (潰せない)。

    畳む軸は正規化の種類ごとに決まっており、「正規化した」と書いただけでは
    どの軸も畳まれない。ここで畳んでいるのは全角/半角 (NFKC)、大小文字
    (casefold)、空白の数、「メッセージ」表記の 4 軸だけである。
    """
    folded = unicodedata.normalize("NFKC", line).casefold()
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


# 印を含む表記ゆれ。ここに並ぶのは「同じ語の書き方違い」だけで、言い換えでは
# ない。例を足して緑にする作業に意味があるのはこの一覧までである。
NOTATION_VARIANTS_IN_FORCE = (
    "正式 evaluator は 1 message = 1 foreground fork で直列化する。",
    "正式 evaluator は 1 メッセージ = 1 foreground fork で直列化する。",
    "正式 evaluator は 1 message  =  1 foreground fork とする。",
    "1 Message = 1 Foreground Fork で運用する。",
    "dispatch one message per foreground fork.",
    "監査 fork は必ず 1 件ずつ直列に起動する。",
)

# **塞げていない穴を、文章ではなく検査として残す。**
#
# 種類: **印を一つも使わずに直列化を述べる同義語**。この門は印 (SERIALIZATION_MARKS)
# の在否でしか拾えないので、印を持たない言い方は原理的に素通りする。下は同じ
# 1 種類の実例であって、一覧ではない。**足りない例を足す形で運用しない** —
# 例を増やしても種類は 1 つのままで、増やした分だけ「網羅した」という誤読が
# 育つ。次に別の同義語が出てきたら、それはこの種類の新しい実例であって、
# 新しい穴ではない。
#
# 反転先: 印に頼らずこの種類を拾えるようになった日に、実例を
# NOTATION_VARIANTS_IN_FORCE 側の検査へ移して本 test を削る。
# 印の一覧を長くする方向では移さない。
KNOWN_BLIND_SPOT_KIND = "印を持たない同義語 (直列化を SERIALIZATION_MARKS 抜きで述べる)"
KNOWN_BLIND_SPOT_EXAMPLES = (
    "前の fork の完全応答を受け取ってから次の 1 件を起動する。",
    "監査 fork はシリアルに 1 件ずつ起動すること。",
    "fork は逐次実行する (並走させない)。",
)

# 拾ってはいけないもの。来歴の言及と、直列化と無関係な記述。
NOT_IN_FORCE = (
    "「1 message = 1 foreground fork」という手段は撤回する。",
    "3 監査は独立 context で並走し得る。",
    "PostToolUse は matching tool call ごとに発火する。",
)


def test_gate_catches_notation_variants_of_the_retracted_means() -> None:
    for example in NOTATION_VARIANTS_IN_FORCE:
        assert states_serialization_in_force(example), example


def test_gate_ignores_retraction_and_unrelated_lines() -> None:
    for example in NOT_IN_FORCE:
        assert not states_serialization_in_force(example), example


def test_known_blind_spot_kind_is_recorded_as_a_hole() -> None:
    """塞げていない「種類」を検査として書く (doc comment の反転先を参照)。

    実例が全て素通りすることを固定する。1 件でも捕まるようになったら、それは
    種類が塞がり始めた合図なので、この test を消して実例を上の検査へ移す。
    """
    assert KNOWN_BLIND_SPOT_KIND
    for example in KNOWN_BLIND_SPOT_EXAMPLES:
        assert not states_serialization_in_force(example), example


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
