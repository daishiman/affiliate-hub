/**
 * 道具に渡す「通る入力」を、項目名から組み立てる。
 *
 * 道具 95 個ぶんの入力を手で並べない。並べると、道具を 1 つ足すたびに
 * 表を 1 行足す作業が生まれ、**足し忘れた道具だけが検査されないまま残る**。
 * 代わりに**項目名の辞書**を持つ。`siteSlug` や `productId` は多くの道具で共通なので、
 * 新しい道具が既知の項目名だけで出来ていれば、何もしなくても検査対象に入る。
 *
 * 知らない項目名が現れたときだけ、辞書に 1 行足す。
 * そのとき落ちるのは `tool-catalog-adapters.test.ts` の「辞書の網羅」で、
 * **黙って素通りしない**ようにしてある。
 */

import { authoredSectionsFor } from "@/domain/authoring";
import { sampleGenerationInput } from "@/infrastructure/persistence/sample/generation-sample-input";
import { SAMPLE_SITE_SLUG } from "@/infrastructure/persistence/sample/site-sample-repository";
import type { AnyToolDefinition } from "@/presentation/tools/tool-definition";

/**
 * 項目名 → その項目に入れる値。
 *
 * 値は見本データに実在するものを使う。
 * それらしい文字列を作ると「見つかりません」が返り、
 * **通ったつもりで異常系だけを検査している**状態になる。
 */
