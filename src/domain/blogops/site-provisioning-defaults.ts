/**
 * 新しく作られたブログが**最初から持っている**版面の行の定義。
 *
 * ここが 1 か所である理由は `site-publication.ts` と同じ。保存先ごとに
 * 初期値を書くと、D1 で作ったブログと見本データで作ったブログが別の形になり、
 * 「手元では出るのに本番では出ない」を作れてしまう。
 *
 * **行を作ることと、読者に出すことを分けている。** 帯や枠は行が無いと
 * 管理画面が「未整備」としか言えず、運営者は何を触ればよいか分からない。
 * かといって中身が空のまま全部出すと、作成直後のブログに空の箱が並ぶ。
 * だから行は全部作り（公開投影が実在を確認できる）、
 * 中身が要るものだけ `enabled: false` で置いておく。
 */

import {
  LAYOUT_REGIONS,
  type LayoutRegion,
  SLOT_KEYS_BY_REGION,
  TOP_BANDS,
  TOP_BAND_LABEL,
  type TopBand,
} from "./blueprint-parts";

export type LayoutBandSeed = {
  readonly band: TopBand;
  readonly title: string;
  readonly enabled: boolean;
  readonly position: number;
  readonly itemLimit: number;
};

export type LayoutSlotSeed = {
  readonly region: LayoutRegion;
  readonly slotKey: string;
  readonly title: string;
  readonly body: string;
  readonly enabled: boolean;
  readonly position: number;
};

/**
 * 運営者が文章を入れるまで出しても意味が無い枠。
 *
 * 空の「お知らせ」や空の「おすすめ」が読者に見えると、
 * 作った本人には**壊れているのか未入力なのか**が区別できない。
 */
const NEEDS_CONTENT_SLOT_KEYS: ReadonlySet<string> = new Set([
  "custom-html-slot-upper",
  "custom-html-slot-lower",
  "sticky-promo-slot",
]);

/**
 * 姉妹サイトの帯だけ既定で切る。
 *
 * 最初の 1 本目は姉妹サイトを持たない。持たないものの帯を出すと
 * 空の見出しだけが残る。2 本目を作った時点で運営者が入れる。
 */
const DISABLED_BANDS: ReadonlySet<TopBand> = new Set(["sister_sites"]);

export function defaultLayoutBandSeeds(): readonly LayoutBandSeed[] {
  return TOP_BANDS.map((band, index) => ({
    band,
    title: TOP_BAND_LABEL[band],
    enabled: !DISABLED_BANDS.has(band),
    position: index,
    itemLimit: 3,
  }));
}

export function defaultLayoutSlotSeeds(): readonly LayoutSlotSeed[] {
  const seeds: LayoutSlotSeed[] = [];
  for (const region of LAYOUT_REGIONS) {
    SLOT_KEYS_BY_REGION[region].forEach((slotKey, index) => {
      seeds.push({
        region,
        slotKey,
        // 見出しは空で置く。空なら `slotHeading` が枠の名前に落とす。
        // ここで名前を焼き込むと、運営者が消しても名前が戻らない。
        title: "",
        body: "",
        enabled: !NEEDS_CONTENT_SLOT_KEYS.has(slotKey),
        position: index,
      });
    });
  }
  return seeds;
}
