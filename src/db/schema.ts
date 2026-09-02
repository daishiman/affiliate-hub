import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import {
  CHANNEL_CAPABILITIES,
  PUBLICATION_STATES,
  type ChannelKind,
  type PublicationState,
} from "@/domain/distribution";
import {
  ARTICLE_BLOCK_KINDS,
  ARTICLE_TEMPLATES,
  BLOG_TAG_KINDS,
  DELIVERY_PARTS,
  FIXED_PAGE_KINDS,
  LAYOUT_REGIONS,
  NETWORK_ROLES,
  NETWORK_STATUSES,
  TOP_BANDS,
} from "@/domain/blogops";
import {
  POLICY_CHANNEL_SCOPES,
  POLICY_DOMAIN_SCOPES,
  POLICY_SEVERITIES,
} from "@/domain/compliance";
import {
  COMPLIANCE_STATUSES,
  CONTENT_ANGLES,
  CONTENT_STATES,
  CONTENT_VARIANT_STATUSES,
  CTA_TYPES,
  SITE_DOCUMENT_ONLY_STORAGE_KINDS,
  type ComplianceStatus,
  type ContentAngle,
  type ContentState,
  type ContentVariantStatus,
  type CtaType,
} from "@/domain/authoring";
import {
  ASP_LABEL,
  CONVERSION_STATUSES,
  type AspKind,
  type ConversionStatus,
} from "@/domain/monetization";
import {
  COMPARISON_VERDICTS,
  LOOP_RUN_STATUSES,
  type ComparisonVerdict,
  type LoopRunStatus,
  type VariantSetting,
} from "@/domain/analytics";

/**
 * 列に入れてよい値を、**業務側の一覧から取り出す**。
 *
 * ここに手で書き写すと、出し先や状態を 1 つ足した日に、
 * 業務側だけが増えて保存先が古いまま残る。しかも壊れ方が
 * 「保存のときだけ失敗する」なので、画面では最後まで気づけない。
 * 写しではなく同じものを指すことで、ずれる余地を無くしている。
 */
const CHANNEL_KIND_VALUES = Object.keys(CHANNEL_CAPABILITIES) as [ChannelKind, ...ChannelKind[]];
const PUBLICATION_STATE_VALUES = [...PUBLICATION_STATES] as [
  PublicationState,
  ...PublicationState[],
];
const CONTENT_STATE_VALUES = [...CONTENT_STATES] as [ContentState, ...ContentState[]];
const CONTENT_ANGLE_VALUES = [...CONTENT_ANGLES] as [ContentAngle, ...ContentAngle[]];
const CTA_TYPE_VALUES = [...CTA_TYPES] as [CtaType, ...CtaType[]];
const ASP_KIND_VALUES = Object.keys(ASP_LABEL) as [AspKind, ...AspKind[]];
const CONVERSION_STATUS_VALUES = [...CONVERSION_STATUSES] as [
  ConversionStatus,
  ...ConversionStatus[],
];
const CONTENT_VARIANT_STATUS_VALUES = [...CONTENT_VARIANT_STATUSES] as [
  ContentVariantStatus,
  ...ContentVariantStatus[],
];
const COMPLIANCE_STATUS_VALUES = [...COMPLIANCE_STATUSES] as [
  ComplianceStatus,
  ...ComplianceStatus[],
];
const LEGAL_PAGE_KIND_VALUES = [
  ...FIXED_PAGE_KINDS,
  ...SITE_DOCUMENT_ONLY_STORAGE_KINDS,
] as const;
const LOOP_RUN_STATUS_VALUES = [...LOOP_RUN_STATUSES] as [LoopRunStatus, ...LoopRunStatus[]];
const COMPARISON_VERDICT_VALUES = [...COMPARISON_VERDICTS] as [
  ComparisonVerdict,
  ...ComparisonVerdict[],
];

/**
 * このファイルは 2 つのドメインを持つ。混ぜてはいけない。
 *
 *   1. 運営者ドメイン (asps / programs / conversions)
 *      運営者が受け取る報酬を管理する。非公開。
 *
 *   2. 読者ドメイン (categories 以降)
 *      読者に商品比較を提供する。公開。仕様書 §12 に対応。
 *
 * 仕様書 §4.7 / §17.4 により、ランキング計算は運営者ドメインを参照して
 * はならない。報酬額の大小が順位に影響した時点で仕様違反になる。
 * 分離は docs/spec/data-model-gap.md の「テスト方針」で静的に検査する。
 */

// ---------------------------------------------------------------------------
// 運営者ドメイン
// ---------------------------------------------------------------------------

/**
 * ASP (A8.net, もしもアフィリエイト, Amazon アソシエイト 等)
 */
