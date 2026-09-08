import type { BlogAppearancePort } from "@/application/ports/blog-appearance";
import {
  type Appearance,
  parseBrandTheme,
  parseColorMode,
} from "@/domain/authoring/appearance";
import { findBlogTemplate, resolvePageTheme } from "@/domain/authoring/blog-template";
import { normalizePagePath } from "@/domain/authoring/page-path";
import type { WorkspaceId } from "@/domain/shared";

/**
 * 読者 1 人・1 ページに実際に効く配色を、**保存された 2 層から**決める。
 *
 * --- なぜ公開面のためだけの読み口を分けたか ---
 * 管理画面は `manage-blog-appearance` を通るが、あれは `content.read` を要求する。
 * 読者は誰でもあり、能力を 1 つも持たない。能力の要る道を読者に通させると、
 * 「配色を読むために読者へ記事の読み取り権限を配る」ことになり、
 * 能力の意味が薄まる。**見た目は秘密ではない**ので、読み取り専用の別の口を置く。
 *
 * --- 優先順を写さない ---
 * 2 層の合成は `resolvePageTheme`（ドメイン）ただ 1 本に任せる。
 * 読者側にもう一度 `??` を並べると、優先順を変えた日に公開面だけ古い順で解け続ける。
 * この関数が足しているのは「保存先から 2 つ読む」ことと、
 * 「知らない名札を既定へ落とす」ことだけである。
 *
 * --- 読めなかったら記事を止めるか ---
 * **止めない。** 配色は読み物の付随物で、色が既定に戻っても文章は読める。
 * ここで失敗を上へ投げると、`blog_theme` が読めないだけで記事が
 * 「いま表示できません」になる。読者が失うものの大きさが釣り合わない。
 * 失敗は `fallback`（設計図の配色）へ倒し、**倒したことは呼ぶ側へ返す**
 * （黙って倒すと、保存先が落ちていても管理画面と公開面の色が違うだけに見える）。
 *
 * 規範: docs/spec/feat-blog-ui-builder/theme-contract.md §3・§4（受入 A2-4）
 */

/**
 * 記事の中の塊の並び。ブログが選んだ見せ方から取る（受入 A1・A5）。
 *
 * 選んでいなければ `null` を返す。**既定の並びをここで埋めない。**
 * 埋めると「選んでいない」と「既定と同じものを選んだ」が区別できなくなり、
 * 既定の並びを変えた日に、明示的に選んだブログまで一緒に動く
 * （`blog-appearance.ts` の `templateOf` が守っているのと同じ約束）。
 */
export async function readPublicArticleBlockOrder(input: {
  readonly port: BlogAppearancePort;
  readonly workspaceId: WorkspaceId;
  readonly siteSlug: string;
}): Promise<readonly string[] | null> {
  const selected = await input.port.templateOf({
    workspaceId: input.workspaceId,
    siteSlug: input.siteSlug,
  });
  if (!selected.ok || selected.value === null) return null;
  /*
    保存先が持っているのは名札だけで、並びの定義はドメインにある
    （`admin-api-contract.md` §2.2）。知らない名札は `null` に落ちるので、
    見せ方を 1 つ減らした日に、消した名札を持つブログは既定の並びへ戻る。
  */
  return findBlogTemplate(selected.value)?.articleBlockOrder ?? null;
}

export type PublicBlogAppearance = {
  /** 読者の cookie を載せる前の、ブログ側が決めた配色。 */
  readonly appearance: Appearance;
  /**
   * 保存先を読めたか。読めていないときは `fallback` をそのまま返している。
   * 画面はこれを見て「保存した色が出ていない」と気づける。
   */
  readonly resolved: boolean;
};

export async function readPublicBlogAppearance(input: {
  readonly port: BlogAppearancePort;
  readonly workspaceId: WorkspaceId;
  readonly siteSlug: string;
  /** サイト基準の道（`/`、`/operator`）。`site_slug` と組で一意なので接頭辞は付けない。 */
  readonly pagePath: string;
  /** ブログ既定が未登録のときの土台（`site_blueprints.theme`）。 */
  readonly fallback: Appearance;
}): Promise<PublicBlogAppearance> {
  const { port, workspaceId, siteSlug, pagePath, fallback } = input;

  /*
    保存したときと**同じ正規化**を通す。書く側だけで揃えると、
    `/operator` で保存した上書きが `/operator/` を開いた読者に効かない。
    正規化の関数は domain policy の 1 本きりで、ここに写しを作らない。
  */
  const path = normalizePagePath(pagePath);
  const [theme, override] = await Promise.all([
    port.themeOf({ workspaceId, siteSlug }),
    port.overrideOf({ workspaceId, siteSlug, pagePath: path }),
  ]);
  if (!theme.ok || !override.ok) return { appearance: fallback, resolved: false };

  /*
    ブログ既定の行が無いのは正常（受入 A2 の「未設定」）。
    設計図の配色が土台になる ——`theme-contract.md` §3 の 4 段目。
  */
  const base = theme.value ?? { brandTheme: fallback.brandTheme, colorMode: fallback.colorMode };
  const effective = resolvePageTheme(base, override.value);

  /*
    保存先から読んだ値にも名札の検証を掛ける。**DB を信用しない。**
    migration や手作業の SQL で語彙の外の値が入る経路が実在し、
    素通しするとトークンの無い名前が `data-brand-theme` に入って
    「色が半分だけ既定」の画面になる（`theme-contract.md` §4）。
  */
  return {
    appearance: {
      brandTheme: parseBrandTheme(effective.brandTheme) ?? fallback.brandTheme,
      colorMode: parseColorMode(effective.colorMode) ?? fallback.colorMode,
    },
    resolved: true,
  };
}
