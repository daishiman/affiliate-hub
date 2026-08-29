#!/usr/bin/env node
/**
 * 広告表記が、媒体ごとの正しいやり方で出ているかを見る。
 *
 *   node .claude/plugins/affiliate-content-harness/scripts/validate-affiliate-disclosure.mjs \
 *     --campaign campaign-brief.json [--article a.json ...] [--post p.json ...]
 *
 * --- ここだけ「書く／書いてはいけない」が反転する ---
 *
 * ブログ記事では、広告表記を**本文に書かない**。`src/presentation/ui/templates/article-view.tsx`
 * が記事の `disclosureRequired` を見て `DisclosureNotice` を出し、文面は
 * `src/presentation/ui/copy.ts` の 1 箇所が正本になっている。本文にも書くと、
 * 同じ断りが 2 回出る。読者からは、片方が古い文面に見える。
 *
 * SNS には画面が無い。だから逆に、本文へ自分で書かないと誰も出さない。
 * `disclosure` を持たせただけで本文に入れ忘れると、**JSON には表記があるのに
 * 投稿には無い**という、検品を通したのに義務を果たしていない状態になる。
 *
 * --- 判定の起点は案件ブリーフ ---
 *
 * 「この投稿にリンクが無いから表記も要らない」とはしない。Instagram のように
 * リンクを置けない媒体でも、プロフィール経由で同じ商品へ送っているなら広告である。
 * 要否は媒体ごとの事情ではなく、案件の `disclosureRequired` が決める。
 */

import {
  argValue,
  argValues,
  checkFlags,
  checkOutbound,
  createReport,
  readJson,
  readMediaProfiles,
  usage,
} from "./lib/harness.mjs";

const report = createReport();
const MEDIA = readMediaProfiles();

/**
 * 表記に最低限入っていなければならない語。
 *
 * 文面そのものの正本は `src/presentation/ui/copy.ts`。あちらは記事用の長い文なので
 * SNS へはそのまま入らない。短くするのは許すが、「広告であること」と
 * 「アフィリエイトであること」の 2 つは削らせない。どちらか片方だけだと、
 * 読者は「宣伝を含む記事」なのか「買うと運営に報酬が入る」のかを区別できない。
 */
const REQUIRED_TERMS = ["広告", "アフィリエイト"];

/** 記事の本文に広告表記が紛れ込んでいないかを見るための目印。 */
const DISCLOSURE_IN_BODY = /広告（アフィリエイトリンク）|アフィリエイトリンクが含|報酬が支払われ/;

function hasTerms(text) {
  return REQUIRED_TERMS.every((t) => text.includes(t));
}

/** その成果物が買う導線を持っているか（案件側の要否とは別の観点）。 */
function linkedCards(cards) {
  return (cards ?? []).filter((c) => c.affiliateUrl !== undefined || c.trackingCode !== undefined);
}

function checkCampaign(brief, path) {
  const where = `案件ブリーフ ${path}`;
  let linked = false;
  for (const card of brief.productCards ?? []) {
    if (checkOutbound(report, card, `${where} の商品カード「${card.name}」`).linked) linked = true;
  }
  if (linked && brief.disclosureRequired !== true) {
    report.fail(
      where,
      "買う導線があるのに disclosureRequired が true ではありません。",
      "ここが false だと、下流の成果物にも表記を求めません。全媒体の表記が一斉に消えます。",
    );
  }
  if (!linked && brief.disclosureRequired === true) {
    report.warn(
      where,
      "買う導線が無いのに disclosureRequired が true です。",
      "報酬の発生しない案件で広告と断ると、読者は「どこかに広告がある」と探します。導線を置く予定があるならこのままで構いません。",
    );
  }
  return brief.disclosureRequired === true;
}

/**
 * ブログ記事。
 *
 * 見るのは 2 つだけ。フラグが立っているか、本文に書いてしまっていないか。
 * 文面は見ない（記事側が持たないため）。
 */