export const asps = sqliteTable("asps", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  siteUrl: text("site_url"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

/**
 * 案件 (プログラム)。ASP ごとの広告主・報酬条件を保持する。
 */
export const programs = sqliteTable(
  "programs",
  {
    id: text("id").primaryKey(),
    aspId: text("asp_id")
      .notNull()
      .references(() => asps.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    advertiser: text("advertiser"),
    category: text("category"),
    // 成果1件あたりの報酬額 (円)。料率型の案件は rewardRate を使う。
    rewardAmount: integer("reward_amount"),
    // 売上に対する料率 (0.0 - 1.0)
    rewardRate: real("reward_rate"),
    status: text("status", { enum: ["active", "paused", "closed"] })
      .notNull()
      .default("active"),
    landingUrl: text("landing_url"),
    note: text("note"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [index("programs_asp_id_idx").on(t.aspId), index("programs_status_idx").on(t.status)],
);

/**
 * 成果 (コンバージョン)。ASP からの取り込み単位。
 */
export const conversions = sqliteTable(
  "conversions",
  {
    id: text("id").primaryKey(),
    programId: text("program_id")
      .notNull()
      .references(() => programs.id, { onDelete: "cascade" }),
    // 成果発生日 (日次集計の軸)
    occurredAt: integer("occurred_at", { mode: "timestamp" }).notNull(),
    // 確定 / 未確定 / 却下 — ASP は事後に確定状態を変えるため保持する
    status: text("status", { enum: ["pending", "approved", "rejected"] })
      .notNull()
      .default("pending"),
    // 報酬額 (円)。確定前は見込み額。
    amount: integer("amount").notNull().default(0),
    clicks: integer("clicks").notNull().default(0),
    // ASP 側の一意キー。再取り込み時の重複排除に使う。
    externalId: text("external_id"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    index("conversions_program_id_idx").on(t.programId),
    index("conversions_occurred_at_idx").on(t.occurredAt),
  ],
);

// ---------------------------------------------------------------------------
// 読者ドメイン (仕様書 §12)
// ---------------------------------------------------------------------------

/**
 * カテゴリー。仕様書 §7 の /categories/{category} に対応する。
 */
export const categories = sqliteTable("categories", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  // カテゴリーページ冒頭の一文説明 (§7)
  description: text("description"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

/**
 * 人物 (著者 / 編集者 / 監修者)。
 *
 * 仕様書 §12 は author_ids / editor_ids / expert_ids を分けているが、
 * 同一人物が記事によって役割を変えるため、人物は 1 テーブルにまとめ、
 * 役割は articlePeople 側に持たせる。§4.2 の重複入力の禁止に従う。
 */
export const people = sqliteTable("people", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  bio: text("bio"),
  // 資格・専門性。§11.1 の ExpertCaution はこれが無い人物に使えない。
  credentials: text("credentials"),
  avatarAssetId: text("avatar_asset_id"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

/**
 * 広告・アフィリエイト表記 (§17.1)。
 *
 * 記事・AI 回答・WebMCP の 3 経路が同じ 1 行を参照する。
 * 経路ごとに文言を書くと §28 の「広告関係が 3 経路で一貫する」が破れる。
 */
export const disclosures = sqliteTable(
  "disclosures",
  {
    id: text("id").primaryKey(),
    /**
     * どの作業場所の表記か。**列として持つ。**
     *
     * 足す前は列が無く、行は作業場所をまたいで 1 つの海に浮かんでいた。
     * 表記は法令の要る表示なので、**別の作業場所の表記が自分の記事に出る**のは
     * 「表示が無い」のと同じくらい悪い（出典の違う断りが読者に出る）。
     * 読み口（`DisclosureRepositoryPort.list`）は作業場所を必ず受け取るので、
     * 列が無いままでは絞りようがなかった。
     */
    workspaceId: text("workspace_id").notNull(),
    relationshipType: text("relationship_type", {
      // `paid_partnership` は domain の `RelationshipType` にあって表に無かった。
      // 語彙が片側だけ広いと、選べるのに保存できない関係が生まれる。
      enum: ["affiliate", "sponsored", "supplied", "loaned", "purchased", "paid_partnership"],
    }).notNull(),
    advertiserOrSupplier: text("advertiser_or_supplier"),
    editorialInfluence: text("editorial_influence", {
      enum: ["none", "limited", "declared"],
    })
      .notNull()
      .default("none"),
    /**
     * 本文の作成に AI を使ったか（§20.1）。**列として持つ。**
     * 表示文（`visible_message`）から読み取らない。文は言い回しが変わりうるので、
     * 文字列を検索して判定する形にすると、言い回しを直した日に印が消える。
     */
    aiAssisted: integer("ai_assisted", { mode: "boolean" }).notNull().default(false),
    // 読者に実際に表示する文言。§17.1 が要求する「判別できる表現」。
    visibleMessage: text("visible_message").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    /**
     * 最後に変えた時刻。**表記の変更は監査の対象**（§26 の必須記録 3 つ目）なので、
     * 「いつからその表記だったか」が行の側からも言えるようにしておく。
     * 誰が変えたかは `audit_logs` にある（ここへ写すと正本が 2 つになる）。
     */
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (t) => [index("disclosures_workspace_idx").on(t.workspaceId)],
);

/**
 * 表現ポリシー（§20 / §26）。
 *
 * --- なぜ表が要るか ---
 * きまりは `policy-rule-seed.ts` の初期 13 件が正本だったが、**読むだけだった**。
 * 法令も規約も改定されるうえ、扱う分野は作業場所ごとに違う。
 * 追加も無効化もできない状態は、「効いていないきまりを外せない」ことと
 * 「新しい規制に追いつけない」ことを同時に意味する。
 *
 * --- 初期ルールをこの表へ流し込まない ---
 * 作業場所を作った時点で 13 行を書き込む形にはしていない。そうすると、
 * 初期ルールを直したときに**既に作られた作業場所だけが古いまま**残り、
 * どの作業場所がどの版のきまりで確認されたのかが誰にも言えなくなる。
 * この表が持つのは**初期ルールからの差分**（無効化と、上書きと、足したもの）で、
 * 触っていないきまりは `buildSeedPolicyRules()` 側が正本のまま返る。
 * 詳しくは `src/infrastructure/persistence/d1/policy-rule-repository.ts`。
 *
 * 規範: docs/product/traceability.md REQ-SEC07 / REQ-QC11
 */
export const policyRules = sqliteTable(
  "policy_rules",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    name: text("name").notNull(),
    // 語彙は domain の配列がそのまま正本。ここで並べ直さない。
    domainScope: text("domain_scope", { enum: POLICY_DOMAIN_SCOPES }).notNull(),
    channelScope: text("channel_scope", { enum: POLICY_CHANNEL_SCOPES }).notNull(),
    severity: text("severity", { enum: POLICY_SEVERITIES }).notNull(),
    /** 検出する表現。正規表現の文字列。壊れた式は登録の時点で断る（domain 側）。 */
    pattern: text("pattern").notNull(),
    ignoreCase: integer("ignore_case", { mode: "boolean" }).notNull().default(true),
    /** 根拠。**空では保存できない**（domain 側が断る）。理由の書けないきまりは運用されない。 */
    basis: text("basis").notNull(),
    /** 代わりの書き方。禁止だけ示すと執筆が止まる。 */
    suggestion: text("suggestion").notNull(),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    // 記事を 1 本確認するたびに引く索引。無いと全件走査になる。
    index("policy_rules_workspace_enabled_idx").on(t.workspaceId, t.enabled),
  ],
);

/**
 * 商品。Phase 1 では最小限に留める。
 *
 * 仕様書 §12 の specifications / official_source_ids / image_asset_ids は
 * Phase 2 (検証データ基盤) で追加する。TestRun が無い状態で
 * specifications の構造だけ決めても作り直しになるため。
 */
export const products = sqliteTable(
  "products",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    brand: text("brand").notNull(),
    name: text("name").notNull(),
    modelNumber: text("model_number"),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    releaseDate: integer("release_date", { mode: "timestamp" }),
    discontinuedAt: integer("discontinued_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [index("products_category_id_idx").on(t.categoryId)],
);

/**
 * 記事 (§12 Article)。
 */
export const articles = sqliteTable(
  "articles",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    /** ブログCRUDでは公開URLの所属をこの組で決める。旧AI記事では null。 */
    workspaceId: text("workspace_id"),
    siteSlug: text("site_slug"),
    /** T1〜T4。旧AI記事では null のままにし、推測値を保存しない。 */
    template: text("article_template", { enum: ARTICLE_TEMPLATES }),
    type: text("type", {
      enum: ["ranking", "review", "comparison", "guide", "tool"],
    }).notNull(),
    title: text("title").notNull(),
    // 一文の結論 (§8)。要約ではなく結論を書く。
    summary: text("summary"),
    lead: text("lead").notNull().default(""),
    status: text("status", { enum: ["draft", "review", "published", "archived"] })
      .notNull()
      .default("draft"),
    categoryId: text("category_id").references(() => categories.id, { onDelete: "set null" }),
    /**
     * 公開projectionに写すサイト内カテゴリ。グローバルcategory masterとは別のURL語彙。
     * 下書きはnullを許すが、公開時は利用者が選んだ値を必須にする。
     */
    publicCategorySlug: text("public_category_slug"),
    disclosureId: text("disclosure_id").references(() => disclosures.id, {
      onDelete: "restrict",
    }),
    /**
     * 更新責任者。§28 運用 C1「更新責任者が存在」を満たすために持つ。
     * 仕様書 §12 には無いフィールドだが、完了条件側が要求している。
     */
    ownerId: text("owner_id").references(() => people.id, { onDelete: "restrict" }),
    /** 表示名の写し。人物マスタを持たないブログCRUDでも署名を失わない。 */
    authorName: text("author_name").notNull().default(""),
    publishedAt: integer("published_at", { mode: "timestamp" }),
    /** null は通常、日時ありは削除済み。archived は公開状態なので代用しない。 */
    deletedAt: integer("deleted_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    /** 古い画面の保存で新しい本文を上書きしないための CAS 版番。 */
    revision: integer("revision").notNull().default(1),
    /**
     * D1 batch 内で CAS 成功を証明する内部トークン。画面やドメインへは公開しない。
     * 同じ revision を読んだ保存が競合しても、勝者の子要素だけを更新するために使う。
     */
    saveToken: text("save_token"),
    // 検証を実施した日 (§8 の「検証日」)
    testedAt: integer("tested_at", { mode: "timestamp" }),
    /**
     * 次回確認日。§28 運用 C3「記事ごとの次回確認日が存在」に対応。
     * testedAt (過去に検証した日) とは別概念なので独立して持つ。
     */
    nextReviewAt: integer("next_review_at", { mode: "timestamp" }),
    // 以下は表示用の文字列リスト。参照整合性が不要なので JSON で持つ。
    targetAudience: text("target_audience", { mode: "json" }).$type<string[]>(),
    suitableFor: text("suitable_for", { mode: "json" }).$type<string[]>(),
    notSuitableFor: text("not_suitable_for", { mode: "json" }).$type<string[]>(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    index("articles_status_idx").on(t.status),
    index("articles_category_id_idx").on(t.categoryId),
    index("articles_next_review_at_idx").on(t.nextReviewAt),
    uniqueIndex("articles_site_slug_idx").on(t.workspaceId, t.siteSlug, t.slug),
    uniqueIndex("articles_legacy_slug_idx")
      .on(t.slug)
      .where(sql`${t.workspaceId} is null and ${t.siteSlug} is null`),
  ],
);

/**
 * 記事 ↔ 人物。role で著者・編集者・監修者を区別する。
 */
export const articlePeople = sqliteTable(
  "article_people",
  {
    articleId: text("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    personId: text("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "restrict" }),
    role: text("role", { enum: ["author", "editor", "expert"] }).notNull(),
    // 同一役割内での表示順
    position: integer("position").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.articleId, t.personId, t.role] }),
    index("article_people_person_id_idx").on(t.personId),
  ],
);

/**
 * 記事 ↔ 商品。position が比較表・ランキングの表示順を決める。
 *
 * 注意: ランキングの「順位」はここではなく RankingModel による計算結果で
 * 決まる (Phase 2)。position は表示順の保存にすぎず、順位の正規データ源
 * として扱ってはならない (§27 の禁止依存)。
 */
export const articleProducts = sqliteTable(
  "article_products",
  {
    articleId: text("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    position: integer("position").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.articleId, t.productId] }),
    index("article_products_product_id_idx").on(t.productId),
  ],
);

/**
 * 会話ブロック (§11)。
 */
export const conversationBlocks = sqliteTable(
  "conversation_blocks",
  {
    id: text("id").primaryKey(),
    articleId: text("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    speaker: text("speaker", {
      enum: ["ReaderQuestion", "GuideAnswer", "ReviewerNote", "ExpertCaution"],
    }).notNull(),
    // §11.2 で 40〜120 文字程度とされている。長さの検査は入力側で行う。
    body: text("body").notNull(),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("conversation_blocks_article_id_idx").on(t.articleId)],
);

/**
 * FAQ。
 */
export const faqs = sqliteTable(
  "faqs",
  {
    id: text("id").primaryKey(),
    articleId: text("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    question: text("question").notNull(),
    answer: text("answer").notNull(),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("faqs_article_id_idx").on(t.articleId)],
);

/**
 * 更新履歴 (§22)。
 *
 * 訂正は元の誤りを隠さない。よってこのテーブルは追記のみで、
 * 既存行の更新・削除を行わない運用とする。
 */
export const updateLogs = sqliteTable(
  "update_logs",
  {
    id: text("id").primaryKey(),
    articleId: text("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    changedAt: integer("changed_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    changedById: text("changed_by_id").references(() => people.id, { onDelete: "set null" }),
    changeType: text("change_type", {
      enum: ["factual", "price", "ranking", "editorial", "correction"],
    }).notNull(),
    summary: text("summary").notNull(),
    reviewerId: text("reviewer_id").references(() => people.id, { onDelete: "set null" }),
  },
  (t) => [
    index("update_logs_article_id_idx").on(t.articleId),
    index("update_logs_changed_at_idx").on(t.changedAt),
  ],
);

/**
 * 成果リンクの受信箱 (§9.2)。運営者ドメイン。
 *
 * `submitted_url` は**受け取ったまま**保存する。改変は規約違反になりうる。
 * `normalized_url` は重複判定にだけ使う形で、表示にも遷移にも使わない。
 *
 * **`normalized_url` に一意制約を置かない。** 以前は置いていたが、
 * 業務側の決めごとは「重複していても受け取り、相手を指して知らせる」
 * （`duplicate_of` 列と「消していません」の案内がその実体）であり、
 * 保存先で弾くと 2 回目の貼り付けが**やり直しても永久に通らない失敗**になる。
 * 実際の D1 で通したときに、その形で表面化した
 * （`tests/integration/d1-link-inbox.test.ts`）。
 * 索引は重複相手を引くために残す。一意にはしない。
 *
 * 同時に 2 人が同じ URL を入れたときにどちらへ印を付けるかは、
 * この表ではなく次の `link_ingestion_url_claims` が決める。
 */
export const linkIngestions = sqliteTable(
  "link_ingestions",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    submittedUrl: text("submitted_url").notNull(),
    normalizedUrl: text("normalized_url").notNull(),
    source: text("source", {
      enum: ["paste", "csv", "api", "extension", "webmcp"],
    }).notNull(),
    submittedAt: integer("submitted_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    state: text("state", {
      enum: ["received", "resolved", "matched", "rejected"],
    }).notNull(),
    programId: text("program_id"),
    productId: text("product_id"),
    duplicateOf: text("duplicate_of"),
    note: text("note"),
    rejectedReason: text("rejected_reason"),
  },
  (t) => [
    index("link_ingestions_workspace_state_idx").on(t.workspaceId, t.state),
    index("link_ingestions_workspace_normalized_url_idx").on(t.workspaceId, t.normalizedUrl),
  ],
);

/**
 * 「その URL を最初に受け取ったのは誰か」の取り合い（§9.2 の重複判定）。
 *
 * **なぜ受信箱の外に置くのか。**
 * 重複の印を付けるには「自分より先に同じ URL があったか」を知る必要があるが、
 * 先に読んでから書く形（SELECT してから INSERT）では、2 人が同時に貼ったときに
 * 両方が「無い」を見て、どちらにも印が付かないまま 2 行入る。
 * かといって `link_ingestions.normalized_url` を一意にすると、
 * 2 回目の貼り付けが**やり直しても永久に通らない失敗**に戻ってしまう
 * （それを避けるために一意制約を落とした経緯が上のコメント）。
 *
 * そこで、**受け取りは今までどおり全部通したまま**、
 * 「最初の 1 本」だけをこの表の主キー（作業場所 + 正規化 URL）で取り合わせる。
 * 取れなければ相手の `link_ingestion_id` が返り、それが `duplicate_of` になる。
 * 主キーは 1 行しか許さないので、同時に来ても勝つのは必ず 1 本だけになる。
 *
 * 対象外にした（`rejected`）ときは、この行を消して取り合いから降りる。
 * 降ろさないと、捨てたリンクを相手に指した「重複」が延々と出続ける。
 */
export const linkIngestionUrlClaims = sqliteTable(
  "link_ingestion_url_claims",
  {
    workspaceId: text("workspace_id").notNull(),
    normalizedUrl: text("normalized_url").notNull(),
    /** 取り合いに勝った受信リンク。重複の印はここを指す。 */
    linkIngestionId: text("link_ingestion_id").notNull(),
    claimedAt: integer("claimed_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.normalizedUrl] })],
);

/**
 * ログイン状態（セッション）。
 *
 * **合言葉そのものを保存しない。** 保存するのは合言葉を潰した値（`token_hash`）だけ。
 * こうしておくと、この表を読めた人でも他人になりすませない。
 * 逆に合言葉を平文で置くと、保存先の中身が漏れた時点で全員のログインが漏れる。
 *
 * ログインの入口（誰がこの行を作るか）はまだ無い。作るのは Better Auth + Google の側で、
 * それには利用者ご自身による接続情報の登録が要る。
 * この表とその読み取りは、入口が付いた日にそのまま使える形で先に用意してある。
 */
export const sessions = sqliteTable(
  "sessions",
  {
    /** 合言葉を SHA-256 で潰した値。合言葉そのものは保存しない。 */
    tokenHash: text("token_hash").primaryKey(),
    userId: text("user_id").notNull(),
    workspaceId: text("workspace_id").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    /** 期限。過ぎた行は読み取り側で無効として扱う（消し忘れても効く）。 */
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    /** ログアウトや管理者による停止。期限内でも無効にできる。 */
    revokedAt: integer("revoked_at", { mode: "timestamp" }),
  },
  (t) => [index("sessions_user_idx").on(t.userId, t.expiresAt)],
);

/**
 * 改善要望（仕様 §5〜§12）。
 *
 * 列の分け方に 1 つだけ決めごとがある。
 * **絞り込みに使うものだけを列にし、それ以外はまとめて 1 つの文字列に入れる。**
 * 画面の一覧が絞るのは「状態 × 種類 × 画面 × 払い出しの有無 × 廃棄したか」の 5 つで、
 * それ以外（送信時の画面の大きさ、直前の操作、履歴）は絞りの条件にならない。
 * 全部を列にすると、要望の中身を 1 つ増やすたびに保存先の作り替えが要る。
 *
 * `handoff_count` を列に持つのは、まとめて渡す画面が「まだ渡していないもの」を
 * 絞るためである。中の履歴を開かないと分からない形にすると、
 * 一覧の 1 行ごとに履歴を読むことになる。
 *
 * **本文（`body`）に一意制約や長さの制限を置かない。** 同じ人が同じことを
 * 2 回書くのは普通に起こることで、保存先で弾くと 2 回目が永久に通らない。
 * 長さの上限（4000 字）は domain 側が持つ（`MAX_BODY_LENGTH`）。
 * 保存先で切ると、切られたことに誰も気づかない。
 */
export const feedbackReports = sqliteTable(
  "feedback_reports",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    brandId: text("brand_id"),
    siteId: text("site_id"),
    kind: text("kind", {
      enum: ["not_working", "hard_to_use", "want_feature"],
    }).notNull(),
    body: text("body").notNull(),
    /** どうなってほしいか。**空は「書かれていない」であり、空文字と区別する。** */
    wish: text("wish"),
    /** どの画面から送られたか。絞り込みに使うので列に出す。 */
    route: text("route").notNull(),
    /** 画面名・URL・画面の大きさ。絞らないので 1 つにまとめる。 */
    originJson: text("origin_json").notNull(),
    /** エラー・失敗した通信・直前の操作・伏せた件数。同上。 */
    technicalJson: text("technical_json").notNull(),
    captureId: text("capture_id"),
    submittedBy: text("submitted_by").notNull(),
    submittedAt: integer("submitted_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    status: text("status", {
      enum: ["open", "in_progress", "resolved", "declined"],
    }).notNull(),
    /** 打ち切り方。状態とは別に持つ（「見送り」と「廃棄」は別のこと）。 */
    dispositionKind: text("disposition_kind", {
      enum: ["will_not_fix", "duplicate", "discarded"],
    }),
    dispositionJson: text("disposition_json"),
    /** 渡した回数。0 なら「まだ渡していない」。 */
    handoffCount: integer("handoff_count").notNull().default(0),
    handoffJson: text("handoff_json").notNull(),
    /** Beads の課題番号。1 件につき最大 1 つ。着手・完了はここへ写さない。 */
    beadsIssueId: text("beads_issue_id"),
    /** 履歴。**消さずに積む**ので、上書き保存でも前の行が消えない形で入れる。 */
    historyJson: text("history_json").notNull(),
  },
  (t) => [
    index("feedback_reports_workspace_status_idx").on(t.workspaceId, t.status),
    index("feedback_reports_workspace_route_idx").on(t.workspaceId, t.route),
    index("feedback_reports_workspace_submitted_idx").on(t.workspaceId, t.submittedAt),
  ],
);

/**
 * 取りに来るときの鍵（仕様 §10-3）。
 *
 * **平文の鍵は入らない。** 入るのは潰した値（`hashed_value`）だけで、
 * 平文は発行の瞬間に画面へ 1 度返るきりである。
 * `sessions` の `token_hash` と同じ考え方で、この表を読めた人でも
 * 鍵として使えない状態にしておく。
 *
 * `hashed_value` に一意の索引を置く。ここは重複を許す理由が無く、
 * 突き合わせ（`authenticate`）が毎回この列だけで引くためである。
 * 受信箱の URL と違い、同じ値が 2 つ出ることは事故しか意味しない。
 */
export const integrationKeys = sqliteTable(
  "integration_keys",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    /** 何に使う鍵か。これが無いと、後から失効させてよいか判断できない。 */
    label: text("label").notNull(),
    /** 潰した値。平文はここへ入れない。 */
    hashedValue: text("hashed_value").notNull(),
    /** できること。`read` / `update_status` を並べて入れる。 */
    scopesJson: text("scopes_json").notNull(),
    createdBy: text("created_by").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    lastUsedAt: integer("last_used_at", { mode: "timestamp" }),
    /** 失効。行は消さない。消すと「いつ誰が止めたか」が残らない。 */
    revokedAt: integer("revoked_at", { mode: "timestamp" }),
    rateLimitPerMinute: integer("rate_limit_per_minute").notNull().default(30),
  },
  (t) => [
    uniqueIndex("integration_keys_hashed_value_idx").on(t.hashedValue),
    index("integration_keys_workspace_idx").on(t.workspaceId),
  ],
);

/**
 * 鍵が使われた記録。
 *
 * 回数の上限（1 分あたり）を**本当に数える**ために持つ。
 * 上限の判定を記録なしに行うと、実行中だけ覚える形にしかならず、
 * 別のリクエストで作り直された瞬間に数が 0 に戻る。
 *
 * 古い行は判定に要らない。消し方は残課題（`docs/product/backlog.md`）。
 * ここで自動削除を書かないのは、消す仕組みを入れる前に
 * 「何日ぶん残すか」を決める必要があるからで、決める前に消すと元へ戻せない。
 */
export const integrationKeyUsages = sqliteTable(
  "integration_key_usages",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    keyId: text("key_id").notNull(),
    usedAt: integer("used_at", { mode: "timestamp" }).notNull(),
    /**
     * そのときの鍵の名前。**鍵の表を引き直さずに読めるよう、写しを持つ。**
     * 名前を変えても、変える前に使われた記録は当時の名前のまま残る。
     */
    keyLabel: text("key_label").notNull(),
    /** その 1 回で何件持っていったか。 */
    fetchedCount: integer("fetched_count").notNull().default(0),
  },
  (t) => [index("integration_key_usages_key_used_idx").on(t.keyId, t.usedAt)],
);

/**
 * ブログ作成ウィザードの下書き（仕様 §16.2 の 13 段階）。
 *
 * 13 段階ぶんの記入は `draft_json` にまとめて入れる。**列に出すのは
 * 一覧が実際に使う項目だけ**（作業場所・名前・URL 名・作ったブログ・更新日時）。
 * 段階が 1 つ増えるたびに保存先の形を変えることになると、
 * ウィザードの手直しに毎回マイグレーションが要る。
 */
export const siteDrafts = sqliteTable(
  "site_drafts",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    /** 一覧で見分けるための名前。まだ決めていない段階では空文字。 */
    name: text("name").notNull().default(""),
    slug: text("slug").notNull().default(""),
    /** 作りきったら、できたブログの URL 名が入る。作りかけは NULL。 */
    createdSiteSlug: text("created_site_slug"),
    /** CAS 用の単調増加版。updated_at の秒精度へ競合判定を委ねない。 */
    revision: integer("revision").notNull().default(1),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    draftJson: text("draft_json").notNull(),
  },
  (t) => [index("site_drafts_workspace_updated_idx").on(t.workspaceId, t.updatedAt)],
);

/**
 * ウィザードから作られたブログの設計図。
 *
 * **ここを通ったものだけが読者から見える。**
 *
 * `slug` に一意の索引を置く。読者の URL（`/s/<URL名>`）がこの値そのもので、
 * 同じ URL 名が 2 つあると、どちらを出すか決められないためである。
 * 受信箱の URL（重複しても受け取る）と違い、ここは重複に意味が無い。
 * 新規作成は workspace が同じでも上書きしない。編集と新規作成を別経路にし、
 * 作成失敗時の巻き戻しが既存サイトを消せる状態を作らない。取り下げ後も行を残し、
 * 別 workspace へ URL 名を移管せず読者データを守る。
 *
 * 読者向けホスト名は保存しない。slug と実行環境の SITE_BASE_DOMAIN から
 * `siteHostname` が導出する。環境ごとに異なる値を行に焼き込むと、同じデータを
 * dev/prod で移しただけで住所が古くなるためである。
 */
export const siteBlueprints = sqliteTable(
  "site_blueprints",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    /**
     * 新規作成の元になった下書き。既存行と編集経路は null。
     * 同じ下書きの stale request が別 slug で並行しても、
     * 一意制約により両方を新規作成できない。
     */
    sourceDraftId: text("source_draft_id"),
    /** 作成が読み取った下書きの版。trigger が現在版と照合する。 */
    sourceDraftRevision: integer("source_draft_revision"),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    /** 10 パターンのどれか。一覧の絞り込みに使うので列に出す。 */
    pattern: text("pattern").notNull(),
    publishedAt: integer("published_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    blueprintJson: text("blueprint_json").notNull(),
  },
  (t) => [
    uniqueIndex("site_blueprints_slug_idx").on(t.slug),
    uniqueIndex("site_blueprints_source_draft_idx").on(t.sourceDraftId),
    index("site_blueprints_workspace_idx").on(t.workspaceId),
  ],
);

/**
 * ブログURLの取り下げ墓標。site_blueprints本体を変形せず、再利用を永久に防ぐ。
 * SQLiteに `ADD COLUMN IF NOT EXISTS` が無いため、独立表ならmigration再実行も安全。
 */
export const siteRetirements = sqliteTable(
  "site_retirements",
  {
    slug: text("slug").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    retiredAt: integer("retired_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [index("site_retirements_workspace_idx").on(t.workspaceId)],
);

/**
 * 読者ページへ出した記事（そのとき出した内容の**写し**）。
 *
 * `articles` は編集の唯一の正本。こちらは別の編集正本ではなく、
 * **出した瞬間の内容をそのまま**保存する公開 read projection である。
 *
 * 内容全体は `article_json` に入れ、**列に出すのは一覧と検索が実際に使う項目だけ**。
 * 節を 1 つ足すたびにマイグレーションが要る形にすると、記事の構成を直すのが
 * 億劫になり、構成が古いまま固まる。
 *
 * 写しである理由: 人物やカテゴリーの登録内容をあとで変えても、
 * **すでに読者が読んだ記事は変わらない**。参照で持つと、名前を直した日に
 * 過去の全記事の署名が書き換わり、「誰が書いたか」の記録が消える。
 *
 * 主キーは（ブログの URL 名, 記事の URL 名）の組。読者の URL が
 * `/s/<ブログ>/<種類>/<記事>` そのもので、同じ組が 2 つあると
 * どちらを出すか決められない。出し直しは**上書き**として扱う。
 */
export const publishedArticles = sqliteTable(
  "published_articles",
  {
    siteSlug: text("site_slug").notNull(),
    slug: text("slug").notNull(),
    workspaceId: text("workspace_id").notNull(),
    /**
     * 編集 aggregate から決定的に作った projection の由来。
     * AI 公開など、`articles` を経由しない公開は null。
     */
    sourceArticleId: text("source_article_id").references(() => articles.id, {
      onDelete: "restrict",
    }),
    /** 記事の種類。URL の道筋がこれで決まるので列に出す。 */
    type: text("type").notNull(),
    title: text("title").notNull(),
    /** 一文の結論。一覧・検索結果にそのまま出るので列に出す。 */
    summary: text("summary").notNull(),
    categorySlug: text("category_slug").notNull(),
    /** 書き手。人物ページから記事を引くので列に出す。 */
    authorSlug: text("author_slug").notNull(),
    authorName: text("author_name").notNull(),
    publishedAt: text("published_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    /** 非公開にした時刻。NULL だけが読者画面に出る。 */
    archivedAt: text("archived_at"),
    articleJson: text("article_json").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.siteSlug, t.slug] }),
    index("published_articles_site_category_idx").on(t.siteSlug, t.categorySlug),
    index("published_articles_site_updated_idx").on(t.siteSlug, t.updatedAt),
    index("published_articles_site_author_idx").on(t.siteSlug, t.authorSlug),
    index("published_articles_workspace_idx").on(t.workspaceId),
    uniqueIndex("published_articles_source_article_idx")
      .on(t.sourceArticleId)
      .where(sql`${t.sourceArticleId} is not null`),
  ],
);

/**
 * 公開記事の取り下げ墓標。
 *
 * 公開行を消すだけでは、同じURLの見本記事が再び読者へ出てしまう。
 * 取り下げたURLを独立して残し、一覧・検索・1枚引きの全てで見本より優先する。
 * 再公開時だけ同じworkspaceが墓標を外せる。
 */
export const publishedArticleTombstones = sqliteTable(
  "published_article_tombstones",
  {
    siteSlug: text("site_slug").notNull(),
    slug: text("slug").notNull(),
    workspaceId: text("workspace_id").notNull(),
    unpublishedAt: integer("unpublished_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    primaryKey({ columns: [t.siteSlug, t.slug] }),
    index("published_article_tombstones_workspace_idx").on(t.workspaceId),
  ],
);

/**
 * 計測の記録（仕様 §27）。
 *
 * **事実として貯めるのはこの表だけ。** 表示回数や滞在時間といった指標は
 * 別の表に持たず、読むたびにここから導く
 * （`src/domain/analytics/metrics-from-telemetry.ts`）。
 * 集計済みの数字も一緒に貯めると、食い違ったときにどちらが正しいか決められない。
 *
 * 列に出しているのは、**絞り込みと削除に使う項目だけ**。
 *   - `key` … 種類ごとに数える／種類ごとに保存期間が違う
 *   - `occurred_at` … 期間で切る。集計は必ず期間つきで行う
 *   - `site_slug` … ブログ単位で見る（`payload_json` の中を検索させない）
 *   - `reader_key` … 読者から「消してください」と言われたときに引く列
 * それ以外は `payload_json` にまとめる。イベントの項目が 1 つ増えるたびに
 * マイグレーションが要る形にすると、計測を足すのが億劫になり、測らなくなる。
 *
 * 保存期間の判定はここに書かない（domain の `RETENTION_DAYS` が正本）。
 * 期限を行へ焼き込むと、方針を短くしたときに**古い行だけ長く残る**。
 */
/**
 * 操作の記録（監査ログ）。
 *
 * **足すだけの表。** 更新も削除もしない。後から書き換えられる記録は
 * 「人が承認した」の証明にならない。読み口（`AuditLogPort`）にも
 * update / delete を置いていない。
 *
 * 差分（before / after）は JSON で持つ。対象が文脈をまたぐ（記事・順位の基準・
 * 広告表記・担当者）ので、列にすると対象ごとに表が要る。
 * **秘密情報は入る前に落とす**（`redactSensitive`）。列で防ぐのではなく、
 * 詰める側で機械的に置換する — 「入れないよう気をつける」は必ず破られる。
 *
 * 規範: docs/product/traceability.md REQ-SEC09 / `src/domain/compliance/audit-log.ts`
 */
export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    /** 操作の種類。正本は domain/compliance/audit-log.ts の `AuditAction`。 */
    action: text("action").notNull(),
    /** 誰が。AI のサービスアカウントのときは null になり得る。 */
    actorUserId: text("actor_user_id"),
    /**
     * AI の代行だったか。**列として持つ。**
     * 利用者 ID の有無から推測すると、AI が人の権限を借りた操作を
     * 後から人の操作として読んでしまう。
     */
    actorIsAi: integer("actor_is_ai", { mode: "boolean" }).notNull(),
    /**
     * その身元を照合して確かめてあったか。**列として持つ。**
     * 利用者 ID の有無から推測できない——確かめていない身元にも名前は付いている
     * （読者は `anonymous`、見本は `u_sample`）。推測にすると、
     * 誰でもない人が押した承認を後から「人が承認した」と読んでしまう。
     *
     * 既存の行の既定は 1（確かめてある）。この列を足す前に書かれた行は、
     * 断りが働いていた頃のもので、確かめていない身元では 1 行も書かれていない。
     */
    actorIdentified: integer("actor_identified", { mode: "boolean" }).notNull().default(true),
    actorModelId: text("actor_model_id"),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    beforeJson: text("before_json"),
    afterJson: text("after_json"),
    /** なぜその操作をしたか。承認・取り下げ・訂正では必須（domain 側で断る）。 */
    reason: text("reason"),
    /**
     * その操作が入ってきた**一回の要求**を指す名前。
     *
     * **断りの記録（`access.*`）では必ず入る**（domain 側が空を断る）。
     * 通した操作では入らない回がある（定期実行など、要求の外で起きたもの）。
     *
     * 既存の行は `null` になる。この列を足す前に書かれた行は、
     * 断りを 1 行も持っていない（語そのものが無かった）ので、
     * 「断りなのに糸が無い行」は生まれない。
     */
    requestId: text("request_id"),
    occurredAt: integer("occurred_at", { mode: "timestamp" }).notNull(),
  },
  (t) => [
    // 「この記事に何が起きたか」を引く索引。無いと全件走査になる。
    index("audit_logs_workspace_target_idx").on(t.workspaceId, t.targetType, t.targetId),
    /*
     * 「同じ一回の要求で、ほかに何が断られたか」を引く索引。
     * 断りは 1 件では読めない。総当たりは 1 回の要求の中で何十件も断られ、
     * 役の付け忘れは 1 件で終わる。糸で引けないと、この差が一覧から読めない。
     */
    index("audit_logs_workspace_request_idx").on(t.workspaceId, t.requestId),
    index("audit_logs_workspace_occurred_idx").on(t.workspaceId, t.occurredAt),
    index("audit_logs_workspace_action_occurred_idx").on(t.workspaceId, t.action, t.occurredAt),
  ],
);

export const telemetryEvents = sqliteTable(
  "telemetry_events",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    /** イベントの種類。正本は domain/analytics/telemetry-events.ts。 */
    key: text("key").notNull(),
    occurredAt: integer("occurred_at", { mode: "timestamp" }).notNull(),
    /** どのブログでの出来事か。ページによっては入らない（AI 利用など）。 */
    siteSlug: text("site_slug"),
    /** 仮の目印。同意が無いときは null のまま入る（記録自体は残す）。 */
    readerKey: text("reader_key"),
    payloadJson: text("payload_json").notNull(),
  },
  (t) => [
    index("telemetry_events_workspace_occurred_idx").on(t.workspaceId, t.occurredAt),
    index("telemetry_events_workspace_key_occurred_idx").on(t.workspaceId, t.key, t.occurredAt),
    // 削除依頼のための索引。**無いと「消せます」が現実的でなくなる。**
    index("telemetry_events_reader_idx").on(t.workspaceId, t.readerKey),
  ],
);

/**
 * 出し先の接続（どのアカウントへ出せるか）。
 *
 * **認証情報そのものは入れない。** 入るのは `credential_ref`＝
 * 「どこに保管したか」の名前だけ。値を列に入れると、この表を読めた人が
 * そのまま他人のアカウントへ投稿できてしまう。
 *
 * 接続登録の入口は、対応済みproviderでは実認証から返った不変IDを保存する。
 * 未実装providerは登録所が明示的に止め、入力された表示名だけで接続済みにしない。
 */
export const channelConnections = sqliteTable(
  "channel_connections",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    /** 出し先の種類。正本は domain/distribution/channel.ts の `CHANNEL_CAPABILITIES`。 */
    kind: text("kind", { enum: CHANNEL_KIND_VALUES }).notNull(),
    /** 画面に出すアカウント名。**誤爆防止のために保存する**（ID だけでは誰宛か分からない）。 */
    accountLabel: text("account_label").notNull(),
    connectedAt: integer("connected_at", { mode: "timestamp" }).notNull(),
    /** 認証の有効期限。null は期限なし。 */
    expiresAt: integer("expires_at", { mode: "timestamp" }),
    revokedAt: integer("revoked_at", { mode: "timestamp" }),
    /** providerが実認証で返した不変ID。BlueskyではDID。token/JWTは保存しない。 */
    providerIdentity: text("provider_identity"),
    /** 保管先の名前。**値ではない。** */
    credentialRef: text("credential_ref").notNull(),
  },
  (t) => [
    index("channel_connections_workspace_kind_idx").on(t.workspaceId, t.kind),
    uniqueIndex("channel_connections_workspace_provider_identity_idx").on(
      t.workspaceId,
      t.kind,
      t.providerIdentity,
    ),
    // 同じsecret参照を別DIDへ差し替えて2行目を作る経路も保存先で閉じる。
    uniqueIndex("channel_connections_workspace_credential_ref_idx").on(
      t.workspaceId,
      t.kind,
      t.credentialRef,
    ),
  ],
);

/**
 * provider主体ごとの短期送信lease。
 * workspaceを主キーへ含めない。同じDIDを複数workspaceから登録しても、
 * provider側から見れば同じ送信主体なので、外部通信は全体で1件へ直列化する。
 */
export const channelProviderDeliveryLeases = sqliteTable(
  "channel_provider_delivery_leases",
  {
    kind: text("kind", { enum: CHANNEL_KIND_VALUES }).notNull(),
    providerIdentity: text("provider_identity").notNull(),
    holderPublicationId: text("holder_publication_id").notNull(),
    /** acquireごとに変わるfencing token。旧workerのreleaseから新leaseを守る。 */
    leaseToken: text("lease_token").notNull(),
    acquiredAt: integer("acquired_at", { mode: "timestamp" }).notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.kind, t.providerIdentity] }),
    index("channel_provider_delivery_leases_expiry_idx").on(t.expiresAt),
  ],
);

