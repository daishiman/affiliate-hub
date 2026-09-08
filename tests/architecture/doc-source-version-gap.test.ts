/**
 * @tier 1
 * @req REQ-TS14
 * @types equivalence, boundary
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  declaredSourceTargets,
  EMPTY_INVENTORY_DELTA,
  inventoryDelta,
  SOURCE_TARGET_FLOOR,
} from "./spec-source-inventory";

/**
 * 「最新ドキュメント出典」の欄が、欄の名前どおりの値を持っているか。
 *
 * **2026-08-25、この検査は 3 度目の反転をした。**前回 (2026-08-23) は
 * 「部分的に直った状態を、部分的に直ったまま固定する」ために向きを反転させた。
 * 今回もその指示に従う。反転の中身は下の 3 つである。
 *
 * ── 1. この検査は、自分が捕まえるはずの不具合を隠していた ─────
 *
 * 旧版の `sourceRow` は「章の出典表は 1 行」を前提に、行数が違えば **describe の
 * 収集時に throw** していた。2026-08-25 実測で backend が 4 行・maintenance-ops が
 * 4 行・frontend が 2 行に増えた結果、**この試験ファイルは 1 件も走らなくなった**。
 *
 * 走らなかった中に `最新確認 − 取得 >= 0` があった。そして実際に破れていた——
 * `nextjs` の章と `fetched-references.json` が、**再取得していないのに
 * 2026-08-23 の取得を名乗って**おり、最新確認 (2026-08-22) より後になっていた。
 * 見張る側が死んでいたので、見張られる側の綻びが 2 日間見えなかった。
 *
 * **「0 件検出」と「検出する側が動いていない」は、出力では区別がつかない。**
 * だから今の版は、章が何行持っていても落ちない。行数は前提ではなく**測る対象**である。
 *
 * ── 2. 章 md と fetched-references の二重管理は解消した ────────
 *
 * 前回は 3 件 (`better-auth` `owasp-asvs` `apple-hig`) が食い違っていた。
 * 2026-08-25 実測で **15 行すべてが一致**している。章は `compile-spec-doc.py`
 * が正本から組み立てる純関数になり、写しが手で編まれる余地が消えた
 * (`--on-handwritten preserve` での再生成が 1 行しか動かさないことで確かめた)。
 * 食い違いが**増えても**赤くするのがこの検査の役目なので、期待値は空配列で置く。
 *
 * ── 3. 「最新確認は取得より後」は前提として狭すぎた ─────────────
 *
 * `vitest` は 最新確認 11:38:55 / 取得 11:38:56 で、確認が取得の 1 秒**前**である。
 * これは嘘ではない。registry 照会とページ取得という**別の行為**を、それぞれ
 * 正直に記録した結果である。鮮度の出所が取得ページ本文でないとき、確認が取得に
 * 先行することは起こりうる。
 *
 * **正しい記録を違反と呼ぶ検査は、記録を歪ませる圧力になる。**
 * そこで順序ではなく「取得ページ本文を鮮度根拠にしている行だけ、確認は取得以降」
 * という条件へ狭めた。
 *
 * ── 【2026-09-04・4 度目の反転】母数 15 → 19、例外 1 件 → 0 件 ────────
 *
 * 増えた 4 件は実在する取得証跡である——`google-search-central` / `schema-org` /
 * `w3c-wai-aria` / `web-dev-core-web-vitals`。G3 の AEO/SEO 決定を裏取りするために
 * 取り、frontend 章が 2 → 5 本、ui-ux 章が 1 → 2 本になった。
 * **この母数を減らす向きに触らないこと。**減らせば「食い違い 0 件」「版が取得日の行
 * 0 件」が、見る対象を失っただけで緑になる。上の 1. がまさにその形で 2 日間死んでいた。
 *
 * 例外 `vitest=publisher-registry` が消えたのは、違反が直ったからではない。
 * C08 鮮度監査が記録の 4.1.11 と公式の 5.0.0 の乖離を指摘し、2026-09-03 に
 * registry 照会とページ取得を同一時刻で取り直した結果、**確認が取得より前になる行が
 * 1 つも無くなった**。3. で狭めた条件そのものは今も生きている（`page-declared` 以外
 * なら先行してよい）。期待値は消さず空配列で残し、抜け道が再び開く日に名指しさせる。
 *
 * ── 解除条件（次に赤くなる日） ──────────────────────────
 *
 *   - 「版が取得日である行は 0 件」が赤 → 版を確かめずに取得日で埋めた行が戻った
 *   - 「章 md と参照の食い違いは 0 件」が赤 → 二重管理が再発した
 *   - 「章別の出典本数」が赤 → 章が出典を増やした/落とした（どちらも見えてよい）
 *
 * どの赤でも**消さず、また向きを反転させて残すこと。**
 * 穴を見張る検査は、穴が塞がった日に役目を終えるのではない。
 * 塞がったものが再び開く道は、塞がる前から在る。
 */