function checkArticle(article, path, required) {
  const where = `記事 ${path}`;

  // 判断の材料は「この記事に導線があるか」で、案件の設定ではない。
  // 案件が広告表記の要る案件でも、導線を持たない記事（読み物・使い方ガイド）に
  // 断りを出すと、読者は無い広告を探すことになる。
  const linked = linkedCards(article.productCards).length > 0;

  if (required && linked && article.disclosureRequired !== true) {
    report.fail(
      where,
      "買う導線があるのに、記事の disclosureRequired が true ではありません。",
      "記事の広告表示はこのフラグだけで出ます。false のままだと、リンクは出るのに断りが出ません。",
    );
  }
  if (!linked && article.disclosureRequired === true) {
    report.warn(where, "買う導線が無いのに disclosureRequired が true です。", "読者は「どこかに広告がある」と探します。");
  }

  const body = [];
  for (const s of article.sections ?? []) body.push(s.heading ?? "", ...(s.paragraphs ?? []));
  const text = body.join("\n");

  if (DISCLOSURE_IN_BODY.test(text)) {
    report.fail(
      where,
      "本文に広告表記が書かれています。",
      "記事の広告表示は画面が自動で出します（文面の正本は src/presentation/ui/copy.ts）。本文にも書くと同じ断りが 2 回出て、片方が古い文面に見えます。disclosureRequired を true にするだけにしてください。",
    );
  }
}

/** SNS 投稿。媒体の disclosureStyle でやり方が変わる。 */
function checkPost(post, path, required) {
  const profile = MEDIA[post.medium];
  if (profile === undefined) return; // medium 自体の妥当性は validate-media-post が見る
  const where = `投稿 ${path}（${profile.label}）`;

  if (!required) {
    if ((post.disclosure ?? "").trim() !== "") {
      report.warn(where, "案件は広告表記が不要ですが、disclosure が入っています。", "報酬が発生しないなら外してください。");
    }
    return;
  }

  if (profile.disclosureStyle === "none") return;

  const disclosure = (post.disclosure ?? "").trim();
  if (disclosure === "") {
    report.fail(
      where,
      "広告表記（disclosure）がありません。",
      "この媒体には記事のような自動表示がありません。書かないと誰も出しません。",
    );
    return;
  }
  if (!hasTerms(disclosure)) {
    report.fail(
      where,
      `広告表記に「${REQUIRED_TERMS.join("」「")}」が揃っていません（現在の文面「${disclosure}」）。`,
      "短くするのは構いませんが、この 2 語は削らないでください。片方だけだと、読者は「宣伝を含む」のか「買うと運営に報酬が入る」のかを区別できません。",
    );
  }

  if (profile.disclosureStyle === "inline") {
    if (!(post.body ?? "").includes(disclosure)) {
      report.fail(
        where,
        "disclosure が本文に入っていません。",
        "この媒体は本文に書いた文字だけが読者に届きます。JSON にあるだけでは投稿に出ません。本文の末尾へそのまま入れてください。",
      );
    }
    return;
  }

  // linked: 本文が短い媒体。表記のある先へ送る導線が要る。
  const links = [...(post.links ?? []), ...[...(post.body ?? "").matchAll(/https?:\/\/\S+/g)].map((m) => m[0])];
  if (links.length === 0) {
    report.fail(
      where,
      "表記の続きを読める行き先がありません。",
      "この媒体は本文が短いので、断りの詳細はリンク先へ預けます。預ける先が無いなら、本文へ全部書いてください（媒体の disclosureStyle を inline へ変えることになります）。",
    );
  }
}

// ---------------------------------------------------------------------------

const argv = process.argv.slice(2);
checkFlags(argv, ["--campaign", "--article", "--post"], "node validate-affiliate-disclosure.mjs --campaign campaign-brief.json [--article a.json ...] [--post p.json ...]");
const campaignPath = argValue(argv, "--campaign");
if (campaignPath === undefined) {
  usage("node validate-affiliate-disclosure.mjs --campaign campaign-brief.json [--article a.json ...] [--post p.json ...]");
}

const brief = readJson(campaignPath);
const required = checkCampaign(brief, campaignPath);

const articlePaths = argValues(argv, "--article");
const postPaths = argValues(argv, "--post");

for (const p of articlePaths) checkArticle(readJson(p), p, required);
for (const p of postPaths) checkPost(readJson(p), p, required);

report.finish(`案件 1 件と成果物 ${articlePaths.length + postPaths.length} 件の表記を見ました。`);
