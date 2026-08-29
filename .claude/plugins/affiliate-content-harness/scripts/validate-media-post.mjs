#!/usr/bin/env node
/**
 * 媒体投稿（social-post.json）を、その媒体の規則で検品する。
 *
 *   node .claude/plugins/affiliate-content-harness/scripts/validate-media-post.mjs \
 *     --post post.json [--post post2.json ...] [--campaign campaign-brief.json]
 *
 * --- 規則をここに書かない ---
 *
 * 長さ・見出し記法・ハッシュタグ・リンク可否は `references/media-profiles.json`
 * から読む。生成側（run-social-post）も同じファイルを読む。どちらかにだけ規則を
 * 書くと、**生成が通して検品が落とす**（またはその逆の）状態になり、書き手には
 * 理由が見えない。媒体を足すときも、あのファイルへ 1 エントリ足すだけで
 * 生成と検品の両方が追随する。
 *
 * --- 媒体ごとに実害が違う ---
 *
 * Instagram で「リンクはこちら」と書くのは、押せない場所を指すこと。
 * X 長文の見出しが 50 字を超えるのは、タイムラインで核が切れること。
 * どちらも保存は成功し、投稿も成功し、読者にだけ届かない。
 */

import {
  argValue,
  argValues,
  checkFlags,
  checkWords,
  countChars,
  createReport,
  readJson,
  readMediaProfiles,
  readSharedVocabulary,
  substantiveChars,
  usage,
} from "./lib/harness.mjs";

const report = createReport();
const MEDIA = readMediaProfiles();
const VOCAB = readSharedVocabulary();

/** 絵文字。全媒体で禁止（理由は media-profiles.json の `_emoji`）。 */
const EMOJI = /\p{Extended_Pictographic}/u;
/** 文節で折る媒体で、1 行がこれを超えると「折っていない」とみなす。 */
const CONTEXT_LINE_MAX = 60;

function checkPost(post, path, campaign) {
  const where = `投稿 ${path}`;

  const profile = MEDIA[post.medium];
  if (profile === undefined) {
    report.fail(
      where,
      `medium「${post.medium}」の規則がありません。`,
      `references/media-profiles.json にある媒体だけ書けます（${Object.keys(MEDIA).join(" / ")}）。媒体を増やすなら、まずあのファイルへ規則を足してください。`,
    );
    return;
  }
  const at = `${where}（${profile.label}）`;

  if (typeof post.body !== "string" || post.body.trim() === "") {
    report.fail(at, "body が空です。", "投稿の本文です。");
    return;
  }

  checkLength(post, at, profile);
  checkHeading(post, at, profile);
  checkLineBreaks(post, at, profile);
  checkHashtags(post, at, profile);
  checkLinks(post, at, profile);
  checkExpressions(post, at, profile);
  checkClaimRefs(post, at, campaign);
  checkWords(report, post, at);
}

function checkLength(post, at, profile) {
  // 上限は全体、下限は定型を除いた実質で数える。理由は substantiveChars を参照。
  const n = countChars(post.body);
  if (profile.maxChars !== null && n > profile.maxChars) {
    report.fail(
      at,
      `本文が ${n} 字で、上限 ${profile.maxChars} 字を超えています。`,
      "末尾を切り落とすと結論が消えます。削るのは経緯と前置きからにしてください。",
    );
  }
  const sub = substantiveChars(post);
  if (sub < profile.minChars) {
    const fixed = n - sub;
    report.warn(
      at,
      `本文の中身が ${sub} 字しかありません（下限 ${profile.minChars} 字）。全体は ${n} 字ですが、うち ${fixed} 字は定型（広告表記・URL・ハッシュタグ）です。`,
      "この長さでは、読者はこの媒体でこの投稿を読む理由がありません。測った状況か、外した選択肢を足してください。",
    );
  }
}

