import type { AnyToolDefinition } from "./tool-definition";

/**
 * 仕様に書かれた「道具の名前」と、実際に動くツールの対応表（§24.1・§24.3、ブログ層 §14.2）。
 *
 * **なぜ表にするか。**
 * 仕様の道具名（`search_products` など）と、この実装で育ってきた名前（`filter_products`）は
 * 同じものを指しているのに綴りが違う。放っておくと
 *   - 仕様を読んだ人が「無い」と判断して同じものをもう 1 つ作る
 *   - 外部のエージェントが仕様どおりの名前で呼んで、毎回「そのツールはありません」を受け取る
 * の 2 つが同時に起きる。どちらも「実装が足りない」ではなく「名前が繋がっていない」だけの事故。
 *
 * **やること 2 つ。**
 *   1. 対応が付いているものは、仕様の名前でも呼べるようにする（別名を機械で生やす）。
 *      処理は 1 つのまま。別名から呼んでも同じユースケースに入る。
 *   2. 対応が付いていないものは、**スタブとして名前を出す**。
 *      黙って一覧から消すと「仕様の 18 個のうち何個できているか」が誰にも分からなくなる。
 *
 * 別名は増やさないほうがよい。ここに載せてよいのは
 * **仕様書に固有名詞として書かれているもの**だけで、呼びやすさのための愛称は載せない。
 */

export type ContractSurface =
  | "webmcp_admin_read"
  | "webmcp_admin_write"
  | "webmcp_reader_read"
  | "webmcp_reader_write"
  | "mcp_tool";

export const SURFACE_LABELS: Readonly<Record<ContractSurface, string>> = {
  webmcp_admin_read: "管理側 WebMCP（読み取り）",
  webmcp_admin_write: "管理側 WebMCP（状態変更）",
  webmcp_reader_read: "読者側 WebMCP（読み取り）",
  webmcp_reader_write: "読者側 WebMCP（状態変更）",
  mcp_tool: "バックエンド MCP（ツール）",
};

export type ContractEntry = {
  /** 仕様書に書かれている名前。ここは変えない。 */
  readonly specName: string;
  readonly surface: ContractSurface;
  /** 何をする道具か。1 文。 */
  readonly purpose: string;
  /** 実際に動くカタログ上のツール名。null は未実装（スタブ）。 */
  readonly implementedBy: string | null;
  /** 未実装のときだけ書く。何が無いのか・何が済めば動くのか。 */
  readonly stubReason?: string;
  /**
   * 実装はあるが、**この面からは届かない**ときに書く。
   *
   * `stubReason`（そもそも無い）とは別の状態である。分けないと
   * 「目録にあるから読者も呼べる」という読み違いが起きる。実際
   * `ah-83f` の前は、読者ページに載っている 9 件が全部この状態だった
   * （目録には在り、動きもするが、読者の身元では 1 件も通らない）。
   *
   * 書いたものは `PAGE_TOOLS` に載っていないことを検査で固定する。
   * 理由だけ書いて載せたままにはできない。
   */
  readonly unreachableReason?: string;
};

