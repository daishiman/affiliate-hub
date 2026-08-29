#!/usr/bin/env node
/**
 * 案件ブリーフ（campaign-brief.json）を検品する。
 *
 *   node .claude/plugins/affiliate-content-harness/scripts/validate-campaign-brief.mjs \
 *     --campaign campaign-brief.json [--site site.json]
 *
 * --- 案件ブリーフとは何か ---
 *
 * **1 つのアフィリエイト案件について、全媒体が共有する唯一の正本。**
 * ブログ記事も X 長文も Instagram も、主張（claims）・根拠（evidence）・
 * 買う導線（productCards）をここから継ぐ。継がずに媒体ごとに書くと、
 * X では「38kPa」と言い、Instagram では「40kPa」と言う状態が起きる。
 * どちらも単体では正しく見えるので、並べて読む人だけが気づく。
 *
 * --- ここで止めるもの ---
 *
 * 1. **ペルソナが空。** 誰に向けて書くかが無いまま各媒体へ展開すると、
 *    媒体ごとに違う読者を想像した文章ができる。
 * 2. **fact に根拠が無い。** ここで通すと、その主張が 6 媒体へ複製される。
 *    根拠の検査は下流ではなく、いちばん上流でする。
 * 3. **導線と blockedReason の同時指定。** 理由が黙って消える壊れ方
 *    （`lib/harness.mjs` の checkOutbound を参照）。
 * 4. **展開先の媒体が media-profiles.json に無い。** 規則の無い媒体へ
 *    展開すると、長さも記法も誰も見ないまま公開される。
 */

import {
  argValue,
  checkClaim,
  checkFlags,
  checkOutbound,
  checkWords,
  createReport,
  isSlug,
  readFactKinds,
  readJson,
  readMediaProfiles,
  usage,
} from "./lib/harness.mjs";

const report = createReport();
const FACT_KINDS = readFactKinds();
const MEDIA = readMediaProfiles();

/** ペルソナに要る 4 つ。どれか 1 つでも欠けると、書き手は自分の想像で埋める。 */
const PERSONA_KEYS = {
  who: "誰か（年齢・職業・環境）",
  situation: "いま何に困っているか",
  jobToBeDone: "何を片付けたくて商品を探しているか",
  objection: "買う直前に何を疑うか",
};

/** コンセプトに要る 3 つ。媒体をまたいで文体と約束を揃えるための拠り所。 */
const CONCEPT_KEYS = {
  promise: "この案件で読者に約束すること",
  differentiation: "同じ商品を扱う他の記事と何が違うか",
  tone: "どういう口調で書くか",
};

function checkCampaign(brief, path) {
  const where = `案件ブリーフ ${path}`;

  if (!isSlug(brief.campaignId)) {
    report.fail(
      where,
      `campaignId「${brief.campaignId}」が使えません。`,
      "半角英小文字・数字・ハイフンだけで指定してください。全媒体の成果物がこの値で結び付きます。",
    );
  }
  if (!isSlug(brief.siteSlug)) {
    report.fail(where, `siteSlug「${brief.siteSlug}」が使えません。`, "どのブログの案件かを示す値です。");
  }

  report.required(where, brief.product, ["productId", "name", "brand"], "案件の対象商品です。");

  for (const [key, label] of Object.entries(PERSONA_KEYS)) {
    if (typeof brief.persona?.[key] !== "string" || brief.persona[key].trim() === "") {
      report.fail(
        where,
        `persona.${key}（${label}）が空です。`,
        "ここを埋めずに展開すると、媒体ごとに違う読者へ向けた文章ができます。並べて読むまで気づけません。",
      );
    }
  }

  for (const [key, label] of Object.entries(CONCEPT_KEYS)) {
    if (typeof brief.concept?.[key] !== "string" || brief.concept[key].trim() === "") {
      report.fail(where, `concept.${key}（${label}）が空です。`, "全媒体が共有する約束と口調です。");
    }
  }

  checkClaims(brief, where);
  checkCards(brief, where);
  checkMedia(brief, where);
  checkWords(report, brief, where);
}

