/** @tier 1 @req REQ-BLOG01 */
import { describe, expect, it } from "vitest";
import {
  SITE_COMPOSITION_ELEMENTS,
  SITE_COMPOSITION_LABEL,
  SITE_COMPOSITION_REMEDY,
  SITE_COMPOSITION_SEVERITY,
  SITE_CONTENT_REQUIRED_COUNTS,
  SITE_PROVISIONING_REQUIRED_COUNTS,
  type CompositionCounts,
  blockingGaps,
  evaluateSiteComposition,
} from "@/domain/authoring";

/**
 * 「読者から見える」の定義が 1 か所であることを固定する。
 *
 * この検査が守っているのは、13 問に答えて緑の「作成済みです」が出たのに
 * `/s/<URL名>` が 404 だった事故である。あのとき成功の定義は 2 つあった——
 * 作成側は「設計図を保存できた」、読者側は「サイト網の節点が 1 行ある」。
 * だから**ここで見るのは個々の判定結果ではなく、定義が 1 つであること**である。
 */

/** 全要素が満たされた状態。個々の検査はここから 1 つずつ削って作る。 */
const FULL: CompositionCounts = SITE_CONTENT_REQUIRED_COUNTS;

function withZero(...zeroed: readonly (keyof CompositionCounts)[]): CompositionCounts {
  return { ...FULL, ...Object.fromEntries(zeroed.map((e) => [e, 0])) } as CompositionCounts;
}

describe("構成要素の表", () => {
  /*
    表を 3 つに分けて持っている以上、要素を 1 つ足したときに
    どれか 1 つを書き忘れる形が必ずできる。書き忘れると画面には
    `undefined` が出る——**しかも型は通る**（Record の値が string 型のまま
    実体が欠けるのは、要素を後から足したときに起きる）。
    だから 3 表とも「要素の集合と過不足なく一致する」を見る。
  */
  it.each([
    ["表示名", SITE_COMPOSITION_LABEL],
    ["直し方", SITE_COMPOSITION_REMEDY],
    ["強さ", SITE_COMPOSITION_SEVERITY],
  ])("%s の表が、構成要素と過不足なく一致する", (_name, table) => {
    expect(Object.keys(table).sort()).toEqual([...SITE_COMPOSITION_ELEMENTS].sort());
  });

  it("表示名と直し方に、内部構造の語をそのまま出さない", () => {
    // 13 問に答えた人に「スロット」「バンド」「ノード」は通じない。
    // 通じない語で不足を告げると、原因が自分の入力にあると誤って受け取られる。
    const internalWords = ["slot", "band", "node", "blueprint", "スロット", "ノード"];
    for (const element of SITE_COMPOSITION_ELEMENTS) {
      const shown = `${SITE_COMPOSITION_LABEL[element]} ${SITE_COMPOSITION_REMEDY[element]}`;
      for (const word of internalWords) {
        expect(shown.toLowerCase(), `${element} の文言`).not.toContain(word.toLowerCase());
      }
    }
  });

  /*
    ── これは「増やすな」ではなく「増やすときは目に入れろ」の検査である ──
    `blocking` を増やせば「作成済みと言ったのに 404」はより起きにくくなるが、
    作成が巻き戻る場面が増え、13 問を通した人が完成に辿り着けなくなる。
    どちらが良いかは場合による。**黙って増えるのだけが困る。**
    増やす変更はここで必ず赤くなり、理由を書く場所ができる。
  */
  it("公開を止める要素は network_node ただ 1 つである", () => {
    const blocking = SITE_COMPOSITION_ELEMENTS.filter(
      (e) => SITE_COMPOSITION_SEVERITY[e] === "blocking",
    );
    expect(blocking).toEqual(["network_node"]);
  });
});

