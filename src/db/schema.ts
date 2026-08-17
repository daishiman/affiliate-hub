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

// 運営者ドメイン
export type Asp = typeof asps.$inferSelect;
export type ChannelConnectionRow = typeof channelConnections.$inferSelect;
export type PublicationRow = typeof publications.$inferSelect;
export type SessionRow = typeof sessions.$inferSelect;
export type Program = typeof programs.$inferSelect;
export type Conversion = typeof conversions.$inferSelect;
export type LinkIngestionRow = typeof linkIngestions.$inferSelect;
export type FeedbackReportRow = typeof feedbackReports.$inferSelect;
export type IntegrationKeyRow = typeof integrationKeys.$inferSelect;
export type IntegrationKeyUsageRow = typeof integrationKeyUsages.$inferSelect;
export type SiteDraftRow = typeof siteDrafts.$inferSelect;
export type SiteBlueprintRow = typeof siteBlueprints.$inferSelect;
export type TelemetryEventRow = typeof telemetryEvents.$inferSelect;

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
