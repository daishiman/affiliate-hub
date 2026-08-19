/**
 * @tier 1
 * @req REQ-W10
 * @types equivalence, boundary
 *
 * 差別化の 10 軸が、**言い換えを別物と数えていないか**を見る。
 *
 * 仕様 §16.6 の見出しは「マルチサイトの重複対策」で、本文の 1 行目は
 * 「単なる言い換え記事を量産しない」である。10 軸はそのための道具で、
 * 「サイトごとに以下を変える」の中身にあたる。
 *
 * ところが `differentiationGap()` は `a[k].trim() !== b[k].trim()` の
 * **文字列の一致だけ**で「違う」を数えていた。語尾を変える、送り仮名を変える、
 * 同義語に置き換える——どれも文字列としては違うので、
 * **軸を 3 つ言い換えるだけで「十分に差別化されている」と出る**。
 * これは §16.6 が名指しで禁じている当のものである。
 *
 * `docs/product/traceability.md` の REQ-W10 の行は
 * 「言い換え本文は `similarity()` ≥0.85 で停止」と書いているが、
 * それは記事本文（`quality-check.ts`）の話で、軸の側は素通りしていた。
 * 「言い換え禁止」の要件に対して、**本文にだけ道具があり、軸には無かった**。
 *
 * 近さの物差しは既にある `similarity()`（3-gram の重なり率）を使う。
 * 新しい物差しを作らない——2 つあると、片方だけ緩めて通せる。
 */
import { describe, expect, it } from "vitest";
import type { DifferentiationAxes } from "@/domain/authoring";
import { differentiationGap } from "@/domain/authoring";

const BASE: DifferentiationAxes = {
  targetReader: "動画編集をこれから始める人",
  searchIntent: "最初の 1 本をどれにするか決めたい",
  articlePurpose: "候補を 3 つにしぼって比較検討へ進ませる",
  evaluationAxis: "書き出し速度と静音性を重く見る",
  usageScene: "自宅の机で夜に作業する",
  uniqueExperience: "同じ素材を 5 台で書き出して測った",
  comparisonScope: "10 万円台のノート 5 機種",
  conclusionStance: "静音を優先するなら A、速さなら B",
  internalLinkStrategy: "書き出し設定の解説記事へ送る",
  ctaStrategy: "価格比較ページへの導線を本文末に置く",
};

/**
 * **言い換えただけの 3 軸。** 意味は変えていない。
 *
 * 文字列としては 1 文字も同じ位置に無い軸すらあるが、
 * 読んで得られるものは `BASE` と同じである。
 * 送り仮名・語尾・語順・同義語だけを触っている。
 */
const PARAPHRASED_THREE: DifferentiationAxes = {
  ...BASE,
  targetReader: "動画編集をこれから始める方",
  searchIntent: "最初の 1 本をどれにするか決めたいです",
  articlePurpose: "候補を 3 つにしぼって比較検討へ進ませます",
};

describe("差別化の軸が言い換えを見抜くこと", () => {
  /*
   * この 1 本が本体である。落ちるときは
   * 「軸を言い換えるだけで別のブログとして通る」という意味になる。
   */
  it("軸を 3 つ言い換えただけでは、十分に差別化されたことにならない", () => {
    const gap = differentiationGap(BASE, PARAPHRASED_THREE);
    expect(
      gap.sufficient,
      `言い換えただけの軸が「違う」と数えられています: ${gap.differentAxes.join(" / ")}\n` +
        "仕様 §16.6 は「単なる言い換え記事を量産しない」ためにこの 10 軸を置いています。" +
        "文字列の一致だけで数えると、語尾を変えるだけで要件を満たしたことになります。",
    ).toBe(false);
  });

  it("言い換えた軸は、違う軸として数に入らない", () => {
    const gap = differentiationGap(BASE, PARAPHRASED_THREE);
    expect(
      gap.differentAxes,
      "言い換えただけの軸が、違う軸の一覧に載っています。" +
        "この一覧は画面に「この軸が違います」として出るので、載ると嘘の説明になります。",
    ).toEqual([]);
  });

  /*
   * **陽性対照。** 上の 2 本だけだと、`sufficient` を常に false にしても緑になる。
   * 本当に違うものは通ることを、同じ組で固定する。
   */
  it("中身が本当に違う 3 軸は、いままでどおり違うと数える", () => {
    const gap = differentiationGap(BASE, {
      ...BASE,
      targetReader: "撮影を仕事にしている人",
      searchIntent: "いま使っている機材から乗り換えるべきか知りたい",
      articlePurpose: "乗り換えの損益を数字で示す",
    });
    expect(
      gap.differentAxes.length,
      "本当に違う軸まで「同じ」と数えています。断りすぎです。",
    ).toBe(3);
    expect(gap.sufficient).toBe(true);
  });

  /*
   * 表記ゆれだけの差も同じ扱いにする。**空白の除去では足りない。**
   * `trim()` は両端しか見ないので、中に入れた空白と全角半角の差が残る。
   */
  it("表記のゆれだけの差は、違う軸として数えない", () => {
    const gap = differentiationGap(BASE, {
      ...BASE,
      comparisonScope: "10万円台のノート5機種",
      usageScene: "自宅の 机で夜に作業する",
    });
    expect(
      gap.differentAxes,
      `表記のゆれが違う軸として数えられています: ${gap.differentAxes.join(" / ")}`,
    ).toEqual([]);
  });
});
