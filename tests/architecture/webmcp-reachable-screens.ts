/**
 * 道具 1 つずつに「人が画面から同じことをできる場所」を書いた表。
 *
 * 要件 `REQ-FD04`（**WebMCP でしか到達できない機能を作らない**）を見るための入力である。
 *
 * ---
 *
 * **この表を実装から作らないこと。**
 *
 * 道具が増えたぶんだけ表も自動で増える作りにすると、道具を足しても緑のままになり、
 * 「やった形」だけが残って何も守らない（残課題 78 の 5 つ目「一覧を実装と共有している
 * 検査は、一覧が減ったことを言えない」）。**手で書くのが仕様である。**面倒なのは
 * 副作用ではなく効き目のほうで、**道具を 1 つ足すたびに「これは人がどこで押すのか」を
 * 1 度考えさせる**ことが、この表の仕事である。
 *
 * 既に在る検査（1 つのカタログが 4 入口へ同じ形で写っている）は、**入口ごとに実装が
 * 分かれていないこと**しか見ていない。写しが一致することと、人が到達できることは別で、
 * WebMCP にだけ載って画面に無い道具を足しても、あちらは緑のままである。
 *
 * ---
 *
 * `screen` は `tests/ui/route-table.ts` の `file` と同じ文字列で書く。
 * 実在しない道を書いたら検査が落ちる（画面が消えた日にも落ちる）。
 *
 * `alias` は仕様書 §24 の名前で入る別名。本体と同じユースケースへ入るので、
 * **本体の到達性がそのまま別名の到達性になる。**ここで route を書き直すと、
 * 本体の画面が消えた日に別名だけ緑で残る。
 */

/** 表 1 行。画面を指すか、本体の道具を指すかのどちらか。 */
export type ReachEntry =
  | { readonly screen: string; readonly note?: string }
  | { readonly alias: string };

/**
 * 道具名 → 人が同じことをできる画面。
 *
 * 並びはカタログの群ごと。**群ごとに 1 画面へまとめない**——「この群は管理画面に
 * ある」で通すと、群の中に 1 つだけ画面の無い道具が混ざっても気づけない。
 */