describe("evaluateSiteComposition", () => {
  it("全部そろっていれば開ける・不足なし", () => {
    const report = evaluateSiteComposition(FULL);

    expect(report.reachable).toBe(true);
    expect(report.provisioningComplete).toBe(true);
    expect(report.contentReady).toBe(true);
    expect(report.gaps).toEqual([]);
    expect(report.counts).toEqual(FULL);
  });

  it("住所の登録が無いと開けない", () => {
    const report = evaluateSiteComposition(withZero("network_node"));

    expect(report.reachable).toBe(false);
    expect(blockingGaps(report).map((g) => g.element)).toEqual(["network_node"]);
  });

  it("作成の必須実体が足りなければ、開けても作成完了にしない", () => {
    const report = evaluateSiteComposition(
      withZero("site_documents", "layout_bands", "layout_slots", "categories"),
    );

    expect(report.reachable, "薄いだけで開けなくなってはいけない").toBe(true);
    expect(report.provisioningComplete).toBe(false);
    expect(report.contentReady).toBe(false);
    expect(report.gaps).toHaveLength(4);
    expect(blockingGaps(report)).toEqual([]);
  });

  it("記事が0件なら開けても公開準備完了にはしない", () => {
    const report = evaluateSiteComposition(withZero("articles"));

    expect(report.reachable).toBe(true);
    expect(report.provisioningComplete).toBe(true);
    expect(report.contentReady).toBe(false);
    expect(report.gaps.map((gap) => gap.element)).toEqual(["articles"]);
  });

  it("件数があっても必須の内訳が不完全な要素は不足にする", () => {
    const report = evaluateSiteComposition(FULL, ["site_documents"]);

    // 件数は満ちている（FULL = 公開準備に要る全種）。それでも内訳が不完全なら不足にする、が主題。
    // 作成側の必須（`SITE_PROVISIONING_REQUIRED_COUNTS.site_documents`）は 0 なので、
    // ここでそちらと比べると「満ちている」の前提が崩れる。
    expect(report.counts.site_documents).toBe(SITE_CONTENT_REQUIRED_COUNTS.site_documents);
    expect(report.provisioningComplete).toBe(true);
    expect(report.contentReady).toBe(false);
    expect(report.gaps.map((gap) => gap.element)).toEqual(["site_documents"]);
  });

  it("固定ページ8種が下書きで実体化されていれば作成は完了、公開準備は未完了", () => {
    const report = evaluateSiteComposition(
      { ...SITE_PROVISIONING_REQUIRED_COUNTS, articles: 0 },
      ["site_documents"],
    );

    expect(report.reachable).toBe(true);
    expect(report.provisioningComplete).toBe(true);
    expect(report.contentReady).toBe(false);
    expect(report.gaps.map((gap) => gap.element)).toEqual(["site_documents", "articles"]);
  });

  it("不足には、画面に出す言葉と直し方が必ず付く", () => {
    // 不足を告げるだけで直し方が無いと、告げられた人は 13 問をやり直す。
    for (const gap of evaluateSiteComposition(withZero(...SITE_COMPOSITION_ELEMENTS)).gaps) {
      expect(gap.label, `${gap.element} の表示名`).toBeTruthy();
      expect(gap.remedy, `${gap.element} の直し方`).toBeTruthy();
      expect(gap.label).toBe(SITE_COMPOSITION_LABEL[gap.element]);
      expect(gap.remedy).toBe(SITE_COMPOSITION_REMEDY[gap.element]);
    }
  });

  it("不足の並びは構成要素の並びに従う（画面ごとに順が変わらない）", () => {
    const report = evaluateSiteComposition(withZero(...SITE_COMPOSITION_ELEMENTS));

    expect(report.gaps.map((g) => g.element)).toEqual([...SITE_COMPOSITION_ELEMENTS]);
  });

  it("2 件以上あっても「足りない」と言い続けない", () => {
    // 何件あれば十分かは運営者が決めることで、機械が決める話ではない。
    const many = Object.fromEntries(
      SITE_COMPOSITION_ELEMENTS.map((e) => [e, 99]),
    ) as CompositionCounts;

    expect(evaluateSiteComposition(many).gaps).toEqual([]);
  });
});
