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

    **これは下限であり、上げる方向にしか動かさない。**行走査の門を撤回した分は
    ここで受け止める (下の RETRACTED_GATE の受け止め先 3 を参照)。
    """
    for name, text in _contract_texts().items():
        assert "PostToolUse" in text, name
        assert "SubagentStop" in text, name
        assert "agent_id" in text, name
        # 帰属根拠。順序へ戻すにはこの 2 つを削るしかない。
        assert "唯一の帰属根拠" in text, name
        assert "順序・同時性" in text, name
        # 撤回で失われた保証。ここが消えたら、順序に頼る推論が黙って戻る。
        assert "順序の保証" in text, name
        # 配線を直しても過去の pending 行は resolved にならない。
        assert "遡及" in text, name
        # 目的側の条項。手段の撤回に巻き込まれて一緒に消えていないこと。
        assert "撤回していない" in text, name


# 直列化の話題を指す印。**これは規則性の判定器ではない。**印を含む行を拾うだけで、
# その行が禁止を述べているのか遵守を述べているのかは区別しない (下の
# test_marks_detector_cannot_tell_polarity がその区別ができないことを固定している)。
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


def mentions_serialization_marks(line: str) -> bool:
    """その行が直列化の印を**含むか**だけを返す。規則かどうかは判定しない。

    名前を弱いほうへ直してある。以前は `states_serialization_in_force` と名乗って
    いたが、名乗っていた判定はこの実装にはできない (下の 2 つの test を参照)。
    """
    folded = _normalize(line)
    return any(mark in folded for mark in SERIALIZATION_MARKS)


# 印を含む表記ゆれ。ここに並ぶのは「同じ語の書き方違い」だけで、言い換えでは
# ない。例を足して緑にする作業に意味があるのはこの一覧までである。
# 印は 2 つあるので、**印ごとに分けて置く**。両方の印を含む例だけで測ると、
# 片方の印だけで捕まっていた可能性を排除できない (交絡)。
NOTATION_VARIANTS_FORK_MARK = (
    "正式 evaluator は 1 message = 1 foreground fork で運用する。",
    "正式 evaluator は 1 メッセージ = 1 foreground fork で運用する。",
    "正式 evaluator は 1 message  =  1 foreground fork とする。",
    "1 Message = 1 Foreground Fork で運用する。",
    "dispatch one message per foreground fork.",
)
NOTATION_VARIANTS_SERIAL_MARK = (
    "監査 fork は必ず 1 件ずつ直列に起動する。",
    "監査 fork は必ず 1 件ずつ直列に起動すること。",
)

# **塞げていない穴を、文章ではなく検査として残す。**
#
# 種類 1: **印を一つも使わない同義語**。印の在否でしか見ていないので、印を持たない
# 言い方は原理的に素通りする。下は同じ 1 種類の実例であって一覧ではない。
# **足りない例を足す形で運用しない** — 例を増やしても種類は 1 つのままで、
# 増やした分だけ「網羅した」という誤読が育つ。次に別の同義語が出てきたら、
# それはこの種類の新しい実例であって新しい穴ではない。
# 反転先: 印に頼らずこの種類を拾えるようになった日に、実例を表記ゆれ側の検査へ
# 移して本 test を削る。印の一覧を長くする方向では移さない。
KNOWN_BLIND_SPOT_KIND = "印を持たない同義語 (直列化を SERIALIZATION_MARKS 抜きで述べる)"
KNOWN_BLIND_SPOT_EXAMPLES = (
    "前の fork の完全応答を受け取ってから次の 1 件を起動する。",
    "監査 fork はシリアルに 1 件ずつ起動すること。",
    "fork は逐次実行する (並走させない)。",
)

# 種類 2: **極性**。印の在否は、その文が禁止を述べているのか遵守を述べているのか、
# 引用しているだけなのかを区別しない。下の 3 例はいずれも「直列化しない」と
# 正しく書いた文だが、印を含むので同じように拾われる。
POLARITY_INDISTINGUISHABLE_EXAMPLES = (
    "直列化は行わない。fork は並走してよい。",
    "foreground fork という語は本文書では使わない。",
    "直列実行を前提にした記述は全て削除済みである。",
)


def test_marks_detector_catches_notation_variants_per_mark() -> None:
    for example in NOTATION_VARIANTS_FORK_MARK:
        assert "直列" not in example, f"交絡: {example}"
        assert mentions_serialization_marks(example), example
    for example in NOTATION_VARIANTS_SERIAL_MARK:
        assert "foreground fork" not in example.casefold(), f"交絡: {example}"
        assert mentions_serialization_marks(example), example


def test_marks_detector_is_blind_to_synonyms() -> None:
    """塞げていない「種類」を検査として書く (doc comment の反転先を参照)。"""
    assert KNOWN_BLIND_SPOT_KIND
    for example in KNOWN_BLIND_SPOT_EXAMPLES:
        assert not mentions_serialization_marks(example), example


# 種類 3: **宣言した 4 軸の外にある表記ゆれ。**`_normalize` が畳むと宣言したのは
# NFKC・casefold・空白の数・「メッセージ」表記の 4 つだけである。語の**内側**に
# 空白を差し込む形と、読みをカナへ置き換える形は、そのどれにも当たらない。
# **これは種類 1 (同義語) とは別の種類である** — 語を言い換えていないのに外れる。
# **足りない例を足す形で運用しない。**「全角空白」を畳めば `直・列` が残り、
# 中黒を畳めば `直_列` が残る。挿入できる文字は有限ではない。
# 反転先: 語の内側の区切り文字に依存せず印を拾える手段 (形態素解析・読み正規化) を
# 得た日に、この test を表記ゆれ側の検査へ移す。**畳む軸を 1 つずつ足す方向では
# 反転させない** (軸を足すたびに宣言と実装がずれ、何を畳んだかが読めなくなる)。
NORMALIZATION_MISSES = (
    ("直　列", "語の内側に全角空白を挿入 (空白の数ではなく位置の問題)"),
    ("チョクレツ", "漢字表記をカナの読みへ置換"),
)


def test_normalization_misses_are_recorded_as_a_kind() -> None:
    """宣言した 4 軸の外にある表記ゆれを、種類として固定する。"""
    for example, reason in NORMALIZATION_MISSES:
        assert reason
        # 交絡を排する: これらが外れるのは同義語だからではなく、正規化の軸の外だから。
        assert not mentions_serialization_marks(example), example
    # 対: 宣言した軸の内側 (全角/半角) は畳めている。常に赤い記録ではない。
    assert mentions_serialization_marks("直列")


def test_marks_detector_cannot_tell_polarity() -> None:
    """**印の在否では極性を判定できない**ことを、実行できる事実として固定する。

    肯定文 (直列化する) と否定文 (直列化しない) が同じ結果になることを示す。
    これがこの道具の性能上限なので、**この道具を「規則として述べているか」の
    門に昇格させてはならない**。昇格させると、直列化を否定する正しい記述が
    赤くなり、書き手は話題自体を避けるようになる。避けられた話題は文書から
    消え、消えたものは名乗り出ない。門が改善を罰する向きに効く形である。

    反転先: 極性を判定できる手段を得た日に、この test を「否定文を拾わない」
    検査へ書き換える。否定語の一覧を足す方向では反転させない (肯定と否定の
    語彙は対称に無限で、一覧は必ず外側を残す)。
    """
    positive = "監査 fork は必ず 1 件ずつ直列に起動する。"
    assert mentions_serialization_marks(positive)
    for negative in POLARITY_INDISTINGUISHABLE_EXAMPLES:
        assert mentions_serialization_marks(negative) == mentions_serialization_marks(
            positive
        ), negative


# **撤回した門についての記録。**
#
# ここには以前 `test_retracted_means_is_never_stated_as_in_force` があり、3 文書の
# 全行を走査して「印を含み『撤回』を含まない行」を赤にしていた。撤回した理由は
# 上の 2 つの test が示すとおりで、この判定器には (1) 印を持たない同義語が見えず、
# (2) 極性が区別できない。(2) のほうが重い。「直列化は行わない」と正しく書くと
# 赤くなり、通すには同じ行に「撤回」の 2 文字を置くしかなかった。書き手が学ぶのは
# 話題に触れないことで、それは文書から話題を消す。
#
# **緩めた分の受け止め先** (ここが無いなら撤回は選べない):
#   1. 実行側の門。`scripts/audit_fork_attribution.py` の畳み込みが、起動行と
#      `agent_id` 一致の解決行が揃わない fork を receipt にしない。文書に何を
#      書いても、順序を根拠に receipt を作ることはできない。
#   2. hook 側の門。`hooks/record-audit-fork.py` の `resolvable_launch` が、
#      引き当て 0 件・2 件以上・最終行が marker でない応答を resolved にしない。
#   3. 文書側の下限。`test_audit_fork_attribution_is_bound_by_agent_id` が、
#      帰属根拠 (`agent_id` / 唯一の帰属根拠 / 順序・同時性は根拠にしない) と
#      失われた保証 (順序の保証) と遡及しない条項と、撤回していない禁止の
#      在ることを 3 文書に要求する。帰属根拠を順序へ戻すには、これらの条文を
#      削るしかなく、削れば赤くなる。**下限は上げる方向にしか動かさない。**
#
# 受け止められないもの: 帰属根拠に触れずに、運用上の推奨として直列化を書き足す
# 形。これは receipt の作られ方を変えないので、害が無い側に倒して受け入れる。
RETRACTED_GATE = "test_retracted_means_is_never_stated_as_in_force (極性を判定できないため撤回)"


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
