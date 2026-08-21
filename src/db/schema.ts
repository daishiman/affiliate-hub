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
  COMPLIANCE_STATUSES,
  CONTENT_ANGLES,
  CONTENT_STATES,
  CONTENT_VARIANT_STATUSES,
  CTA_TYPES,
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
export const disclosures = sqliteTable("disclosures", {
  id: text("id").primaryKey(),
  relationshipType: text("relationship_type", {
    enum: ["affiliate", "sponsored", "supplied", "loaned", "purchased"],
  }).notNull(),
  advertiserOrSupplier: text("advertiser_or_supplier"),
  editorialInfluence: text("editorial_influence", {
    enum: ["none", "limited", "declared"],
  })
    .notNull()
    .default("none"),
  // 読者に実際に表示する文言。§17.1 が要求する「判別できる表現」。
  visibleMessage: text("visible_message").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

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
    slug: text("slug").notNull().unique(),
    type: text("type", {
      enum: ["ranking", "review", "comparison", "guide", "tool"],
    }).notNull(),
    title: text("title").notNull(),
    // 一文の結論 (§8)。要約ではなく結論を書く。
    summary: text("summary"),
    status: text("status", { enum: ["draft", "review", "published", "archived"] })
      .notNull()
      .default("draft"),
    categoryId: text("category_id").references(() => categories.id, { onDelete: "set null" }),
    disclosureId: text("disclosure_id").references(() => disclosures.id, {
      onDelete: "restrict",
    }),
    /**
     * 更新責任者。§28 運用 C1「更新責任者が存在」を満たすために持つ。
     * 仕様書 §12 には無いフィールドだが、完了条件側が要求している。
     */
    ownerId: text("owner_id").references(() => people.id, { onDelete: "restrict" }),
    publishedAt: integer("published_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
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
 * 同時に 2 人が同じ URL を入れたときは、どちらも重複の印が付かないまま
 * 2 行入る。受信箱は重複を持てる作りなので、これは表示上の取りこぼしであって
 * データの破損ではない。残課題として記録してある。
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
 * 作り直しは**上書き**として扱うので、2 回目が永久に通らない失敗にはならない。
 */
export const siteBlueprints = sqliteTable(
  "site_blueprints",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
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
    index("site_blueprints_workspace_idx").on(t.workspaceId),
  ],
);

/**
 * 読者ページへ出した記事（そのとき出した内容の**写し**）。
 *
 * すでにある `articles` 表とは別に置く。あちらは分類・人物・広告表記を
 * 別表への参照で持つ形で、参照先を作る入口がまだ無い（作れない行になっている）。
 * こちらは**出した瞬間の内容をそのまま**保存する。
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
    articleJson: text("article_json").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.siteSlug, t.slug] }),
    index("published_articles_site_category_idx").on(t.siteSlug, t.categorySlug),
    index("published_articles_site_updated_idx").on(t.siteSlug, t.updatedAt),
    index("published_articles_site_author_idx").on(t.siteSlug, t.authorSlug),
    index("published_articles_workspace_idx").on(t.workspaceId),
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
    occurredAt: integer("occurred_at", { mode: "timestamp" }).notNull(),
  },
  (t) => [
    // 「この記事に何が起きたか」を引く索引。無いと全件走査になる。
    index("audit_logs_workspace_target_idx").on(t.workspaceId, t.targetType, t.targetId),
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
 * 行を作る入口（各サービスとの接続）は、利用者ご自身がブラウザで
 * 認証するものなのでまだ無い。表と読み書きは、入口が付いた日に
 * そのまま使える形で先に用意してある（`sessions` と同じ考え方）。
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
    /** 保管先の名前。**値ではない。** */
    credentialRef: text("credential_ref").notNull(),
  },
  (t) => [index("channel_connections_workspace_kind_idx").on(t.workspaceId, t.kind)],
);

/**
 * 配信（いつ・どこへ出すか、と出した結果）。
 *
 * **`idempotency_key` に一意制約を付けない。** 同じ記事・同じ先・同じ日時を
 * 二度登録したときに断るのは配信のユースケース側の仕事で、そこは
 * 「作らずに、すでにある 1 件を返す」という成功で応じる。保存先が
 * 一意制約で弾くと、その応答が**やり直しても永久に通らない失敗**になる
 * （受信箱で実際にその形になった。`link_ingestions` の注記を参照）。
 * 代わりに索引を張って、探す側を速くする。
 */
