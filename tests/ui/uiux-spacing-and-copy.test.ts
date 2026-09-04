/**
 * @tier 2
 * @req REQ-UX08, REQ-UX10
 * @types code-boundary, equivalence, boundary
 *
 * A8: カード間隔・文章量・サイドバー構成が規則として文書化され、全画面へ適用されている。
 * A10: 各画面の表示情報がタスク遂行に必要な項目だけに絞られている。
 *
 * 上限は「読む量を減らす」ためだけに置いているのではない。**画面ごとに違う書き方が
 * 混ざること自体**が負荷になる。同じ意味の余白が画面ごとに違うと、目は毎回
 * 「これは同じ塊か、別の塊か」を数え直す。
 *
 * 見るのは 5 つ。
 *   1. カード内の余白が 1 つのトークンに揃っている
 *   2. カード間の間隔がカード内より狭い（狭くないと 1 枚の範囲が読めない）
 *   3. 画面の説明文が 40 字以内
 *   4. 常に見えている注意書きが 1 画面 2 個まで
 *   5. 落とすと決めた項目が、実際に画面から消えている
 *
 * 3 で落とした断り書きのうち、金銭・秘密・公開に関わるものは消さず、
 * **押す物の隣へ移す**。4 の枠には数えない。「画面のどこかに書いてある」より
 * 「押す物の隣に書いてある」ほうが、押す前に読まれる。
 *
 * 規範: docs/spec/feat-uiux-overhaul/design-review.md,
 *       docs/spec/feat-uiux-overhaul/information-priority-map.json
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const ADMIN_DIR = join(ROOT, "src/app/admin");
const UI_CSS = join(ROOT, "src/presentation/ui/primitives/ui.module.css");
const PRIORITY_MAP = join(ROOT, "docs/spec/feat-uiux-overhaul/information-priority-map.json");

const LEAD_MAX = 40;
const CALLOUT_MAX = 2;

type PriorityMap = {
  readonly screens: readonly {
    readonly route: string;
    readonly drop: readonly { readonly item: string; readonly method: string }[];
    // keep と transform は §2 が「行が何かを決めているか」を見るために要る。
    // drop だけ宣言していると、3 分類のうち 1 つしか型で守られない。
    readonly keep: readonly { readonly item: string }[];
    readonly transform: readonly { readonly item: string }[];
    readonly exempt_from?: readonly string[];
  }[];
};

const priorityMap: PriorityMap = JSON.parse(readFileSync(PRIORITY_MAP, "utf8"));
const exemptions = new Map(priorityMap.screens.map((s) => [s.route, s.exempt_from ?? []]));

function pages(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) pages(full, out);
    else if (name === "page.tsx") out.push(full);
  }
  return out;
}

function routeOf(file: string): string {
  return `/${relative(join(ROOT, "src/app"), file).split(sep).slice(0, -1).join("/")}`;
}

const screens = pages(ADMIN_DIR).map((file) => ({
  route: routeOf(file),
  source: readFileSync(file, "utf8"),
}));

function leadOf(source: string): string | null {
  const m = /lead=\{?"([^"]+)"/.exec(source) ?? /lead=\{`([^`]+)`\}/.exec(source);
  return m ? m[1] : null;
}

function isExempt(route: string, rule: string): boolean {
  return (exemptions.get(route) ?? []).includes(rule);
}

/**
 * 上限の判定。**式を名前にしておかないと、端を当てる先が無い。**
 *
 * 「全画面が上限内である」だけを見ていると、いま全画面が短いあいだは
 * `LEAD_MAX` を 4000 に書き換えても緑のままになる。上限そのものが
 * 効いていることは、画面の集まりとは別に当てる必要がある。
 */
function leadWithinLimit(lead: string): boolean {
  return lead.length <= LEAD_MAX;
}

/** 常時表示の注意書きの上限判定。理由は `leadWithinLimit` と同じ。 */
function calloutsWithinLimit(count: number): boolean {
  return count <= CALLOUT_MAX;
}