export const FIELD_VALUES: Readonly<Record<string, unknown>> = {
  // --- ブログと記事 ---
  siteSlug: SAMPLE_SITE_SLUG,
  categorySlug: "laptops",
  slug: "laptops-for-video-editing",
  query: "ノートパソコン",
  kind: "author",
  key: "methodology",
  readerKey: "reader-test",
  // 見本に**在る**記事を指す。作る側 (`create_blog_article`) と違い、
  // 読む・直す側は既にある行でないと一度も動かない。
  articleId: "ba_sample_starter_kit",
  // 記事型は `ARTICLE_TEMPLATES` の 4 つ。数字でも日本語でもない。
  template: "T1",
  lead: "はじめて選ぶ人が、どこから見ればよいかだけを先に決められるようにまとめました。",

  // --- 商品と順位 ---
  productId: "p_alpha_15",
  productIds: ["p_alpha_15", "p_beta_14"],
  modelId: "rm_video_editing_laptop",

  // --- 商品を登録する（create_product）---
  // 見本に**無い**商品にする。既にある商品と同じブランド + 名前を渡すと、
  // 同一性の判定（`IDENTITY_KEY_PRIORITY` の `brand_and_name`）で
  // 「もうあります」と断られる。断られたところで検査は緑になるので、
  // 登録の道が一度も動いていないことに気づけない。
  brand: "Delta",
  // `name` は用途の付いていない名前なので、他の道具が使い始めたら必ずぶつかる。
  // そのときは辞書を書き換えず、ぶつかった道具側を TOOL_OVERRIDES で上書きする。
  name: "Delta Studio 13",
  officialUrl: "https://example.com/products/delta-studio-13",
  // 比較表の列になる。空だと「仕様と出どころが両方そろっていない」で断られる。
  specifications: { weightKg: 1.2, os: "Windows / macOS" },
  // 鍵の種類は `IDENTITY_KEY_PRIORITY` から取る。一番強い鍵を 1 本だけ置く。
  identityKeys: [{ kind: "gtin", value: "4901234567894" }],

  // --- 記事案と人物像 ---
  variantId: "cv_alpha_review",
  personaId: "ap_editor",
  packageId: "cp_laptop_2026",
  // 段階は `CONTENT_STATES` の大文字の値。2026-08-18 まで `draft` / `in_review` が
  // 入っていたが、そんな段階は存在しない。見本の記事 `cv_alpha_review` は
  // 「事実確認中」に居るので、次に進める先は「表示のきまりを確認中」になる。
  from: "FACT_CHECK",
  to: "COMPLIANCE_REVIEW",
  body: "この製品の重さは 1.5kg です。",
  // 問い合わせは人による自動送信よけ完了が必須。値は入力契約の見本で、実検証済みtokenではない。
  humanCheckToken: "turnstile-token-for-input-shape-test",
  text: "この文章には指示が含まれていません。",
  provided: {},

  // --- 記事 1 本の枠を作る（create_content_variant）---
  // 枠の 4 点（企画・媒体・体裁・書き手／読者）は、どれが欠けても
  // 「誰に向けた何なのか分からない記事」が出来てしまうので、全部そろえる。
  contentPackageId: "cp_laptop_2026",
  channel: "own_site",
  format: "article",
  authorPersonaId: "ap_editor",
  // 読者像は執筆者とは別の一覧にある（`get_audience_persona` の上書きと同じ id）。
  audiencePersonaId: "dp_video_beginner",
  // 切り口と CTA は `CONTENT_ANGLES` / `CTA_TYPES` の値。それらしい文字列を入れると
  // 入力の検査で断られ、断られたところは検査が緑になる。
  angle: "conclusion_first",
  cta: "read_detail",
  disclosure: "アフィリエイト広告を利用しています。",
  summary: "書き出しの速さで選ぶと、動画編集向けのノートパソコンは絞り込める。",

  // --- 配信 ---
  // まだ出していない配信を指す。公開済みの `pub_own_site` を指すと、
  // 「出せない状態だから断られた」応答を見て「通った」と数えてしまう。
  publicationId: "pub_own_site_ready",
  scheduledAt: "2026-09-01T09:00:00.000Z",
  channelKind: "own_site",
  accountLabel: "@publisher.example",
  credentialRef: "channel/conn_bluesky/credentials",
  expiresAt: "2027-08-27T00:00:00.000Z",

  // --- 自分のブログへ出す ---
  // 出せる条件（書き手・広告表記・次に見直す日・根拠）を全部そろえた値を置く。
  // 1 つでも欠かすと、断られた応答を見て「通った」と数えてしまう。
  articleType: "guide",
  title: "動画編集向けノートパソコンの選び方",
  conclusion: "書き出しの速さで選ぶ。",
  authorName: "三輪 みわ",
  authorBio: "家電量販店で 8 年、パソコン売り場を担当。",
  authorCredentials: ["家電量販店で 8 年勤務"],
  relationshipType: "affiliate",
  disclosureMessage: "アフィリエイト広告を利用しています。",
  nextReviewOn: "2026-12-01",
  claims: [
    {
      statement: "書き出し時間は 4 分 12 秒でした。",
      sourceLabel: "編集部の実測",
      sourceUrl: null,
      checkedOn: "2026-08-01",
    },
  ],
  // 節は記事タイプごとに決まっている。手で並べると、必要な節が増えたときに
  // ここだけ古いままになり、断られた応答を「通った」と数えてしまう。
  sectionBodies: Object.fromEntries(
    authoredSectionsFor("guide").map((s) => [
      s.id,
      `${s.label}について、実際に確かめた内容をここに書いています。`,
    ]),
  ),

  // --- 収益 ---
  period: "2026-08",
  conversionId: "cv_2026_08_a",
  amountMinor: 1000,
  currency: "JPY",
  reason: "広告主からの確定連絡にあわせて修正しました。",
  /*
    止める対象は見本のリンク（`affiliate-sample-repository.ts` の `LINKS`）。
    見本は止められない（保存先に行が無いので断られる）が、**断られる場所は
    権限より先ではない。** 能力の検査と入力の検査を通り抜けたうえで、
    保存先が断る形になっているかをここで通す。
  */
  affiliateLinkId: "lnk_amazon_pc",
  url: "https://example.com/products/alpha-studio-15",
  // 受け取り方は `LinkIngestionSource` の 5 つだけ（paste / csv / api / extension / webmcp）。
  // 2026-08-18 まで `manual` が入っていて、2 つの道具が入力の検査で断られていた。
  // 断られたところで検査は緑になるので、**間違った見本は黙って通る。**
  source: "paste",
  // 受信箱の見本は `link-inbox-sample-repository.ts` の 5 件。
  // 2026-08-18 まで `lnk_amazon_pc` という**どこにも無い id** が入っていて、
  // 3 つの道具が「見つかりません」で止まっていた。止まったところは
  // 検査が緑になるので、その先が一度も動いていないことに気づけない。
  // 状態は道具ごとに要るものが違うので、既定は「受け取ったまま」の 1 件にし、
  // 別の状態が要る道具は TOOL_OVERRIDES で指す（互いに別の行を触るので、
  // どの順で呼んでも結果が変わらない）。
  linkIngestionId: "li_received_1",
  programId: "prg_amazon_pc",
  // 成果リンクとして登録したとき、読者のカードにそのまま出る写し。
  productName: "Alpha Studio 15",

  // --- 数字 ---
  target: "article_revision",
  metricKey: "page_views",

  // --- ブログ作成の下書き ---
  draftId: "sd_sample",
  // 段階は文字列（`SITE_WIZARD_STEPS`）。数字を入れても入力の検査で断られるだけで、
  // 断られたところは検査が緑になるので気づけない。
  step: "purpose",
  answers: {},

  // --- 改善要望 ---
  // `id` は改善要望だけが使っている項目名。他の道具は用途つきの名前
  // （productId / draftId など）を使うので、ここで見本の要望を 1 件指す。
  // 他の道具が `id` を使い始めたら、その道具側で TOOL_OVERRIDES を足す。
  id: "fb_sample_sort",
  // 送るときに自動で付く 2 つ。画面が集めて渡す形をそのまま置く。
  origin: {
    screenName: "順位表",
    url: "https://example.invalid/admin/rankings",
    route: "/admin/rankings",
    viewportWidth: 1440,
    viewportHeight: 900,
  },
  technical: {
    jsErrors: [],
    failedRequests: [],
    userAgent: "検査のため実際の環境情報は入っていません",
    recentActions: ["画面を開いた"],
    redactedCount: 0,
  },
  ids: ["fb_sample_sort"],
  route: "copied_by_human",

  // --- 読者の道具 ---
  // 読者の道具の入力は、単位つきで人が打つものなので文字列で受ける。
  values: { minutes: "60", bitrate: "100", months: "12" },
  item: {
    productId: "p_alpha_15",
    productName: "Alpha Studio 15",
    savedAt: "2026-08-17T00:00:00.000Z",
  },
};