export const REACHABLE_SCREENS: Readonly<Record<string, ReachEntry>> = {
  // ── 順位づけ ────────────────────────────────────────────
  rank_products: { screen: "admin/rankings/page.tsx" },

  // ── 見出し ──────────────────────────────────────────────
  get_dashboard: { screen: "admin/page.tsx" },

  // ── 運営するブログ ──────────────────────────────────────
  list_managed_sites: { screen: "admin/sites/page.tsx" },
  get_managed_site: { screen: "admin/sites/[site]/page.tsx" },
  check_site_differentiation: { screen: "admin/sites/[site]/page.tsx" },
  list_site_drafts: { screen: "admin/sites/page.tsx" },
  get_site_draft: { screen: "admin/sites/new/page.tsx" },
  start_site_draft: { screen: "admin/sites/new/page.tsx" },
  save_site_draft_step: { screen: "admin/sites/new/page.tsx" },
  create_site_from_draft: { screen: "admin/sites/new/page.tsx" },
  update_managed_site: { screen: "admin/sites/[site]/edit/page.tsx" },
  delete_managed_site: {
    screen: "admin/sites/[site]/page.tsx",
    note: "画面の末尾に確認欄（理由が要る）",
  },

  // ── ブログの中身（読者側の画面がそのまま到達先）────────
  get_site: { screen: "s/[site]/page.tsx" },
  list_sites: { screen: "admin/sites/page.tsx" },
  list_recent_articles: { screen: "s/[site]/page.tsx" },
  list_articles_by_category: { screen: "s/[site]/categories/[category]/page.tsx" },
  get_article: { screen: "s/[site]/guides/[topic]/page.tsx" },
  search_articles: { screen: "s/[site]/search/page.tsx" },
  get_person: { screen: "s/[site]/authors/[author]/page.tsx" },
  list_corrections: { screen: "s/[site]/corrections/page.tsx" },
  get_policy_document: { screen: "s/[site]/editorial-policy/page.tsx" },
  list_shortlist: { screen: "s/[site]/shortlist/page.tsx" },
  save_to_shortlist: { screen: "s/[site]/shortlist/page.tsx" },
  remove_from_shortlist: { screen: "s/[site]/shortlist/page.tsx" },
  list_reader_tools: { screen: "s/[site]/tools/[tool]/page.tsx" },
  get_reader_tool: { screen: "s/[site]/tools/[tool]/page.tsx" },
  run_reader_tool: { screen: "s/[site]/tools/[tool]/page.tsx" },
  submit_contact: { screen: "s/[site]/contact/page.tsx" },

  // ── 商品（運営側）──────────────────────────────────────
  get_product: { screen: "admin/products/[product]/page.tsx" },
  filter_products: { screen: "admin/products/page.tsx" },
  compare_products: { screen: "admin/products/compare/page.tsx" },
  find_alternatives: { screen: "admin/products/compare/page.tsx" },
  get_evidence: { screen: "admin/evidence/page.tsx" },
  list_test_runs: { screen: "admin/evidence/page.tsx" },
  list_ranking: { screen: "admin/rankings/page.tsx" },
  explain_ranking: { screen: "admin/rankings/page.tsx" },
  create_product: { screen: "admin/products/new/page.tsx" },
  update_product: { screen: "admin/products/[product]/edit/page.tsx" },
  // 消す欄は詳細画面の中に置く。別画面にすると、目の前の物と消す物が
  // 同じかを確かめられないまま押すことになる。
  delete_product: {
    screen: "admin/products/[product]/page.tsx",
    note: "画面の末尾に確認欄（理由が要る）",
  },

  // ── 商品（読者側）──────────────────────────────────────
  reader_list_ranking: { screen: "s/[site]/best/[topic]/page.tsx" },
  reader_explain_ranking: { screen: "s/[site]/methodology/page.tsx" },
  reader_get_product: { screen: "s/[site]/reviews/[product]/page.tsx" },
  reader_filter_products: { screen: "s/[site]/categories/[category]/page.tsx" },
  reader_find_alternatives: { screen: "s/[site]/compare/[comparison]/page.tsx" },
  reader_compare_products: { screen: "s/[site]/compare/[comparison]/page.tsx" },
  reader_get_evidence: { screen: "s/[site]/methodology/page.tsx" },
  reader_get_disclosure: { screen: "s/[site]/advertising-policy/page.tsx" },

  // ── 記事の状態 ──────────────────────────────────────────
  list_content_board: { screen: "admin/content/page.tsx" },
  get_content: { screen: "admin/content/[variant]/page.tsx" },
  list_review_overdue: { screen: "admin/content/page.tsx" },
  advance_content_state: { screen: "admin/content/[variant]/page.tsx" },
  approve_content: { screen: "admin/content/[variant]/page.tsx" },
  get_generation_matrix: { screen: "admin/content/matrix/page.tsx" },
  list_author_personas: { screen: "admin/personas/page.tsx" },
  get_author_persona: { screen: "admin/personas/page.tsx" },
  list_audience_personas: { screen: "admin/personas/page.tsx" },
  get_audience_persona: { screen: "admin/personas/page.tsx" },
  check_fact_boundary: { screen: "admin/evidence/page.tsx" },
  read_writing_method: { screen: "admin/writing/page.tsx" },
  create_content_variant: { screen: "admin/content/new/page.tsx" },
  update_content_variant: { screen: "admin/content/[variant]/edit/page.tsx" },
  delete_content_variant: {
    screen: "admin/content/[variant]/page.tsx",
    note: "画面の末尾に確認欄（理由が要る）",
  },

  // ── ブログ運用（作成者向け）────────────────────────────
  // **手元の CLI (Claude Code / Codex) から書ける道具である。**
  // それでもここに画面を書くのは、AI からしか届かない機能を作らないため。
  // 画面が消えた日にこの検査が落ちるので、片方だけ残ることがない。
  list_blog_articles: { screen: "admin/blog/articles/page.tsx" },
  get_blog_article: { screen: "admin/blog/articles/[article]/page.tsx" },
  create_blog_article: { screen: "admin/blog/articles/new/page.tsx" },
  update_blog_article: { screen: "admin/blog/articles/[article]/page.tsx" },
  set_blog_article_status: {
    screen: "admin/blog/articles/[article]/page.tsx",
    note: "公開は人しか押せない（AI からは requiresHumanApproval で断られる）",
  },
  delete_blog_article: {
    screen: "admin/blog/articles/[article]/page.tsx",
    note: "画面の末尾に確認欄（理由が要る）。AI からは断られる",
  },
  list_blog_tags: { screen: "admin/blog/tags/page.tsx" },

  // ── 配信 ────────────────────────────────────────────────
  list_channels: { screen: "admin/distribution/page.tsx" },
  list_publications: { screen: "admin/distribution/page.tsx" },
  get_publication: { screen: "admin/distribution/[publication]/page.tsx" },
  update_publication: { screen: "admin/distribution/[publication]/edit/page.tsx" },
  // 記事 1 本が「いまどこへ出ているか」を並べる場所。出していない先も
  // 未着手として並ぶので、次にどこへ出すかを決める材料になる。
  get_content_channel_status: { screen: "admin/content/[variant]/progress/page.tsx" },
  export_manual_draft: { screen: "admin/distribution/[publication]/page.tsx" },
  schedule_publication: { screen: "admin/distribution/calendar/page.tsx" },
  cancel_publication: { screen: "admin/distribution/[publication]/page.tsx" },
  get_publication_calendar: { screen: "admin/distribution/calendar/page.tsx" },
  reschedule_publication: { screen: "admin/distribution/calendar/page.tsx" },
  prepare_publish_article: { screen: "admin/distribution/[publication]/page.tsx" },
  publish_article_to_own_site: { screen: "admin/distribution/[publication]/page.tsx" },

  // ── 成果とリンク ────────────────────────────────────────
  list_affiliate_accounts: { screen: "admin/affiliate/page.tsx" },
  list_affiliate_programs: { screen: "admin/affiliate/page.tsx" },
  list_conversions: { screen: "admin/affiliate/page.tsx" },
  get_conversion: { screen: "admin/affiliate/[conversion]/page.tsx" },
  list_product_links: { screen: "admin/affiliate/page.tsx" },
  adjust_conversion_reward: { screen: "admin/affiliate/[conversion]/page.tsx" },
  list_link_inbox: { screen: "admin/inbox/page.tsx" },
  submit_affiliate_url: { screen: "admin/inbox/page.tsx" },
  resolve_link_ingestion: { screen: "admin/inbox/page.tsx" },
  match_link_ingestion_product: { screen: "admin/inbox/page.tsx" },
  reject_link_ingestion: { screen: "admin/inbox/page.tsx" },

  // ── 数字 ────────────────────────────────────────────────
  list_metrics: { screen: "admin/analytics/page.tsx" },
  list_usable_metrics: { screen: "admin/improvement/dimensions/page.tsx" },
  check_metric_feedback: { screen: "admin/improvement/page.tsx" },
  filter_metrics: { screen: "admin/analytics/page.tsx" },

  // ── 生成 ────────────────────────────────────────────────
  read_generation_plan: { screen: "admin/generation/page.tsx" },
  check_generation_input: { screen: "admin/generation/page.tsx" },
  review_untrusted_material: { screen: "admin/generation/page.tsx" },
  draft_content_variant: { screen: "admin/generation/page.tsx" },

  // ── 設定 ────────────────────────────────────────────────
  get_settings_overview: { screen: "admin/settings/page.tsx" },
  list_roles: { screen: "admin/settings/page.tsx" },
  list_members: { screen: "admin/settings/page.tsx" },
  list_brands: { screen: "admin/settings/page.tsx" },
  list_disclosures: { screen: "admin/settings/page.tsx" },
  list_audit_log: { screen: "admin/settings/page.tsx" },

  // ── 改善要望 ────────────────────────────────────────────
  submit_feedback: { screen: "s/[site]/contact/page.tsx" },
  list_feedback: { screen: "admin/feedback/page.tsx" },
  get_feedback: { screen: "admin/feedback/[report]/page.tsx" },
  update_feedback_status: { screen: "admin/feedback/[report]/page.tsx" },
  hand_off_feedback: { screen: "admin/feedback/[report]/page.tsx" },
  manage_integration_keys: { screen: "admin/settings/integration-access/page.tsx" },

  // ── 仕様書 §24 の名前（別名）───────────────────────────
  // 本体と同じユースケースへ入る。到達先を書き直さないこと。
  search_affiliate_sources: { alias: "list_link_inbox" },
  search_products: { alias: "filter_products" },
  find_comparable_products: { alias: "compare_products" },
  get_product_evidence: { alias: "get_evidence" },
  preview_content_matrix: { alias: "get_generation_matrix" },
  validate_content_variant: { alias: "get_content" },
  get_publication_status: { alias: "get_publication" },
  create_affiliate_source_draft: { alias: "submit_affiliate_url" },
  create_blog_draft: { alias: "start_site_draft" },
  schedule_approved_publications: { alias: "reschedule_publication" },
  publish_approved_content: { alias: "advance_content_state" },
  get_disclosure: { alias: "reader_get_disclosure" },
  research_product: { alias: "get_product" },
  generate_content_variants: { alias: "draft_content_variant" },
  validate_claims: { alias: "check_fact_boundary" },
  get_campaign_performance: { alias: "list_metrics" },
};

/**
 * 画面が無いことを承知で載せている道具。**理由を書かずにここへ足さないこと。**
 *
 * 空のまま保つのが望ましい。1 件でも入っているうちは、その道具は
 * 「AI からしか使えない機能」である。
 */
export const REACHABILITY_EXCEPTIONS: Readonly<Record<string, string>> = {};