describe("A8 §0 上限の判定が端で切り替わる", () => {
  // 上限内・上限超の 2 クラスと、**切り替わる 1 点そのもの**を当てる。
  // 「ちょうど上限」を通す側に置くのは、上限が「まで」の意味だからで、
  // ここが逆になっていると全画面が 1 字分だけ厳しく採点される。
  it.each([
    ["ちょうど上限", LEAD_MAX, true],
    ["上限より 1 字長い", LEAD_MAX + 1, false],
    ["十分短い", 1, true],
  ] as const)("説明文が %s のとき", (_name, length, expected) => {
    expect(leadWithinLimit("あ".repeat(length)), `${length} 字の判定が違います`).toBe(expected);
  });

  it.each([
    ["ちょうど上限", CALLOUT_MAX, true],
    ["上限より 1 個多い", CALLOUT_MAX + 1, false],
    ["1 個も無い", 0, true],
  ] as const)("注意書きが %s のとき", (_name, count, expected) => {
    expect(calloutsWithinLimit(count), `${count} 個の判定が違います`).toBe(expected);
  });
});

describe("A8 §1 余白が用途ごとに 1 つへ揃っている", () => {
  const css = readFileSync(UI_CSS, "utf8");

  it("カード内の余白がすべて --space-5", () => {
    // 揃っていないと、同じ「カード」という言葉が画面ごとに違う物を指すことになる。
    const cardBlocks = css.match(/\.card[^{]*\{[^}]*\}/g) ?? [];
    expect(cardBlocks.length, "カードの定義が見つかりません").toBeGreaterThan(0);
    const odd = cardBlocks.filter((b) => /padding:/.test(b) && !/padding:\s*var\(--space-5\)/.test(b));
    expect(odd, `カード内の余白が --space-5 でない定義が ${odd.length} 件あります`).toEqual([]);
  });

  it("生の数値で余白を書いていない", () => {
    // 生値が 1 つ混ざると、そこだけ規則の外側になり、次の人が真似る。
    const raw = css.match(/(padding|gap):\s*\d+(px|rem)/g) ?? [];
    expect(raw, `生値の余白: ${raw.join(", ")}`).toEqual([]);
  });
});

describe("A8 §2 画面の説明文が短い", () => {
  it.each(screens.map((s) => [s.route, s] as const))("%s の説明文", (route, screen) => {
    if (isExempt(route, "lead_max")) return;
    const lead = leadOf(screen.source);
    if (lead === null) return;
    // §0 と同じ判定を通す。別々に書くと、端を当てた式と画面に当てる式がずれる。
    expect(
      leadWithinLimit(lead),
      `${route} の説明文が ${lead.length} 字あります（上限 ${LEAD_MAX} 字）:\n  ${lead}`,
    ).toBe(true);
  });
});

describe("A8 §3 常に見えている注意書きが多すぎない", () => {
  it.each(screens.map((s) => [s.route, s] as const))("%s の注意書き", (route, screen) => {
    if (isExempt(route, "callout_max")) return;
    const count = (screen.source.match(/<Callout[\s/>]/g) ?? []).length;
    expect(
      calloutsWithinLimit(count),
      `${route} に常時表示の注意書きが ${count} 個あります（上限 ${CALLOUT_MAX} 個）。` +
        `金銭・秘密・公開に関わるものは消さず、押す物の隣へ移してください`,
    ).toBe(true);
  });
});

describe("A10 §1 落とすと決めた項目が消えている", () => {
  const removals = priorityMap.screens.flatMap((s) =>
    s.drop.filter((d) => d.method === "remove").map((d) => ({ route: s.route, item: d.item })),
  );

  it("落とす対象が 1 件以上ある（表そのものが空でない）", () => {
    // 表が空のまま全部緑になる状態を防ぐ。減らす計画が無ければ A10 は測れない。
    expect(removals.length).toBeGreaterThan(0);
  });

  it("落とすと決めた画面の文章量が、決める前より減っている", () => {
    const byRoute = new Map<string, number>();
    for (const r of removals) byRoute.set(r.route, (byRoute.get(r.route) ?? 0) + 1);
    // 落とす計画のある画面が 1 つも実在しなければ、下の loop は 1 周も回らず 0 が出る。
    // 表が空でないこと（上の it）と、**表の route が実在の画面に当たること**は別の話。
    const targets = [...byRoute.keys()].filter((r) => screens.some((s) => s.route === r));
    expect(targets.length, "落とす計画のある画面が 1 つも実在しません").toBeGreaterThan(0);
    const notReduced: string[] = [];
    for (const [route] of byRoute) {
      const screen = screens.find((s) => s.route === route);
      if (!screen) continue;
      const lead = leadOf(screen.source);
      const callouts = (screen.source.match(/<Callout[\s/>]/g) ?? []).length;
      // 落とす項目がある画面は、説明文か注意書きのどちらかが上限内に収まる。
      if ((lead?.length ?? 0) > LEAD_MAX && callouts > CALLOUT_MAX) notReduced.push(route);
    }
    expect(notReduced, `落とす計画が実施されていない画面: ${notReduced.join(", ")}`).toEqual([]);
  });
});