const ROOT = process.cwd();
const SPEC_DIR = "system" + "-spec";

/**
 * 2026-09-06: 固定 21 行では、正しく追加された R2 overview まで不具合になる。
 * 全 22 対象の名前を床として保持し、実際に検査する集合は targets[] と照合する。
 * 追加は自動的に全件検査へ入り、欠落・同数での置換・重複は赤になる。
 */
const CHAPTERS = Object.keys(SOURCE_TARGET_FLOOR);

/** 版番号ではなく日付が書かれている、という判定。`1.6.29` を日付と読まないこと。 */
function looksLikeDate(version: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(version.trim());
}

type Row = {
  chapter: string;
  target: string;
  version: string;
  retrievedAt: string;
  confirmedAt: string;
};

/**
 * 版の欄が**取得した日そのもの**になっている、という判定。
 *
 * 日付であること自体は誤りではない。`cloudflare-d1=2026-04-30` のように、
 * 版を公表しない対象が公式表明の更新日を版の欄に持つのは正しい状態である。
 * 誤りは「確かめた値が無いので取得日を書いた」ことだけである。
 *
 * ── 取得日と一致しても誤りでない場合がある（2026-09-08）──────────
 *
 * 上流が**取得したその日に更新した**なら、正しく写した版日付が取得日と一致する。
 * `webmcp` がこれで、Community Group の rolling draft を更新当日に取った。
 * 日付の一致だけで数えると、この正しい行を誤りとして挙げてしまう。
 *
 * そこで第 2 引数に「その値が**ページ本文に逐語で在った**という裏付け」を取る。
 * `freshness_source` の自己申告だけを見ると名乗るだけで通る抜け道になるので、
 * 裏付けの判定 (`declaredOnPage`) は取得証跡の `found_in` にその値が
 * literal で現れることまで要求する。**確かめた値が無いのに取得日を書いた**行は、
 * その日付が本文の逐語に現れようがないので、これまで通り挙がる。
 *
 * 既定は `false`。裏付けを渡さなければ判定は元のままである。
 */
function isRetrievalDate(row: Row, backedByPageText = false): boolean {
  if (backedByPageText) return false;
  return looksLikeDate(row.version) && row.version.trim() === row.retrievedAt.slice(0, 10);
}

/**
 * その対象の取得証跡が、章の書いた値を**ページ本文の逐語**で裏付けているか。
 *
 * 証跡が無い・`found_in` が空・値が逐語のどこにも現れない、のいずれでも `false`。
 * 裏付けが取れないものを裏付けありに倒さない (fail-closed)。
 */
function declaredOnPage(target: string, value: string): boolean {
  let raw: string;
  try {
    raw = readFileSync(join(ROOT, `${SPEC_DIR}/retrieval-evidence/${target}.json`), "utf8");
  } catch {
    return false;
  }
  const extraction = (JSON.parse(raw) as {
    freshness_extraction?: { freshness_source?: string; found_in?: unknown };
  }).freshness_extraction;
  if (extraction === undefined) return false;
  // 取得した機械が付けた値 (取得日) ではなく、上流が表明した値であること。
  if (extraction.freshness_source !== "page-declared" && extraction.freshness_source !== "http-last-modified") {
    return false;
  }
  const quotes = Array.isArray(extraction.found_in) ? extraction.found_in : [];
  return quotes.some((q) => typeof q === "string" && q.includes(value.trim()));
}

/**
 * 「最新ドキュメント出典」表の本文行を**全部**取り出す。
 *
 * 行数で throw しない。**行数は前提ではなく測る対象である。**
 */
