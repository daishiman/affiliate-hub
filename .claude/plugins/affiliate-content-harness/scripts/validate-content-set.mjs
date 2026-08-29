#!/usr/bin/env node
/**
 * 1 案件ぶんの設計図・記事・投稿を集め、公開前の 5 検品を同じ入口から実行する。
 *
 *   node validate-content-set.mjs --content-set blog-content/quiet-rental
 *   node validate-content-set.mjs --content-set set-a --content-set set-b
 *
 * 個別スクリプトへファイル一覧を手で渡す経路を公開手順に残すと、glob や配列の
 * 組み方を誤ったときに「0 件を見て通過」が起きる。ここで実ファイルを列挙し、
 * 案件ブリーフの media と突き合わせてから、同じ一覧を 5 検品へ渡す。
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  argValues,
  checkFlags,
  readMediaProfiles,
  usage,
} from "./lib/harness.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const MEDIA = readMediaProfiles();
const VALIDATOR_COUNT = 5;

function jsonFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => join(dir, entry.name))
    .sort();
}

function readDocument(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    console.error(`× ${path} を読めませんでした: ${error.message}`);
    return undefined;
  }
}

function repeated(flag, paths) {
  return paths.flatMap((path) => [flag, path]);
}

function mediumName(medium) {
  const label = MEDIA[medium]?.label ?? medium;
  return `${label} (${medium})`;
}

function inspectMedia(campaign, articlePaths, postDocuments) {
  const problems = [];
  const expected = new Set(Array.isArray(campaign.media) ? campaign.media : []);
  const counts = new Map();

  if (articlePaths.length > 0) counts.set("blog", 1);
  for (const { path, post } of postDocuments) {
    if (typeof post.medium !== "string" || post.medium.trim() === "") continue;
    counts.set(post.medium, (counts.get(post.medium) ?? 0) + 1);
    if (post.campaignId !== campaign.campaignId) {
      problems.push(
        `投稿 ${path} は別案件「${post.campaignId}」の成果物です（この案件は「${campaign.campaignId}」）。`,
      );
    }
  }

  const missing = [...expected].filter((medium) => !counts.has(medium));
  const unexpected = [...counts.keys()].filter((medium) => !expected.has(medium));
  const duplicatedPosts = [...counts.entries()].filter(
    ([medium, count]) => medium !== "blog" && count > 1,
  );

  if (missing.length > 0) {
    problems.push(`不足している媒体: ${missing.map(mediumName).join(" / ")}`);
  }
  if (unexpected.length > 0) {
    problems.push(`予定にない媒体: ${unexpected.map(mediumName).join(" / ")}`);
  }
  for (const [medium, count] of duplicatedPosts) {
    problems.push(`同じ媒体が ${count} 件あります: ${mediumName(medium)}`);
  }

  return problems;
}

function runValidator(label, script, args) {
  console.log(`\n▶ ${label}`);
  const result = spawnSync(process.execPath, [resolve(HERE, script), ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) {
    console.error(`× ${label}を起動できませんでした: ${result.error.message}`);
    return 2;
  }
  return result.status ?? 2;
}

function validateContentSet(inputPath) {
  const contentSet = resolve(inputPath);
  console.log(`\n━━ content set: ${contentSet} ━━`);
  if (!existsSync(contentSet)) {
    console.error(`× content set がありません: ${contentSet}`);
    return 2;
  }

  const campaignPath = join(contentSet, "campaign-brief.json");
  const sitePath = join(contentSet, "site.json");
  const missingRequired = [campaignPath, sitePath].filter((path) => !existsSync(path));
  if (missingRequired.length > 0) {
    for (const path of missingRequired) console.error(`× 必須ファイルがありません: ${path}`);
    return 2;
  }

  const campaign = readDocument(campaignPath);
  if (campaign === undefined) return 2;

  const articlePaths = jsonFiles(join(contentSet, "articles"));
  const postPaths = jsonFiles(join(contentSet, "posts"));
  const postDocuments = [];
  let unreadable = false;
  for (const path of postPaths) {
    const post = readDocument(path);
    if (post === undefined) unreadable = true;
    else postDocuments.push({ path, post });
  }
  if (unreadable) return 2;

  const mediaProblems = inspectMedia(campaign, articlePaths, postDocuments);
  for (const problem of mediaProblems) console.log(`× 媒体の過不足\n  ${problem}`);

  const articles = repeated("--article", articlePaths);
  const posts = repeated("--post", postPaths);
  const checks = [
    {
      label: "1/5 案件ブリーフ",
      script: "validate-campaign-brief.mjs",
      args: ["--campaign", campaignPath, "--site", sitePath],
    },
    {
      label: "2/5 ブログ設計図と記事",
      script: "validate-blog-content.mjs",
      args: ["--all", "--site", sitePath, ...articles, "--campaign", campaignPath],
    },
    {
      label: "3/5 媒体投稿",
      script: "validate-media-post.mjs",
      args: [...posts, "--campaign", campaignPath],
      skip: postPaths.length === 0 ? "投稿が無いため対象なし" : undefined,
    },
    {
      label: "4/5 広告表記",
      script: "validate-affiliate-disclosure.mjs",
      args: ["--campaign", campaignPath, ...articles, ...posts],
    },
    {
      label: "5/5 媒体間の食い違い",
      script: "validate-cross-media-consistency.mjs",
      args: ["--campaign", campaignPath, ...articles, ...posts],
    },
  ];

  let status = mediaProblems.length > 0 ? 1 : 0;
  for (const check of checks) {
    if (check.skip !== undefined) {
      console.log(`\n▶ ${check.label}\n△ ${check.skip}`);
      continue;
    }
    const result = runValidator(check.label, check.script, check.args);
    if (result === 2) status = 2;
    else if (result !== 0 && status === 0) status = 1;
  }

  console.log(
    `\n${contentSet}: ${VALIDATOR_COUNT} つの検品を完了しました。記事 ${articlePaths.length} 本 / 投稿 ${postPaths.length} 件 / 媒体の過不足 ${mediaProblems.length} 件。`,
  );
  return status;
}

const argv = process.argv.slice(2);
checkFlags(
  argv,
  ["--content-set"],
  "node validate-content-set.mjs --content-set blog-content/<site> [--content-set blog-content/<site> ...]",
);
const contentSets = argValues(argv, "--content-set");
if (contentSets.length === 0) {
  usage(
    "node validate-content-set.mjs --content-set blog-content/<site> [--content-set blog-content/<site> ...]",
  );
}

let exitCode = 0;
for (const contentSet of contentSets) {
  const status = validateContentSet(contentSet);
  if (status === 2) exitCode = 2;
  else if (status !== 0 && exitCode === 0) exitCode = 1;
}
process.exit(exitCode);