export const TOOL_CONTRACT: readonly ContractEntry[] = [
  // --- 管理側 WebMCP 読み取り 10 種（§24.1）-------------------------------
  {
    specName: "search_affiliate_sources",
    surface: "webmcp_admin_read",
    purpose: "受け取った成果リンクを探す",
    implementedBy: "list_link_inbox",
  },
  {
    specName: "inspect_affiliate_url",
    surface: "webmcp_admin_read",
    purpose: "取り込む前の URL の行き先と広告主を下見する",
    implementedBy: null,
    stubReason:
      "外部への取得口（`src/infrastructure/http/guarded-fetch.ts`）は用意済みだが、取り込み前に下見するユースケースが無い。取り込み済みのものは `list_link_inbox` で見える。",
  },
  {
    specName: "search_products",
    surface: "webmcp_admin_read",
    purpose: "言葉やカテゴリーで商品を探す",
    implementedBy: "filter_products",
  },
  {
    specName: "find_comparable_products",
    surface: "webmcp_admin_read",
    purpose: "比べられる商品を並べる",
    implementedBy: "compare_products",
  },
  {
    specName: "get_product_evidence",
    surface: "webmcp_admin_read",
    purpose: "その商品について言えることと、その根拠を返す",
    implementedBy: "get_evidence",
  },
  {
    specName: "list_author_personas",
    surface: "webmcp_admin_read",
    purpose: "書き手の一覧を返す",
    implementedBy: "list_author_personas",
  },
  {
    specName: "list_audience_personas",
    surface: "webmcp_admin_read",
    purpose: "読者像の一覧を返す",
    implementedBy: "list_audience_personas",
  },
  {
    specName: "preview_content_matrix",
    surface: "webmcp_admin_read",
    purpose: "同じ素材から作る媒体ごとの原稿の組み合わせを先に見る",
    implementedBy: "get_generation_matrix",
  },
  {
    specName: "validate_content_variant",
    surface: "webmcp_admin_read",
    purpose: "原稿 1 本の品質検査の結果（止めた理由・検査していない項目）を返す",
    implementedBy: "get_content",
  },
  {
    specName: "get_publication_status",
    surface: "webmcp_admin_read",
    purpose: "配信 1 件の状態を返す",
    implementedBy: "get_publication",
  },

  // --- 管理側 WebMCP 状態変更 8 種（§24.1）-------------------------------
  {
    specName: "create_affiliate_source_draft",
    surface: "webmcp_admin_write",
    purpose: "成果リンクを受信箱に入れる",
    implementedBy: "submit_affiliate_url",
  },
  {
    specName: "create_comparison_set",
    surface: "webmcp_admin_write",
    purpose: "比較の組み合わせを保存する",
    implementedBy: null,
    stubReason:
      "比較そのものは `compare_products` で都度計算できるが、組み合わせを保存する置き場（ComparisonSet の保存先）が未実装。",
  },
  {
    specName: "create_content_package",
    surface: "webmcp_admin_write",
    purpose: "同じ素材から作る記事のまとまりを起こす",
    implementedBy: null,
    stubReason:
      "作る対象は `get_generation_matrix` で見えるが、まとまりを新規に起こす保存操作が未実装。",
  },
  {
    specName: "generate_channel_variants",
    surface: "webmcp_admin_write",
    purpose: "媒体ごとの原稿を作る",
    implementedBy: null,
    stubReason:
      "生成AIの呼び出しがスタブ。組み立て（`read_generation_plan` / `check_generation_input`）まではできている。解除条件: 生成AIの鍵を利用者本人がブラウザから登録すること。",
  },
  {
    specName: "create_blog_draft",
    surface: "webmcp_admin_write",
    purpose: "ブログの下書きを起こす",
    implementedBy: "start_site_draft",
  },
  {
    specName: "prepare_publications",
    surface: "webmcp_admin_write",
    purpose: "出し先ごとの配信を下ごしらえする",
    implementedBy: null,
    stubReason:
      "手で貼り付ける経路（`export_manual_draft`）はある。自動で各媒体分を起こす操作は、媒体の接続情報の登録待ち。",
  },
  {
    specName: "schedule_approved_publications",
    surface: "webmcp_admin_write",
    purpose: "承認済みの配信に日時を決める",
    implementedBy: "reschedule_publication",
  },
  {
    specName: "publish_approved_content",
    surface: "webmcp_admin_write",
    purpose: "承認済みの記事を公開へ進める",
    implementedBy: "advance_content_state",
  },

  // --- 読者側 WebMCP 読み取り 9 種（ブログ層 §14.2）------------------------
  //
  // ここは 2026-08-18（ah-83f）に向き先を差し替えた。
  // それまでは運営側の `read-product.ts`（`product.read` が要る）を指しており、
  // **読者の身元では 9 件とも動かなかった**。同一サイトの呼び出しが見本の管理権限へ
  // 落ちていたあいだは通っていたので、画面上は正常に見えていた。
  //
  // いまは読者ページの画面と同じ記事を読む `reader-tools.ts` を指す。
  // 名前が違うのは、運営側の同名の道具と目録の中で衝突させないため。
  // 読者に見えるのは `reader_` の付いたほうだけである。
  {
    specName: "list_ranking",
    surface: "webmcp_reader_read",
    purpose: "順位の一覧を返す",
    implementedBy: "reader_list_ranking",
  },
  {
    specName: "get_product",
    surface: "webmcp_reader_read",
    purpose: "商品 1 件を返す",
    implementedBy: "reader_get_product",
  },
  {
    specName: "compare_products",
    surface: "webmcp_reader_read",
    purpose: "商品を並べて比べる",
    implementedBy: "reader_compare_products",
  },
  {
    specName: "get_evidence",
    surface: "webmcp_reader_read",
    purpose: "根拠を返す",
    implementedBy: "reader_get_evidence",
  },
  {
    specName: "list_test_runs",
    surface: "webmcp_reader_read",
    purpose: "検証の記録を返す",
    implementedBy: "list_test_runs",
    unreachableReason:
      "検証の記録は読者ページの画面に出ていない（`PublishedArticle` にその欄が無い）。実装（`list_test_runs`）は動くが `product.read` を要求するので読者は呼べない。読者向けを作るなら記事に欄を足して画面へ先に出す必要がある。道具からだけ出すと画面より広い出口になる（残課題）。",
  },
  {
    specName: "explain_ranking",
    surface: "webmcp_reader_read",
    purpose: "その順位になった理由を返す",
    implementedBy: "reader_explain_ranking",
  },
  {
    specName: "filter_products",
    surface: "webmcp_reader_read",
    purpose: "条件で商品を絞り込む",
    implementedBy: "reader_filter_products",
  },
  {
    specName: "get_disclosure",
    surface: "webmcp_reader_read",
    purpose: "広告であることの表示を返す",
    implementedBy: "reader_get_disclosure",
  },
  {
    specName: "find_alternatives",
    surface: "webmcp_reader_read",
    purpose: "代わりになる候補を返す",
    implementedBy: "reader_find_alternatives",
  },

  // --- 読者側 WebMCP 状態変更 1 種（ブログ層 §14.2）------------------------
  {
    specName: "submit_feedback",
    surface: "webmcp_reader_write",
    purpose: "読者から運営者へ知らせる（確認画面を挟む）",
    implementedBy: "submit_contact",
  },

  // --- バックエンド MCP ツール 8 種（§24.3）------------------------------
  {
    specName: "research_product",
    surface: "mcp_tool",
    purpose: "商品 1 件を調べる",
    implementedBy: "get_product",
  },
  {
    specName: "find_comparable_products",
    surface: "mcp_tool",
    purpose: "比べられる商品を並べる",
    implementedBy: "compare_products",
  },
  {
    specName: "create_content_brief",
    surface: "mcp_tool",
    purpose: "記事の方針をまとめる",
    implementedBy: null,
    stubReason:
      "方針の中身（型・節の並び・文体）は `read_writing_method` で読めるが、方針を 1 件として保存する操作が未実装。",
  },
  {
    specName: "generate_content_variants",
    surface: "mcp_tool",
    purpose: "媒体ごとの原稿を作る",
    // 道具そのものは実装済み。呼ぶと素材の充足と資料の安全性まで確かめて進み、
    // 最後の生成 AI への接続で止まる（鍵が未登録のため）。
    // 「道具が無い」と「鍵が無い」は別のことなので、ここでは分けて扱う。
    implementedBy: "draft_content_variant",
  },
  {
    specName: "validate_claims",
    surface: "mcp_tool",
    purpose: "書いてよいことの境界を確かめる",
    implementedBy: "check_fact_boundary",
  },
  {
    specName: "create_blog_draft",
    surface: "mcp_tool",
    purpose: "ブログの下書きを起こす",
    implementedBy: "start_site_draft",
  },
  {
    specName: "prepare_publication",
    surface: "mcp_tool",
    purpose: "配信を下ごしらえする",
    implementedBy: null,
    stubReason: "`prepare_publications` と同じ。媒体の接続情報の登録待ち。",
  },
  {
    specName: "get_campaign_performance",
    surface: "mcp_tool",
    purpose: "施策ごとの数字を返す",
    implementedBy: "list_metrics",
  },
];