function checkClaims(brief, where) {
  const claims = brief.claims ?? [];
  if (claims.length === 0) {
    report.fail(
      where,
      "claims が 1 件もありません。",
      "各媒体はここから主張を継ぎます。空だと、媒体ごとに書き下ろすことになり、食い違いを止められません。",
    );
    return;
  }
  const ids = new Set();
  for (const c of claims) {
    const at = `${where} の言い切り「${(c.statement ?? "").slice(0, 20)}…」`;
    if (ids.has(c.id)) {
      report.fail(at, `id「${c.id}」が重複しています。`, "媒体をまたいで同じ主張を指す番号なので、案件の中で一意にしてください。");
    }
    ids.add(c.id);
    checkClaim(report, c, at, FACT_KINDS);
  }
  if (!claims.some((c) => c.kind === "fact")) {
    report.fail(
      where,
      "測った・確かめた主張（kind: fact）が 1 つもありません。",
      "推測と意見だけの案件は、どの媒体へ出しても感想文になります。1 つでも自分で確かめたことを根拠付きで入れてください。",
    );
  }
}

function checkCards(brief, where) {
  const cards = brief.productCards ?? [];
  if (cards.length === 0) {
    report.warn(
      where,
      "productCards がありません。",
      "買う導線を置かない案件（手引きだけを出す等）ならこのままで構いません。置くつもりなら、導線はここで一度だけ決めてください。",
    );
    return;
  }
  let anyLinked = false;
  for (const card of cards) {
    const at = `${where} の商品カード「${card.name}」`;
    report.required(at, card, ["productId", "name", "brand", "oneLine"], "");
    const { linked } = checkOutbound(report, card, at);
    if (linked) anyLinked = true;
  }
  if (anyLinked && brief.disclosureRequired !== true) {
    report.fail(
      where,
      "買う導線があるのに disclosureRequired が true ではありません。",
      "報酬の発生しうるリンクを置く案件では、全媒体で広告表記を出します。ここが false だと、下流の検品も表記を求めません。",
    );
  }
}

function checkMedia(brief, where) {
  const targets = brief.media ?? [];
  if (targets.length === 0) {
    report.fail(where, "media が空です。", `どの媒体へ展開するかを並べてください。使えるのは ${Object.keys(MEDIA).join(" / ")} です。`);
    return;
  }
  for (const m of targets) {
    report.oneOf(where, "media", m, Object.keys(MEDIA));
  }
  // blog が要るのは、blog が無いこと自体が問題だからではない。
  // 「リンクを置けない媒体」と「広告表記の詳細をリンク先へ預ける媒体」だけが、
  // 送り先としてブログ記事を前提にしている。媒体の名前で引かず、規則で引く。
  const needsBlog = targets.filter(
    (m) => MEDIA[m] && (MEDIA[m].linkAllowed === false || MEDIA[m].disclosureStyle === "linked"),
  );
  if (!targets.includes("blog") && needsBlog.length > 0) {
    const labels = needsBlog.map((m) => MEDIA[m].label ?? m).join(" / ");
    report.warn(
      where,
      "展開先に blog が入っていません。",
      `${labels}は導線の送り先にブログ記事を前提にしています（リンクを本文に置けない、または広告表記の詳細をリンク先へ預ける）。ブログを作らないなら、その媒体の導線をどこへ送るかを決めてください。`,
    );
  }
}

// ---------------------------------------------------------------------------

const argv = process.argv.slice(2);
checkFlags(argv, ["--campaign", "--site"], "node validate-campaign-brief.mjs --campaign campaign-brief.json [--site site.json]");
const campaignPath = argValue(argv, "--campaign");
if (campaignPath === undefined) {
  usage("node validate-campaign-brief.mjs --campaign campaign-brief.json [--site site.json]");
}

const brief = readJson(campaignPath);
checkCampaign(brief, campaignPath);

const sitePath = argValue(argv, "--site");
if (sitePath !== undefined) {
  const site = readJson(sitePath);
  if (site.slug !== brief.siteSlug) {
    report.fail(
      `案件ブリーフ ${campaignPath}`,
      `siteSlug「${brief.siteSlug}」が設計図の slug「${site.slug}」と違います。`,
      "同じ値にしてください。違うと、記事がどのブログに載るか決まりません。",
    );
  }
}

report.finish("案件ブリーフ 1 件を見ました。");
