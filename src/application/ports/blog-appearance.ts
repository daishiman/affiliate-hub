import type {
  BlogTemplateId,
  BlogTheme,
  PageThemeOverride,
} from "@/domain/authoring/blog-template";
import type { WorkspaceId } from "@/domain/shared";
import type { PortResult } from "./common";

/**
 * ブログの見た目の保存口（テンプレート選択・配色 2 層）。
 *
 * --- 3 つを 1 つのポートにまとめた理由 ---
 * テンプレート・ブログ既定配色・ページ上書きは表としては別だが、
 * 「ブログの見た目をどう決めるか」という 1 つの問いの 3 つの層である。
 * 別々のポートにすると、画面が 3 つの保存先を順に呼ぶことになり、
 * 途中で落ちたときの状態が画面ごとに違う形で残る。
 *
 * --- 口を絞る理由 ---
 * `save` / `clear` / 読み取りだけを置く。
 *
 * **書く口は `save` で始める。** 見せ方を決める操作は日本語では「選ぶ」だが、
 * `selectTemplate` と名乗っていた頃、`scripts/port-wiring.mjs` が
 * 読み書きを判定できずに止まった（SQL の `SELECT` は読みの語である）。
 * 語彙表へ `select` を足して黙らせることもできたが、それをすると
 * **将来の読み取り手続きが黙って書き込み扱いになる。**名前の側を直した。
 * **一括更新の口を作らない。** 作ると「テンプレートも配色も同時に変えた」
 * 操作が 1 行の監査記録になり、後からどちらが原因か辿れなくなる。
 *
 * --- テンプレート定義そのものは保存しない ---
 * 6 種の定義は `src/domain/authoring/blog-template.ts` にある。
 * DB へ持たせると、種類を 1 つ増やすのに migration が要る
 * （`admin-api-contract.md` §2.2）。ここが保存するのは
 * 「どのブログがどれを選んだか」だけである。
 */
export type BlogAppearancePort = {
  /**
   * このブログが選んでいるテンプレート。
   *
   * **行が無いのは正常**で、`null` を返す。既定値をここで埋めない。
   * 埋めると「既定のまま」と「既定を明示的に選んだ」が区別できなくなり、
   * 既定を変えた日に、明示的に選んだブログまで一緒に動く。
   */
  templateOf(input: {
    readonly workspaceId: WorkspaceId;
    readonly siteSlug: string;
  }): PortResult<BlogTemplateId | null>;

  /**
   * テンプレートを選ぶ。行が無ければ作り、あれば書き換える。
   *
   * **記事に触らない。** 触ると差し替えで記事が壊れる
   * （`component-contract.md` §1.1、受入 A1 の本体）。
   */
  saveTemplate(input: {
    readonly workspaceId: WorkspaceId;
    readonly siteSlug: string;
    readonly templateId: BlogTemplateId;
  }): PortResult<BlogTemplateId>;

  /** ブログ既定の配色。未設定なら `null`。 */
  themeOf(input: {
    readonly workspaceId: WorkspaceId;
    readonly siteSlug: string;
  }): PortResult<BlogTheme | null>;

  saveTheme(input: {
    readonly workspaceId: WorkspaceId;
    readonly siteSlug: string;
    readonly theme: BlogTheme;
  }): PortResult<BlogTheme>;

  /**
   * ページ上書きの一覧。
   *
   * **上書きしていないページは返さない。** 全ページぶんの行を返すと、
   * 「上書きしていない」が「既定と同じ値で上書きしている」に化け、
   * 既定を変えた日にどのページも動かなくなる。
   */
  listOverrides(input: {
    readonly workspaceId: WorkspaceId;
    readonly siteSlug: string;
  }): PortResult<readonly { readonly pagePath: string; readonly override: PageThemeOverride }[]>;

  overrideOf(input: {
    readonly workspaceId: WorkspaceId;
    readonly siteSlug: string;
    readonly pagePath: string;
  }): PortResult<PageThemeOverride | null>;

  /**
   * ページ上書きを保存する。
   *
   * 両軸とも未指定の上書きは**保存せず削除する**（不変条件 I2）。
   * 「上書きしていない上書き行」は、一覧に出るのに何も変えない行で、
   * 解除したはずのページが解除できなくなる。
   * この判定は保存口の責務である——D1 の制約では書けない。
   */
  saveOverride(input: {
    readonly workspaceId: WorkspaceId;
    readonly siteSlug: string;
    readonly pagePath: string;
    readonly override: PageThemeOverride;
  }): PortResult<PageThemeOverride | null>;

  /** 上書きを外す。行を消す。NULL の行を残さない（`theme-contract.md` §3.3）。 */
  clearOverride(input: {
    readonly workspaceId: WorkspaceId;
    readonly siteSlug: string;
    readonly pagePath: string;
  }): PortResult<void>;
};
