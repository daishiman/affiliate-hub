/**
 * @tier 1
 * @req REQ-QC02, REQ-QC03, REQ-QC05, REQ-QC06, REQ-QC07, REQ-W08, REQ-W12
 * @types boundary, decision-table, equivalence
 *
 * `boundary` の根拠は末尾の 2 つである。
 * 「文体の決まりに書いた数が、実際に効いている」は、表が名乗る「1〜3 文」の
 * 3 と 4 の境目そのものを当てどころにしている。
 * 「価格の鮮度の上限が、実際に効いている」は 72 時間ちょうどと 73 時間の境目を当てる。
 * **どちらも期待値を要件の側から手で書き写している**（実装の定数から組み立てると、
 * 値を変えても入力が同じ側に居続けて永久に赤くならない）。
 *
 * 一覧で決めている検査を、一覧の全行に当てる。
 *
 * 品質検査の中身は、正規表現や語の**一覧**で決めているものが 5 つある
 * （誇大表現 8 / 見出し 8 / 相対的な日付 11 / 単位を付ける語 13 / 一人称の言い回し）。
 * これまでの検査は、どれも**そのうち 1 つ**だけを試していた。
 *
 * 1 つだけ試すと、次の 3 つがどれも緑のまま通る。
 *
 *   一覧から語を 1 つ消す      … 消えた語は誰も試していない
 *   足した正規表現が何にも当たらない … 足したこと自体は誰も見ていない
 *   書き換えて別のものを指す   … 試している 1 件さえ当たれば緑
 *
 * `policy-rule-seed.test.ts` は同じ問題を先に解いている
 * （ルール 1 件ごとに「当たる文」と「当たってはならない文」を持たせる）。
 * ここはその形を、ドメインに直に書いてある一覧へ広げたものである。
 *
 * **数を先に見る。**例の数と一覧の数が合わないと落ちる。
 * 一覧に足したのに例を書かなければ、その場で止まる——
 * 「足したが誰も試していない」を作らせないための行である。
 */
import { describe, expect, it } from "vitest";
import {
  FIRSTHAND_EXPERIENCE_PATTERNS,
  checkFactBoundary,
  createAuthorPersona,
} from "@/domain/authoring/author-persona";
import {
  EXAGGERATION_PATTERNS,
  MEASURE_WORDS,
  PRICE_STALE_HOURS,
  RELATIVE_DATE_PATTERNS,
  VAGUE_HEADING_PATTERNS,
  runQualityChecks,
  type ChannelConstraints,
} from "@/domain/authoring/quality-check";
import { createContentVariant } from "@/domain/authoring/content-variant";
import { STYLE_RULES } from "@/domain/authoring/writing-style";
import { taggedString } from "@/domain/shared";

const WS = taggedString<"WorkspaceId">("ws_table");

const CONSTRAINTS: ChannelConstraints = {
  channel: "ブログ",
  maxBodyLength: null,
  maxHashtags: null,
  allowsAffiliateLink: true,
  requiresInlineDisclosure: false,
};