/**
 * 配信（いつ・どこへ出すか、と出した結果）。
 *
 * 同じ記事・同じ先・同じ日時は、workspace内で1件に収束させる。
 * ユースケースの事前確認だけでは並行要求の競合窓が残るため、保存先の
 * 一意制約とcreate-if-absentを最終境界にする。競合は例外ではなく、先に
 * 作られた正本を読み直して成功として返す。
 */
export const publications = sqliteTable(
  "publications",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    variantId: text("variant_id").notNull(),
    /** 予約時に公開前確認を通したcontent_variants.revision。旧行はfail-closedのためnull。 */
    variantRevision: integer("variant_revision"),
    kind: text("kind", { enum: CHANNEL_KIND_VALUES }).notNull(),
    /** 出し先の接続。書き出し（note）だけは接続を持たないので null。 */
    connectionId: text("connection_id"),
    /** 状態。正本は domain/distribution/publication.ts の `PUBLICATION_STATES`。 */
    state: text("state", { enum: PUBLICATION_STATE_VALUES }).notNull(),
    /** 予約時刻。null は即時。 */
    scheduledAt: integer("scheduled_at", { mode: "timestamp" }),
    /** 一時失敗後に次に試してよい時刻。予約時刻の意味を上書きしない。 */
    retryAt: integer("retry_at", { mode: "timestamp" }),
    /** 送信中workerのclaim期限。期限切れのSENDINGだけを別workerが回収する。 */
    deliveryLeaseUntil: integer("delivery_lease_until", { mode: "timestamp" }),
    idempotencyKey: text("idempotency_key").notNull(),
    /** 外部送信claim時に固定したprovider主体。provider keyの一意境界に使う。 */
    providerIdentity: text("provider_identity"),
    /** provider側のrecord key。最初のclaimで確定し、retryでも変えない。 */
    providerDeliveryKey: text("provider_delivery_key"),
    /** provider record本文のcreatedAt。即時配信でも初回claim後は変えない。 */
    providerRecordCreatedAt: integer("provider_record_created_at", { mode: "timestamp" }),
    attempts: integer("attempts").notNull().default(0),
    externalId: text("external_id"),
    externalUrl: text("external_url"),
    lastError: text("last_error"),
    publishedAt: integer("published_at", { mode: "timestamp" }),
    /** 配信状態CASとoutboxを結ぶ内部token。業務状態としては公開しない。 */
    lastDeliveryAuditId: text("last_delivery_audit_id"),
  },
  (t) => [
    index("publications_workspace_variant_idx").on(t.workspaceId, t.variantId),
    uniqueIndex("publications_workspace_idempotency_idx").on(t.workspaceId, t.idempotencyKey),
    // TIDのclock idが別isolateで衝突しても、外部送信前のclaimを片方だけにする。
    uniqueIndex("publications_provider_delivery_key_idx").on(
      t.kind,
      t.providerIdentity,
      t.providerDeliveryKey,
    ),
    // 予約の時間が来たものを拾う索引。無いと、送る側が毎回全件を読む。
    index("publications_state_scheduled_idx").on(t.state, t.scheduledAt),
    index("publications_state_retry_idx").on(t.state, t.retryAt),
    index("publications_state_lease_idx").on(t.state, t.deliveryLeaseUntil),
  ],
);