function checkHeading(post, at, profile) {
  const hasTitle = typeof post.title === "string" && post.title.trim() !== "";

  if (profile.headingStyle === "none") {
    if (hasTitle) {
      report.fail(
        at,
        "この媒体は見出し記法を使いませんが、title が入っています。",
        "本文の 1 行目に置き直してください。# はそのまま文字として表示されます。",
      );
    }
    if (/^#{1,6}\s/m.test(post.body)) {
      report.fail(at, "本文に markdown の見出しが入っています。", "この媒体では # が装飾にならず、そのまま文字として出ます。");
    }
    return;
  }

  if (!hasTitle) {
    report.fail(at, "title がありません。", "この媒体は見出しから読まれます。");
    return;
  }
  const n = countChars(post.title);
  if (profile.headingMaxChars !== null && n > profile.headingMaxChars) {
    report.fail(
      at,
      `見出しが ${n} 字で、上限 ${profile.headingMaxChars} 字を超えています。`,
      "末尾を切り捨てるのではなく、書き直して収めてください。最初に読まれるのは先頭 30 字程度なので、そこに核を置いて残りを予告にします。",
    );
  }
  if (!/^##\s/m.test(post.body)) {
    report.warn(
      at,
      "本文に見出し 2（##）が 1 つもありません。",
      "見出し 1 だけの長文は、途中から読む人が現在地を掴めません。文脈の変わり目で区切ってください。",
    );
  }
}

function checkLineBreaks(post, at, profile) {
  const lines = post.body.split("\n");

  if (profile.lineBreakRule === "context") {
    const long = lines.filter((l) => countChars(l) > CONTEXT_LINE_MAX);
    if (long.length > 0) {
      report.warn(
        at,
        `${CONTEXT_LINE_MAX} 字を超える行が ${long.length} 行あります（例:「${long[0].slice(0, 24)}…」）。`,
        "この媒体は文節と句読点で折って読ませます。折らないと、画面幅によって切れる位置が変わり、読点の無い塊に見えます。",
      );
    }
    return;
  }

  if (!post.body.includes("\n\n") && countChars(post.body) > 300) {
    report.warn(
      at,
      "段落の区切り（空行）がありません。",
      "この媒体は段落で読ませます。300 字を超える塊は、途中で読むのをやめられます。",
    );
  }
}

function checkHashtags(post, at, profile) {
  const tags = post.hashtags ?? [];
  const { min, max } = profile.hashtags;

  if (max === 0 && tags.length > 0) {
    report.fail(at, "この媒体ではハッシュタグを使いません。", "本文の言葉として書き直してください。");
    return;
  }
  if (tags.length > max) {
    report.fail(at, `ハッシュタグが ${tags.length} 個で、上限 ${max} 個を超えています。`, "多いほど届くわけではありません。");
  }
  if (tags.length < min) {
    report.warn(at, `ハッシュタグが ${tags.length} 個しかありません（下限 ${min} 個）。`, "この媒体は検索と一覧からの流入が主です。");
  }
  for (const tag of tags) {
    if (typeof tag !== "string" || !tag.startsWith("#")) {
      report.fail(at, `ハッシュタグ「${tag}」が # で始まっていません。`, "# を含めた文字列で入れてください。");
    }
  }
}

function checkLinks(post, at, profile) {
  const links = post.links ?? [];
  const inBody = [...post.body.matchAll(/https?:\/\/\S+/g)].map((m) => m[0]);

  if (!profile.linkAllowed) {
    if (links.length > 0 || inBody.length > 0) {
      report.fail(
        at,
        "この媒体は本文中のリンクが機能しませんが、リンクが入っています。",
        "押しても何も起きない文字列が残ります。導線はブログ記事へ送り、この投稿からは外してください。",
      );
    }
    return;
  }
  for (const url of [...links, ...inBody]) {
    if (!/^https:\/\//.test(url)) {
      report.fail(at, `リンク「${url}」が https で始まっていません。`, "https のみ受け付けます。");
    }
  }
}