/**
 * 項目名だけでは決まらないもの。
 *
 * `slug` は記事にも人物にも道具にも使われていて、同じ値では通らない。
 * ここに置くのは**その道具に固有の事情**だけで、共通の値は辞書側に置く。
 */
export const TOOL_OVERRIDES: Readonly<Record<string, Readonly<Record<string, unknown>>>> = {
  register_channel_connection: { channelKind: "bluesky" },
  get_person: { slug: "miwa" },
  get_reader_tool: { slug: "storage-estimator" },
  // 計算が動くようになったので、値まで渡す（2026-08-26）。
  // 空の `values` のままだと「欄が空です」で失敗し、正常系を見たことにならない。
  run_reader_tool: {
    slug: "storage-estimator",
    values: { minutes: "60", bitrate: "100", months: "12" },
  },
  get_policy_document: { key: "methodology" },
  get_article: { slug: "laptops-for-video-editing" },
  // 読者像は執筆者とは別の一覧にある。
  get_audience_persona: { personaId: "dp_video_beginner" },
  // 書き出しは「自動で投稿できない配信先」でしか意味を持たない。
  export_manual_draft: { publicationId: "pub_note_manual" },
  // 改善要望の種類は `FEEDBACK_KINDS` の 3 つだけ。`kind` という名前は
  // 人物の種類（`author`）でも使われているので、辞書ごと変えずにここで上書きする。
  submit_feedback: { kind: "not_working" },
  // 下書きの段階は `SITE_WIZARD_STEPS` の文字列。数字ではない。
  // `answers` は段階ごとに必要な項目が違うので、共通の辞書には置けない
  // （空のまま渡すと「まだ埋まっていません」で止まり、その先が動かない）。
  save_site_draft_step: {
    step: "purpose",
    answers: { purpose: "はじめてレンズを買う人が、迷わず 1 本を選べるようにする" },
  },
  // 商品との結びつけは、広告主が決まった行にしかできない。
  match_link_ingestion_product: { linkIngestionId: "li_resolved_1", productId: "p_alpha_15" },
  // 登録は商品まで決まった行だけが通る。受信・広告主決定の見本を流用しない。
  register_affiliate_link: {
    linkIngestionId: "li_matched_1",
    productName: "Alpha Studio 15",
  },
  // 鍵の道具は選択肢（一覧・発行・失効）に分かれている。先頭の枝は「一覧」で、
  // これだけが何も壊さずに呼べる。`action` は他の道具では使われない項目名なので、
  // 辞書ではなくここに置く。
  manage_integration_keys: { action: "list" },
  // 公開状態は `BLOG_ARTICLE_STATUSES` の 4 つ。`published` は使わない
  // ——記事型が要求する部品がそろっていないと断られる側の枝で、
  // そこで緑になると「公開の道が通った」と読み違える。
  set_blog_article_status: { status: "review" },
  // 消す道具だけ**別の記事**を指す。読む・直す道具と同じ行を指すと、
  // 検査の並び順が変わった日に「消えた行を読もうとした」で落ちる。
  // 落ちた側を直すと、消す道具か読む道具のどちらかが検査から外れる。
  delete_blog_article: { articleId: "ba_sample_draft" },
  // 対応状況の変更は「状態・扱いの決定・取り消し」のどれか 1 つが要る。
  // 先頭の枝は状態なので、通る状態を 1 つ置く（`status` は他の道具でも使われうる
  // 名前で、要望の状態はこの道具に固有）。
  update_feedback_status: { status: "in_progress" },
  // 下書きを作らせる道具は、18 項目そろった素材とモデルの指定が要る。
  // 見本の素材は画面の「試す」で使っているものと同じ 1 本を使う。
  // 別に組み立てると、画面で通るものと検査で通るものが分かれる。
  draft_content_variant: {
    model: { providerId: "openai", modelId: "gpt-4o-mini" },
    provided: sampleGenerationInput(),
  },
  // 仕様書の名前でも同じ道具に入る（`spec-contract.ts`）。
  // 別名の側も同じ入力で呼べることを、ここで一緒に見る。
  generate_content_variants: {
    model: { providerId: "openai", modelId: "gpt-4o-mini" },
    provided: sampleGenerationInput(),
  },
  // 対象外にするのは、まだどの状態にもなっていない行で見る
  // （`li_received_1` は resolve の道具が触るので、別の行を指す）。
  reject_link_ingestion: {
    linkIngestionId: "li_received_2",
    reason: "提携が終了しているため。",
  },
};