/**
 * 外部配信の状態確定と同じtransactionで積む監査outbox。
 *
 * audit_logs と同じpayloadを保持し、flush時に再生成しない。再試行しても同じIDを
 * insert-if-absentするため、監査保存後の停止でも重複記録にならない。
 */
export const publicationDeliveryAuditOutbox = sqliteTable(
  "publication_delivery_audit_outbox",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    action: text("action").notNull(),
    actorUserId: text("actor_user_id"),
    actorIsAi: integer("actor_is_ai", { mode: "boolean" }).notNull(),
    actorIdentified: integer("actor_identified", { mode: "boolean" }).notNull(),
    actorModelId: text("actor_model_id"),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    beforeJson: text("before_json"),
    afterJson: text("after_json"),
    reason: text("reason"),
    requestId: text("request_id"),
    occurredAt: integer("occurred_at", { mode: "timestamp" }).notNull(),
    /** Publication CAS triggerが同一transaction内で確定した時刻。nullは未確定intent。 */
    committedAt: integer("committed_at", { mode: "timestamp" }),
    /** audit_logsへの配送と同じbatchで入る。nullだけを次cronが拾う。 */
    deliveredAt: integer("delivered_at", { mode: "timestamp" }),
  },
  (t) => [
    index("publication_delivery_audit_outbox_pending_idx").on(
      t.deliveredAt,
      t.committedAt,
      t.occurredAt,
    ),
    index("publication_delivery_audit_outbox_workspace_pending_idx").on(
      t.workspaceId,
      t.deliveredAt,
      t.committedAt,
      t.occurredAt,
    ),
  ],
);

/**
 * 成果（ASP から取り込んだ 1 件）。
 *
 * **上の `conversions` を使い回さない。** あちらは最初のたたき台で作った表で、
 * 作業場所を持たず、取込額と手修正額を 1 つの列（`amount`）で兼ねている。
 * 兼ねると、人が直した瞬間に取込値が消え、次の取込との差分を出せなくなる。
 * ——「直したはずが元に戻っている」「ASP 側の誤りに気づけない」のどちらも、
 * 数字なので画面を見ても分からない。通貨・会計期間・締めの欄も無く、
 * さらに `programs` への外部キーがあるが、その表を埋める入口がまだ無い。
 * 足りない列を継ぎ足すより、業務の形（domain/monetization/conversion.ts）に
 * そのまま対応する表を別に作るほうが、読む側の混乱が少ない。
 *
 * **取り込んだ額（`ingested_*`）と手で直した額（`adjusted_*`）を別の列で持つ。**
 * これがこの表を作った理由そのもので、片方に寄せる形へ直してはいけない。
 *
 * `external_conversion_id` に一意制約を付けない。同じ成果が二度来たときに
 * 「すでにあります」と成功で応じるのは取込のユースケース側の仕事で、
 * 保存先が例外で弾くと、その応答が永久に通らない失敗になる
 * （`publications` / `link_ingestions` と同じ理由）。索引だけ張る。
 */
export const affiliateConversions = sqliteTable(
  "affiliate_conversions",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    programId: text("program_id").notNull(),
    /** 成果の元になったリンク。分からないまま取り込むことがあるので null 可。 */
    linkId: text("link_id"),
    /** ASP。正本は domain/monetization/affiliate-program.ts の `ASP_LABEL`。 */
    asp: text("asp", { enum: ASP_KIND_VALUES }).notNull(),
    /** ASP 側の成果 ID（正規化済み）。突合の主キー。 */
    externalConversionId: text("external_conversion_id").notNull(),
    /** 状態。正本は domain/monetization/conversion.ts の `CONVERSION_STATUSES`。 */
    status: text("status", { enum: CONVERSION_STATUS_VALUES }).notNull(),
    occurredAt: integer("occurred_at", { mode: "timestamp" }).notNull(),
    confirmedAt: integer("confirmed_at", { mode: "timestamp" }),
    /**
     * 取り込んだままの額。**null は「未取得」で、0 円ではない。**
     * 0 で埋めると、まだ金額の来ていない成果が「0 円の成果」になり、
     * 合計だけを見ている人には両者の区別が付かなくなる。
     */
    ingestedAmountMinor: integer("ingested_amount_minor"),
    ingestedCurrency: text("ingested_currency"),
    /** 人が直した額。直していなければ null。取込額を上書きしない。 */
    adjustedAmountMinor: integer("adjusted_amount_minor"),
    adjustedCurrency: text("adjusted_currency"),
    /** 直した理由。無いと、後から金額の根拠をたどれない。 */
    adjustmentReason: text("adjustment_reason"),
    /** 会計期間（YYYY-MM）。締めの単位。 */
    period: text("period").notNull(),
    /** その期間が締め済みか。締め後は取込値の変更を反映しない。 */
    periodClosed: integer("period_closed", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [
    index("affiliate_conversions_workspace_period_idx").on(t.workspaceId, t.period),
    index("affiliate_conversions_workspace_external_idx").on(
      t.workspaceId,
      t.asp,
      t.externalConversionId,
    ),
  ],
);

/**
 * ASP アカウント（提携先）。
 *
 * **秘密の値をこの表に置かない。** 置いてよいのは
 * `credential_ref`（保管先の名前）と `public_tracking_id`（リンクに現れる公開 ID）だけ。
 * 鍵そのものを列にすると、保存先を読める全員が鍵を読めることになり、
 * 画面に出さない配慮も、権限の判定も、すべて意味を失う。
 *
 * `disabled_at` で止める。行を消さないのは、止めた提携先で発生した過去の成果が
 * **どこの成果だったのか分からなくなる**ため。
 */
export const affiliateAccounts = sqliteTable(
  "affiliate_accounts",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    /** ASP。正本は domain/monetization/affiliate-program.ts の `ASP_LABEL`。 */
    asp: text("asp", { enum: ASP_KIND_VALUES }).notNull(),
    /** 画面に出す識別名。同じ ASP を複数持てるので、これが人の目印になる。 */
    label: text("label").notNull(),
    /** リンクに現れる公開 ID。秘密ではない。未取得は空文字ではなく null。 */
    publicTrackingId: text("public_tracking_id"),
    /** 認証情報の**保管先の名前**。値そのものは決してここに入らない。 */
    credentialRef: text("credential_ref"),
    connectedAt: integer("connected_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    disabledAt: integer("disabled_at", { mode: "timestamp" }),
  },
  (t) => [index("affiliate_accounts_workspace_idx").on(t.workspaceId)],
);

/**
 * 提携プログラム（広告主ごとの条件）。
 *
 * **報酬の決め方は 3 列に割らず、種類 + 値で持つ。** 率・固定額・段階制・未取得は
 * 排他で、列を並べると「率も固定額も入っている行」が作れてしまう。
 * とくに **未取得（`unknown`）と 0 円を同じ形にしない**。同じにすると、
 * 取れていないだけの提携が「報酬 0 円の提携」として画面に並ぶ。
 *
 * `restrictions`（掲載条件）は文章の並びで、機械では判定できない。
 * 判定できないものを列に割ると、割った形が判定できるかのように見える。
 */
export const affiliatePrograms = sqliteTable(
  "affiliate_programs",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    /** どの提携先アカウントの下の提携か。 */
    accountId: text("account_id").notNull(),
    asp: text("asp", { enum: ASP_KIND_VALUES }).notNull(),
    advertiserName: text("advertiser_name").notNull(),
    /** 報酬の決め方の種類。正本は domain の `RewardModel`。 */
    rewardKind: text("reward_kind", {
      enum: ["rate", "fixed", "tiered", "unknown"],
    }).notNull(),
    /** `rate` のときの率（%）。 */
    rewardPercent: integer("reward_percent"),
    /** `fixed` のときの額と通貨。片方だけ入っている行は未取得として読む。 */
    rewardAmountMinor: integer("reward_amount_minor"),
    rewardCurrency: text("reward_currency"),
    /** `tiered` のときの説明。詳細は ASP 側にしか無い。 */
    rewardNote: text("reward_note"),
    /** 承認率（0〜1）。**null は未取得で、0 ではない。** */
    approvalRate: real("approval_rate"),
    confirmationDays: integer("confirmation_days"),
    cookieDurationDays: integer("cookie_duration_days"),
    /** 人が読んで確かめる掲載条件。 */
    restrictions: text("restrictions", { mode: "json" }).$type<string[]>().notNull(),
    joinedAt: integer("joined_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    endedAt: integer("ended_at", { mode: "timestamp" }),
  },
  (t) => [
    index("affiliate_programs_workspace_idx").on(t.workspaceId),
    index("affiliate_programs_account_idx").on(t.workspaceId, t.accountId),
  ],
);

/**
 * 記事（媒体別の文章）1 本。
 *
 * **進行の現在地（`state`）を同じ行に持つ。** 別表にすると、記事を消したのに
 * 現在地だけが残る、あるいはその逆が起こり、かんばんに本文の無い札が並ぶ。
 * 一方で業務の型（`ContentVariant`）には入れていない。あれは AI の出力契約で、
 * AI が文章を返しただけで段階が進んだことにはならないため。
 *
 * 親の企画（`content_packages`）は別表。1 つの企画から記事が何本も生まれるので、
 * 同じ行に混ぜると企画の決めごとが記事の本数だけ重複する。
 */
export const contentVariants = sqliteTable(
  "content_variants",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    contentPackageId: text("content_package_id").notNull(),
    /** 媒体。配信の出し先と同じ語彙だが、記事側は自社サイトの区分も持つため素の文字列。 */
    channel: text("channel").notNull(),
    format: text("format").notNull(),
    authorPersonaId: text("author_persona_id").notNull(),
    audiencePersonaId: text("audience_persona_id").notNull(),
    /** 切り口。正本は domain/authoring/content-package.ts の `CONTENT_ANGLES`。 */
    angle: text("angle", { enum: CONTENT_ANGLE_VALUES }).notNull(),
    title: text("title"),
    body: text("body").notNull(),
    summary: text("summary").notNull(),
    cta: text("cta", { enum: CTA_TYPE_VALUES }).notNull(),
    disclosure: text("disclosure").notNull(),
    affiliateLinkIds: text("affiliate_link_ids", { mode: "json" }).$type<string[]>().notNull(),
    claimIds: text("claim_ids", { mode: "json" }).$type<string[]>().notNull(),
    evidenceIds: text("evidence_ids", { mode: "json" }).$type<string[]>().notNull(),
    /** AI が置いた仮定。読者へ「仮定」として示すので、保存しないと出せなくなる。 */
    assumptions: text("assumptions", { mode: "json" }).$type<string[]>().notNull(),
    platformWarnings: text("platform_warnings", { mode: "json" }).$type<string[]>().notNull(),
    factualityScore: real("factuality_score").notNull(),
    personaFitScore: real("persona_fit_score").notNull(),
    channelFitScore: real("channel_fit_score").notNull(),
    complianceStatus: text("compliance_status", { enum: COMPLIANCE_STATUS_VALUES }).notNull(),
    /** どの指示・どのモデルで作ったか。後から原因を追えるようにするため必須。 */
    generationPromptVersion: text("generation_prompt_version").notNull(),
    modelId: text("model_id").notNull(),
    status: text("status", { enum: CONTENT_VARIANT_STATUS_VALUES }).notNull(),
    /** 本文・表記・根拠などContentVariant本体を保存するたびに単調増加する版。 */
    revision: integer("revision").notNull().default(1),
    /** 進行の現在地。正本は domain/authoring/content-state.ts の `CONTENT_STATES`。 */
    state: text("state", { enum: CONTENT_STATE_VALUES }).notNull(),
    /**
     * 次に見直す日。
     *
     * まだこれを入れる処理は無い（公開の運用が入っていないため）。
     * 列だけ先に置いてあるのは、見直しの一覧が「現在地が REFRESH_DUE のもの」
     * だけで動いていることを、あとから読む人に隠さないため。
     */
    reviewDueAt: integer("review_due_at", { mode: "timestamp" }),
  },
  (t) => [
    index("content_variants_workspace_state_idx").on(t.workspaceId, t.state),
    index("content_variants_workspace_package_idx").on(t.workspaceId, t.contentPackageId),
    index("content_variants_review_due_idx").on(t.state, t.reviewDueAt),
  ],
);