/**
 * バックエンド MCP の Resources 8 種（§24.3）。
 *
 * Resources は「読める場所」であって新しい処理ではない。
 * だから中身は必ず既存のツールから取る。ここで別に読み出しを書くと、
 * ツール経由と Resource 経由で違う内容が返る余地ができる。
 */
export type ResourceEntry = {
  /** `workspace://{workspace_id}` のような形。`{}` の部分が引数になる。 */
  readonly uriTemplate: string;
  readonly description: string;
  /** 中身を作るカタログ上のツール名。 */
  readonly backedBy: string;
  /** URI から取り出した値を、そのツールのどの入力に入れるか。 */
  readonly paramName: string;
};

export const MCP_RESOURCES: readonly ResourceEntry[] = [
  {
    uriTemplate: "workspace://{workspace_id}",
    description: "作業場所の設定一式（役割・接続・監査の記録）",
    backedBy: "get_settings_overview",
    paramName: "workspaceId",
  },
  {
    uriTemplate: "brand://{brand_id}",
    description: "ブランドと、その配下のブログ",
    backedBy: "list_brands",
    paramName: "brandId",
  },
  {
    uriTemplate: "product://{product_id}",
    description: "商品 1 件の仕様と、言えること",
    backedBy: "get_product",
    paramName: "productId",
  },
  {
    uriTemplate: "comparison://{comparison_id}",
    description: "比較 1 件",
    backedBy: "compare_products",
    paramName: "comparisonId",
  },
  {
    uriTemplate: "content-package://{package_id}",
    description: "記事のまとまり 1 件",
    backedBy: "get_content",
    paramName: "packageId",
  },
  {
    uriTemplate: "publication://{publication_id}",
    description: "配信 1 件",
    backedBy: "get_publication",
    paramName: "publicationId",
  },
  {
    uriTemplate: "methodology://{category_id}",
    description: "その分野の書き方の決めごと",
    backedBy: "read_writing_method",
    paramName: "articleType",
  },
  {
    uriTemplate: "evidence://{evidence_id}",
    description: "根拠 1 件",
    backedBy: "get_evidence",
    paramName: "evidenceId",
  },
];

