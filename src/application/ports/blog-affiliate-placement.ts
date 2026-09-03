import type { WorkspaceId } from "@/domain/shared";
import type { BlogArticleBlock } from "@/domain/blogops";
import type { PortResult } from "./common";

/**
 * ブログ記事のどこに成果リンクが在るかの台帳（受入 A6 / A7）。
 *
 * --- 何のための表か ---
 * 報酬を数える表ではない（それは `affiliate_links` と `conversion` の担当）。
 * ここが答えるのは「**どこに出ていないか**」である。
 * 掲載 0 件の記事を数えられることが、この台帳の一番の値打ちで、
 * 「どこに出ているか」は副産物にすぎない。
 *
 * --- 読者経路はこの表を読まない ---
 * 不変条件 I4。公開面が出すのは記事の `cta` ブロックが持つリンク集合で、
 * この台帳ではない。読者経路をここへ繋ぐと、報酬に関わる列が
 * 読者向けのクエリ結果に混ざり、1 度混ざったら取り除いた確証が持てない。
 *
 * 受入 A7 が求める「3 面一致」は、この台帳の集合と
 * `cta` ブロックの集合が**一致すること**を指す（`admin-api-contract.md` §5.4）。
 */

/** 台帳 1 行。行 ID は外へ出さない（画面が行 ID で物を言い始めない）。 */
export type AffiliatePlacement = {
  readonly siteSlug: string;
  readonly articleSlug: string;
  /** 記事内のどこか（`intro` / `comparison` / `conclusion` など）。 */
  readonly placement: string;
  readonly trackingCode?: string;
  /** 同じ位置の中での並び。既定 0。重複してよい。 */
  readonly position: number;
};

/** A6 の一覧 1 行。掲載 0 件の記事も**行として出す**（そこが見たいので）。 */
export type ArticlePlacements = {
  readonly articleSlug: string;
  readonly placements: readonly AffiliatePlacement[];
};

export type BlogAffiliatePlacementPort = {
  /**
   * A6 — ブログ 1 つぶんの掲載を記事単位でまとめて返す。
   *
   * `knownArticleSlugs` を渡すと、**掲載 0 件の記事も空の行として**返す。
   * 渡さなければ台帳にある記事だけを返す。
   * 掲載漏れを数えるには、記事の全体集合を知っている側が渡すしかない
   * ——この台帳は「載っているもの」しか知らないからである。
   */
  listBySite(input: {
    readonly workspaceId: WorkspaceId;
    readonly siteSlug: string;
    readonly knownArticleSlugs?: readonly string[];
  }): PortResult<readonly ArticlePlacements[]>;

  /**
   * A7 — 成果リンクから、それが載っているブログ・記事を逆に引く。
   *
   * `trackingCode` と `placement` のどちらか（または両方）で絞る。
   * **両方とも省略したら全件を返す**——絞り込みの無い問い合わせを
   * 例外にすると、一覧の初期表示のために別の口が要る。
   *
   * 下書きの記事の掲載も返す。隠すと「公開したのに出ない」の
   * 原因が画面から見えなくなる。
   */
  listByAffiliate(input: {
    readonly workspaceId: WorkspaceId;
    readonly trackingCode?: string;
    readonly placement?: string;
  }): PortResult<readonly AffiliatePlacement[]>;

  /**
   * 掲載を記録する。同じ（記事・位置・追跡コード）が既にあれば書き換える。
   *
   * 位置の重複は許す。並びの厳密さより入力の軽さを採る
   * （`admin-api-contract.md` §5.1）。
   */
  save(input: {
    readonly workspaceId: WorkspaceId;
    readonly placement: AffiliatePlacement;
    /** 台帳と同じ原子的保存へ含める、公開記事側の CTA projection。 */
    readonly publicArticleBlock?: {
      readonly articleId: string;
      readonly block: BlogArticleBlock;
    };
  }): PortResult<AffiliatePlacement>;

  /**
   * 掲載を消す。**物理削除でよい。**
   *
   * この表は所在の記録であって履歴ではない。
   * 「いつ外したか」が要るなら `audit_log` が持つ。
   * 消した配置を残すと、掲載漏れの数が実態と合わなくなる。
   */
  remove(input: {
    readonly workspaceId: WorkspaceId;
    readonly siteSlug: string;
    readonly articleSlug: string;
    readonly placement: string;
    readonly trackingCode?: string;
    /** 台帳と同じ原子的削除へ含める公開記事側の CTA projection。 */
    readonly publicArticleBlockId?: string;
  }): PortResult<void>;
};