/**
 * 運営者が管理する商品（比較表と順位表の入力）。
 *
 * **読者ドメインの `products` とは別の表である。** 名前が似ているのは
 * 同じものを指しているからではない。あちらは読者ページに出す商品の見出し
 * （slug・カテゴリー・型番）で、カテゴリーへの外部キーを必須にしている。
 * こちらは編集側の入力で、比較表の列になる仕様と、その出どころ
 * （どこに書いてあった値か・いつ確かめたか・どこまで信じてよいか）を持つ。
 *
 * 1 つの表にまとめると、読者ページに出す前の商品を登録できなくなるか、
 * カテゴリーの無い行を読者ページが拾ってしまうかのどちらかになる。
 *
 * `specifications` と `identity_keys` を JSON にしているのは、
 * **列が分野ごとに違うため。** ノートパソコンの「重さ」と洗剤の「容量」を
 * 同じ列に並べる方法は無く、分野ごとに表を足すと分野を 1 つ増やすたびに
 * マイグレーションが要る。揃っているかどうかは比較のときに見る
 * （`compare_products` が「全商品で値が揃っている項目だけを列にする」）。
 */
export const catalogProducts = sqliteTable(
  "catalog_products",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    brand: text("brand").notNull(),
    name: text("name").notNull(),
    manufacturer: text("manufacturer"),
    /**
     * 分野。読者ドメインの `categories` へは**つながない。**
     * 読者ページに出していない分野の商品も登録できる必要があるため。
     */
    categoryId: text("category_id"),
    /** 同一性の鍵。正本は domain/product/product-identity.ts の `IDENTITY_KEY_PRIORITY`。 */
    identityKeys: text("identity_keys", { mode: "json" })
      .$type<{ kind: string; value: string }[]>()
      .notNull(),
    description: text("description"),
    specifications: text("specifications", { mode: "json" })
      .$type<Record<string, string | number>>()
      .notNull(),
    imageAssetIds: text("image_asset_ids", { mode: "json" }).$type<string[]>().notNull(),
    releaseDate: integer("release_date", { mode: "timestamp" }),
    discontinuedAt: integer("discontinued_at", { mode: "timestamp" }),
    officialUrl: text("official_url"),
    officialSourceIds: text("official_source_ids", { mode: "json" }).$type<string[]>().notNull(),
    /**
     * 出どころ。**列に開いて持つ。**
     *
     * JSON 1 本にまとめると「取得日時が古い商品」を問い合わせで拾えない。
     * 仕様の値が古くなっているかどうかは運用の中心の問いなので、
     * ここだけは分野に依らず形が決まっている。
     */
    provenanceSourceType: text("provenance_source_type").notNull(),
    provenanceSourceName: text("provenance_source_name").notNull(),
    provenanceSourceUrl: text("provenance_source_url"),
    provenanceRetrievedAt: integer("provenance_retrieved_at", { mode: "timestamp" }).notNull(),
    provenanceValidUntil: integer("provenance_valid_until", { mode: "timestamp" }),
    provenanceConfidence: real("provenance_confidence").notNull(),
    provenancePermittedUsage: text("provenance_permitted_usage").notNull(),
  },
  (t) => [
    index("catalog_products_workspace_idx").on(t.workspaceId, t.name),
    index("catalog_products_workspace_category_idx").on(t.workspaceId, t.categoryId),
    index("catalog_products_stale_idx").on(t.workspaceId, t.provenanceRetrievedAt),
  ],
);

/**
 * 生成 AI の鍵。**列に平文は入らない。**
 *
 * 値は `sealed_key`（AES-GCM で包んだ 1 本の文字列）だけが持ち、
 * ほかの列はすべて「値でないもの」である。
 * 平文を入れる列を作らないことで、うっかり書く先が存在しなくなる。
 *
 * 作業場所ごとに分けるため、主キーは (workspace_id, provider_id) の組にする。
 * `id` を振って作業場所を列の 1 つにすると、
 * **where を書き忘れた問い合わせが他の作業場所の鍵を返す**。
 * 組の主キーなら、片方だけで引く問い合わせがそもそも書きにくい。
 */
export const llmCredentials = sqliteTable(
  "llm_credentials",
  {
    workspaceId: text("workspace_id").notNull(),
    /** 提供元の識別子。一覧の正本は infrastructure/llm/llm-provider-registry.ts。 */
    providerId: text("provider_id").notNull(),
    /** AES-GCM で包んだ鍵。`base64(iv || 暗号文)`。開けられるのは secret-box.ts だけ。 */
    sealedKey: text("sealed_key").notNull(),
    /** 末尾 4 文字。どの鍵が入っているかを本人が見分けるためだけに持つ。 */
    last4: text("last4").notNull(),
    /** "active" | "revoked"。正本は domain/generation/llm-credential.ts。 */
    status: text("status").notNull(),
    registeredBy: text("registered_by"),
    registeredAt: integer("registered_at", { mode: "timestamp" }).notNull(),
    lastVerifiedAt: integer("last_verified_at", { mode: "timestamp" }),
    /** "ok" | "failed"。まだ確かめていなければ null。 */
    lastVerification: text("last_verification"),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.providerId] })],
);

/**
 * 生成 AI をどれだけ使ったか。
 *
 * **鍵の欄はここに無い。** どの提供元・どのモデルを何トークン使ったかまでで、
 * 誰の鍵だったかは `provider_id` から引ける（鍵は作業場所に 1 本のため）。
 */
export const llmUsages = sqliteTable(
  "llm_usages",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    providerId: text("provider_id").notNull(),
    modelId: text("model_id").notNull(),
    /** 何のための呼び出しか（下書き生成・疎通確認など）。 */
    purpose: text("purpose").notNull(),
    inputTokens: integer("input_tokens").notNull(),
    outputTokens: integer("output_tokens").notNull(),
    /**
     * 概算の費用（最小通貨単位）。**請求の正はいつでも提供元の管理画面**で、
     * ここは当たりを付けるための値である。単価は目録から来る。
     */
    estimatedCostMinor: integer("estimated_cost_minor").notNull(),
    currency: text("currency").notNull(),
    /** 失敗した呼び出しも残す。失敗にも料金が掛かることがあるため。 */
    succeeded: integer("succeeded", { mode: "boolean" }).notNull(),
    /** 提供元への通信を開始したか。月次枠では `purpose = 'draft'` の行だけを数える。 */
    capacityConsumed: integer("capacity_consumed", { mode: "boolean" })
      .notNull()
      .default(true),
    occurredAt: integer("occurred_at", { mode: "timestamp" }).notNull(),
  },
  (t) => [
    index("llm_usages_workspace_occurred_idx").on(t.workspaceId, t.occurredAt),
    index("llm_usages_workspace_provider_idx").on(t.workspaceId, t.providerId, t.occurredAt),
    index("llm_usages_workspace_capacity_idx").on(
      t.workspaceId,
      t.purpose,
      t.capacityConsumed,
      t.occurredAt,
    ),
  ],
);

/**
 * 成果リンク（ASP が発行した URL）の保存先。
 *
 * **記事の版（`content_variants.affiliate_link_ids`）が指している先がここ。**
 * 版は ID の列しか持たないので、この表が無いと、公開のときに
 * 「どの商品の、どこへ行く、何という名前のリンクか」が 1 つも分からない。
 * その状態では記事に成果リンクを 1 件も載せられない（残課題 58）。
 *
 * **`original_url` は ASP が発行した URL そのもの。** 加工して保存する列は置かない。
 * 印を足した URL は多くの ASP で規約違反になり、成果そのものが計上されなくなる。
 * 入れる前に https であることを確かめる（`createAffiliateLink`）。
 * 差し替えるときは上書きせず新しい行を作る（`disabled_at` を入れて止める）。
 *
 * --- なぜ商品名をここに持つのか ---
 * 商品の表（`products`）は、**作る入口がまだ無いので空**である。そこを引くと、
 * 実運用では名前が引けず、リンクだけのカードになる。ASP でリンクを発行した
 * 時点では商品名が分かっているので、**そのときの名前をここへ写す**。
 * 写しなので古くなりうる。古くなったら行を作り直す（URL と同じ扱い）。
 *
 * **報酬額はここに置かない。** 記事の組み立てはこの表を読むので、
 * 置いた時点で「よく売れる商品を上に出す」実装が書ける形になる
 * （Editorial / Commercial の遮断。`tests/architecture/commercial-isolation.test.ts`）。
 *
 * 規範: docs/spec/01-要求仕様書-v1.0.md §19.2 / REQ-E13、tasks/task-publish-article-affiliate-links.md
 */
export const affiliateLinks = sqliteTable(
  "affiliate_links",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    programId: text("program_id").notNull(),
    /** どの商品のリンクか。商品に結びついていないリンクもある。 */
    productId: text("product_id"),
    /** 発行したときの商品名。読者のカードにそのまま出る。 */
    productName: text("product_name").notNull(),
    /** 作り手・ブランド。分からないときは空にせず未設定（null）にする。 */
    brand: text("brand"),
    /** 1 文の説明。カードの見出しの下に出る。 */
    oneLine: text("one_line"),
    /** ASP が発行した URL。**1 文字も変えずに入れ、1 文字も変えずに出す。** */
    originalUrl: text("original_url").notNull(),
    /** preview時の正規URL。originalUrlは不変のまま別列に保持する。 */
    canonicalUrl: text("canonical_url"),
    merchantName: text("merchant_name"),
    /** 権利・host gateを通過した画像だけ。未確認・legacyはnull。 */
    imageUrl: text("image_url"),
    priceMinor: integer("price_minor"),
    currency: text("currency"),
    retrievedAt: integer("retrieved_at", { mode: "timestamp" }),
    sourceMethod: text("source_method"),
    alterationProhibited: integer("alteration_prohibited", { mode: "boolean" })
      .notNull()
      .default(true),
    /** 内部の計測用識別子。URL には足さない。 */
    trackingRef: text("tracking_ref").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    /** 最後に商品情報と遷移先を確認した日時。legacyはnull=要確認。 */
    lastCheckedAt: integer("last_checked_at", { mode: "timestamp" }),
    expiresAt: integer("expires_at", { mode: "timestamp" }),
    disabledAt: integer("disabled_at", { mode: "timestamp" }),
  },
  (t) => [
    index("affiliate_links_workspace_idx").on(t.workspaceId),
    index("affiliate_links_workspace_product_idx").on(t.workspaceId, t.productId),
  ],
);

/**
 * 転送の写し（仕様 03 §1.2 の resolver store）。
 *
 * `/go/<合言葉>` を開いたときに読むのはこの表だけである。
 * 提携リンクと計測リンクを突き合わせて解くと表を 2 つ引くことになり、
 * **読者を待たせる経路が重くなる**。公開のときに転送へ要る値だけを写しておく。
 *
 * **`destination_url` は ASP が発行した URL そのもの。**
 * 入れる前に https であることを確かめ（`isSafeDestination`）、
 * 転送する直前にもう一度確かめる。合言葉から URL を組み立てる列は置かない
 * ——置いた時点で、合言葉を細工すれば任意の場所へ飛ばせる入口ができる。
 *
 * 写しなので、元を差し替えたらこの行は**上書きせず作り直す**
 * （仕様 §1.1「転送先原本は不変とする」）。上書きを許すと、
 * 差し替え前に押されたクリックと差し替え後のクリックが同じ合言葉に混ざる。
 *
 * 規範: docs/spec/03-分析・解析基盤仕様.md §1.1 / §1.2、REQ-E13
 */
export const redirectResolutions = sqliteTable(
  "redirect_resolutions",
  {
    /** `/go/<合言葉>` の合言葉。推測しにくい値を発行する。 */
    code: text("code").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    affiliateLinkId: text("affiliate_link_id").notNull(),
    destinationUrl: text("destination_url").notNull(),
    /** どのブログ・どの記事・どの位置から押されたか。数える軸になる。 */
    siteSlug: text("site_slug").notNull(),
    articlePath: text("article_path").notNull(),
    placement: text("placement").notNull(),
    productId: text("product_id"),
    state: text("state", { enum: ["active", "disabled", "expired"] })
      .notNull()
      .default("active"),
    expiresAt: integer("expires_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    index("redirect_resolutions_workspace_idx").on(t.workspaceId),
    index("redirect_resolutions_site_idx").on(t.siteSlug),
  ],
);

// ---------------------------------------------------------------------------
// 改善ループの記録（仕様 docs/spec/03-分析・解析基盤仕様.md §14 / REQ-IM13）
// ---------------------------------------------------------------------------

/**
 * 見せ方の設定。
 *
 * 配色も見出し順も比較表の列順も、**「改善の軸 → 値」の集まり**という
 * 1 つの形で入る（仕様 §14.2）。種類ごとに表を分けない。分けた瞬間に
 * 比較・記録・承認・巻き戻しがその数だけ増える。
 *
 * `settings` を JSON の 1 列にしているのは、軸を 1 つ足すたびに
 * **列が増えてマイグレーションが要る形にしないため**。軸の正本は
 * `domain/analytics/optimization.ts` の登録表だけで、保存先は形を知らない。
 * 代わりに、**入っている軸が登録表と `NON_OPTIMIZABLE` を通ることは
 * 保存のたびに突き当てる**（`domain/analytics/loop-record.ts`）。
 *
 * 承認の欄が 2 つに分かれているので「誰が承認したかだけあって日時が無い」
 * 行が書ける。書けてしまう形は保存側で断る（同じ理由で片方だけの行を
 * 読み出し時にも承認済みとして扱わない）。
 */
export const variantSpecs = sqliteTable(
  "variant_specs",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    /** どのブログの設定か。一覧はここで絞る。 */
    siteSlug: text("site_slug").notNull(),
    label: text("label").notNull(),
    settings: text("settings", { mode: "json" }).$type<VariantSetting[]>().notNull(),
    /**
     * どこから来た設定か。**記録の仕組みを 2 つ作らない**ので既存の由来をそのまま入れる。
     *
     * `mode: "json"` を使わず素の文字列で持つのは、由来が `Date` を 2 つ含むため。
     * JSON にすると読み出しは文字列で返るのに、型の上では `Date` を名乗る。
     * 型が嘘をつくと、日付の比較が黙って文字列比較になる。読む側で戻す。
     */
    provenanceJson: text("provenance_json").notNull(),
    approvedBy: text("approved_by"),
    approvedAt: integer("approved_at", { mode: "timestamp" }),
  },
  (t) => [index("variant_specs_workspace_site_idx").on(t.workspaceId, t.siteSlug)],
);