function sourceRows(chapter: string): Row[] {
  const text = readFileSync(join(ROOT, `${SPEC_DIR}/${chapter}.md`), "utf8");
  const section = text.split(/^## /m).find((s) => s.startsWith("最新ドキュメント出典"));
  if (section === undefined) return [];
  return section
    .split("\n")
    .filter((line) => line.startsWith("|") && !/^\|\s*-+/.test(line) && !/^\|\s*対象\s*\|/.test(line))
    .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()))
    .map(([target, version, , , retrievedAt, confirmedAt]) => ({
      chapter,
      target,
      version,
      retrievedAt,
      confirmedAt,
    }));
}

/** `fetched-references.json` 側の同じ対象の記録。章 md と突き合わせる相手。 */
type Reference = {
  target_id: string;
  version: string | null;
  last_updated: string | null;
  freshness_source: string | null;
};

function references(): Reference[] {
  const raw = readFileSync(join(ROOT, `${SPEC_DIR}/fetched-references.json`), "utf8");
  const parsed = JSON.parse(raw) as { references: Reference[] };
  return parsed.references;
}

/**
 * ── 判定を入力から切り離す（2026-08-30 / ah-5nu）─────────────────
 *
 * 反転後の 3 件は「実ファイルを読んで 0 件」という形だったので、
 * **わざと壊して赤を見る**には確定章を書き換えるしかなかった。それは
 * `guard-confirmed-chapter-overwrite` が止める道で、迂回しないと決めてある。
 * その結果「検査が動いている証拠が無い」状態が残っていた——**0 件検出と、
 * 検出する側が動いていないことは、出力では区別がつかない。**
 *
 * そこで判定だけを引数を取る関数にした。**章は 1 バイトも触らない。**
 * 実ファイルを読む it はこの関数へ実物を渡し、下の陽性対照は合成した行を渡す。
 * 同じ関数が両方を通るので、「実物で 0 件」が「判定が何も当たらない」ではないことが
 * 同じ試験の中で言える。
 *
 * **判定の中身は 1 つも変えていない。**渡す先を実ファイル固定から引数へ移しただけである。
 */
function retrievalDated(rows: readonly Row[]): string[] {
  return rows
    .filter((r) => isRetrievalDate(r, declaredOnPage(r.target, r.version)))
    .map((r) => `${r.target}=${r.version}`);
}

/** 章 md と `fetched-references.json` の食い違い。名指しで返す。 */
function driftBetween(rows: readonly Row[], refs: Map<string, Reference>): string[] {
  const drifted: string[] = [];
  for (const row of rows) {
    const ref = refs.get(row.target);
    if (ref === undefined) {
      drifted.push(`${row.target}: 章に在るが fetched-references に無い`);
      continue;
    }
    // 章のバージョン欄 1 つに対し、参照側は版と更新日の 2 欄を持つ。
    // 版を公表する対象は版を、公表しない対象は公式表明の更新日を、章が写すべき値とみなす。
    const expected = ref.version ?? ref.last_updated;
    if (row.version !== expected) {
      drifted.push(`${row.target}: 章=${row.version} / 参照=${expected}`);
    }
  }
  return drifted;
}