function checkExpressions(post, at, profile) {
  const text = `${post.title ?? ""}\n${post.body}\n${(post.hashtags ?? []).join(" ")}`;

  if (!profile.emojiAllowed && EMOJI.test(text)) {
    report.fail(
      at,
      "絵文字が入っています。",
      "この harness は全媒体で絵文字を使いません。装飾は記号ではなく、見出しの言葉そのもので表してください。",
    );
  }
  for (const pattern of profile.forbiddenPatterns) {
    if (new RegExp(pattern).test(text)) {
      report.fail(
        at,
        `この媒体で使わない表現「${pattern}」が入っています。`,
        "理由は references/media-profiles.json の notes に書いてあります。",
      );
    }
  }

  // 煽り語と装飾記号。fail ではなく △ にしてある。
  // 煽りの重さは案件の concept.tone が「煽らない」と決めているかで変わり、
  // 記号は引用や単位で正当に出ることがある。どちらも最終判断は apply-style-genome の担当。
  // ここが見るのは**リストに載っているものだけ**。載っていない煽り・装飾は agent が拾う。
  const hits = VOCAB.hypeWords.filter((w) => text.includes(w));
  if (hits.length > 0) {
    report.warn(
      at,
      `煽り語が入っています（${hits.join(" / ")}）。`,
      "案件の concept.tone が「煽らない」と決めているなら書き直してください。決めていない場合でも、他の媒体と濃度が違うと同じ書き手に見えなくなります。",
    );
  }
  const marks = VOCAB.decorationMarks.filter((m) => text.includes(m));
  if (marks.length > 0) {
    report.warn(
      at,
      `記号による装飾が入っています（${marks.join(" / ")}）。`,
      "この harness は装飾を見出しの言葉そのもので表します。引用や単位として正当に出ているなら、このままで構いません。",
    );
  }
}

/**
 * 主張が案件ブリーフに実在するか。
 *
 * ここが無いと、媒体側で書き下ろした主張が案件を素通りする。素通りすると、
 * 媒体間の突合（validate-cross-media-consistency.mjs）が「両方に無い主張」を
 * 比べられず、食い違いを見つけられない。
 */
function checkClaimRefs(post, at, campaign) {
  const refs = post.claimRefs ?? [];
  if (refs.length === 0) {
    report.warn(
      at,
      "claimRefs が空です。",
      "この投稿がどの主張を運んでいるかを、案件ブリーフの id で書いてください。書かないと、媒体をまたいだ食い違いを機械が見つけられません。",
    );
    return;
  }
  if (campaign === undefined) return;

  const known = new Set((campaign.claims ?? []).map((c) => c.id));
  for (const ref of refs) {
    if (!known.has(ref)) {
      report.fail(
        at,
        `claimRefs の「${ref}」が案件ブリーフにありません。`,
        "媒体側で新しい主張を足すときは、先に案件ブリーフへ足してください。順序を逆にすると、その主張だけ根拠の検査を通りません。",
      );
    }
  }
}

// ---------------------------------------------------------------------------

const argv = process.argv.slice(2);
checkFlags(argv, ["--post", "--campaign"], "node validate-media-post.mjs --post post.json [--post post2.json ...] [--campaign campaign-brief.json]");
const postPaths = argValues(argv, "--post");
if (postPaths.length === 0) {
  usage("node validate-media-post.mjs --post post.json [--post post2.json ...] [--campaign campaign-brief.json]");
}

const campaignPath = argValue(argv, "--campaign");
const campaign = campaignPath === undefined ? undefined : readJson(campaignPath);

for (const path of postPaths) {
  const post = readJson(path);
  if (campaign !== undefined && post.campaignId !== campaign.campaignId) {
    report.fail(
      `投稿 ${path}`,
      `campaignId「${post.campaignId}」が案件ブリーフの「${campaign.campaignId}」と違います。`,
      "別の案件の投稿を混ぜて検品しています。同じ案件のものだけを渡してください。",
    );
  }
  checkPost(post, path, campaign);
}

report.finish(`${postPaths.length} 件の投稿を見ました。`);
