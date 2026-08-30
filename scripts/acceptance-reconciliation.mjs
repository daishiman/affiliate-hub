#!/usr/bin/env node
/**
 * feat-uiux-overhaul の A1〜A10 を、仕様・runtime・test・report・trackingで突合する。
 *
 * `--write` は、現在の仕様・runtime・testの内容から評価digestを再生成し、
 * manifest・報告マーカー・feature tracking・証跡を同じ時点へ揃える。
 * テスト結果そのものは捏造しない。CIではこのgateの後に実テストを全件実行する。
 */
import { createHash } from "node:crypto";
import {
  existsSync,
  globSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_MANIFEST = "docs/spec/feat-uiux-overhaul/acceptance-reconciliation.json";
const CLAIM_PATTERN = /<!-- acceptance-reconciliation (\{[^\n]+\}) -->/;
const TRACKING_PATTERN = /^acceptance_reconciliation:\s*(\{[^\n]+\})$/m;
const EXPECTED_IDS = Array.from({ length: 10 }, (_, index) => `A${index + 1}`);
const EVALUATION_FIELDS = ["requirement_refs", "runtime_refs", "test_refs"];
const REQUIRED_FIELDS = [...EVALUATION_FIELDS, "report_refs"];

function sha256(body) {
  return createHash("sha256").update(body).digest("hex");
}

function safeRelativePath(path) {
  return typeof path === "string" && path.length > 0 && !isAbsolute(path) && !path.split("/").includes("..");
}

function refLabel(ref) {
  return typeof ref === "string" ? ref : ref?.pattern;
}

function expandRef(ref, root) {
  const pattern = refLabel(ref);
  if (!safeRelativePath(pattern)) return { files: [], problem: `安全でない参照です: ${String(pattern)}` };

  const exact = existsSync(join(root, pattern)) && statSync(join(root, pattern)).isFile();
  const wildcard = /[*?\[\]{}]/.test(pattern);
  // Next.js の `[variant]` はglobではなく実在するディレクトリ名。まず完全一致を見る。
  const files = exact ? [pattern] : wildcard ? globSync(pattern, { cwd: root, nodir: true }).sort() : [];
  const minMatches = typeof ref === "object" && Number.isInteger(ref.min_matches) ? ref.min_matches : 1;
  if (files.length < minMatches) {
    return {
      files,
      problem: `${pattern} は ${minMatches} 件以上必要ですが ${files.length} 件です`,
    };
  }
  return { files, problem: null };
}

function acceptanceEntries(manifest) {
  return Array.isArray(manifest?.acceptance) ? manifest.acceptance : [];
}

function collectEvidence(manifest, root, issues = []) {
  const files = new Set();
  for (const entry of acceptanceEntries(manifest)) {
    for (const field of EVALUATION_FIELDS) {
      const refs = Array.isArray(entry?.[field]) ? entry[field] : [];
      for (const ref of refs) {
        const expanded = expandRef(ref, root);
        if (expanded.problem) issues.push(`${entry.id} ${field}: ${expanded.problem}`);
        for (const path of expanded.files) files.add(path);
      }
    }
  }
  return [...files].sort();
}

/**
 * パターン参照ごとの「下限と実測」。証跡に残すために使う。
 *
 * 総数（`evidence_file_count`）だけでは、**どのパターンが何件を掴んでいたか**が
 * 残らない。パターンを書き換えて別のファイル群を数えても総数は同じになり得るし、
 * 下限にどれだけ余裕があったのかも後から読めない。digest がずれたときに
 * 「何が動いたのか」を証跡だけで辿れるようにする。
 *
 * 同じパターンが複数の受入 ID に現れるので、パターン文字列で畳む。
 * 下限が違う場合は厳しい方を残す（緩い方を残すと、証跡が実際の条件より甘くなる）。
 */
export function collectPatternCoverage(manifest, root = process.cwd()) {
  const byPattern = new Map();
  for (const entry of acceptanceEntries(manifest)) {
    for (const field of EVALUATION_FIELDS) {
      const refs = Array.isArray(entry?.[field]) ? entry[field] : [];
      for (const ref of refs) {
        const pattern = refLabel(ref);
        if (typeof ref !== "object" || !Number.isInteger(ref.min_matches)) continue;
        const expanded = expandRef(ref, root);
        const previous = byPattern.get(pattern);
        byPattern.set(pattern, {
          pattern,
          min: previous === undefined ? ref.min_matches : Math.max(previous.min, ref.min_matches),
          actual: expanded.files.length,
        });
      }
    }
  }
  return [...byPattern.values()].sort((a, b) => a.pattern.localeCompare(b.pattern));
}

export function computeEvaluationDigest(manifest, root = process.cwd()) {
  const files = collectEvidence(manifest, root);
  const records = files.map((path) => ({
    path,
    sha256: sha256(readFileSync(join(root, path))),
  }));
  const digest = `sha256:${sha256(records.map((record) => `${record.path}:${record.sha256}`).join("\n"))}`;
  return { digest, files: records };
}

function parseJsonMarker(body, pattern, label, issues) {
  const match = body.match(pattern);
  if (!match) {
    issues.push(`${label}: acceptance-reconciliation marker がありません`);
    return null;
  }
  try {
    return JSON.parse(match[1]);
  } catch (error) {
    issues.push(`${label}: marker のJSONを読めません (${error instanceof Error ? error.message : error})`);
    return null;
  }
}

function expectedClaim(manifest) {
  return {
    implementation_status: manifest.status?.implementation,
    release_status: manifest.status?.release,
    tracking_status: manifest.status?.tracking,
    evaluated_digest: manifest.evaluated_digest,
  };
}

function compareClaim(claim, expected, label, issues) {
  if (!claim) return;
  for (const [field, value] of Object.entries(expected)) {
    if (claim[field] !== value) {
      issues.push(`${label}: ${field}=${String(claim[field])} は manifest の ${String(value)} と相反します`);
    }
  }
}

function validateReport(path, requiredIds, manifest, root, issues) {
  const full = join(root, path);
  if (!existsSync(full)) {
    issues.push(`report_refs: ${path} が存在しません`);
    return;
  }
  const claim = parseJsonMarker(readFileSync(full, "utf8"), CLAIM_PATTERN, path, issues);
  compareClaim(claim, expectedClaim(manifest), path, issues);
  const reported = Array.isArray(claim?.acceptance_ids) ? claim.acceptance_ids : [];
  for (const id of requiredIds) {
    if (!reported.includes(id)) issues.push(`${path}: acceptance_ids に ${id} がありません`);
  }
}

function validateTracking(path, requiredIds, manifest, root, issues) {
  const full = join(root, path);
  if (!existsSync(full)) {
    issues.push(`tracking_ref: ${path} が存在しません`);
    return;
  }
  const body = readFileSync(full, "utf8");
  const claim = parseJsonMarker(body, TRACKING_PATTERN, path, issues);
  compareClaim(claim, expectedClaim(manifest), path, issues);

  const frontmatterStatus = body.match(/^status:\s*["']?([\w-]+)["']?$/m)?.[1];
  const evaluationStatus = body.match(/^evaluation_status:\s*["']?([\w-]+)["']?$/m)?.[1];
  if (frontmatterStatus !== manifest.status?.tracking) {
    issues.push(`${path}: status=${String(frontmatterStatus)} は tracking=${String(manifest.status?.tracking)} と相反します`);
  }
  if (evaluationStatus !== manifest.status?.implementation) {
    issues.push(
      `${path}: evaluation_status=${String(evaluationStatus)} は implementation=${String(manifest.status?.implementation)} と相反します`,
    );
  }
  for (const id of requiredIds) {
    const checked = new RegExp(`^- \\[x\\] ${id}(?:\\s|\\b)`, "m").test(body);
    if (!checked) issues.push(`${path}: ${id} の実装受入がcheckedになっていません`);
  }
}

export function reconcileAcceptance(manifest, root = process.cwd()) {
  const issues = [];
  const entries = acceptanceEntries(manifest);
  const ids = entries.map((entry) => entry?.id);

  if (manifest?.schema_version !== 1) issues.push("schema_version は 1 でなければなりません");
  if (new Set(ids).size !== ids.length) issues.push("acceptance id が重複しています");
  if (JSON.stringify([...ids].sort()) !== JSON.stringify([...EXPECTED_IDS].sort())) {
    issues.push(`acceptance id は A1〜A10 の10件ちょうどでなければなりません: ${ids.join(", ")}`);
  }
  if (manifest?.status?.implementation !== "pass") issues.push("implementation は pass でなければなりません");
  if (!['published', 'unpublished'].includes(manifest?.status?.release)) {
    issues.push("release は published / unpublished のどちらかでなければなりません");
  }
  if (!['active', 'closed'].includes(manifest?.status?.tracking)) {
    issues.push("tracking は active / closed のどちらかでなければなりません");
  }

  for (const entry of entries) {
    if (entry?.implementation_status !== "pass") {
      issues.push(`${entry?.id ?? "（idなし）"}: implementation_status は pass でなければなりません`);
    }
    for (const field of REQUIRED_FIELDS) {
      if (!Array.isArray(entry?.[field]) || entry[field].length === 0) {
        issues.push(`${entry?.id ?? "（idなし）"} ${field}: 必須参照がありません`);
      }
    }
    if (!safeRelativePath(entry?.tracking_ref)) {
      issues.push(`${entry?.id ?? "（idなし）"} tracking_ref: 必須参照がありません`);
    }
  }

  const evidenceFiles = collectEvidence(manifest, root, issues);
  const current = computeEvaluationDigest(manifest, root);
  if (manifest?.evaluated_digest !== current.digest) {
    issues.push(`評価digestが古い: manifest=${String(manifest?.evaluated_digest)} current=${current.digest}`);
  }

  for (const entry of entries) {
    for (const testRef of entry.test_refs ?? []) {
      const expanded = expandRef(testRef, root);
      for (const path of expanded.files) {
        const body = readFileSync(join(root, path), "utf8");
        if (!/\b(?:expect|assert)\s*\(/.test(body)) {
          issues.push(`${entry.id} test_refs: ${path} にruntime assertionがありません`);
        }
        if (!/@tier\s+[12]\b/.test(body)) {
          issues.push(`${entry.id} test_refs: ${path} はCIで走るtier 1/2に属していません`);
        }
      }
    }
  }

  const reportToIds = new Map();
  const trackingToIds = new Map();
  for (const entry of entries) {
    for (const ref of entry.report_refs ?? []) {
      const path = refLabel(ref);
      if (!reportToIds.has(path)) reportToIds.set(path, new Set());
      reportToIds.get(path).add(entry.id);
    }
    if (safeRelativePath(entry.tracking_ref)) {
      if (!trackingToIds.has(entry.tracking_ref)) trackingToIds.set(entry.tracking_ref, new Set());
      trackingToIds.get(entry.tracking_ref).add(entry.id);
    }
  }
  for (const [path, requiredIds] of reportToIds) {
    validateReport(path, requiredIds, manifest, root, issues);
  }
  for (const [path, requiredIds] of trackingToIds) {
    validateTracking(path, requiredIds, manifest, root, issues);
  }

  return {
    ok: issues.length === 0,
    issues,
    acceptanceCount: entries.length,
    evidenceFileCount: evidenceFiles.length,
    digest: current.digest,
  };
}

export function reconcileRepository(root = process.cwd(), manifestPath = DEFAULT_MANIFEST) {
  const full = resolve(root, manifestPath);
  if (!existsSync(full)) {
    return {
      ok: false,
      issues: [`manifest がありません: ${relative(root, full)}`],
      acceptanceCount: 0,
      evidenceFileCount: 0,
      digest: null,
    };
  }
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(full, "utf8"));
  } catch (error) {
    return {
      ok: false,
      issues: [`manifest を読めません: ${error instanceof Error ? error.message : error}`],
      acceptanceCount: 0,
      evidenceFileCount: 0,
      digest: null,
    };
  }
  return reconcileAcceptance(manifest, root);
}

function replaceClaim(body, pattern, claim, label) {
  if (!pattern.test(body)) throw new Error(`${label} に acceptance-reconciliation marker がありません`);
  pattern.lastIndex = 0;
  const prefix = pattern === TRACKING_PATTERN ? "acceptance_reconciliation: " : "<!-- acceptance-reconciliation ";
  const suffix = pattern === TRACKING_PATTERN ? "" : " -->";
  return body.replace(pattern, `${prefix}${JSON.stringify(claim)}${suffix}`);
}

function writeCurrentEvaluation(root, manifestPath) {
  const full = resolve(root, manifestPath);
  const manifest = JSON.parse(readFileSync(full, "utf8"));
  const current = computeEvaluationDigest(manifest, root);
  manifest.evaluated_digest = current.digest;
  writeFileSync(full, `${JSON.stringify(manifest, null, 2)}\n`);

  const claim = {
    implementation_status: manifest.status.implementation,
    release_status: manifest.status.release,
    tracking_status: manifest.status.tracking,
    evaluated_digest: current.digest,
    acceptance_ids: EXPECTED_IDS,
  };
  const reports = new Set(manifest.acceptance.flatMap((entry) => entry.report_refs.map(refLabel)));
  for (const path of reports) {
    const report = join(root, path);
    writeFileSync(report, replaceClaim(readFileSync(report, "utf8"), CLAIM_PATTERN, claim, path));
  }
  const tracking = new Set(manifest.acceptance.map((entry) => entry.tracking_ref));
  const trackingClaim = {
    implementation_status: manifest.status.implementation,
    release_status: manifest.status.release,
    tracking_status: manifest.status.tracking,
    evaluated_digest: current.digest,
    manifest_ref: manifestPath,
  };
  for (const path of tracking) {
    const target = join(root, path);
    writeFileSync(target, replaceClaim(readFileSync(target, "utf8"), TRACKING_PATTERN, trackingClaim, path));
  }

  const result = reconcileAcceptance(manifest, root);
  if (!result.ok) throw new Error(result.issues.join("\n"));
  const evidencePath = manifest.evidence_output;
  if (!safeRelativePath(evidencePath)) throw new Error("evidence_output がありません");
  const evidence = [
    "# acceptance reconciliation（自動生成）",
    "",
    `- generated_at: ${new Date().toISOString()}`,
    `- feature_id: ${manifest.feature_id}`,
    `- implementation_status: ${manifest.status.implementation}`,
    `- release_status: ${manifest.status.release}`,
    `- tracking_status: ${manifest.status.tracking}`,
    `- acceptance_count: ${result.acceptanceCount}`,
    `- evidence_file_count: ${result.evidenceFileCount}`,
    `- evaluated_digest: ${result.digest}`,
    "- verdict: PASS",
    "",
    "## 検査対象パターンと実測（下限 / 実測）",
    "",
    "件数の総和ではなく、どのパターンが何件を掴んでいたかを残す。",
    "パターンを書き換えて別の母集団を数えても総数は変わらないことがあるため。",
    "",
    ...collectPatternCoverage(manifest, root).map(
      (row) => `- \`${row.pattern}\`: min ${row.min} / actual ${row.actual}`,
    ),
    "",
    "A1〜A10は、仕様・runtime・test・report・trackingの共通IDでjoin済み。",
    "この証跡はreconciliationの結果であり、テスト実行件数の代替ではない。",
    "",
  ].join("\n");
  mkdirSync(dirname(join(root, evidencePath)), { recursive: true });
  writeFileSync(join(root, evidencePath), evidence);
  return result;
}

function printResult(result) {
  if (result.ok) {
    process.stdout.write(
      `受入reconciliation: PASS（${result.acceptanceCount} IDs / ${result.evidenceFileCount} evidence files）\n${result.digest}\n`,
    );
    return;
  }
  process.stdout.write("受入reconciliation: FAIL\n");
  for (const issue of result.issues) process.stdout.write(`- ${issue}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const root = process.cwd();
  const manifestPath = process.env.ACCEPTANCE_RECONCILIATION_MANIFEST ?? DEFAULT_MANIFEST;
  try {
    const result = process.argv.includes("--write")
      ? writeCurrentEvaluation(root, manifestPath)
      : reconcileRepository(root, manifestPath);
    printResult(result);
    process.exit(result.ok ? 0 : 1);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
    process.exit(1);
  }
}
