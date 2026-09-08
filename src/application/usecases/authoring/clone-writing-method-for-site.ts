import {
  PATTERN_WRITING_EMPHASIS,
  type WritingEmphasis,
} from "@/domain/authoring/pattern-writing-emphasis";
import { SITE_PATTERN_LABEL, type SitePattern } from "@/domain/authoring/site-blueprint";
import type { SectionView, WritingMethod } from "./read-writing-method";

/**
 * 共通の雛形から、ブログ 1 本分の「書き方の決めごと」を作る (A7)。
 *
 * **雛形を複製しない。** 参照して重みを足すだけである。
 * 複製すると、雛形を直したときに既存ブログが古い決めごとのまま残り、
 * どちらが本物か機械にも人にも決められなくなる。
 * 変わるのは「どの節を強く見るか」だけで、節そのものも文体の決まりも共通のままである。
 *
 * `required` を落とさない検査を関数の中に置いてあるのは、
 * 「この型では省いてよい」をブログ側の設定で作れないようにするためである。
 *
 * 純粋関数にしてあるので、全 10 型分の出力を単体テストで一度に確かめられる。
 *
 * 規範: docs/spec/feat-site-scoped-authoring-ia/site-scoped-route-contract.md
 */

/** 節に「この型では特に外せない」印を足した形。 */
export type SiteSectionView = SectionView & { readonly emphasized: boolean };

export type SiteWritingMethod = Omit<WritingMethod, "sections"> & {
  readonly sections: readonly SiteSectionView[];
  readonly pattern: SitePattern;
  readonly patternLabel: string;
  readonly emphasis: WritingEmphasis;
  /** 強調された節のうち、この記事の型に実在するものの件数。 */
  readonly emphasizedCount: number;
};

export function cloneWritingMethodForSite(
  base: WritingMethod,
  pattern: SitePattern,
): SiteWritingMethod {
  const emphasis = PATTERN_WRITING_EMPHASIS[pattern];
  const wanted = new Set<string>(emphasis.emphasized);

  /*
    強調は節が実在するときだけ付く。記事の型によっては、その型に無い節が
    強調表に載っていることがある。無い節を数に入れると、画面には出ない
    「3件強調中」が出て、探した人が見つけられない。
  */
  const sections = base.sections.map((section) => ({
    ...section,
    emphasized: wanted.has(section.id),
  }));

  return {
    ...base,
    sections,
    pattern,
    patternLabel: SITE_PATTERN_LABEL[pattern],
    emphasis,
    emphasizedCount: sections.filter((section) => section.emphasized).length,
  };
}
