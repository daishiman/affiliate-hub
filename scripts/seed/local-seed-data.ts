/**
 * ローカルで画面を触るための見本データ（**開発機の D1 だけ**）。
 *
 * ここは「作る値」だけを持ち、当てる手順は `scripts/seed-local.ts` が持つ。
 * 分けてあるのは、**値をテストから読めるようにする**ため。
 * 手順と混ぜると、取り込むだけで `wrangler` が走るファイルになる。
 *
 * 決めごと 3 つ。
 *   1. 参考サイト由来の文章・固有名・色値は 1 つも書かない（`check:reference-reuse` の対象）。
 *   2. 作業場所は見本と同じ `ws_sample`。別 ID にすると、既にある見本の
 *      画面と、ここで入れた行が別々の作業場所に分かれて見える。
 *   3. ブログの URL 名は見本のブログ（`video-editing-gear`）に合わせる。
 *      読者側の設計図は見本が持っているので、ここで新しい名前を作ると
 *      `/s/<名前>` が 404 になる。
 */
import {
  ARTICLE_BLOCK_KINDS,
  ARTICLE_TYPE_BY_TEMPLATE,
  DELIVERY_PARTS,
  FIXED_PAGE_KINDS,
  FIXED_PAGE_LABEL,
  type FixedPageKind,
  REQUIRED_BLOCKS,
  SIDEBAR_SLOT_KEYS,
  SIDEBAR_STICKY_SLOT_KEYS,
  TOP_BANDS,
} from "@/domain/blogops";
import { BLOG_OPS_SAMPLE_ROUTE_IDS } from "@/infrastructure/persistence/sample/blog-ops-sample-repository";

/** 見本の作業場所。`SAMPLE_WORKSPACE_ID` と同じ値であることを検査が見る。 */
export const SEED_WORKSPACE_ID = "ws_sample";
/** ログインに使う人。**この人だけが入れる。** */
export const SEED_USER_ID = "usr_local_owner";
export const SEED_USER_EMAIL = "owner@local.test";
export const SEED_USER_NAME = "ローカル検証用の担当者";
/** 見本のブログ。読者側の設計図を見本が持っている 2 本。 */
export const SEED_HUB_SLUG = "video-editing-gear";
export const SEED_SUB_SLUG = "gear-for-small-kitchen";

