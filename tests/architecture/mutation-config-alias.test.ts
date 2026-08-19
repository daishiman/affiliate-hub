/**
 * @tier 1
 * @req REQ-CI09, REQ-TS09
 * @types contract, infra-config
 *
 * ミューテーション用の設定が、本体の設定より**別名を少なく持っていないか**を見る。
 *
 * --- なぜこれが要るか（2026-08-19 の実測） ---
 * `vitest.mutation.config.mts` には `server-only` の別名が無かった。
 * その別名は本体の `vitest.config.mts` にはある。
 * 結果、`import "server-only"` に行き着く検査ファイル **10 本**が
 * ミューテーションの計測中だけ読み込めず、0 件のまま終わっていた（対象 66 本中）。
 *
 * **落ちたことが問題なのではない。落ちても分からなかったことが問題である。**
 * Stryker はこれを「テストが落ちた」ではなく
 * **「そのコードにはテストが無い」**として数え、スコアの分母に入れる。
 * 検査は在るのに無いことにされ、その分だけ点が下がった状態で
 * 「ミューテーションスコア 52.22%」という数字が出ていた。
 * 数字は低い側へずれていたので、誰も得をしない代わりに、
 * **どこを直せばよいかも指していなかった。**
 *
 * 別名を足したら 1613 件 → 1906 件（+293 件）が計測に参加した。
 *
 * --- この検査の向き ---
 * 見ているのは「ミューテーション側に足りない別名」だけである。
 * ミューテーション側にだけ在る別名は止めない（絞る側の判断は在りうる）。
 * **別名を減らす向きで緑にしない。**足りないほうを足して直す。
 */
import { describe, expect, it } from "vitest";
/*
 * **`.mjs` と書いて `.mts` を読む。**`.mts` と書くと tsc が TS5097 で落ちる
 * （`allowImportingTsExtensions` が要る）。この作業場所ではその設定を入れず、
 * TypeScript の決まりどおり「出力側の拡張子で書く」に合わせる。
 * tsc は `.mjs` を `.mts` へ、vite も TS からの読み込みでは同じ対応づけをする。
 * **設定を緩めて黙らせる形にしない。**
 */
import mainConfig from "../../vitest.config.mjs";
import mutationConfig from "../../vitest.mutation.config.mjs";

type AliasMap = Readonly<Record<string, string>>;

function aliasesOf(config: unknown): AliasMap {
  const alias = (config as { resolve?: { alias?: unknown } })?.resolve?.alias;
  /*
   * vite の別名は配列でも書けるが、この作業場所では 2 つとも object 形式である。
   * 形が変わったら「読めなかった」を空の表にせず、その場で落とす。
   * 空の表にすると、下の突き合わせが 0 件になって緑になる。
   */
  if (alias === undefined || alias === null || Array.isArray(alias) || typeof alias !== "object") {
    throw new Error(
      "別名が object 形式ではありません。形が変わった場合は、この検査の読み方も直してください。" +
        "空の表として扱うと、突き合わせが 0 件になって緑になります。",
    );
  }
  return alias as AliasMap;
}

/** 左（本体）に在って右（ミューテーション）に無い、または行き先が違う別名の名前。 */
function missingAliasKeys(main: AliasMap, mutation: AliasMap): readonly string[] {
  return Object.keys(main).filter((key) => mutation[key] !== main[key]);
}

describe("ミューテーション用の設定が本体より狭くないこと", () => {
  it("本体にある別名は、ミューテーション用の設定にも同じ行き先で在る", () => {
    const missing = missingAliasKeys(aliasesOf(mainConfig), aliasesOf(mutationConfig));
    expect(
      missing,
      `ミューテーション用の設定に足りない別名があります: ${missing.join(" / ")}\n` +
        "足りないと、その別名を必要とする検査ファイルが読み込めず、" +
        "Stryker はそれを「テストが落ちた」ではなく「テストが無い」として数えます。" +
        "検査が在るのに無いことにされ、スコアがその分だけ下がります。" +
        "**本体側の別名を消して揃えないでください。**足りないほうを足します。",
    ).toEqual([]);
  });

  /*
   * **陽性対照。** 上の 1 本だけだと、`missingAliasKeys` が常に空を返すよう
   * 壊れていても緑になる。見つける側が動いていることを、
   * 見つかるはずの見本で示す。
   */
  it("足りない別名があるときは、見つかる", () => {
    const main: AliasMap = { "@": "/src", "server-only": "/stub.ts" };
    expect(missingAliasKeys(main, { "@": "/src" })).toEqual(["server-only"]);
  });

  it("行き先だけが違うときも、足りないほうに数える", () => {
    const main: AliasMap = { "server-only": "/stub.ts" };
    expect(
      missingAliasKeys(main, { "server-only": "/別のところ.ts" }),
      "名前だけ合っていて行き先が違う別名は、名前で数えると見逃します。" +
        "身代わりが別のものに差し替わっていても、読み込めなくなる結果は同じです。",
    ).toEqual(["server-only"]);
  });

  /*
   * ミューテーション側にだけ在る別名は止めない。
   * ここを止めると、絞る側の判断ができなくなる。
   */
  it("ミューテーション側にだけ在る別名は、止めない", () => {
    expect(missingAliasKeys({ "@": "/src" }, { "@": "/src", extra: "/x" })).toEqual([]);
  });
});