export const publications = sqliteTable(
  "publications",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    variantId: text("variant_id").notNull(),
    kind: text("kind", { enum: CHANNEL_KIND_VALUES }).notNull(),
    /** 出し先の接続。書き出し（note）だけは接続を持たないので null。 */
    connectionId: text("connection_id"),
    /** 状態。正本は domain/distribution/publication.ts の `PUBLICATION_STATES`。 */
    state: text("state", { enum: PUBLICATION_STATE_VALUES }).notNull(),
    /** 予約時刻。null は即時。 */
    scheduledAt: integer("scheduled_at", { mode: "timestamp" }),
    idempotencyKey: text("idempotency_key").notNull(),
    attempts: integer("attempts").notNull().default(0),
    externalId: text("external_id"),
    externalUrl: text("external_url"),
    lastError: text("last_error"),
    publishedAt: integer("published_at", { mode: "timestamp" }),
  },
  (t) => [
    index("publications_workspace_variant_idx").on(t.workspaceId, t.variantId),
    index("publications_workspace_idempotency_idx").on(t.workspaceId, t.idempotencyKey),
    // 予約の時間が来たものを拾う索引。無いと、送る側が毎回全件を読む。
    index("publications_state_scheduled_idx").on(t.state, t.scheduledAt),
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
 * 記事（媒体別の文章）1 本。
 *
 * **進行の現在地（`state`）を同じ行に持つ。** 別表にすると、記事を消したのに
 * 現在地だけが残る、あるいはその逆が起こり、かんばんに本文の無い札が並ぶ。
 * 一方で業務の型（`ContentVariant`）には入れていない。あれは AI の出力契約で、
 * AI が文章を返しただけで段階が進んだことにはならないため。
 *
 * 企画（content_packages）と書き手（personas）はまだ表を作っていない。
 * **作る入口がどこにも無いから**で、入口の無い表を先に作ると、
 * 一生埋まらない空の一覧が画面に増える。
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
    occurredAt: integer("occurred_at", { mode: "timestamp" }).notNull(),
  },
  (t) => [
    index("llm_usages_workspace_occurred_idx").on(t.workspaceId, t.occurredAt),
    index("llm_usages_workspace_provider_idx").on(t.workspaceId, t.providerId, t.occurredAt),
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

// 運営者ドメイン
export type WorkspaceRow = typeof workspaces.$inferSelect;
export type MembershipRow = typeof memberships.$inferSelect;
export type SigninDenialRow = typeof signinDenials.$inferSelect;
export type Asp = typeof asps.$inferSelect;
export type RedirectResolutionRow = typeof redirectResolutions.$inferSelect;
export type ContentVariantRow = typeof contentVariants.$inferSelect;
export type ChannelConnectionRow = typeof channelConnections.$inferSelect;
export type PublicationRow = typeof publications.$inferSelect;
export type SessionRow = typeof sessions.$inferSelect;
export type Program = typeof programs.$inferSelect;
export type Conversion = typeof conversions.$inferSelect;
export type AffiliateConversionRow = typeof affiliateConversions.$inferSelect;
export type LinkIngestionRow = typeof linkIngestions.$inferSelect;
export type FeedbackReportRow = typeof feedbackReports.$inferSelect;
export type IntegrationKeyRow = typeof integrationKeys.$inferSelect;
export type IntegrationKeyUsageRow = typeof integrationKeyUsages.$inferSelect;
export type SiteDraftRow = typeof siteDrafts.$inferSelect;
export type SiteBlueprintRow = typeof siteBlueprints.$inferSelect;
export type PublishedArticleRow = typeof publishedArticles.$inferSelect;
export type TelemetryEventRow = typeof telemetryEvents.$inferSelect;
export type AuditLogRow = typeof auditLogs.$inferSelect;
export type LlmCredentialRow = typeof llmCredentials.$inferSelect;
export type LlmUsageRow = typeof llmUsages.$inferSelect;
export type VariantSpecRow = typeof variantSpecs.$inferSelect;
export type LoopRunRow = typeof loopRuns.$inferSelect;
export type LoopObservationRow = typeof loopObservations.$inferSelect;

// 読者ドメイン
export type Category = typeof categories.$inferSelect;
export type Person = typeof people.$inferSelect;
export type Disclosure = typeof disclosures.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Article = typeof articles.$inferSelect;
export type ArticlePerson = typeof articlePeople.$inferSelect;
export type ArticleProduct = typeof articleProducts.$inferSelect;
export type ConversationBlock = typeof conversationBlocks.$inferSelect;
export type Faq = typeof faqs.$inferSelect;
export type UpdateLog = typeof updateLogs.$inferSelect;

/**
 * 認証基盤（Better Auth）が使うテーブル。
 *
 * **中身を手で書かない。** 形は Better Auth の CLI が出したものを
 * `auth-schema.ts` へそのまま置いてある（`src/auth.cli.ts` の冒頭に手順）。
 * ここから出しているのは、マイグレーションの生成が
 * `src/db/schema.ts` だけを見ているためである。
 * 出し忘れると、テーブルが本番に作られないままログインだけが動く形になる。
 */
export * from "./auth-schema";