/** `product://p_1` を `{ scheme: "product", value: "p_1" }` にする。 */
export function parseResourceUri(
  uri: string,
): { readonly scheme: string; readonly value: string } | null {
  const at = uri.indexOf("://");
  if (at <= 0) return null;
  const value = uri.slice(at + 3);
  if (value === "") return null;
  return { scheme: uri.slice(0, at), value };
}

/** テンプレートの `product://{product_id}` から `product` を取る。 */
export function schemeOf(entry: ResourceEntry): string {
  return entry.uriTemplate.slice(0, entry.uriTemplate.indexOf("://"));
}

export function findResource(uri: string): ResourceEntry | null {
  const parsed = parseResourceUri(uri);
  if (parsed === null) return null;
  return MCP_RESOURCES.find((r) => schemeOf(r) === parsed.scheme) ?? null;
}

/**
 * 仕様の名前で呼べるようにする別名を作る。
 *
 * 中身は元のツールそのもの。差し替えるのは名前と、
 * 「これは仕様上の名前である」と分かる 1 文だけ。
 * `parse` も `useCase` も共有するので、別名から入っても検証と処理は 1 つ。
 */
export function contractAliasTools(
  catalog: readonly AnyToolDefinition[],
): readonly AnyToolDefinition[] {
  const byName = new Map(catalog.map((t) => [t.name, t]));
  const aliases = new Map<string, AnyToolDefinition>();

  for (const entry of TOOL_CONTRACT) {
    if (entry.implementedBy === null) continue;
    if (entry.specName === entry.implementedBy) continue;
    if (byName.has(entry.specName)) continue;
    if (aliases.has(entry.specName)) continue;

    const base = byName.get(entry.implementedBy);
    if (base === undefined) continue;

    aliases.set(entry.specName, {
      ...base,
      name: entry.specName,
      description: `${base.description}（仕様書 §24 の名前。中身は ${base.name} と同じものです）`,
    });
  }

  return [...aliases.values()];
}

/** 契約のうち何件が動くかを数える。画面と追跡表で同じ数字を使うため。 */
export function contractCoverage(): {
  readonly total: number;
  readonly implemented: number;
  readonly stub: number;
  readonly bySurface: readonly {
    readonly surface: ContractSurface;
    readonly label: string;
    readonly total: number;
    readonly implemented: number;
  }[];
} {
  const surfaces = Object.keys(SURFACE_LABELS) as ContractSurface[];
  return {
    total: TOOL_CONTRACT.length,
    implemented: TOOL_CONTRACT.filter((e) => e.implementedBy !== null).length,
    stub: TOOL_CONTRACT.filter((e) => e.implementedBy === null).length,
    bySurface: surfaces.map((surface) => {
      const rows = TOOL_CONTRACT.filter((e) => e.surface === surface);
      return {
        surface,
        label: SURFACE_LABELS[surface],
        total: rows.length,
        implemented: rows.filter((e) => e.implementedBy !== null).length,
      };
    }),
  };
}