/**
 * ループを 1 周まわした記録。
 *
 * **判定の規律（仕様 §14.3）を後から確かめられる形で持つ。**
 * 「何の指標で見ると先に決めたか」(`primary_metric`) と
 * 「何件そろうまで何も言わないと決めたか」(`minimum_samples`) を
 * 行に残さないと、指標の後出しが起きたかどうかを誰も検証できない。
 * 結果だけを保存すると、結果は残るのに前提が消える。
 */
export const loopRuns = sqliteTable(
  "loop_runs",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    /** ループの種類。正本は domain/analytics/loop-kinds.ts の登録表。 */
    loopKindKey: text("loop_kind_key").notNull(),
    siteSlug: text("site_slug").notNull(),
    baselineSpecId: text("baseline_spec_id").notNull(),
    candidateSpecId: text("candidate_spec_id").notNull(),
    /** 何を変えた比較か。1〜2 件であることは保存のたびに突き当てる。 */
    changedDimensions: text("changed_dimensions", { mode: "json" }).$type<string[]>().notNull(),
    /** 始める前に決めた指標。**1 つだけ。** */
    primaryMetric: text("primary_metric").notNull(),
    minimumSamples: integer("minimum_samples").notNull(),
    status: text("status", { enum: LOOP_RUN_STATUS_VALUES }).notNull(),
    startedAt: integer("started_at", { mode: "timestamp" }),
    concludedAt: integer("concluded_at", { mode: "timestamp" }),
    verdict: text("verdict", { enum: COMPARISON_VERDICT_VALUES }),
    stoppedReason: text("stopped_reason"),
  },
  (t) => [
    index("loop_runs_workspace_site_idx").on(t.workspaceId, t.siteSlug),
    index("loop_runs_workspace_status_idx").on(t.workspaceId, t.status),
  ],
);

/**
 * 1 周ぶんの観測値。
 *
 * **もとの設定と試した設定を必ず両方持つ**（片方だけの行が書けると、
 * 比べる相手がいないまま数字だけある状態になる）。
 *
 * 主キーを (workspace_id, run_id) の組にしてあるのは
 * `llm_credentials` と同じ理由で、**`workspace_id` を書き忘れた問い合わせが
 * そもそも書きにくい**ようにするため。1 周につき 1 行で、観測し直したら上書きする。
 * 上書きすると前の値が消えるので、いつ時点の観測かを `observed_at` に残す。
 */
export const loopObservations = sqliteTable(
  "loop_observations",
  {
    workspaceId: text("workspace_id").notNull(),
    runId: text("run_id").notNull(),
    baselineValue: real("baseline_value").notNull(),
    baselineSamples: integer("baseline_samples").notNull(),
    candidateValue: real("candidate_value").notNull(),
    candidateSamples: integer("candidate_samples").notNull(),
    observedAt: integer("observed_at", { mode: "timestamp" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.runId] })],
);

/**
 * 作業場所（ワークスペース）。課金・権限・データ分離の単位。
 *
 * ここまで全部のテーブルが `workspace_id` を持っているのに、
 * **その `workspace_id` が指す先だけが無かった。** 見本データの中にしか
 * 存在しなかったため、ログインした人をどの作業場所へ入れるかが決められなかった。
 */
export const workspaces = sqliteTable("workspaces", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  plan: text("plan", { enum: ["solo", "team", "business"] })
    .notNull()
    .default("solo"),
  ownerUserId: text("owner_user_id").notNull(),
  timezone: text("timezone").notNull().default("Asia/Tokyo"),
  currency: text("currency").notNull().default("JPY"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  /** 停止。行を消さずに止める。消すと、その作業場所の記録が全部孤児になる。 */
  suspendedAt: integer("suspended_at", { mode: "timestamp" }),
});

/**
 * mutation開始から保存完了までだけ保持する容量リース。
 * 取得は対象実表の件数と有効リース数を同じINSERT文で判定し、並行超過を防ぐ。
 */
export const capacityLeases = sqliteTable(
  "capacity_leases",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    kind: text("kind", { enum: ["brand", "site", "member", "generation"] }).notNull(),
    acquiredAt: integer("acquired_at", { mode: "timestamp" }).notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  },
  (t) => [
    index("capacity_leases_workspace_kind_expiry_idx").on(
      t.workspaceId,
      t.kind,
      t.expiresAt,
    ),
  ],
);

/**
 * ブランド。読者から見た「誰が言っているか」。
 *
 * --- なぜ運営者の表示名と問い合わせ先を列へ出すか ---
 *
 * この 2 つが欠けていると記事を公開できない（`missingPublishReadiness`）。
 * JSON の中に入れると、**公開できないブランドを数えるために全件を開く**ことになる。
 * 「あと何件埋めれば公開できるか」は設定画面がいつも出す数字なので、列で持つ。
 *
 * --- なぜ声（voice）は JSON か ---
 *
 * 一人称・敬体か常体か・使わない言い回しは、どれも一覧の並べ替えにも
 * 絞り込みにも使わない。列へ出すと、言い回しの禁止を 1 つ足すたびに
 * テーブルの形が変わる。
 */
export const brands = sqliteTable(
  "brands",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    displayName: text("display_name").notNull(),
    /** 特定商取引法の表示に使う名前。未設定のまま公開はできない。 */
    legalName: text("legal_name"),
    /** 訂正の連絡先。未設定のまま公開はできない。 */
    contactEmail: text("contact_email"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    brandJson: text("brand_json").notNull(),
  },
  (t) => [index("brands_workspace_idx").on(t.workspaceId)],
);

/**
 * 担当者の登録。**権限の正本はここ 1 か所。**
 *
 * ログインの合言葉の中に権限を書き込まない。書き込むと、担当を外した人の権限が
 * その合言葉が切れるまで残る（`session-actor.ts` 冒頭）。
 *
 * `user_id` は認証基盤（Better Auth）の `user.id` と同じ値を入れる。
 * ただし**外部キーは張らない**。張ると、認証基盤の版を上げてテーブルの形が
 * 変わった日に、業務側のテーブルが道連れになる。
 * つなぎ目は値の一致だけにして、片方だけを差し替えられる状態を保つ。
 *
 * --- 招待はアドレスで書く。`user_id` は後から埋まる ---
 *
 * 初めてログインする人の `user.id` は、ログインするまで存在しない。
 * よって招待の時点で書けるのは**アドレス**だけで、`user_id` は `null` で始まり、
 * 本人が初めて入った瞬間に埋まる（`session-issuer.ts`）。
 *
 * この形にしないと「最初に入った人を自動で管理者にする」ような特例が要る。
 * 特例は認証が入ったあとも残り、後から誰も外せなくなる。
 * **入ってよい人は必ず、入る前に行がある。**
 */
export const memberships = sqliteTable(
  "memberships",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    /** 認証基盤の `user.id`。`null` は「招待済みだが、まだ一度も入っていない」。 */
    userId: text("user_id"),
    /** 招待したアドレス。小文字で入れる。Google が返す値と突き合わせる唯一の手がかり。 */
    invitedEmail: text("invited_email").notNull(),
    roles: text("roles", { mode: "json" }).$type<string[]>().notNull(),
    /** 空配列は「作業場所の全体」。ブランド単位で担当を分けるときだけ入れる。 */
    scopedBrandIds: text("scoped_brand_ids", { mode: "json" })
      .$type<string[]>()
      .notNull(),
    displayName: text("display_name").notNull(),
    invitedAt: integer("invited_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    /** 招待を受けた日。null は「まだ入っていない」。 */
    acceptedAt: integer("accepted_at", { mode: "timestamp" }),
    /** 担当から外した日。行は消さない。消すと過去の操作の記録が誰のものか分からなくなる。 */
    revokedAt: integer("revoked_at", { mode: "timestamp" }),
  },
  (t) => [
    // 同じ人が同じ作業場所に 2 行あると、どちらの役割が効くかが実行順で決まる。
    // 招待はアドレスで一意にする。`user_id` は埋まるまで null なので、こちらが正。
    uniqueIndex("memberships_workspace_email_idx").on(t.workspaceId, t.invitedEmail),
    index("memberships_user_idx").on(t.userId),
  ],
);

/**
 * 断ったログインの試み。
 *
 * **残すのは日時とアドレスと理由だけ。** 合言葉・トークン・Google から返る値は
 * 1 つも残さない。ここに残す目的は「誰かが入ろうとしているか」を後から見ることで、
 * 入れなかった人を再現することではない。
 *
 * 入れた状態（セッション）は作らないので、この表に `session_id` は無い。
 * 「入れないアカウントに、中途半端に途中まで入られる」状態を作らないためである。
 */
export const signinDenials = sqliteTable(
  "signin_denials",
  {
    id: text("id").primaryKey(),
    at: integer("at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    /** 断った相手。Google が本人確認済みとして返したアドレスをそのまま小文字で。 */
    email: text("email").notNull(),
    /**
     * 断った理由。画面には出さない（出すと、どれが登録済みかを教えることになる）。
     *
     * `no_membership` は「アドレスは許可されているが、担当者の登録が無い」。
     * 名簿だけ直して招待を忘れた状態がこれで、他の 2 つと原因も直し方も違う。
     */
    reason: text("reason", {
      enum: ["not_allowed", "email_unverified", "no_membership"],
    }).notNull(),
  },
  (t) => [index("signin_denials_email_idx").on(t.email, t.at)],
);

/**
 * 書き手（§13）。
 *
 * **これは記事の署名（`people`）ではない。** `people` は読者へ名前が出る人物で、
 * こちらは「どの立場・どの文体で書かせるか」という生成の設定である。
 * 1 人の署名に対して書き手の設定が複数あってよいし、その逆もある。
 * 同じ表に混ぜると、署名を消したいだけで生成の設定まで消えることになる。
 *
 * 列の切り方は `site_drafts` と同じ決めごとに従う。
 * **一覧が絞り込みと並べ替えに使うものだけを列にする。**
 * 文体の 6 軸・使ってよい言い回し・事実の範囲は項目が増え続けるので
 * JSON 1 列にまとめる。軸を 1 つ足すたびに保存先の作り直しが要る形にしない。
 */
export const authorPersonas = sqliteTable(
  "author_personas",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    /** 一覧の見出し。並べ替えにも使うので列に出す。 */
    displayName: text("display_name").notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    personaJson: text("persona_json").notNull(),
  },
  (t) => [
    index("author_personas_workspace_name_idx").on(t.workspaceId, t.displayName),
    // 同じ作業場所に同じ名前の書き手が 2 人いると、記事の設定でどちらを
    // 選んだのか画面から判別できない。名前は読者へ出る値ではないので
    // 縛っても運用が詰まらない（読者向けの署名は `people` 側）。
    uniqueIndex("author_personas_workspace_display_name_idx").on(t.workspaceId, t.displayName),
  ],
);

/**
 * 企画（§7.3）。
 *
 * 記事 1 本ではなく、**記事を何本も生む親**。
 * 「どの商品を・どの根拠で・誰が・誰に向けて・何のために・どの購買段階で・
 * どの切り口で」までをここで決め、媒体と長さと CTA は記事（`content_variants`）が持つ。
 *
 * 列の切り方は `author_personas` と同じ決めごとに従う。
 * **一覧が絞り込みと並べ替えに使うものだけを列にする。**
 * 切り口・主張・根拠・生まれた記事の一覧は増え続けるので JSON 1 列にまとめる。
 * とくに `variant_ids` を列にすると、記事を 1 本作るたびに企画の行の作り直しが
 * 要る形になり、記事の追加と企画の編集がぶつかる。
 *
 * `domain_scope` は列に出す。**分野ごとの表現ルール（薬機法・金融・賭博など）を
 * 当てる唯一の手がかり**で、分野で絞って一覧を見る操作が実際に要るため。
 */
export const contentPackages = sqliteTable(
  "content_packages",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    /** 一覧の見出し。この企画で達成したいこと。 */
    objective: text("objective").notNull(),
    /** 進み具合。かんばんの絞り込みに使う。 */
    status: text("status").notNull(),
    /** 記事の分野。表現ルールを選ぶ手がかり。 */
    domainScope: text("domain_scope").notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    packageJson: text("package_json").notNull(),
  },
  (t) => [
    index("content_packages_workspace_status_idx").on(t.workspaceId, t.status),
    // 目的では縛らない。同じ商品について「初心者向け」と「買い替え向け」を
    // 別の企画として立てるとき、目的の文言が似通うのはむしろ普通だから。
    index("content_packages_workspace_updated_idx").on(t.workspaceId, t.updatedAt),
  ],
);

/**
 * 読者像（§14）。
 *
 * 「誰に向けて書くか」。比較表の列（`decisionCriteria`）がここから決まるので、
 * **記事より先に決まっていないと、観点の無い比較表ができる。**
 */
export const audiencePersonas = sqliteTable(
  "audience_personas",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    name: text("name").notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    personaJson: text("persona_json").notNull(),
  },
  (t) => [
    index("audience_personas_workspace_name_idx").on(t.workspaceId, t.name),
    uniqueIndex("audience_personas_workspace_name_unique_idx").on(t.workspaceId, t.name),
  ],
);

/**
 * 順位づけの基準（§17.4）。
 *
 * **報酬の列を置かない。** 報酬額・広告主予算・成果件数の列がここに 1 つでも
 * あると、順位を決める処理からそれが読めてしまう。読めるものは、いつか読まれる。
 * 禁止された指標は `criteria` の中身として domain が断るが、
 * **表の形として持てないようにしておくのが最後の壁**になる。
 *
 * 評価の仕方を変えたら `version` を上げる決まり（domain の不変条件）なので、
 * 同じ `categoryId` に版違いが何本も並ぶ。だから `id` が主キーで、
 * カテゴリーは主キーにしない。
 */
export const rankingModels = sqliteTable(
  "ranking_models",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    /** どの分類の順位か。同じ分類に読者別・版違いが並ぶ。 */
    categoryId: text("category_id").notNull(),
    /** 評価の仕方の版。上げないと過去の順位を再現できなくなる。 */
    version: text("version").notNull(),
    /** 誰向けの順位か。一覧で選ぶ手がかり。 */
    audience: text("audience").notNull(),
    /** いつからの評価か。新しい順に並べるために列へ出す。 */
    effectiveFrom: integer("effective_from", { mode: "timestamp" }).notNull(),
    modelJson: text("model_json").notNull(),
  },
  (t) => [
    index("ranking_models_workspace_effective_idx").on(t.workspaceId, t.effectiveFrom),
    // 同じ分類・同じ読者・同じ版を 2 本持たない。持てると、どちらの順位が
    // 出ているのか画面からも記録からも決められなくなる。
    uniqueIndex("ranking_models_workspace_category_audience_version_unique_idx").on(
      t.workspaceId,
      t.categoryId,
      t.audience,
      t.version,
    ),
  ],
);