/** SQLite の文字列。`'` を 2 つ重ねる以外の細工をしない。 */
function q(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function seconds(daysAgo: number, base: number): number {
  return base - daysAgo * 24 * 60 * 60;
}

type Article = {
  readonly id: string;
  readonly slug: string;
  readonly template: "T1" | "T2" | "T3" | "T4";
  readonly title: string;
  readonly lead: string;
  readonly status: "draft" | "review" | "published" | "archived";
  readonly daysAgo: number;
  /** 必須部品のうち、わざと入れないもの。空なら全部入れる。 */
  readonly missing: readonly string[];
  readonly ratings: readonly number[];
};

/**
 * E2E が名指しで開く記事の URL 名。
 *
 * **spec 側に文字列を書き写させないために出している。** 書き写すと、
 * ここの値を変えた日に E2E だけが静かに 404 を踏む。2026-08-26 に実際そうなった
 * （spec が `editing-monitor-picks` を手で持っていた）。
 */
export const SEED_ARTICLE_SLUGS = {
  /** 公開済み。読者側に出て、点を付けられる。見本と同じ記事。 */
  published: BLOG_OPS_SAMPLE_ROUTE_IDS.articleSlug,
  /** 下書き。読者側に出てはいけない。 */
  draft: "storage-for-4k-footage",
} as const;

/**
 * 記事は 4 本。**わざと 4 通りの状態を作る。**
 *   - 揃っている公開記事（新しい）
 *   - 部品が 1 つ欠けた下書き（公開しようとすると断られる）
 *   - 古い公開記事（鮮度が「見直し時期」になる）
 *   - 票が 4 件しかない公開記事（目安が出ない側の境目）
 */
const ARTICLES: readonly Article[] = [
  {
    /*
     * **1 本目だけは見本（D1 が無いときの代役）と同じ記事にしてある。**
     *
     * 代役と本物が別の記事を語っていると、見本で描く vitest は緑のまま、
     * 本物の通信で開く E2E だけが 404 になる。2026-08-26 に実際そうなった
     * （`/s/<ブログ>/blog/starter-kit-2026` が本番相当の環境に無かった）。
     * URL 名は `BLOG_OPS_SAMPLE_ROUTE_IDS` から取り、手で書き写さない。
     */
    id: "ba_sample_starter_kit",
    slug: BLOG_OPS_SAMPLE_ROUTE_IDS.articleSlug,
    template: "T1",
    title: "はじめての編集机まわり おすすめ 5 選",
    lead: "予算・置き場所・音の 3 点で絞り込み、迷いどころを先に片づけます。",
    status: "published",
    daysAgo: 3,
    missing: [],
    ratings: [5, 4, 5, 4, 5, 3],
  },
  {
    id: "ba_seed_draft",
    slug: SEED_ARTICLE_SLUGS.draft,
    template: "T2",
    title: "4K 素材の置き場所をどう決めるか",
    lead: "速さと容量のどちらを先に決めるかで、置き場所は変わります。",
    status: "draft",
    daysAgo: 1,
    missing: ["editor-credential-box"],
    ratings: [],
  },
  {
    id: "ba_seed_stale",
    slug: "color-calibration-basics",
    template: "T3",
    title: "色合わせの手順を、道具を増やさずに始める",
    lead: "まず今ある画面で測ってから、足りないものを足します。",
    status: "published",
    daysAgo: 400,
    missing: [],
    ratings: [3, 2, 4, 3, 5],
  },
  {
    id: "ba_seed_fewvotes",
    slug: "quiet-workspace-setup",
    template: "T4",
    title: "録音しながら編集できる机の作り方",
    lead: "音の出るものを机から離すだけで、録り直しが減ります。",
    status: "published",
    daysAgo: 20,
    missing: [],
    ratings: [5, 4, 4, 5],
  },
];

/**
 * タグ。**`kind` を書かないと全部 `topic` になる**（列の既定値）。
 *
 * `brand-tag-cloud` に出るのは `brand` だけなので、種類を書かない見本を入れると
 * **枠は正しいのに 1 件も出ない**という、いちばん気づきにくい形で画面が空になる。
 * 作り手の名前は**架空のもの**を置く（決めごと 1: 参考サイト由来の固有名は書かない）。
 */
const TAGS = [
  { id: "bt_seed_display", slug: "display", name: "画面まわり", note: "モニター・色・明るさ", kind: "topic" },
  { id: "bt_seed_storage", slug: "storage", name: "保存まわり", note: "外付け・速さ・容量", kind: "topic" },
  { id: "bt_seed_audio", slug: "audio", name: "音まわり", note: "録音・机・静かさ", kind: "topic" },
  { id: "bt_seed_brand_a", slug: "mihondo", name: "見本堂", note: "架空の作り手。ブランド絞り込みの見本。", kind: "brand" },
  { id: "bt_seed_brand_b", slug: "shisaku-lab", name: "試作ラボ", note: "架空の作り手。ブランド絞り込みの見本。", kind: "brand" },
] as const;

/**
 * サイドバーの枠の中身。
 *
 * **本文が要る枠と、要らない枠がある。**「探す」「カテゴリー」「ブランド」は
 * いまのデータから作るので空でも出るが、それ以外は**運営者が書いた本文が
 * 無いと枠ごと出ない**（`presentation/site/blog-sidebar.tsx`）。空のまま配ると
 * 「実装されていない」と読めてしまうので、見本には書いた状態を入れておく。
 *
 * `custom-html-slot-*` は**保存の直前に削られた形**（`sanitizeSlotHtml` が通す
 * タグだけ）を直に入れる。ここは保存経路を通らないので、通る形を手で守る。
 */
const SIDEBAR_SLOT_BODY: Readonly<Record<string, string>> = {
  "profile-card": "道具を実際に買って、使ってから書いています。\n\n合わないと思ったものは、合わない理由まで書きます。",
  "quick-link-menu": "はじめての人向けのまとめ\n\n買い替えの目安\n\n返品・保証の調べ方",
  "recent-comments": "「音まわりの記事、机の位置まで書いてあって助かりました」\n\n「保存の話、容量より速さという結論が意外でした」",
  "custom-html-slot-upper":
    "<p>この場所は運営者が自由に書ける枠です。</p><ul><li>お知らせ</li><li>期間限定の案内</li></ul>",
  "custom-html-slot-lower":
    "<p>枠の下側。<strong>貼った HTML は保存の直前に削られます。</strong></p>",
};

/** 追従する枠の中身。上と同じ理由で、書いた状態を入れておく。 */
const SIDEBAR_STICKY_SLOT_BODY: Readonly<Record<string, string>> = {
  "sticky-promo-slot": "巻いても付いてくる枠です。案内をここに置きます。",
  "sticky-toc": "長い記事では、ここに見出しの一覧を出します。",
};

const LEGAL_PAGE_BODY: Readonly<Record<FixedPageKind, string>> = {
  profile: "この場所を運営している人と、判断のしかたを書きます。",
  sitemap: "扱っている題目と固定ページへの入り口を並べます。",
  site_policy: "何を選び、何を選ばないかの基準を書きます。",
  privacy_policy: "受け取る情報と、その使い道を書きます。",
  commercial_transaction: "法で求められる表示をまとめます。",
  contact: "連絡の方法と、返事までの目安を書きます。",
  review_guidelines: "比較・試用・確認の基準と、利益関係の扱いを書きます。",
  company: "運営する組織の名前と連絡先を書きます。",
};

const LEGAL_PAGES = FIXED_PAGE_KINDS.map(
  (kind) => [kind, FIXED_PAGE_LABEL[kind], LEGAL_PAGE_BODY[kind]] as const,
);

/**
 * 当てる SQL を組み立てる。
 *
 * **同じものを 2 度当てても増えない**ようにするため、入れる前に
 * 種として入れた行だけを消す。消す範囲を作業場所とブログの URL 名で
 * 縛っているので、手で作った行は巻き込まない。
 */
export function buildSeedSql(nowSeconds: number): readonly string[] {
  const ws = q(SEED_WORKSPACE_ID);
  const hub = q(SEED_HUB_SLUG);
  const sub = q(SEED_SUB_SLUG);
  const out: string[] = [];

  out.push(
    `DELETE FROM blog_article_rating WHERE article_id IN (SELECT id FROM articles WHERE workspace_id = ${ws});`,
    `DELETE FROM blog_article_tag WHERE article_id IN (SELECT id FROM articles WHERE workspace_id = ${ws});`,
    `DELETE FROM blog_article_block WHERE article_id IN (SELECT id FROM articles WHERE workspace_id = ${ws});`,
    `DELETE FROM articles WHERE workspace_id = ${ws};`,
    `DELETE FROM blog_tag WHERE workspace_id = ${ws};`,
    `DELETE FROM blog_layout_slot WHERE workspace_id = ${ws};`,
    `DELETE FROM blog_layout_band WHERE workspace_id = ${ws};`,
    `DELETE FROM blog_delivery_part WHERE workspace_id = ${ws};`,
    `DELETE FROM site_network_node WHERE workspace_id = ${ws};`,
    `DELETE FROM legal_page WHERE site_slug IN (${hub}, ${sub});`,
  );

  // 入口（作業場所・担当者・認証基盤の人）。担当の行が無いと通行証が出ない。
  out.push(
    `INSERT INTO workspaces (id, name, plan, owner_user_id, timezone, currency, created_at)
       VALUES (${ws}, ${q("ローカル検証")}, 'solo', ${q(SEED_USER_ID)}, 'Asia/Tokyo', 'JPY', ${nowSeconds})
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, owner_user_id = excluded.owner_user_id;`,
    `INSERT INTO user (id, name, email, email_verified, image, created_at, updated_at)
       VALUES (${q(SEED_USER_ID)}, ${q(SEED_USER_NAME)}, ${q(SEED_USER_EMAIL)}, 1, NULL, ${nowSeconds * 1000}, ${nowSeconds * 1000})
       ON CONFLICT(id) DO UPDATE SET email = excluded.email, name = excluded.name;`,
    `INSERT INTO memberships (id, workspace_id, user_id, invited_email, roles, scoped_brand_ids, display_name, invited_at, accepted_at, revoked_at)
       VALUES (${q("mb_seed_owner")}, ${ws}, ${q(SEED_USER_ID)}, ${q(SEED_USER_EMAIL)}, ${q('["owner"]')}, ${q("[]")}, ${q(SEED_USER_NAME)}, ${nowSeconds}, ${nowSeconds}, NULL)
       ON CONFLICT(id) DO UPDATE SET user_id = excluded.user_id, roles = excluded.roles, revoked_at = NULL;`,
  );

  // サイト網。中心 1 本と子 1 本。親を持たない中心が 1 本だけであること自体が見本になる。
  out.push(
    `INSERT INTO site_network_node (id, workspace_id, site_slug, role, parent_slug, name, one_line, position, status, created_at, updated_at)
       VALUES (${q("sn_seed_hub")}, ${ws}, ${hub}, 'hub', NULL, ${q("編集の道具")}, ${q("道具選びの入口をここに集めます。")}, 0, 'active', ${nowSeconds}, ${nowSeconds});`,
    `INSERT INTO site_network_node (id, workspace_id, site_slug, role, parent_slug, name, one_line, position, status, created_at, updated_at)
       VALUES (${q("sn_seed_sub")}, ${ws}, ${sub}, 'sub', ${hub}, ${q("台所まわりの道具")}, ${q("中心から分けた、狭い題目のほう。")}, 1, 'active', ${nowSeconds}, ${nowSeconds});`,
  );

  // 版面。サイドバーの通常枠 8 種を全部置く（設計図の数を画面が減らせないことを見るため）。
  SIDEBAR_SLOT_KEYS.forEach((slotKey, index) => {
    out.push(
      `INSERT INTO blog_layout_slot (id, workspace_id, site_slug, region, slot_key, title, body, position, enabled)
         VALUES (${q(`ls_seed_${slotKey}`)}, ${ws}, ${hub}, 'sidebar', ${q(slotKey)}, ${q("")}, ${q(SIDEBAR_SLOT_BODY[slotKey] ?? "")}, ${index}, 1);`,
    );
  });
  // 追従する枠。**行が無いと枠ごと出ない**ので、見本にも 2 種とも置く。
  SIDEBAR_STICKY_SLOT_KEYS.forEach((slotKey, index) => {
    out.push(
      `INSERT INTO blog_layout_slot (id, workspace_id, site_slug, region, slot_key, title, body, position, enabled)
         VALUES (${q(`ls_seed_${slotKey}`)}, ${ws}, ${hub}, 'sidebar_sticky', ${q(slotKey)}, ${q("")}, ${q(SIDEBAR_STICKY_SLOT_BODY[slotKey] ?? "")}, ${index}, 1);`,
    );
  });
  out.push(
    `INSERT INTO blog_layout_slot (id, workspace_id, site_slug, region, slot_key, title, body, position, enabled)
       VALUES (${q("ls_seed_header_brand")}, ${ws}, ${hub}, 'header', ${q("header-brand")}, ${q("編集の道具")}, ${q("")}, 0, 1);`,
    `INSERT INTO blog_layout_slot (id, workspace_id, site_slug, region, slot_key, title, body, position, enabled)
       VALUES (${q("ls_seed_footer_profile")}, ${ws}, ${hub}, 'footer', ${q("footer-profile")}, ${q("運営者")}, ${q("道具を実際に使って書いています。")}, 0, 1);`,
  );

  TOP_BANDS.forEach((band, index) => {
    out.push(
      `INSERT INTO blog_layout_band (id, workspace_id, site_slug, band, title, enabled, position, item_limit)
         VALUES (${q(`lb_seed_${band}`)}, ${ws}, ${hub}, ${q(band)}, ${q("")}, 1, ${index}, 3);`,
    );
  });

  DELIVERY_PARTS.forEach((part, index) => {
    out.push(
      `INSERT INTO blog_delivery_part (id, workspace_id, site_slug, part, enabled, note, position)
         VALUES (${q(`dp_seed_${part}`)}, ${ws}, ${hub}, ${q(part)}, 1, ${q("")}, ${index});`,
    );
  });

  for (const tag of TAGS) {
    out.push(
      `INSERT INTO blog_tag (id, workspace_id, site_slug, slug, name, description, kind)
         VALUES (${q(tag.id)}, ${ws}, ${hub}, ${q(tag.slug)}, ${q(tag.name)}, ${q(tag.note)}, ${q(tag.kind)});`,
    );
  }

  for (const article of ARTICLES) {
    const at = seconds(article.daysAgo, nowSeconds);
    const publishedAt = article.status === "published" ? String(at) : "NULL";
    out.push(
      `INSERT INTO articles (id, workspace_id, site_slug, slug, article_template, type, title, lead, status, author_name, published_at, created_at, updated_at)
         VALUES (${q(article.id)}, ${ws}, ${hub}, ${q(article.slug)}, ${q(article.template)}, ${q(ARTICLE_TYPE_BY_TEMPLATE[article.template])}, ${q(article.title)}, ${q(article.lead)}, ${q(article.status)}, ${q(SEED_USER_NAME)}, ${publishedAt}, ${at}, ${at});`,
    );

    const required = REQUIRED_BLOCKS[article.template].filter(
      (kind) => !article.missing.includes(kind),
    );
    // 必須の前に見出しまわりを置く。並びは position が正本で、種類の順ではない。
    const blocks = ["article-title", "article-meta", ...required].filter(
      (kind, index, all) => all.indexOf(kind) === index,
    );
    blocks.forEach((kind, index) => {
      if (!(ARTICLE_BLOCK_KINDS as readonly string[]).includes(kind)) {
        throw new Error(`知らない部品です: ${kind}`);
      }
      out.push(
        `INSERT INTO blog_article_block (id, article_id, kind, heading, body, position)
           VALUES (${q(`bb_${article.id}_${index}`)}, ${q(article.id)}, ${q(kind)}, ${q("")}, ${q("")}, ${index});`,
      );
    });

    const tag = TAGS[ARTICLES.indexOf(article) % TAGS.length];
    out.push(
      `INSERT INTO blog_article_tag (article_id, tag_id) VALUES (${q(article.id)}, ${q(tag.id)});`,
    );

    article.ratings.forEach((score, index) => {
      out.push(
        `INSERT INTO blog_article_rating (id, article_id, reader_key, score, comment, created_at)
           VALUES (${q(`br_${article.id}_${index}`)}, ${q(article.id)}, ${q(`reader_seed_${index}`)}, ${score}, NULL, ${at});`,
      );
    });
  }

  for (const [kind, title, body] of LEGAL_PAGES) {
    out.push(
      `INSERT INTO legal_page (id, site_slug, kind, title, body, status, deleted_at, updated_at)
         VALUES (${q(`lp_seed_${kind}`)}, ${hub}, ${q(kind)}, ${q(title)}, ${q(body)}, 'published', NULL, ${nowSeconds});`,
    );
  }

  return out;
}