function persona() {
  const r = createAuthorPersona({
    id: taggedString<"AuthorPersonaId">("ap_1"),
    workspaceId: WS,
    displayName: "見本の書き手",
    personaType: "editorial_team",
    role: "編集部",
    knowledgeLevel: "intermediate",
    firstPersonPronoun: "編集部",
    readerAddress: "みなさん",
    tone: { formality: 0.6, analytical: 0.7, emotional: 0.3, assertiveness: 0.4, humor: 0.2, emojiUsage: 0 },
    prohibitedPhrases: [],
    disclosureStyle: "冒頭に明記する",
    ctaStyle: "押しつけない",
  });
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

/**
 * 本文だけを差し替えて品質検査に掛ける。根拠は付けておき、見たい検査だけを残す。
 *
 * `price` は価格の鮮度（QC-09）を当てるときだけ渡す。既定は「確認の記録が無い」で、
 * 本文に価格を書かない限りこの検査は `skipped` に落ちるため他の表の邪魔をしない。
 */
function checksFor(body: string, price?: { checkedAt: Date; now: Date }) {
  const created = createContentVariant({
    id: taggedString<"ContentVariantId">("cv_1"),
    workspaceId: WS,
    contentPackageId: taggedString<"ContentPackageId">("cp_1"),
    channel: "blog",
    format: "article",
    authorPersonaId: taggedString<"AuthorPersonaId">("ap_1"),
    audiencePersonaId: taggedString<"AudiencePersonaId">("aud_1"),
    angle: "beginner",
    body,
    summary: "要約",
    cta: "view_comparison",
    disclosure: "アフィリエイト広告を利用しています。",
    factualityScore: 0.9,
    personaFitScore: 0.9,
    channelFitScore: 0.9,
    complianceStatus: "pass",
    generationPromptVersion: "p1",
    modelId: "見本モデル",
    claimIds: [taggedString<"ClaimId">("cl_1")],
    evidenceIds: [taggedString<"EvidenceId">("ev_1")],
  });
  if (!created.ok) throw new Error(`見本の本文を作れませんでした: ${created.error.message}`);
  const report = runQualityChecks({
    variant: created.value,
    persona: persona(),
    constraints: CONSTRAINTS,
    hasVerifiedTestRun: true,
    knownFeatureNames: [],
    existingBodies: [],
    priceCheckedAt: price?.checkedAt ?? null,
    now: price?.now ?? new Date("2026-08-18T00:00:00Z"),
  });
  return report.issues;
}

/** 一覧に載っていない書き方。どの表でも「当たってはならない側」に使う。 */
const CLEAN_BODY = "書き出しの速さを 2026 年 8 月 18 日に測りました。デメリットは重さです。";

describe("誇大表現の一覧（QC-05）", () => {
  const EXAMPLES: Readonly<Record<string, string>> = {
    最強: "この構成が最強です。デメリットは重さです。",
    最安: "この店が最安です。デメリットは重さです。",
    絶対: "絶対に失敗しません。デメリットは重さです。",
    完全: "完全に静かです。デメリットは重さです。",
    日本一: "日本一の書き出し速度です。デメリットは重さです。",
    世界一: "世界一の静音性です。デメリットは重さです。",
    "No.1": "満足度No.1の製品です。デメリットは重さです。",
    効果の断定: "使えば必ず痩せます。デメリットは重さです。",
  };

  it("例が一覧と同じ数だけある", () => {
    expect(Object.keys(EXAMPLES)).toHaveLength(EXAGGERATION_PATTERNS.length);
    expect(Object.keys(EXAMPLES).sort()).toEqual(EXAGGERATION_PATTERNS.map((p) => p.label).sort());
  });

  for (const [label, body] of Object.entries(EXAMPLES)) {
    it(`「${label}」は止まる`, () => {
      const hit = checksFor(body).find((i) => i.check === "exaggeration");
      expect(hit, `${label} に当たる正規表現がありません`).toBeDefined();
      expect(hit?.message).toContain(label);
    });
  }

  it("一覧に無い書き方は止めない", () => {
    expect(checksFor(CLEAN_BODY).map((i) => i.check)).not.toContain("exaggeration");
  });
});

describe("結論の分からない見出しの一覧（QC-04）", () => {
  const EXAMPLES: readonly string[] = [
    "まとめ",
    "はじめに",
    "おわりに",
    "その他",
    "ポイント",
    "注意点",
    "静音性について",
    "HDRとは",
  ];

  it("例が一覧と同じ数だけある", () => {
    expect(EXAMPLES).toHaveLength(VAGUE_HEADING_PATTERNS.length);
  });

  for (const heading of EXAMPLES) {
    it(`「${heading}」は知らせる`, () => {
      const body = `## ${heading}\n静かに動きます。デメリットは重さです。`;
      const hit = checksFor(body).find((i) => i.check === "vague_heading");
      expect(hit, `${heading} に当たる正規表現がありません`).toBeDefined();
      expect(hit?.excerpt).toBe(heading);
    });
  }

  it("結論の入った見出しは知らせない", () => {
    const body = "## 動画編集なら A が最短で書き出せます\n静かに動きます。デメリットは重さです。";
    expect(checksFor(body).map((i) => i.check)).not.toContain("vague_heading");
  });
});

describe("相対的な日付の一覧（QC-10）", () => {
  const EXAMPLES: readonly string[] = [
    "先日",
    "最近",
    "今年",
    "昨年",
    "去年",
    "来年",
    "今月",
    "先月",
    "来月",
    "今週",
    "先週",
  ];

  it("例が一覧と同じ数だけある", () => {
    expect(EXAMPLES).toHaveLength(RELATIVE_DATE_PATTERNS.length);
  });

  it("一覧の全部が、どれかの例に当たる（当たらない行を残さない）", () => {
    const dead = RELATIVE_DATE_PATTERNS.filter((p) => !EXAMPLES.some((w) => p.test(w))).map(
      (p) => p.source,
    );
    expect(dead, "この書き方は、どの例にも当たりません").toEqual([]);
  });

  for (const word of EXAMPLES) {
    it(`「${word}」は知らせる`, () => {
      const body = `${word}まで在庫がありました。デメリットは重さです。`;
      const hit = checksFor(body).find((i) => i.check === "relative_date");
      expect(hit, `${word} に当たる正規表現がありません`).toBeDefined();
      expect(hit?.excerpt).toBe(word);
    });
  }

  it("具体的な日付は知らせない", () => {
    expect(checksFor(CLEAN_BODY).map((i) => i.check)).not.toContain("relative_date");
  });
});

describe("単位を付けるべき語の一覧（QC-08）", () => {
  /*
   * ここだけ語を手で書き写している。
   * `MEASURE_WORDS` を回して当てるだけだと、**一覧から語を消したときに輪が縮むだけ**で緑になる。
   * 消えたことを緑として現れさせないために、期待する側は一覧から独立させる。
   */
  const WORDS: readonly string[] = [
    "重さ",
    "重量",
    "容量",
    "時間",
    "速度",
    "サイズ",
    "幅",
    "高さ",
    "奥行",
    "厚さ",
    "価格",
    "解像度",
    "距離",
  ];

  it("一覧が、ここに書き写した 13 語と一致する", () => {
    expect(MEASURE_WORDS).toEqual(WORDS);
  });

  it("一覧の全部の語で、単位の無い数字が止まる", () => {
    const missed: string[] = [];
    for (const word of WORDS) {
      const body = `${word}は12です。デメリットは重さです。`;
      const hit = checksFor(body).find(
        (i) => i.check === "unit_missing" && i.message.includes(`「${word}12」`),
      );
      if (!hit) missed.push(word);
    }
    expect(missed, "この語の後ろに単位の無い数字を書いても止まりません").toEqual([]);
  });

  it("一覧の全部の語で、単位が付いていれば通る", () => {
    // 止める側だけを見ると、**何にでも当たる**書き方に気づけない。
    const wrong: string[] = [];
    for (const word of WORDS) {
      const body = `${word}は12kgです。デメリットは重さです。`;
      const hit = checksFor(body).find((i) => i.check === "unit_missing");
      if (hit) wrong.push(word);
    }
    expect(wrong, "単位が付いているのに止まっています").toEqual([]);
  });
});

describe("一人称の体験の言い回しの一覧（QC-11）", () => {
  /*
   * 検証記録が無いのに「使ってみた」と書けるかどうかを、一覧の全行で見る。
   * ここだけ `runQualityChecks` を通さず `checkFactBoundary` を直に呼ぶ。
   * 返り値が当たった正規表現そのもの (`pattern`) を持っており、
   * 「どの行が効いたか」を行ごとに突き合わせられるのはこちらだけだからである。
   */
  const EXAMPLES: readonly string[] = [
    "実際に測ってみて、書き出し時間を記録しました。",
    "同じ素材で試してみました。",
    "筆者の手元では 9 時間でした。",
    "2 週間使い続けました。",
    "天板を触ってみました。",
    "体感では静かなほうです。",
  ];

  it("例が一覧と同じ数だけある", () => {
    expect(EXAMPLES).toHaveLength(FIRSTHAND_EXPERIENCE_PATTERNS.length);
  });

  it("一覧の全行が、どれかの例文で実際に止まる", () => {
    const fired = new Set(
      EXAMPLES.flatMap((body) =>
        checkFactBoundary(persona(), body, { hasVerifiedTestRun: false }).map((v) => v.pattern),
      ),
    );
    const dead = FIRSTHAND_EXPERIENCE_PATTERNS.map((p) => p.source).filter((s) => !fired.has(s));
    expect(
      dead,
      "この言い回しは、どの例文でも止まりません。" +
        "一覧に足したのに誰も試していないか、当たらない書き方になっています。",
    ).toEqual([]);
  });

  it("公式情報に基づく書き方は止めない", () => {
    expect(
      checkFactBoundary(persona(), "公表値では 12 時間とされています。", {
        hasVerifiedTestRun: false,
      }),
    ).toEqual([]);
  });

  it("検証記録があれば、同じ文が全部通る", () => {
    for (const body of EXAMPLES) {
      expect(
        checkFactBoundary(persona(), body, { hasVerifiedTestRun: true }),
        `${body} が検証記録つきでも止まっています`,
      ).toEqual([]);
    }
  });
});

/**
 * 文体の決まりが名乗る数を、実検査へ当てる (REQ-W08 の端)。
 *
 * ── なぜこれが要るのか ────────────────────────────────
 *
 * `writing-style-tables.test.ts` には、表と実装を結び直す行が既にある。
 *
 *     expect(rule?.rule).toContain(`1〜${MAX_SENTENCES_PER_PARAGRAPH} 文`);
 *
 * これは「表の文言」と「実装の定数」が離れたときに落ちる。**離れなければ落ちない。**
 * 両方そろえて 5 へ書き換えれば緑のままだし、`paragraph_shape` の検査そのものを
 * 消しても緑である——文字列と定数を見ているだけで、**効いているかを見ていない**。
 *
 * `invariants.test.ts` の「1 段落は 3 文まで通し、4 文で知らせる」は効き目を見ているが、
 * あれが名乗っているのは `REQ-QC02`（実検査の側）で、決まりの表とは繋がっていない。
 *
 * ここは 2 つを繋ぐ。**期待値を表から読む。**定数からでも手書きでもない。
 * 表が「1〜5 文」と名乗り直したのに検査が 3 のままなら、ここが赤くなる。
 * 逆に検査を消せば、上限側の主張（4 文で止まる）が赤くなる。
 */
describe("文体の決まりに書いた数が、実際に効いている（REQ-W08）", () => {
  /** 表の文言から上限を読む。実装の定数は輸入しない（同じものを 2 度見ることになる）。 */
  const declaredMax = (() => {
    const rule = STYLE_RULES.find((r) => r.id === "1to3_sentences")?.rule ?? "";
    const m = rule.match(/1〜(\d+) 文/);
    return m ? Number(m[1]) : null;
  })();

  it("床: 表から上限を読めている（読めていないと下の 2 件は空振りする）", () => {
    expect(declaredMax, `1to3_sentences の文言から数を読めない: ${declaredMax}`).toBeGreaterThan(0);
  });

  it("表が名乗る文数ちょうどの段落は通る", () => {
    const n = declaredMax as number;
    // 「デメリット」の 1 文は別の検査（長所だけの記事）を黙らせるために要る。
    // それを含めてちょうど n 文にする。
    const body = [...Array(n - 1).fill("軽いです。"), "デメリットは重さです。"].join("");
    expect(checksFor(body).map((i) => i.check)).not.toContain("paragraph_shape");
  });

  it("表が名乗る文数より 1 つ多い段落は止まる", () => {
    const n = declaredMax as number;
    const body = [...Array(n).fill("軽いです。"), "デメリットは重さです。"].join("");
    const hit = checksFor(body).find((i) => i.check === "paragraph_shape");
    expect(hit, `${n + 1} 文の段落が止まっていない`).toBeDefined();
    // 知らせ文が上限を名乗っていること。数だけ合っていて文言が別の値を言うと、
    // 画面に出る指示（「何文までにせよ」）が嘘になる。
    expect(hit?.message).toContain(`${n} 文まで`);
  });
});

/**
 * 価格の鮮度の上限が、実際に効いている（QC-09 / REQ-QC05）。
 *
 * ここを足した理由。**`PRICE_STALE_HOURS` を 72 から 9999 に変えても
 * 7984 件すべて緑だった**（実測、2026-08-28）。
 * 「価格の確認記録が無い」枝は見られていた（消すと 1 件赤）が、
 * **72 時間という上限そのものは誰も見ていなかった。**
 * 上限を実質無効化しても止まらない＝要件が名乗る数が飾りになっていた。
 *
 * **期待値を定数から組み立てない。**`PRICE_STALE_HOURS + 1` で入力を作ると、
 * 定数をいくつに変えても入力が同じ側に居続けるので、永久に赤くならない。
 * 要件（§20.3「価格の鮮度は 72 時間」）の数を**手で書き写す**。
 * 実装が動いた日に、まずこの写した数との照合が落ちる。
 */
describe("価格の鮮度の上限が、実際に効いている（QC-09）", () => {
  /** 要件 §20.3 が名乗る数。実装から輸入しない（同じものを 2 度見ることになる）。 */
  const DECLARED_STALE_HOURS = 72;

  const PRICE_BODY = "この構成は 128000 円です。デメリットは重さです。";
  const NOW = new Date("2026-08-18T00:00:00Z");

  /** `now` から `hours` だけ前に確認したことにする。 */
  const checkedHoursAgo = (hours: number) =>
    checksFor(PRICE_BODY, { checkedAt: new Date(NOW.getTime() - hours * 3_600_000), now: NOW });

  it("床: 実装の上限が、要件に書いた数と一致している", () => {
    expect(PRICE_STALE_HOURS, "実装と要件で価格の鮮度の上限が食い違っている").toBe(
      DECLARED_STALE_HOURS,
    );
  });

  it("床: 価格を書いた本文で、この検査が skipped に落ちていない", () => {
    // 本文に「円」が無いと検査ごと飛ぶ。飛んでいると下の 2 件は何も測らない。
    const issues = checkedHoursAgo(0);
    expect(issues.some((i) => i.check === "unsourced_number")).toBe(false);
  });

  it("上限ちょうどに確認した価格は止めない", () => {
    const checks = checkedHoursAgo(DECLARED_STALE_HOURS).map((i) => i.check);
    expect(checks, `${DECLARED_STALE_HOURS} 時間ちょうどで止めている`).not.toContain("stale_price");
  });

  it("上限を超えて確認した価格は止まる", () => {
    // 1 時間だけ超える。ここと上の 1 件が対になっていないと、
    // 不等号を `>=` に変えても `>` に戻しても、どちらか片方は緑のまま通る。
    const hit = checkedHoursAgo(DECLARED_STALE_HOURS + 1).find((i) => i.check === "stale_price");
    expect(hit, `${DECLARED_STALE_HOURS + 1} 時間前の価格が止まっていない`).toBeDefined();
    // 止め方は警告。error にすると記事が書けなくなる（取り直せば済む話である）。
    expect(hit?.severity).toBe("warning");
  });

  it("止めるときは、何日経ったかを知らせ文が名乗る", () => {
    // 画面に出るのはこの文だけである。日数が出ないと、書き手は
    // 「取り直すか、確認日を併記するか」を決められない。
    const hit = checkedHoursAgo(24 * 10).find((i) => i.check === "stale_price");
    expect(hit?.message).toContain("10 日");
  });
});