/**
 * 商品ごとの採点表（§20.3）。
 *
 * 主キーが（作業場所・評価方法・商品）の 3 つなのは、**同じ商品でも
 * 評価方法が変われば点が変わる**から。商品だけを主キーにすると、
 * 版を上げた瞬間に古い版の順位が再現できなくなる。
 *
 * `evidenceRefs`（根拠）は JSON 側に持つ。根拠を示せない点数は使わない決まりで、
 * 空かどうかは domain が見る。列に出しても増える一方で絞り込みに使わない。
 */
export const scoreCards = sqliteTable(
  "score_cards",
  {
    workspaceId: text("workspace_id").notNull(),
    modelId: text("model_id").notNull(),
    productId: text("product_id").notNull(),
    /** 最後に測った日。読者へ出すので列に置き、古い順に洗い替えできるようにする。 */
    testedAt: integer("tested_at", { mode: "timestamp" }),
    cardJson: text("card_json").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.workspaceId, t.modelId, t.productId] }),
    index("score_cards_workspace_model_idx").on(t.workspaceId, t.modelId),
  ],
);

/**
 * 根拠（§12 Evidence）。
 *
 * **他サイトの本文をここへ丸ごと入れられないようにしてある。**
 * 抜粋の上限は domain（`MAX_EXCERPT_LENGTH`）が断るが、
 * 列の名前を `excerpt_or_summary` にしてあるのは、
 * 保存先を直接触る人にも「全文の置き場ではない」と分かるようにするため。
 *
 * `title` を列に出しているのは探すため。JSON の中だけに置くと、
 * 題名で絞るのに全件を読んで JSON を開くことになる。
 */
export const evidenceRecords = sqliteTable(
  "evidence_records",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    /** 公式資料・検証結果・写真など。何を根拠にしているかで絞る。 */
    type: text("type").notNull(),
    title: text("title").notNull(),
    /** いつ時点の情報か。古い根拠を洗い替えるために列へ出す。 */
    capturedAt: integer("captured_at", { mode: "timestamp" }).notNull(),
    evidenceJson: text("evidence_json").notNull(),
  },
  (t) => [
    index("evidence_records_workspace_captured_idx").on(t.workspaceId, t.capturedAt),
  ],
);

/**
 * 主張（§21.1 / §12 Claim）。
 *
 * **`product_id` は domain の `Claim` に無い列。** どの商品について
 * 言っていることかは保存先の関心事で、主張そのものの成り立ちには関わらない。
 * ここに列として置くのは、商品ページが「この商品について何が言えるか」を
 * 引くのが主な使い道だから。
 *
 * `valid_until` を列に出すのは、期限切れが近いものを探すため。
 * JSON の中だけに置くと、期限の点検に全件を開くことになる。
 */
export const claims = sqliteTable(
  "claims",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    productId: text("product_id").notNull(),
    /** 公式・実測・体験・推論・外部・商業。事実を名乗る種類は根拠が要る。 */
    type: text("type").notNull(),
    /** 未確認・確認済み・却下・期限切れ。確認済みでなければ公開に使えない。 */
    verificationStatus: text("verification_status").notNull(),
    validFrom: integer("valid_from", { mode: "timestamp" }).notNull(),
    validUntil: integer("valid_until", { mode: "timestamp" }),
    claimJson: text("claim_json").notNull(),
  },
  (t) => [
    index("claims_workspace_product_idx").on(t.workspaceId, t.productId),
    // 期限切れが近いものを探す経路。作業場所と期限の 2 列で引く。
    index("claims_workspace_valid_until_idx").on(t.workspaceId, t.validUntil),
  ],
);

/**
 * 検証記録（§12 TestRun）。
 *
 * 「実際に使ってみました」と書けるかどうかは、この記録の有無で決まる。
 * 記録が無いのに体験を名乗る文は、書き手ペルソナの事実境界が止める。
 *
 * `method_version` を列に出すのは、測り方を変えた前後の記録を
 * 混ぜないため。混ざると、比べてはいけない数字が同じ表に並ぶ。
 */
export const testRuns = sqliteTable(
  "test_runs",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    productId: text("product_id").notNull(),
    methodVersion: text("method_version").notNull(),
    startedAt: integer("started_at", { mode: "timestamp" }).notNull(),
    completedAt: integer("completed_at", { mode: "timestamp" }),
    runJson: text("run_json").notNull(),
  },
  (t) => [index("test_runs_workspace_product_idx").on(t.workspaceId, t.productId)],
);

// 運営者ドメイン
export type EvidenceRecordRow = typeof evidenceRecords.$inferSelect;
export type ClaimRow = typeof claims.$inferSelect;
export type TestRunRow = typeof testRuns.$inferSelect;
export type WorkspaceRow = typeof workspaces.$inferSelect;
export type BrandRow = typeof brands.$inferSelect;
export type AuthorPersonaRow = typeof authorPersonas.$inferSelect;
export type AudiencePersonaRow = typeof audiencePersonas.$inferSelect;
export type MembershipRow = typeof memberships.$inferSelect;
export type SigninDenialRow = typeof signinDenials.$inferSelect;
export type Asp = typeof asps.$inferSelect;
export type AffiliateLinkRow = typeof affiliateLinks.$inferSelect;
export type RedirectResolutionRow = typeof redirectResolutions.$inferSelect;
export type ContentPackageRow = typeof contentPackages.$inferSelect;
export type RankingModelRow = typeof rankingModels.$inferSelect;
export type ScoreCardRow = typeof scoreCards.$inferSelect;
export type ContentVariantRow = typeof contentVariants.$inferSelect;
export type CatalogProductRow = typeof catalogProducts.$inferSelect;
export type ChannelConnectionRow = typeof channelConnections.$inferSelect;
export type PublicationRow = typeof publications.$inferSelect;
export type PublicationDeliveryAuditOutboxRow =
  typeof publicationDeliveryAuditOutbox.$inferSelect;
export type SessionRow = typeof sessions.$inferSelect;
export type Program = typeof programs.$inferSelect;
export type Conversion = typeof conversions.$inferSelect;
export type AffiliateConversionRow = typeof affiliateConversions.$inferSelect;
export type AffiliateAccountRow = typeof affiliateAccounts.$inferSelect;
export type AffiliateProgramRow = typeof affiliatePrograms.$inferSelect;
export type LinkIngestionRow = typeof linkIngestions.$inferSelect;
export type LinkIngestionUrlClaimRow = typeof linkIngestionUrlClaims.$inferSelect;
export type FeedbackReportRow = typeof feedbackReports.$inferSelect;
export type IntegrationKeyRow = typeof integrationKeys.$inferSelect;
export type IntegrationKeyUsageRow = typeof integrationKeyUsages.$inferSelect;
export type SiteDraftRow = typeof siteDrafts.$inferSelect;
export type SiteBlueprintRow = typeof siteBlueprints.$inferSelect;
export type PublishedArticleRow = typeof publishedArticles.$inferSelect;
export type TelemetryEventRow = typeof telemetryEvents.$inferSelect;
export type AuditLogRow = typeof auditLogs.$inferSelect;
export type PolicyRuleRow = typeof policyRules.$inferSelect;
export type DisclosureRow = typeof disclosures.$inferSelect;
export type LlmCredentialRow = typeof llmCredentials.$inferSelect;
export type LlmUsageRow = typeof llmUsages.$inferSelect;
export type VariantSpecRow = typeof variantSpecs.$inferSelect;
export type LoopRunRow = typeof loopRuns.$inferSelect;
export type LoopObservationRow = typeof loopObservations.$inferSelect;

// 読者ドメイン
export type Category = typeof categories.$inferSelect;
export type Person = typeof people.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Article = typeof articles.$inferSelect;
export type ArticlePerson = typeof articlePeople.$inferSelect;
export type ArticleProduct = typeof articleProducts.$inferSelect;
export type ConversationBlock = typeof conversationBlocks.$inferSelect;
export type Faq = typeof faqs.$inferSelect;
export type UpdateLog = typeof updateLogs.$inferSelect;


// ---------------------------------------------------------------------------
// ブログ UI ビルダー (feat-blog-ui-builder)
// ---------------------------------------------------------------------------

/**
 * ブログごとのテンプレート選択。
 *
 * テンプレートは**並び方だけ**を決める（`src/domain/authoring/blog-template.ts`）。
 * 記事の中身はテンプレートを知らないので、この行を書き換えても記事は壊れない。
 */
export const blogTemplateSelections = sqliteTable(
  "blog_template",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    siteSlug: text("site_slug").notNull(),
    templateId: text("template_id").notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [uniqueIndex("blog_template_site_idx").on(t.siteSlug)],
);

/**
 * ブログ既定の配色。値は `tokens.css` の `light-dark()` を選ぶ data 属性の
 * 名前であって、色そのものではない（decision-ui-theme-implementation）。
 */
export const blogThemes = sqliteTable(
  "blog_theme",
  {
    id: text("id").primaryKey(),
    siteSlug: text("site_slug").notNull(),
    brandTheme: text("brand_theme").notNull(),
    colorMode: text("color_mode", { enum: ["auto", "light", "dark"] })
      .notNull()
      .default("auto"),
  },
  (t) => [uniqueIndex("blog_theme_site_idx").on(t.siteSlug)],
);

/**
 * ページ単位の配色上書き。行を消すとブログ既定へ戻る（受入条件 2）。
 * 「上書きが無い」状態を NULL 値でなく行の不在で表す。
 */
export const pageThemeOverrides = sqliteTable(
  "page_theme_override",
  {
    id: text("id").primaryKey(),
    siteSlug: text("site_slug").notNull(),
    pagePath: text("page_path").notNull(),
    brandTheme: text("brand_theme"),
    colorMode: text("color_mode", { enum: ["auto", "light", "dark"] }),
  },
  (t) => [uniqueIndex("page_theme_override_site_page_idx").on(t.siteSlug, t.pagePath)],
);

/**
 * ブログ運用の固定ページ8種と、単独の方針文書4種。
 * 前者の語彙は domain/blogops/fixed-page、後者は
 * domain/authoring/site-routes がそれぞれ正本。
 * 1 ブログにつき各 1 枚。draft と削除済みは公開経路から必ず除く。
 * 無いことは「未整備」であって既定文を出さない（見本の文を本物として配らない）。
 *
 * `/admin/sites/[site]/documents` からの固定文書編集も同じ表へ入る。
 * あちらのルート鍵（`SITE_DOCUMENT_KEYS`）は URL のための名前で、
 * この表の名札とは別物なので、repository が写像してから書く
 * （`src/infrastructure/persistence/d1/site-document-repository.ts`）。
 * **名札を 2 系統このまま同居させない。** 同居させると、同じ 1 枚を
 * 2 つの画面が別の行として作り、後から書いたほうが黙って勝つ。
 */
export const legalPages = sqliteTable(
  "legal_page",
  {
    id: text("id").primaryKey(),
    /**
     * 作業場所。`site_slug` から辿れば分かる、では足りない。
     *
     * slug の一意性は `site_blueprints` の索引 1 本が支えているだけで、
     * 作業場所ごとに slug を再利用したくなった日に黙って崩れる。
     * **1 本のクエリが単体で作業場所に絞れること**を、表の側で持つ
     * （`tests/architecture/tenant-scoped-schema.test.ts`）。
     */
    workspaceId: text("workspace_id").notNull().default(""),
    siteSlug: text("site_slug").notNull(),
    kind: text("kind", { enum: LEGAL_PAGE_KIND_VALUES }).notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    status: text("status", { enum: ["draft", "published"] })
      .notNull()
      .default("draft"),
    deletedAt: integer("deleted_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    uniqueIndex("legal_page_site_kind_idx").on(t.siteSlug, t.kind),
    // 作業場所始まり。絞り込みの 1 段目を必ず作業場所にする。
    index("legal_page_workspace_idx").on(t.workspaceId, t.siteSlug, t.kind),
  ],
);

/**
 * ブログ×アフィリエイトの配置管理（どの記事のどの位置に成果リンクが在るか）。
 * 読者向け読み取り経路はこの表を読まない（報酬情報を読者経路に混ぜない）。
 */
export const blogAffiliatePlacements = sqliteTable(
  "blog_affiliate_placement",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    /** legacy行はnullのまま「要確認」として保持する。 */
    affiliateLinkId: text("affiliate_link_id"),
    siteSlug: text("site_slug").notNull(),
    articleSlug: text("article_slug").notNull(),
    blockId: text("block_id"),
    placement: text("placement").notNull(),
    trackingCode: text("tracking_code"),
    status: text("status", { enum: ["active", "removed"] }).notNull().default("active"),
    position: integer("position").notNull().default(0),
    lastRenderedAt: integer("last_rendered_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    index("blog_affiliate_placement_workspace_link_idx").on(
      t.workspaceId,
      t.affiliateLinkId,
      t.status,
    ),
    index("blog_affiliate_placement_workspace_location_idx").on(
      t.workspaceId,
      t.siteSlug,
      t.articleSlug,
      t.blockId,
      t.position,
    ),
  ],
);

/**
 * SEO/AI 検索ガイドラインの参照レジストリ。
 *
 * 海外・日本の出典 URL・発行元・確認日を登録し、確認日から 90 日超は
 * 再確認対象として表示する（`src/domain/seo/guideline-reference.ts`）。
 * 出典そのものの本文は保存しない（古くなった写しを正本に見せない）。
 */