/**
 * 正常系を確かめられない道具と、その理由。
 *
 * **空にできないからといって、黙って検査から外さない。**
 * 外した事実がどこにも残らないと、次に見た人には「全部通っている」と見える。
 * ここに理由つきで並べ、`tool-catalog-adapters.test.ts` が
 * 「並んでいるものが本当に通らないか」まで確かめる。
 */
export const NO_HAPPY_PATH: Readonly<Record<string, string>> = {
  // `get_site_draft` は 2026-08-18 にここから外れた。
  // 見本の下書き `sd_sample` を 1 本置いたので、呼べば返るようになった。
  // 理由が消えたら行ごと消す。理由だけ残すと、次に見た人には
  // 「まだ通らない」と読める。
  // `run_reader_tool` は 2026-08-26 にここから外れた。
  // 計算式を保存側から取って実際に解くようになったので、値を渡せば結果が返る
  // (`src/domain/authoring/reader-tool-formula.ts`)。
};

function requiredList(schema: unknown): readonly string[] {
  const value = (schema as { required?: unknown } | null)?.required;
  return Array.isArray(value) ? value.filter((f): f is string => typeof f === "string") : [];
}

/**
 * 入力の形（JSON Schema 相当）から、必須の項目名を取り出す。
 *
 * 選択肢（`oneOf` / `anyOf`）があるときは、**先頭の枝**の必須も足す。
 * 呼ぶ側はどれか 1 つの枝を満たせばよいので、どれを選ぶかを決めておかないと
 * 「宣言どおりの入力」が 1 つに定まらない。先頭にしてあるのは、
 * 定義に書いた順が変われば検査の入力も変わり、差分に現れるからである。
 */
export function requiredFieldsOf(tool: AnyToolDefinition): readonly string[] {
  const schema = tool.inputSchema as { oneOf?: unknown; anyOf?: unknown };
  const branches = schema.oneOf ?? schema.anyOf;
  const first = Array.isArray(branches) && branches.length > 0 ? requiredList(branches[0]) : [];
  return [...new Set([...requiredList(tool.inputSchema), ...first])];
}

/** その道具に渡す「通るはずの入力」。辞書に無い項目があれば `null` を返す。 */
export function validInputFor(tool: AnyToolDefinition): Record<string, unknown> | null {
  const input: Record<string, unknown> = {};
  for (const field of requiredFieldsOf(tool)) {
    const override = TOOL_OVERRIDES[tool.name]?.[field];
    const value = override ?? FIELD_VALUES[field];
    if (value === undefined) return null;
    input[field] = value;
  }
  return input;
}

/** 辞書に無い項目名の一覧。テストの失敗メッセージに出す。 */
export function unknownFields(catalog: readonly AnyToolDefinition[]): readonly string[] {
  const missing = new Set<string>();
  for (const tool of catalog) {
    for (const field of requiredFieldsOf(tool)) {
      if (TOOL_OVERRIDES[tool.name]?.[field] === undefined && FIELD_VALUES[field] === undefined) {
        missing.add(`${field}（${tool.name}）`);
      }
    }
  }
  return [...missing].sort();
}