describe("最新ドキュメント出典の欄が欄名どおりの値を持っているか", () => {
  const rowsByChapter = new Map(CHAPTERS.map((c) => [c, sourceRows(c)]));
  const rows = CHAPTERS.flatMap((c) => rowsByChapter.get(c) ?? []);
  const referenceRows = references();
  const refs = new Map(referenceRows.map((r) => [r.target_id, r]));
  const targets = declaredSourceTargets(ROOT);
  const targetIds = targets.map((target) => target.target_id);

  function expectCompletePopulation() {
    const floor = Object.values(SOURCE_TARGET_FLOOR).flat();
    expect(targetIds).toEqual(expect.arrayContaining(floor));
    expect(new Set(targetIds).size).toBe(targetIds.length);
    expect(inventoryDelta(rows.map((r) => r.target), targetIds)).toEqual(EMPTY_INVENTORY_DELTA);
    expect(inventoryDelta(referenceRows.map((r) => r.target_id), targetIds)).toEqual(EMPTY_INVENTORY_DELTA);
  }

  it("確定 8 章が宣言した出典を 1 本も落としていない（数える対象が消えていない）", () => {
    // **欠けたものを名指しで出す。**真偽値の一覧だと、8 章が全部 false になった日に
    // 「何が消えたのか」がこの試験からは読めない（2026-08-25 に実際そうなった）。
    const missing = CHAPTERS.flatMap((c) => {
      const present = new Set((rowsByChapter.get(c) ?? []).map((r) => r.target));
      return SOURCE_TARGET_FLOOR[c as keyof typeof SOURCE_TARGET_FLOOR]
        .filter((target) => !present.has(target))
        .map((target) => `${c}: ${target}`);
    });
    expect(missing).toEqual([]);
    expectCompletePopulation();
  });

  it("章別の出典対象が targets[] の全宣言と一致する（同数の置換も検出する）", () => {
    expect([...new Set(targets.map((target) => target.category))].sort()).toEqual([...CHAPTERS].sort());
    for (const chapter of CHAPTERS) {
      const expected = targets.filter((target) => target.category === chapter).map((target) => target.target_id);
      const actual = (rowsByChapter.get(chapter) ?? []).map((row) => row.target);
      expect(inventoryDelta(actual, expected), chapter).toEqual(EMPTY_INVENTORY_DELTA);
    }
    expectCompletePopulation();
  });

  it("版の欄が取得日そのものになっている行は 0 件——戻れば赤くなる", () => {
    expect(retrievalDated(rows)).toEqual([]);
    // **0 件の主張が母数 0 由来でないことを、同じ it で示す。**
    // 上の等号は rows が空でも通る。読み取りが黙って全滅した日に、
    // この検査が「違反なし」と報せるのを止めている。
    expectCompletePopulation();
  });

  it("宣言した全出典が freshness_source を持つ（版・更新日の出所が空欄へ戻らない）", () => {
    const missing = [...refs.values()].filter((r) => !r.freshness_source);
    expect(missing.map((r) => r.target_id)).toEqual([]);
    expectCompletePopulation();
  });

  /**
   * 同じ事実が章 md と `fetched-references.json` の 2 箇所にある。
   * 章が純関数になった今も、写しである以上ずれる道は残っている。
   * **食い違いが減っても増えても赤くする**のがこの検査の役目である。
   */
  it("章 md と fetched-references の食い違いは 0 件（主対象だけでなく宣言した全出典）", () => {
    expect(driftBetween(rows, refs)).toEqual([]);
    expectCompletePopulation();
  });

  /**
   * **順序の前提を、鮮度の出所ごとに分ける。**
   *
   * 取得ページ本文を根拠にしているなら、確認は取得と同時かそれ以降でしか成り立たない
   * （本文を読む前に本文の値を確認できない）。一方 registry 照会は取得と別の行為で、
   * 同じ一括作業の中で先に走ることがある。`vitest` が実際にそれ (確認が 1 秒前) である。
   *
   * 順序だけを見て両方を違反にすると、**正しい記録を書き換えさせる圧力**になる。
   */
  it("取得ページ本文を鮮度根拠にする行は、最新確認が取得以降である", () => {
    const offenders = rows
      .filter((r) => refs.get(r.target)?.freshness_source === "page-declared")
      .filter((r) => Date.parse(r.confirmedAt) < Date.parse(r.retrievedAt))
      .map((r) => `${r.target}: 取得=${r.retrievedAt} / 最新確認=${r.confirmedAt}`);
    expect(offenders).toEqual([]);
    expectCompletePopulation();
  });

  it("確認が取得より前になっている行は、いずれも本文以外を鮮度根拠にしている", () => {
    const early = rows.filter((r) => Date.parse(r.confirmedAt) < Date.parse(r.retrievedAt));
    // 2026-09-04 に `['vitest=publisher-registry']` → `[]` へ。**違反が直ったのではなく、
    // 例外そのものが消えた。**C08 鮮度監査が vitest 4.1.11 の陳腐化を指摘し、2026-09-03 に
    // registry 照会とページ取得を同一時刻 (23:21:10Z) で取り直したため、確認が取得より前に
    // なる行が 1 つも無くなった。**期待値を消さず空配列として残す**のは、`page-declared` 以外を
    // 逃がす抜け道がここに再び開いたとき、名指しで赤くするためである。
    expect(early.map((r) => `${r.target}=${refs.get(r.target)?.freshness_source}`)).toEqual([]);
    expectCompletePopulation();
  });

  /**
   * 見つける側が効くことを、同じ検査の中で示す。
   * これが無いと上の「0 件」は、**本当に 0 件なのか、判定が何も当たらないのか**が
   * 区別できない。2026-08-25 に起きたのはまさにその区別がつかない状態だった。
   */
  describe("見つける側が効いていること", () => {
    it.each([
      ["同数での置換", ["a", "ghost"], { missing: ["b"], unexpected: ["ghost"], duplicate: [] }],
      ["同数での重複", ["a", "a"], { missing: ["b"], unexpected: [], duplicate: ["a"] }],
      ["全件消失", [], { missing: ["a", "b"], unexpected: [], duplicate: [] }],
      ["宣言漏れ", ["a", "b", "c"], { missing: [], unexpected: ["c"], duplicate: [] }],
    ])("出典集合の %s を名指しする", (_label, actual, expected) => {
      expect(inventoryDelta(actual, ["a", "b"])).toEqual(expected);
    });

    it("宣言へ追加した出典は既存の母数を保ったまま検査される", () => {
      expect(inventoryDelta(["c", "a", "b"], ["a", "b", "c"])).toEqual(EMPTY_INVENTORY_DELTA);
    });

    it.each(["2026-08-16", "2020-01-01"])("%s は日付として数えられる", (v) => {
      expect(looksLikeDate(v)).toBe(true);
    });

    it.each(["1.6.29", "0.45.2", "16.3.1", "5.0", "v2026-08-16", "2026-08"])(
      "%s は日付として数えられない",
      (v) => {
        expect(looksLikeDate(v)).toBe(false);
      },
    );

    const at = (version: string, retrievedAt: string): Row => ({
      chapter: "x",
      target: "x",
      version,
      retrievedAt,
      confirmedAt: retrievedAt,
    });

    it("取得日と同じ日付は、取得日を版として書いたものとして数えられる", () => {
      expect(isRetrievalDate(at("2026-08-16", "2026-08-16T09:11:20Z"))).toBe(true);
    });

    /**
     * 裏付けの有無で結論が分かれること自体を示す。**同じ行**を両方に通す。
     * 片方だけ書くと「常に true を返す」「常に false を返す」実装でも通ってしまう。
     */
    it("同じ取得日一致でも、ページ本文の裏付けが在れば数えない", () => {
      const row = at("2026-08-16", "2026-08-16T09:11:20Z");
      expect(isRetrievalDate(row, false)).toBe(true);
      expect(isRetrievalDate(row, true)).toBe(false);
    });

    it("裏付けの判定は、証跡が無い対象を裏付けありに倒さない", () => {
      expect(declaredOnPage("存在しない対象", "2026-08-16")).toBe(false);
    });

    /**
     * 実物の証跡で裏付けが取れること。**この 1 件が false になったら
     * 上の除外は根拠を失う**ので、判定の実装ではなく現物で確かめる。
     */
    it("裏付けの判定は、本文の逐語に在る値だけを裏付けありとする", () => {
      expect(declaredOnPage("webmcp", "2026-09-03")).toBe(true);
      expect(declaredOnPage("webmcp", "2026-09-04")).toBe(false);
    });

    it("同じ日付でも、取得日と違えば数えられない（公表された更新日を誤検出しない）", () => {
      expect(isRetrievalDate(at("2026-08-16", "2026-08-19T15:30:39Z"))).toBe(false);
      expect(isRetrievalDate(at("2026-04-30", "2026-08-19T15:30:39Z"))).toBe(false);
    });

    it("版番号は取得日と同じ日に取っていても数えられない", () => {
      expect(isRetrievalDate(at("5.0.0", "2026-08-16T09:11:19Z"))).toBe(false);
      expect(isRetrievalDate(at("2017", "2026-08-19T15:30:40Z"))).toBe(false);
    });

    /**
     * **行数を前提にしないことを、行数で示す。**
     * 旧版はここで throw していた。今の版は複数行の章を全行として数える。
     *
     * ── 期待値を床から引く（2026-09-08）────────────────────────
     *
     * 以前はここに名前を 4 つ書き写していた。**同じ事実が 2 か所にある**状態で、
     * 出典が増えたとき床（`spec-source-inventory.ts`）だけが動き、この行は
     * 古い件数を主張し続けた。実際 dev 合流で backend の出典が 4 → 7 になり、
     * 章の読取が正しくなったことによってこの試験が赤くなった。
     *
     * 床は章 md ではなく `spec-state.json` の取得対象宣言から作った独立の相手なので、
     * ここから引いても「章の読取結果を期待値に流用する」自明化にはならない。
     * 添えた `length > 1` は、床が将来 1 件に縮んだとき
     * **「複数行を読む」という実証そのものが黙って消える**のを防ぐためのもの。
     */
    it("複数行の章を、行を落とさずに読み取る", () => {
      expect(SOURCE_TARGET_FLOOR.backend.length).toBeGreaterThan(1);
      expect(sourceRows("backend").map((r) => r.target)).toEqual([...SOURCE_TARGET_FLOOR.backend]);
    });

    it("出典表を持たない名前でも throw せず空を返す（収集時に試験ごと沈黙させない）", () => {
      expect(sourceRows("index")).toEqual([]);
    });

    /**
     * ── 壊したら赤くなることを、章を触らずに示す（ah-5nu）──────────
     *
     * 上の 3 件は実物に対して「0 件」「実測どおり」と言っている。**言えているのは
     * 実物がそうだということだけで、違反が起きたときに気づけるかは別の話である。**
     * それを確かめるには壊した入力が要るが、壊す先は確定章で、
     * `guard-confirmed-chapter-overwrite` が止める。迂回はしない。
     *
     * **判定を引数を取る形にしたので、壊すのは合成した行で足りる。**
     * ここで通しているのは実物と同じ関数である（別の写しを検査しているのではない）。
     */
    const row = (over: Partial<Row> = {}): Row => ({
      chapter: "c",
      target: "t",
      version: "1.0.0",
      retrievedAt: "2026-08-19T15:30:39Z",
      confirmedAt: "2026-08-19T15:30:39Z",
      ...over,
    });

    it("版が取得日で埋まった行を混ぜると、名指しで挙がる", () => {
      const dirty = [
        row({ target: "ok", version: "1.6.29" }),
        row({ target: "bad", version: "2026-08-19" }),
      ];
      expect(retrievalDated(dirty)).toEqual(["bad=2026-08-19"]);
    });

    it("章と参照の値がずれた行を混ぜると、両方の値つきで挙がる", () => {
      const refs = new Map<string, Reference>([
        ["same", { target_id: "same", version: "1.0.0", last_updated: null, freshness_source: "x" }],
        ["moved", { target_id: "moved", version: "2.0.0", last_updated: null, freshness_source: "x" }],
      ]);
      const dirty = [row({ target: "same" }), row({ target: "moved" })];
      expect(driftBetween(dirty, refs)).toEqual(["moved: 章=1.0.0 / 参照=2.0.0"]);
    });

    it("参照に居ない対象を章が名乗ると、それも食い違いとして挙がる", () => {
      // 値が一致しないのではなく**突き合わせる相手が無い**場合。
      // ここを黙って飛ばすと、参照から消えた対象は永久に一致扱いになる。
      expect(driftBetween([row({ target: "ghost" })], new Map())).toEqual([
        "ghost: 章に在るが fetched-references に無い",
      ]);
    });

    it("版を公表しない対象は、参照の更新日と突き合わせる", () => {
      // `version: null` の対象は `last_updated` が写すべき値である。
      // この分岐が消えると、公表しない 4 件が常に食い違い扱いになる。
      const refs = new Map<string, Reference>([
        ["d1", { target_id: "d1", version: null, last_updated: "2026-04-30", freshness_source: "x" }],
      ]);
      expect(driftBetween([row({ target: "d1", version: "2026-04-30" })], refs)).toEqual([]);
      expect(driftBetween([row({ target: "d1", version: "2026-08-19" })], refs)).toEqual([
        "d1: 章=2026-08-19 / 参照=2026-04-30",
      ]);
    });

    it("違反が無い入力では、どちらの判定も空を返す（陰性対照）", () => {
      // 上の 4 件が「何を渡しても挙がる」ではないことを示す。
      const refs = new Map<string, Reference>([
        ["t", { target_id: "t", version: "1.0.0", last_updated: null, freshness_source: "x" }],
      ]);
      expect(retrievalDated([row()])).toEqual([]);
      expect(driftBetween([row()], refs)).toEqual([]);
    });
  });
});