/*
 * --- §2 を足した理由（2026-08-22）-----------------------------------------
 *
 * A10 の述語は「**全 route** について keep / drop / transform が記録され、
 * 実装がそれに一致する」。§1 が見ていたのは「表に載っている画面が減ったか」だけで、
 * **表に載っていない画面**は 1 度も照合されなかった。
 *
 * 実測すると、分割で生まれた 17 画面が表に無かった。表は 32 件のまま、
 * 実装は 49 画面。§1 は 32 件を全部緑にして「A10 は満たした」と言っていた。
 *
 * ㉞ **「全部について」と書かれた条件は、全部の作り方を別に測らないと守れない。**
 * 表と実装の差は、表の側からは決して見えない。実装を数えて突き合わせる。
 */
describe("A10 §2 表が全画面を記録している", () => {
  /*
   * --- 床を置く理由 ---
   *
   * 下の 3 つはいずれも「0 件である」と主張する。だが 0 は 2 通りの作り方がある。
   * 「差が無い」ときと、**走査に失敗して母集団が空**のときである。
   * 画面の取り出し（`screens`）が壊れれば前者 2 つは常に緑になり、
   * 表の読み込みが壊れれば 3 つとも常に緑になる。
   * だから同じ it の中に、0 でないはずの数の床を同居させる。
   */
  const MIN_SCREENS = 40; // 実測 49
  const MIN_MAPPED_ROWS = 40; // 実測 49

  it("実在する画面がすべて表に載っている", () => {
    expect(screens.length, "画面が 1 枚も取れていません。走査が壊れています").toBeGreaterThanOrEqual(
      MIN_SCREENS,
    );
    const mapped = new Set(priorityMap.screens.map((s) => s.route));
    const missing = screens.map((s) => s.route).filter((r) => !mapped.has(r));
    expect(
      missing,
      `表に無い画面が ${missing.length} 枚あります:\n  ${missing.join("\n  ")}\n` +
        "画面を足したら、何を残し何を落としたかを表へ書くこと。",
    ).toEqual([]);
  });

  it("表に載っている画面がすべて実在する", () => {
    // 逆向きも見る。消した画面の行が残っていると、表は「まだ在る」と言い続ける。
    expect(
      priorityMap.screens.length,
      "表の行が 1 つも読めていません。読み込みが壊れています",
    ).toBeGreaterThanOrEqual(MIN_MAPPED_ROWS);
    const actual = new Set(screens.map((s) => s.route));
    const ghosts = priorityMap.screens.map((s) => s.route).filter((r) => !actual.has(r));
    expect(ghosts, `実在しない画面の行: ${ghosts.join(", ")}`).toEqual([]);
  });

  it("どの行も 3 分類のどれかに 1 件以上を持つ", () => {
    // 3 つとも空の行は「載っている」だけで何も決めていない。
    // 行の数だけ合わせて中身が無い状態を、件数の一致は見抜けない。
    expect(
      priorityMap.screens.length,
      "表の行が 1 つも読めていません。読み込みが壊れています",
    ).toBeGreaterThanOrEqual(MIN_MAPPED_ROWS);
    const empty = priorityMap.screens
      .filter((s) => s.keep.length + s.drop.length + s.transform.length === 0)
      .map((s) => s.route);
    expect(empty, `何も決めていない行: ${empty.join(", ")}`).toEqual([]);
  });
});

/*
 * --- なぜこの検査が要るか（2026-08-22 / ah-1kz）---
 *
 * この表には `current_totals` という節があり、`screens_over_lead_limit: 21` /
 * `screens_over_callout_limit: 14` と書いてあった。`measured_at` は
 * 「P07 (2026-08-22)」。だが実測は**どちらも 0 件**で、この 2 つは
 * `baseline_totals`（P01 / 32 画面時点）の写しがそのまま残ったものだった。
 *
 * ㉟ **手で書いた集計値は、検査が測り直す値と必ずずれる。**
 * ずれても誰も気づかなかったのは、その値を**読んでいるコードが 1 行も無かった**から。
 * 参照はすべて文書側で、文書は自分が引用した数が古いかどうかを知らない。
 *
 * だから今の値は持たせない。持たせずに済むのは、上の A8 §3 / §4 が
 * 毎回測っているからである。**測る器があるのに写しを置くのは、
 * 古くなる複製をひとつ増やすだけ**になる。
 *
 * `baseline_totals` は残す。あれは「今の値」ではなく **P01 の固定点**で、
 * 動かさないことに意味がある。動く値と動かない値を、ここで見分ける。
 */
