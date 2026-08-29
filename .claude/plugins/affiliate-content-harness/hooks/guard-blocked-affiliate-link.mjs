#!/usr/bin/env node
/**
 * 買う導線の壊れた書き込みを、保存される前に止める。
 *
 * PreToolUse / Write・Edit。標準入力に Claude Code から tool 呼び出しの JSON が来る。
 * 通すときは exit 0、止めるときは exit 2（stderr に書いた理由が書き手へ返る）。
 *
 * --- なぜ検品スクリプトでは足りないのか ---
 *
 * validate-blog-content も validate-campaign-brief も、**呼ばれたときにしか動かない**。
 * ここで止める 3 つは、どれも「保存は成功し、画面は正常に見え、間違いは後から
 * 分からない」種類のものなので、呼び忘れた回にだけすり抜ける。だから書き込みの
 * 手前に置く。
 *
 *   1. 導線があるのに blockedReason が同居している
 *      → 理由は画面に出ない。書いた本人は書いたと思っている。
 *   2. affiliateUrl が https でない
 *   3. ASP 発行 URL にパラメータを足している
 *      → 多くの ASP で規約違反になり、成果が計上されない。しかもリンクは動く。
 *
 * --- 止める範囲を絞る（実用的な fail-closed） ---
 *
 * 「判定できないものは通さない」を全ての Write・Edit へ適用すると、何も書けなくなる。
 * ここでは **導線らしき文字列を含む書き込みだけ**を対象とし、その中で判定できなければ
 * 止める。対象でない書き込みには一切触らない。
 *
 * --- 判定の根拠はコード側から読む ---
 *
 * 足してはいけないパラメータの一覧は `src/domain/monetization/affiliate-link.ts` の
 * `FORBIDDEN_APPENDED_PARAMS` を実行時に読む。ここへ書き写すと、コード側に 1 つ
 * 足した日にこの hook だけが古くなり、**規約違反を通す門番**になる。
 */

import { readFileSync } from "node:fs";

import { readStringArray, readSource } from "../scripts/lib/harness.mjs";

/** この語のどれかが無ければ、そもそも導線の話ではない。 */
const TRIGGERS = ["affiliateUrl", "trackingCode", "blockedReason"];
/** JSON として読めない断片（Edit の new_string）で、同じカードとみなす近さ。 */
const NEAR = 400;

function block(lines) {
  console.error(["買う導線の書き込みを止めました。", ...lines].join("\n"));
  process.exit(2);
}

function readInput() {
  let raw = "";
  try {
    raw = readFileSync(0, "utf8");
  } catch {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Write は content、Edit は new_string。どちらも無ければ見るものが無い。 */
function writtenText(payload) {
  const input = payload?.tool_input ?? {};
  return [input.content, input.new_string].filter((v) => typeof v === "string").join("\n");
}

// --- 個別の判定 -------------------------------------------------------------

function checkCard(card, where, forbidden, problems) {
  const linked = card.affiliateUrl !== undefined || card.trackingCode !== undefined;

  if (linked && card.blockedReason !== undefined) {
    problems.push(
      `${where}: 導線（affiliateUrl / trackingCode）と blockedReason が同居しています。`,
      "  この理由は画面に出ません。出るのは両方とも無いときだけです。",
      "  導線を出さないなら affiliateUrl と trackingCode を両方消す。出すなら blockedReason を消す。",
    );
  }
  const url = card.affiliateUrl;
  if (typeof url === "string") {
    if (!url.startsWith("https://")) {
      problems.push(`${where}: affiliateUrl「${url}」が https で始まっていません。`);
    }
    for (const param of forbidden) {
      if (new RegExp(`[?&]${param}=`).test(url)) {
        problems.push(
          `${where}: affiliateUrl に「${param}」を足しています。`,
          "  ASP が発行した URL は改変しません。多くの ASP で規約違反になり、成果が計上されません。",
          "  リンクは動くので、気づけるのは報酬が入らなかったときです。計測は trackingCode 側でしてください。",
        );
      }
    }
  }
}

/** JSON として読めたとき。productCards を辿って正確に見る。 */
function checkParsed(value, forbidden, problems, path = "") {
  if (Array.isArray(value)) {
    value.forEach((v, i) => checkParsed(v, forbidden, problems, `${path}[${i}]`));
    return;
  }
  if (value === null || typeof value !== "object") return;

  const keys = Object.keys(value);
  if (TRIGGERS.some((t) => keys.includes(t))) {
    checkCard(value, `${path || "書き込み"}「${value.name ?? value.productId ?? "名前なし"}」`, forbidden, problems);
  }
  for (const [k, v] of Object.entries(value)) checkParsed(v, forbidden, problems, path ? `${path}.${k}` : k);
}

/**
 * JSON として読めなかったとき（Edit の断片が典型）。
 *
 * 構造が無いので、近さで同じカードとみなす。離れた場所にある別カードの
 * blockedReason を巻き込む可能性はあるが、**巻き込んで止めるほうが安全側**。
 * 止められた書き手はファイル全体を書き直せば通る。
 */
function checkFragment(text, forbidden, problems) {
  const outbound = [...text.matchAll(/"(?:affiliateUrl|trackingCode)"\s*:/g)];
  const blocked = [...text.matchAll(/"blockedReason"\s*:/g)];

  for (const o of outbound) {
    for (const b of blocked) {
      if (Math.abs(o.index - b.index) <= NEAR) {
        problems.push(
          "書き込みの断片: 導線と blockedReason が近くに並んでいます。",
          "  同じ商品カードなら、この理由は画面に出ません。別のカードなら、ファイル全体を書き直せば通ります。",
        );
        break;
      }
    }
  }
  for (const m of text.matchAll(/"affiliateUrl"\s*:\s*"([^"]*)"/g)) {
    const url = m[1];
    if (!url.startsWith("https://")) problems.push(`書き込みの断片: affiliateUrl「${url}」が https で始まっていません。`);
    for (const param of forbidden) {
      if (new RegExp(`[?&]${param}=`).test(url)) {
        problems.push(`書き込みの断片: affiliateUrl に「${param}」を足しています。ASP 発行 URL は改変しません。`);
      }
    }
  }
}

// ---------------------------------------------------------------------------

const payload = readInput();
if (payload === null) process.exit(0); // hook の入力が読めない = 対象かどうかも分からない。触らない。

const text = writtenText(payload);
if (!TRIGGERS.some((t) => text.includes(t))) process.exit(0); // 導線の話ではない

let forbidden;
try {
  forbidden = readStringArray(readSource("src/domain/monetization/affiliate-link.ts"), "FORBIDDEN_APPENDED_PARAMS");
} catch (e) {
  // ここから先は「判定できない導線の書き込み」。通さない。
  block([
    `判定の根拠を読めませんでした: ${e.message}`,
    "src/domain/monetization/affiliate-link.ts の FORBIDDEN_APPENDED_PARAMS が読めないと、",
    "ASP 発行 URL の改変を見つけられません。書き写して回避せず、あちらの書き方を確かめてください。",
  ]);
}

const problems = [];
let parsed;
try {
  parsed = JSON.parse(text);
} catch {
  parsed = undefined;
}

if (parsed !== undefined) checkParsed(parsed, forbidden, problems);
else checkFragment(text, forbidden, problems);

if (problems.length > 0) block(problems);
process.exit(0);
