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

  // --- 商品と順位 ---
  productId: "p_alpha_15",
  productIds: ["p_alpha_15", "p_beta_14"],
  modelId: "rm_video_editing_laptop",

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
  text: "この文章には指示が含まれていません。",
  provided: {},

  // --- 配信 ---
  // まだ出していない配信を指す。公開済みの `pub_own_site` を指すと、
  // 「出せない状態だから断られた」応答を見て「通った」と数えてしまう。
  publicationId: "pub_own_site_ready",
  scheduledAt: "2026-09-01T09:00:00.000Z",
  channelKind: "own_site",

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
  get_person: { slug: "miwa" },
  get_reader_tool: { slug: "storage-estimator" },
  run_reader_tool: { slug: "storage-estimator" },
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
  run_reader_tool:
    "計算そのものがまだスタブで、NOT_IMPLEMENTED を返すため（返していることは検査する）",
};

/** 入力の形（JSON Schema 相当）から、必須の項目名を取り出す。 */
export function requiredFieldsOf(tool: AnyToolDefinition): readonly string[] {
  const required = (tool.inputSchema as { required?: unknown }).required;
  return Array.isArray(required) ? required.filter((f): f is string => typeof f === "string") : [];
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