describe("表が手書きの『今の値』を持たない", () => {
  const raw: Record<string, unknown> = JSON.parse(readFileSync(PRIORITY_MAP, "utf8"));

  /** 入れ子のどこかに数を持っているか。節の名前ではなく中身で見る。 */
  const hasNumber = (v: unknown): boolean =>
    typeof v === "number" ||
    (Array.isArray(v) && v.some(hasNumber)) ||
    (typeof v === "object" && v !== null && Object.values(v).some(hasNumber));

  it("数を持つ節は baseline_totals だけ", () => {
    /*
     * 名前で弾かない。`current_totals` を禁じても `latest_totals`、`p07_totals`
     * と名を変えれば同じものが戻ってくる。見るのは**数が在るかどうか**。
     *
     * 除くのは 3 つだけで、どれも「測った結果ではない」から除く。
     *   - `baseline_totals` … P01 の固定点。動かさないことに意味がある
     *   - `rules` … 上限の**決め事**。実測ではなく、実測が超えたかを判定する側
     *   - `screens` … 各画面で何を残し何を落としたかの表（集計ではない）
     *
     * `rules` を素通しにすると、そこへ集計値を紛れ込ませる逃げ道になる。
     * 塞ぐために、下の it で `rules` の上限が検査の定数と一致することを見る。
     * 一致を要求すれば、`rules` に置けるのは検査が実際に使う 2 つだけになる。
     */
    const NOT_MEASUREMENTS = new Set(["baseline_totals", "rules", "screens"]);
    const sections = Object.keys(raw);
    // 床: 走査母集団。表そのものが空になれば「集計値を持つ節は 0 件」も出る。
    // 2026-08-22 実測 9 節。次の it が baseline の中身を、その次が rules を見張る。
    expect(sections.length, "表の節が減っています（走査するものが無い）").toBeGreaterThanOrEqual(9);
    const offenders = sections.filter((k) => !NOT_MEASUREMENTS.has(k) && hasNumber(raw[k]));
    expect(
      offenders,
      `手書きの集計値を持つ節があります: ${offenders.join(", ")}。\n` +
        "今の値は tests/ui/uiux-spacing-and-copy.test.ts が毎回測ります。" +
        "写しを置くと、測り直す値とずれたまま誰も気づきません（ah-1kz）。",
    ).toStrictEqual([]);
  });

  it("baseline_totals は数を持ったまま残っている", () => {
    /*
     * **上の検査の床。**
     *
     * 「数を持つ節が無い」は、表から数を全部消しても緑になる。それでは
     * P01 からどれだけ変わったかを測る固定点まで一緒に失う。
     * 固定点が生きていて、かつ写しが無い——両方が同時に成り立つときだけ緑にする。
     */
    const baseline = raw.baseline_totals;
    expect(hasNumber(baseline), "baseline_totals から数が消えています").toBe(true);
    expect(
      (baseline as { readonly screens?: number }).screens,
      "baseline の画面数は P01 の実測 32 のまま動かしません",
    ).toBe(32);
  });

  it("rules の上限が、検査の使う値と一致している", () => {
    /*
     * `rules` を「測った結果ではない」として除外した以上、そこに在ってよいのは
     * **検査が実際に使う上限だけ**であることを示さないと、除外が抜け道になる。
     *
     * 一致そのものにも値打ちがある。表に「40 字まで」と書いてあるのに検査が
     * 50 で見ていたら、読んだ人は守れない規則を守ることになる。
     */
    const rules = raw.rules as {
      readonly lead_max_chars?: number;
      readonly always_visible_callout_max?: number;
    };
    expect(rules.lead_max_chars, "表の字数上限と検査の LEAD_MAX がずれています").toBe(LEAD_MAX);
    expect(rules.always_visible_callout_max, "表の枠の上限と検査の CALLOUT_MAX がずれています").toBe(
      CALLOUT_MAX,
    );
  });

  it("今の値の在り処が書いてある", () => {
    // 数を消しただけだと「どこで測るのか」が失われ、次の人がまた書き足す。
    // 口を閉じるときは、代わりの口を同じ場所に示す。
    const where = (raw.current_measurement as { readonly where?: string } | undefined)?.where;
    expect(where, "current_measurement.where が指す検査が実在しません").toBe(
      "tests/ui/uiux-spacing-and-copy.test.ts",
    );
  });
});