export const guidelineReferences = sqliteTable(
  "guideline_references",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    title: text("title").notNull(),
    url: text("url").notNull(),
    publisher: text("publisher").notNull(),
    region: text("region", { enum: ["global", "jp"] }).notNull(),
    /** YYYY-MM-DD。90 日判定はドメイン関数が行う。 */
    checkedAt: text("checked_at").notNull(),
    /**
     * 原典の本文を取得した時刻（ISO 8601）。null は「まだ取得していない」。
     * 確認日とは別に持つ。要旨だけ読んだ日と、本文を取った時刻は別の事実である。
     */
    sourceFetchedAt: text("source_fetched_at"),
    /** 取得した本文の sha256。null は未取得。 */
    sourceSha256: text("source_sha256"),
    /** 1 つ前の取得の sha256。これと違えば指針が書き換わっている。 */
    previousSourceSha256: text("previous_source_sha256"),
    /** この本文版について仕様の再評価を完了した指紋。再取得だけでは動かさない。 */
    reEvaluatedSha256: text("re_evaluated_sha256"),
    /** 再評価完了を記録した時刻。初回取得の基準値では取得時刻と同じ。 */
    reEvaluatedAt: text("re_evaluated_at"),
    note: text("note"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [index("guideline_references_workspace_idx").on(t.workspaceId)],
);

/**
 * 読者の「気になる商品」。
 *
 * --- 読者を特定しない ---
 * 持つのは `reader_key` だけ。これはブラウザごとに 1 度だけ発行する
 * 意味の無い文字列で、名前も連絡先も持たない。個人を特定できる列を
 * 作らないことが、読者の情報を漏らさないことの唯一の担保になる。
 *
 * --- 報酬の列を作らない ---
 * ここに報酬の列があると、「保存した商品を報酬順に並べる」実装が書けてしまう。
 * 読者が自分で選んで保存したものの並びに、こちらの都合を混ぜない。
 *
 * --- 主キーは 3 つ組 ---
 * 同じ読者が同じ商品を 2 回押しても増えない。押せてしまうだけの操作にしない。
 */
export const readerShortlistItems = sqliteTable(
  "reader_shortlist_items",
  {
    siteSlug: text("site_slug").notNull(),
    /** ブラウザごとの合言葉。個人は特定できない。 */
    readerKey: text("reader_key").notNull(),
    productId: text("product_id").notNull(),
    productName: text("product_name").notNull(),
    /**
     * 読者が「気になる」を押した時刻。型の側は `ShortlistItem.shortlistedAt`。
     * **列名と欄名がずれているのは、改名に migration が要るため据え置いたから。**
     */
    savedAt: text("saved_at").notNull(),
    /** どの記事から保存したか。「なぜ保存したか」を思い出す手がかり。 */
    fromArticleHref: text("from_article_href"),
    oneLine: text("one_line"),
  },
  (t) => [
    primaryKey({ columns: [t.siteSlug, t.readerKey, t.productId] }),
    index("reader_shortlist_items_reader_idx").on(t.siteSlug, t.readerKey),
  ],
);

export type ReaderShortlistItemRow = typeof readerShortlistItems.$inferSelect;

/**
 * 読者向けの「診断・計算」の道具。
 *
 * --- なぜ入力欄と計算式まで保存するのか ---
 * 道具は運営者が増やす。道具 1 つごとに画面とコードを書き足す形にすると、
 * **道具を増やすたびに公開作業が要る**。定義を保存側に置けば、
 * 画面は 1 枚のまま、登録するだけで増える。
 *
 * --- 計算式は文字列だが、実行はしない ---
 * `formula` に入るのは四則演算と入力欄の名前だけの式で、解くのは
 * `src/domain/authoring/reader-tool-formula.ts` の小さな読み取り機である。
 * **`eval` に渡さない。** 渡すと、この列が乗っ取りの入口になる。
 */
export const readerTools = sqliteTable(
  "reader_tools",
  {
    workspaceId: text("workspace_id").notNull(),
    siteSlug: text("site_slug").notNull(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    purpose: text("purpose").notNull(),
    /** 入力欄の並び。`{ key, label, hint?, unit? }` の配列。 */
    inputs: text("inputs", { mode: "json" })
      .notNull()
      .$type<readonly { key: string; label: string; hint?: string; unit?: string }[]>(),
    /** 結果の読み方。数字だけ出して解釈を読者任せにしない。 */
    howToRead: text("how_to_read").notNull(),
    /** `{ rows: [{ label, expression, unit?, decimals?, as? }], summary }`。 */
    formula: text("formula", { mode: "json" })
      .notNull()
      .$type<{
        rows: readonly {
          label: string;
          expression: string;
          unit?: string;
          decimals?: number;
          as?: string;
        }[];
        summary: string;
      }>(),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    primaryKey({ columns: [t.siteSlug, t.slug] }),
    // 読者側は URL の名前しか持たないので site_slug で引く。
    // 運営側（作業場所ごとの一覧）は作業場所で始まる索引で引く。
    // 索引が片方しか無いと、もう片方は全作業場所の行を走ることになる。
    index("reader_tools_site_idx").on(t.siteSlug),
    index("reader_tools_workspace_idx").on(t.workspaceId, t.siteSlug),
  ],
);

export type ReaderToolRow = typeof readerTools.$inferSelect;

/**
 * 読者から届いた問い合わせ。
 *
 * --- なぜ保存するのか ---
 * これまでは「送信先が未設定」として送れなかった。読者には別の連絡先を案内していたが、
 * **案内先が無いサイトでは、書いた文章がどこにも行かずに消えていた。**
 * メールの送信は鍵の登録が要るが、受け取って運営者が読むだけなら保存先だけで足りる。
 *
 * --- 中身は個人情報になりうる ---
 * `body` と `reply_to` には、書いた人が自分の事情を書く。
 * ここは**運営者が読むためだけの場所**で、記録（監査ログ）へは写さない。
 * 読者を追跡する列（閲覧履歴・IP・端末）は持たない。持てば、問い合わせが
 * 「連絡」ではなく「その人を辿る手がかり」になる。
 *
 * 読者は workspace を名乗らない。公開サイトを server-side で引き、
 * その所有 workspace を保存する。slug の再利用規則が変わっても所属を失わない。
 */
export const contactMessages = sqliteTable(
  "contact_messages",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    siteSlug: text("site_slug").notNull(),
    body: text("body").notNull(),
    /** 返信先。書かなくても送れる（意見だけ伝えたい人を締め出さない）。 */
    replyTo: text("reply_to"),
    /** 生のIPを保存せず、送信元ごとの直近回数を数える匿名化済みキー。 */
    rateLimitKey: text("rate_limit_key").notNull(),
    receivedAt: text("received_at").notNull(),
    /** 運営者が読んで対応を終えた日時。未対応は null。 */
    handledAt: text("handled_at"),
  },
  (t) => [
    index("contact_messages_workspace_site_idx").on(
      t.workspaceId,
      t.siteSlug,
      t.receivedAt,
    ),
  ],
);

export type ContactMessageRow = typeof contactMessages.$inferSelect;

export type BlogTemplateSelectionRow = typeof blogTemplateSelections.$inferSelect;
export type BlogThemeRow = typeof blogThemes.$inferSelect;
export type PageThemeOverrideRow = typeof pageThemeOverrides.$inferSelect;
export type LegalPageRow = typeof legalPages.$inferSelect;
export type BlogAffiliatePlacementRow = typeof blogAffiliatePlacements.$inferSelect;
export type GuidelineReferenceRow = typeof guidelineReferences.$inferSelect;

/**
 * 認証基盤（Better Auth）が使うテーブル。
 *
 * **中身を手で書かない。** 形は Better Auth の CLI が出したものを
 * `auth-schema.ts` へそのまま置いてある（`src/auth.cli.ts` の冒頭に手順）。
 * ここから出しているのは、マイグレーションの生成が
 * `src/db/schema.ts` だけを見ているためである。
 * 出し忘れると、テーブルが本番に作られないままログインだけが動く形になる。
 */

/* ------------------------------------------------------------------ *
 * ブログ運用 (feat-blog-ops-crud) — migration 0023
 *
 * 抽象ブループリント `review-media-classic` (docs/spec/13) の
 * サイト網・レイアウト枠・記事・タグ・配信部品・閲覧者評価。
 *
 * 記事本体は既存 `articles` を編集正本とし、ブログ固有の所属・型・削除状態も
 * そこに保存する。以下の表はサイト網・版面・記事子要素など、
 * `articles` と意味の異なる集約だけを持つ。
 * ------------------------------------------------------------------ */

/** サイト網の節点 (ハブ / サブサイト / ミニサイト)。 */
export const siteNetworkNodes = sqliteTable(
  "site_network_node",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    siteSlug: text("site_slug").notNull(),
    role: text("role", { enum: NETWORK_ROLES }).notNull(),
    /** 上位の URL 名。ハブは null。 */
    parentSlug: text("parent_slug"),
    name: text("name").notNull(),
    oneLine: text("one_line").notNull().default(""),
    position: integer("position").notNull().default(0),
    status: text("status", { enum: NETWORK_STATUSES }).notNull().default("active"),
    /** null は通常、日時ありは削除済み。hidden は公開可否なので代用しない。 */
    deletedAt: integer("deleted_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    uniqueIndex("site_network_node_ws_slug_idx").on(t.workspaceId, t.siteSlug),
    index("site_network_node_parent_idx").on(t.workspaceId, t.parentSlug),
  ],
);

/** ヘッダー・サイドバー・フッターの枠 (§3.1 / §3.4 / §3.5)。 */
export const blogLayoutSlots = sqliteTable(
  "blog_layout_slot",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    siteSlug: text("site_slug").notNull(),
    region: text("region", { enum: LAYOUT_REGIONS }).notNull(),
    /** docs/spec/13 §3 の部品 id。 */
    slotKey: text("slot_key").notNull(),
    title: text("title").notNull().default(""),
    body: text("body").notNull().default(""),
    position: integer("position").notNull().default(0),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  },
  (t) => [
    uniqueIndex("blog_layout_slot_unique_idx").on(t.workspaceId, t.siteSlug, t.region, t.slotKey),
  ],
);

/** ハブトップの 4 帯 (§3.2)。 */
export const blogLayoutBands = sqliteTable(
  "blog_layout_band",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    siteSlug: text("site_slug").notNull(),
    band: text("band", { enum: TOP_BANDS }).notNull(),
    title: text("title").notNull().default(""),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    position: integer("position").notNull().default(0),
    itemLimit: integer("item_limit").notNull().default(3),
  },
  (t) => [uniqueIndex("blog_layout_band_unique_idx").on(t.workspaceId, t.siteSlug, t.band)],
);

/** 記事本文の部品列 (§3.3)。 */
export const blogArticleBlocks = sqliteTable(
  "blog_article_block",
  {
    id: text("id").primaryKey(),
    /** 親記事の作業場所の写し。子表だけを読む 1 本でも他所の行に触れない。 */
    workspaceId: text("workspace_id").notNull().default(""),
    articleId: text("article_id").notNull(),
    kind: text("kind", { enum: ARTICLE_BLOCK_KINDS }).notNull(),
    heading: text("heading").notNull().default(""),
    body: text("body").notNull().default(""),
    position: integer("position").notNull().default(0),
  },
  (t) => [
    index("blog_article_block_article_idx").on(t.articleId, t.position),
    index("blog_article_block_workspace_idx").on(t.workspaceId, t.articleId, t.position),
  ],
);

/** ブランドタグ (§3.4 の brand-tag-cloud)。 */
export const blogTags = sqliteTable(
  "blog_tag",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    siteSlug: text("site_slug").notNull(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    /**
     * ブランドか、話題か。`brand-tag-cloud` に出るのは `brand` だけ。
     *
     * **既定は `topic`。**種類を足す前からあるタグはどちらとも分からないので、
     * 枠が「これは作り手だ」と嘘を言わない側へ倒す (`domain/blogops/blog-tag.ts`)。
     */
    kind: text("kind", { enum: BLOG_TAG_KINDS }).notNull().default("topic"),
  },
  (t) => [uniqueIndex("blog_tag_site_slug_idx").on(t.workspaceId, t.siteSlug, t.slug)],
);

/** 記事とタグの結び付き。 */
export const blogArticleTags = sqliteTable(
  "blog_article_tag",
  {
    /** 親記事の作業場所の写し。結び付きだけを数える 1 本でも作業場所で切れる。 */
    workspaceId: text("workspace_id").notNull().default(""),
    articleId: text("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => blogTags.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.articleId, t.tagId] }),
    index("blog_article_tag_workspace_idx").on(t.workspaceId, t.articleId),
  ],
);

/** 配信部品 9 種 (§6)。 */
export const blogDeliveryParts = sqliteTable(
  "blog_delivery_part",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    siteSlug: text("site_slug").notNull(),
    part: text("part", { enum: DELIVERY_PARTS }).notNull(),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    note: text("note").notNull().default(""),
    position: integer("position").notNull().default(0),
  },
  (t) => [uniqueIndex("blog_delivery_part_unique_idx").on(t.workspaceId, t.siteSlug, t.part)],
);

/**
 * 配信物の点検記録 (受入 A9)。
 *
 * **設定 (`blog_delivery_part`) とは別の表にする。**設定は「出す / 切る」の意思、
 * こちらは「生成してみたら出たか」の事実である。1 つの表に畳むと、
 * 設定を直した拍子に事実が上書きされ、**いつの結果なのかが分からなくなる。**
 *
 * 行は積む (履歴)。同じ部品の最新だけを一覧が採る (`deliveryHealth`)。
 * 上書きにすると「先週までは出ていた」が消え、いつ壊れたかを誰も言えなくなる。
 */
export const blogDeliverySnapshots = sqliteTable(
  "blog_delivery_snapshot",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    siteSlug: text("site_slug").notNull(),
    part: text("part", { enum: DELIVERY_PARTS }).notNull(),
    ok: integer("ok", { mode: "boolean" }).notNull(),
    detail: text("detail").notNull().default(""),
    checkedAt: integer("checked_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [index("blog_delivery_snapshot_site_idx").on(t.workspaceId, t.siteSlug, t.part)],
);

/**
 * 閲覧者の評価。
 *
 * 読者に作業場所は無い。それでも `workspace_id` を持つのは、**書いた人の所属**
 * ではなく**票が属する記事の所属**を写しているからである。運営者が自分の作業場所の
 * 票だけを集計するとき、この列が無いと必ず `articles` を join することになり、
 * join を 1 度忘れた日に他所の票が混ざる。
 * reader_key は cookie 由来の不透明な鍵で、個人を特定する値は入れない。
 */
export const blogArticleRatings = sqliteTable(
  "blog_article_rating",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull().default(""),
    articleId: text("article_id").notNull(),
    readerKey: text("reader_key").notNull(),
    score: integer("score").notNull(),
    comment: text("comment"),
    /**
     * 運営者が伏せた票。**消さずに伏せる。**
     *
     * 消すと「伏せた」と「最初から無かった」が同じ形になり、
     * 伏せた判断そのものを後から確かめられなくなる。伏せた票は
     * 平均にも件数にも入らないが、行としては残り、監査の記録から辿れる。
     */
    hidden: integer("hidden", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    uniqueIndex("blog_article_rating_reader_idx").on(t.articleId, t.readerKey),
    index("blog_article_rating_workspace_idx").on(t.workspaceId, t.articleId),
  ],
);

export type SiteNetworkNodeRow = typeof siteNetworkNodes.$inferSelect;
export type BlogLayoutSlotRow = typeof blogLayoutSlots.$inferSelect;
export type BlogLayoutBandRow = typeof blogLayoutBands.$inferSelect;
export type BlogArticleRow = typeof articles.$inferSelect;
export type BlogArticleBlockRow = typeof blogArticleBlocks.$inferSelect;
export type BlogTagRow = typeof blogTags.$inferSelect;
export type BlogArticleTagRow = typeof blogArticleTags.$inferSelect;
export type BlogDeliveryPartRow = typeof blogDeliveryParts.$inferSelect;
export type BlogArticleRatingRow = typeof blogArticleRatings.$inferSelect;

export * from "./auth-schema";
