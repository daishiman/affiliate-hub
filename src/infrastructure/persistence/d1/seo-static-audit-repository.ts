import { and, asc, eq, getTableColumns, sql } from "drizzle-orm";
import type { SeoStaticAuditPort, StaticAuditInventory, StaticAuditScan, StaticAuditTarget } from "@/application/ports/seo-static-audit";
import type { PublishedArticle } from "@/application/read-models/published-article";
import { publicPageInventory, STATIC_AUDIT_INVENTORY_LIMIT } from "@/application/seo/static-audit-inventory";
import type { SiteBlueprint } from "@/domain/authoring/site-blueprint";
import { SITE_DOCUMENT_KIND_BY_KEY, type SiteDocumentKey } from "@/domain/authoring/site-routes";
import { pageKeyOf } from "@/domain/seo/aeo-measurement/page-key";
import type { PageObservation } from "@/domain/seo/aeo-measurement/page-observation";
import { domainError, notFound, validationError } from "@/domain/shared/errors";
import { err, ok } from "@/domain/shared/result";
import { seoStaticAuditScans, seoStaticAuditTargets, type SeoStaticAuditScanRow, type SeoStaticAuditTargetRow } from "@/db/schema";
import { jsonArrayChunks } from "./json-array-chunks";
import type { DrizzleD1 } from "./link-inbox-repository";
import { storageFailure } from "./storage-failure";

export const STATIC_AUDIT_CLAIM_LIMIT = 25;
/** 25件×既存10秒timeoutを待てる有限の実行権。失効後の書込みは拒否する。 */
export const STATIC_AUDIT_LEASE_MS = 10 * 60 * 1_000;
const OBSERVATION_BYTES = 128 * 1_024;
const CANDIDATE_BYTES = 8 * 1_024 * 1_024;
const COMPLETE_LIMITED_RETRY_MS = 14 * 24 * 60 * 60 * 1_000;
const FAILURE_CODES = new Set(["http_error", "timeout", "invalid_response", "resource_limit", "unavailable"]);
const DOCUMENT_KEY_BY_KIND = new Map<string, SiteDocumentKey>(
  Object.entries(SITE_DOCUMENT_KIND_BY_KEY).map(([key, kind]) => [kind, key as SiteDocumentKey]),
);
const conflict = () => err(domainError("CONFLICT", "別の静的監査が先に進んだか、取得権の期限が切れました。次回の確認へ引き継ぎます。"));
const invalid = () => err(validationError("静的監査の対象・日時・取得結果の対応を確認できません。"));

export function createD1SeoStaticAuditRepository({ db, workspaceId }: { readonly db: DrizzleD1; readonly workspaceId: string }): SeoStaticAuditPort {
  const readScan = async (siteSlug: string) => (await db.select().from(seoStaticAuditScans).where(and(
    eq(seoStaticAuditScans.workspaceId, workspaceId), eq(seoStaticAuditScans.siteSlug, siteSlug),
  )).limit(1))[0];
  const readTargets = async (siteSlug: string, runId: string, observations = false) => db.select({
    ...getTableColumns(seoStaticAuditTargets),
    // 巡回と件数表示は観測内容を使わない。最大1000件のJSONを毎回転送しない。
    observationJson: observations ? seoStaticAuditTargets.observationJson
      : sql<string | null>`CASE WHEN ${seoStaticAuditTargets.observationJson} IS NULL THEN NULL ELSE '{}' END`,
  }).from(seoStaticAuditTargets).where(and(
    eq(seoStaticAuditTargets.workspaceId, workspaceId), eq(seoStaticAuditTargets.siteSlug, siteSlug), eq(seoStaticAuditTargets.runId, runId),
  )).orderBy(asc(seoStaticAuditTargets.position)).limit(STATIC_AUDIT_INVENTORY_LIMIT);
  const failure = (operation: string, cause: unknown) => {
    // Guard-only NOT NULL constraints deliberately abort the entire D1 batch.
    const message = String(cause);
    if (message.includes("seo_static_audit_scan.revision") || message.includes("seo_finding_site_snapshot.last_collected_at")) return conflict();
    return storageFailure(operation, cause);
  };

  async function begin(input: Parameters<SeoStaticAuditPort["beginOrResume"]>[0], retry = true): ReturnType<SeoStaticAuditPort["beginOrResume"]> {
    const at = timestamp(input.at);
    if (at === null || !Number.isInteger(input.limit) || input.limit < 1 || input.limit > STATIC_AUDIT_CLAIM_LIMIT || !validInventory(input.inventory)) return invalid();
    const inv = input.inventory;
    const targets = [...inv.targets].sort((left, right) => left.pageKey < right.pageKey ? -1 : left.pageKey > right.pageKey ? 1 : 0);
    const inventoryHash = await hash(JSON.stringify([inv.emitLlmsTxt, inv.complete, inv.total, targets]));
    try {
      let row = await readScan(inv.siteSlug);
      if (row && row.updatedAt.getTime() > at) return conflict();
      const retryCompleteLimited = row?.status === "limited" && row.inventoryComplete
        && row.updatedAt.getTime() + COMPLETE_LIMITED_RETRY_MS <= at;
      if (!row || row.inventoryHash !== inventoryHash || row.status === "published" || retryCompleteLimited) {
        const previous = row;
        const runId = `ssa_${crypto.randomUUID()}`;
        const status = inv.complete ? (targets.length === 0 ? "ready" : "collecting") : "limited";
        const statements: D1PreparedStatement[] = [];
        if (previous) {
          statements.push(db.$client.prepare(`UPDATE seo_static_audit_scan SET
            revision=CASE WHEN revision=? AND updated_at<=? THEN revision+1 ELSE NULL END,
            run_id=?,inventory_hash=?,status=?,inventory_complete=?,total=?,next_position=0,
            lease_id=NULL,lease_expires_at=NULL,lease_targets_json=NULL,started_at=?,updated_at=?,completed_at=NULL
            WHERE workspace_id=? AND site_slug=?`).bind(previous.revision, at, runId, inventoryHash, status, inv.complete ? 1 : 0, inv.total, at, at, workspaceId, inv.siteSlug));
        } else {
          statements.push(db.$client.prepare(`INSERT INTO seo_static_audit_scan
            (workspace_id,site_slug,run_id,revision,inventory_hash,status,inventory_complete,total,started_at,updated_at)
            VALUES (?,?,?,1,?,?,?,?,?,?)`).bind(workspaceId, inv.siteSlug, runId, inventoryHash, status, inv.complete ? 1 : 0, inv.total, at, at));
        }
        for (const payload of jsonArrayChunks(targets.map((target, position) => ({ ...target, position, updatedAt: timestamp(target.updatedAt) })))) {
          statements.push(db.$client.prepare(`INSERT INTO seo_static_audit_target
            (workspace_id,site_slug,run_id,page_key,url,article_slug,position,target_updated_at,last_attempt_at,last_success_at,last_failure_at,failure_code)
            SELECT ?,?,?,json_extract(item.value,'$.pageKey'),json_extract(item.value,'$.url'),json_extract(item.value,'$.articleSlug'),
              json_extract(item.value,'$.position'),json_extract(item.value,'$.updatedAt'),old.last_attempt_at,old.last_success_at,old.last_failure_at,old.failure_code
            FROM json_each(?) AS item LEFT JOIN seo_static_audit_target AS old
              ON old.workspace_id=? AND old.site_slug=? AND old.run_id=? AND old.page_key=json_extract(item.value,'$.pageKey')
              AND old.url=json_extract(item.value,'$.url')`).bind(workspaceId, inv.siteSlug, runId, payload, workspaceId, inv.siteSlug, previous?.runId ?? ""));
        }
        statements.push(db.$client.prepare("DELETE FROM seo_static_audit_target WHERE workspace_id=? AND site_slug=? AND run_id<>?").bind(workspaceId, inv.siteSlug, runId));
        await db.$client.batch(statements);
        row = await readScan(inv.siteSlug);
      }
      if (!row) return conflict();
      if (row.status === "ready") return ok({ scan: toScan(row), claim: null, skippedReason: null });
      if (row.status === "limited") return ok({
        scan: toScan(row),
        claim: null,
        skippedReason: row.inventoryComplete
          ? "観測結果の合計が安全な一括確認容量を超えたため、前回の所見を保持しています。"
          : "公開ページが監査上限1,000件を超えているため、全体の所見を更新していません。",
      });
      if (row.leaseId !== null && (row.leaseExpiresAt?.getTime() ?? 0) > at)
        return ok({ scan: toScan(row), claim: null, skippedReason: "このブログは別の実行が確認中です。" });
      const available = (await readTargets(inv.siteSlug, row.runId)).filter(target => target.observationJson === null);
      available.sort((left, right) => Number(left.position < row!.nextPosition) - Number(right.position < row!.nextPosition) || left.position - right.position);
      const selected = available.slice(0, input.limit);
      if (selected.length === 0) return ok({ scan: toScan(row), claim: null,
        skippedReason: inv.complete ? null : "対象が上限を超えているため、全体の確認は完了していません。" });
      const leaseId = `ssal_${crypto.randomUUID()}`;
      const leaseExpiresAt = at + STATIC_AUDIT_LEASE_MS;
      const changed = await db.$client.prepare(`UPDATE seo_static_audit_scan SET lease_id=?,lease_expires_at=?,lease_targets_json=?,revision=revision+1,updated_at=?
        WHERE workspace_id=? AND site_slug=? AND run_id=? AND revision=? AND updated_at<=?
          AND (lease_id IS NULL OR lease_expires_at<=?)`).bind(leaseId, leaseExpiresAt, JSON.stringify(selected.map(target => target.pageKey)), at,
          workspaceId, inv.siteSlug, row.runId, row.revision, at, at).run();
      if (Number(changed.meta.changes) !== 1) return conflict();
      const scan = toScan({ ...row, revision: row.revision + 1 });
      return ok({ scan, claim: { workspaceId, siteSlug: inv.siteSlug, runId: row.runId, revision: scan.revision,
        leaseId, leaseExpiresAt: new Date(leaseExpiresAt).toISOString(), targets: selected.map(toTarget) }, skippedReason: null });
    } catch (cause) {
      if (retry && (String(cause).includes("UNIQUE constraint failed") || String(cause).includes("seo_static_audit_scan.revision"))) return begin(input, false);
      return failure("静的監査の開始", cause);
    }
  }

  return {
    async inventory(input) {
      if (!input.siteSlug || !validOrigin(input.origin) || input.basePath !== `/s/${input.siteSlug}`) return invalid();
      try {
        const blueprint = await db.$client.prepare(`SELECT blueprint_json FROM site_blueprints AS site
          WHERE site.workspace_id=? AND site.slug=?
            AND NOT EXISTS (SELECT 1 FROM site_retirements WHERE slug=site.slug)
          LIMIT 1`).bind(workspaceId, input.siteSlug).first<{ blueprint_json: string }>();
        if (!blueprint) return err(notFound("公開ブログ", input.siteSlug));
        const site = JSON.parse(blueprint.blueprint_json) as SiteBlueprint;
        // The inventory builder needs only identities and timestamps, not article bodies.
        // Read the canonical projection once; its article source is never joined with an editor/sample list.
        const rows = await db.$client.prepare(`SELECT json_object(
            'siteSlug',site_slug,'slug',slug,'type',type,
            'title',json_extract(article_json,'$.title'),'summary',json_extract(article_json,'$.summary'),
            'updatedAt',json_extract(article_json,'$.updatedAt'),'categorySlug',category_slug,
            'author',json_object('slug',json_extract(article_json,'$.author.slug')),
            'reviewedBy',CASE WHEN json_extract(article_json,'$.reviewedBy.slug') IS NOT NULL
              THEN json_object('slug',json_extract(article_json,'$.reviewedBy.slug')) ELSE NULL END
          ) AS article_json FROM published_articles
          WHERE workspace_id=? AND site_slug=? AND archived_at IS NULL ORDER BY slug LIMIT ?`).bind(workspaceId, input.siteSlug, STATIC_AUDIT_INVENTORY_LIMIT + 1).all<{ article_json: string }>();
        if (rows.results.length > STATIC_AUDIT_INVENTORY_LIMIT) return ok({
          siteSlug: input.siteSlug,
          targets: [],
          // 上限超過を未開始や正確な全件数に見せないための下限値。
          total: STATIC_AUDIT_INVENTORY_LIMIT + 1,
          complete: false,
          emitLlmsTxt: site.emitLlmsTxt,
        });
        const articles = rows.results.map(row => JSON.parse(row.article_json) as PublishedArticle);
        const documents = await db.$client.prepare(`SELECT kind,updated_at FROM legal_page
          WHERE workspace_id=? AND site_slug=? AND status='published' AND deleted_at IS NULL ORDER BY kind`)
          .bind(workspaceId, input.siteSlug).all<{ kind: string; updated_at: number }>();
        const publishedDocuments = documents.results.flatMap((document) => {
          const key = DOCUMENT_KEY_BY_KIND.get(document.kind);
          return key === undefined || !Number.isFinite(document.updated_at)
            ? []
            : [{ key, updatedAt: new Date(document.updated_at * 1_000).toISOString() }];
        });
        return ok(publicPageInventory({ ...input, site, articles, publishedDocuments }));
      } catch (cause) { return failure("静的監査対象の取得", cause); }
    },
    beginOrResume: begin,

    async stage(input) {
      const { claim } = input;
      const at = timestamp(input.at);
      if (at === null || claim.workspaceId !== workspaceId || input.attempts.length > STATIC_AUDIT_CLAIM_LIMIT) return invalid();
      try {
        const row = await readScan(claim.siteSlug);
        if (!row || row.runId !== claim.runId || row.revision !== claim.revision || row.leaseId !== claim.leaseId
          || (row.leaseExpiresAt?.getTime() ?? 0) <= at || row.updatedAt.getTime() > at) return conflict();
        const keys = JSON.parse(row.leaseTargetsJson ?? "[]") as string[];
        const attempts = new Map(input.attempts.map(attempt => [attempt.pageKey as string, attempt]));
        if (attempts.size !== input.attempts.length || attempts.size !== keys.length || keys.some(key => !attempts.has(key))) return invalid();
        const targets = await readTargets(claim.siteSlug, claim.runId);
        const byKey = new Map(targets.map(target => [target.pageKey, target]));
        const payloads: { pageKey: string; observation: string | null; errorCode: string | null }[] = [];
        let resourceLimitFailures = 0;
        for (const key of keys) {
          const target = byKey.get(key);
          const attempt = attempts.get(key)!;
          if (!target || (attempt.ok && (attempt.observation.pageKey !== key || attempt.observation.url !== target.url))
            || (!attempt.ok && !FAILURE_CODES.has(attempt.errorCode))) return invalid();
          const observation = attempt.ok ? observationJson(attempt.observation) : null;
          if (attempt.ok && observation === null) resourceLimitFailures += 1;
          payloads.push({
            pageKey: key,
            observation,
            errorCode: attempt.ok ? (observation === null ? "resource_limit" : null) : attempt.errorCode,
          });
        }
        const statements: D1PreparedStatement[] = [db.$client.prepare(`UPDATE seo_static_audit_scan SET
          revision=CASE WHEN run_id=? AND revision=? AND lease_id=? AND lease_expires_at>? AND updated_at<=? THEN revision+1 ELSE NULL END
          WHERE workspace_id=? AND site_slug=?`).bind(claim.runId, claim.revision, claim.leaseId, at, at, workspaceId, claim.siteSlug)];
        for (const payload of jsonArrayChunks(payloads)) statements.push(db.$client.prepare(`UPDATE seo_static_audit_target AS target SET
          last_attempt_at=?,last_success_at=CASE WHEN json_extract(item.value,'$.errorCode') IS NULL THEN ? ELSE last_success_at END,
          last_failure_at=CASE WHEN json_extract(item.value,'$.errorCode') IS NOT NULL THEN ? ELSE last_failure_at END,
          failure_code=json_extract(item.value,'$.errorCode'),observation_json=json_extract(item.value,'$.observation')
          FROM json_each(?) AS item WHERE target.workspace_id=? AND target.site_slug=? AND target.run_id=?
            AND target.page_key=json_extract(item.value,'$.pageKey')`).bind(at, at, at, payload, workspaceId, claim.siteSlug, claim.runId));
        const nextPosition = ((byKey.get(keys.at(-1) ?? "")?.position ?? -1) + 1) % Math.max(targets.length, 1);
        statements.push(db.$client.prepare(`UPDATE seo_static_audit_scan SET next_position=?,lease_id=NULL,lease_expires_at=NULL,lease_targets_json=NULL,updated_at=?,
          status=CASE WHEN inventory_complete=0 THEN 'limited' WHEN NOT EXISTS
            (SELECT 1 FROM seo_static_audit_target WHERE workspace_id=? AND site_slug=? AND run_id=? AND observation_json IS NULL)
            THEN 'ready' ELSE 'collecting' END WHERE workspace_id=? AND site_slug=? AND run_id=? AND revision=?`).bind(
              nextPosition, at, workspaceId, claim.siteSlug, claim.runId, workspaceId, claim.siteSlug, claim.runId, claim.revision + 1));
        const results = await db.$client.batch(statements);
        if (Number(results[0]?.meta.changes) !== 1) return conflict();
        return ok({ scan: toScan((await readScan(claim.siteSlug))!), resourceLimitFailures });
      } catch (cause) { return failure("静的監査結果の保存", cause); }
    },

    async loadCompleteCandidate(input) {
      const at = timestamp(input.at);
      if (at === null || !input.siteSlug) return invalid();
      try {
        const row = await readScan(input.siteSlug);
        if (!row || row.status !== "ready" || !row.inventoryComplete || row.leaseId !== null || row.updatedAt.getTime() > at)
          return ok({ candidate: null, limitedReason: null });
        const bytes = Number(await db.$client.prepare(`SELECT coalesce(sum(length(CAST(observation_json AS BLOB))),0) AS bytes
          FROM seo_static_audit_target WHERE workspace_id=? AND site_slug=? AND run_id=?`)
          .bind(workspaceId, input.siteSlug, row.runId).first("bytes"));
        if (bytes > CANDIDATE_BYTES) {
          const changed = await db.$client.prepare(`UPDATE seo_static_audit_scan SET
            revision=CASE WHEN run_id=? AND revision=? AND status='ready' AND inventory_complete=1 AND lease_id IS NULL AND updated_at<=?
              THEN revision+1 ELSE NULL END,status='limited',updated_at=?
            WHERE workspace_id=? AND site_slug=?`).bind(row.runId, row.revision, at, at, workspaceId, input.siteSlug).run();
          if (Number(changed.meta.changes) !== 1) return conflict();
          return ok({
            candidate: null,
            limitedReason: "観測結果の合計が安全な一括確認容量を超えたため、前回の所見を保持し、14日後に再試行します。",
          });
        }
        const targets = await readTargets(input.siteSlug, row.runId, true);
        if (targets.length !== row.total || targets.some(target => target.observationJson === null))
          return ok({ candidate: null, limitedReason: null });
        return ok({
          candidate: { scan: toScan(row), pages: targets.map(target => ({ target: toTarget(target), observation: JSON.parse(target.observationJson!) as PageObservation })) },
          limitedReason: null,
        });
      } catch (cause) { return failure("静的監査の完了候補の取得", cause); }
    },

    async markPublished(input) {
      const at = timestamp(input.at);
      const candidate = input.candidate.scan;
      if (at === null || candidate.workspaceId !== workspaceId) return invalid();
      try {
        const row = await readScan(candidate.siteSlug);
        if (!row || row.runId !== candidate.runId || row.revision !== candidate.revision || row.status !== "ready" || row.leaseId !== null || !row.inventoryComplete || row.updatedAt.getTime() > at) return conflict();
        const targets = await readTargets(candidate.siteSlug, candidate.runId);
        const byKey = new Map(targets.map(target => [target.pageKey, target]));
        if (targets.length !== row.total || targets.some(target => target.observationJson === null)) return conflict();
        const findingKeys = new Set(input.findings.map(finding => `${finding.pageKey}\u0000${finding.code}`));
        if (findingKeys.size !== input.findings.length || input.findings.some(finding => finding.source !== "static_audit" || !byKey.has(finding.pageKey)
          || timestamp(finding.observedAt) === null || Date.parse(finding.observedAt) > at || Date.parse(finding.observedAt) < row.startedAt.getTime())) return invalid();
        const previous = await db.$client.prepare("SELECT page_key,code FROM seo_finding WHERE workspace_id=? AND site_slug=? AND source='static_audit'")
          .bind(workspaceId, candidate.siteSlug).all<{ page_key: string; code: string }>();
        const previousKeys = new Set(previous.results.map(finding => `${finding.page_key}\u0000${finding.code}`));
        const added = [...findingKeys].filter(key => !previousKeys.has(key)).length;
        const resolved = [...previousKeys].filter(key => !findingKeys.has(key)).length;
        const seconds = Math.floor(at / 1_000);
        const statements: D1PreparedStatement[] = [db.$client.prepare(`UPDATE seo_static_audit_scan SET
          revision=CASE WHEN run_id=? AND revision=? AND status='ready' AND inventory_complete=1 AND lease_id IS NULL AND updated_at<=?
            AND NOT EXISTS (SELECT 1 FROM seo_finding WHERE workspace_id=? AND site_slug=? AND source='static_audit' AND observed_at>?)
            THEN revision+1 ELSE NULL END WHERE workspace_id=? AND site_slug=?`).bind(
              candidate.runId, candidate.revision, at, workspaceId, candidate.siteSlug, seconds, workspaceId, candidate.siteSlug)];
        statements.push(db.$client.prepare(`INSERT INTO seo_finding_site_snapshot (workspace_id,site_slug,source,last_collected_at)
          VALUES (?,?,'static_audit',?) ON CONFLICT(workspace_id,site_slug,source) DO UPDATE SET
          last_collected_at=CASE WHEN seo_finding_site_snapshot.last_collected_at<=excluded.last_collected_at THEN excluded.last_collected_at ELSE NULL END`)
          .bind(workspaceId, candidate.siteSlug, seconds));
        statements.push(db.$client.prepare("DELETE FROM seo_finding WHERE workspace_id=? AND site_slug=? AND source='static_audit' AND observed_at<=?").bind(workspaceId, candidate.siteSlug, seconds));
        for (const payload of jsonArrayChunks(input.findings.map(finding => ({ ...finding, articleSlug: byKey.get(finding.pageKey)!.articleSlug,
          observedAt: Math.floor(Date.parse(finding.observedAt) / 1000) })))) {
          statements.push(db.$client.prepare(`INSERT INTO seo_finding (id,workspace_id,site_slug,page_key,article_slug,source,code,detail,observed_at,applied_at)
            SELECT 'sf_' || lower(hex(randomblob(16))),?,?,json_extract(value,'$.pageKey'),json_extract(value,'$.articleSlug'),
              'static_audit',json_extract(value,'$.code'),json_extract(value,'$.detail'),json_extract(value,'$.observedAt'),NULL FROM json_each(?)`)
            .bind(workspaceId, candidate.siteSlug, payload));
        }
        for (const payload of jsonArrayChunks(targets.map(target => ({ pageKey: target.pageKey, articleSlug: target.articleSlug, observedAt: Math.floor(target.lastSuccessAt!.getTime() / 1_000) })))) {
          statements.push(db.$client.prepare(`INSERT INTO seo_page_observation (workspace_id,site_slug,article_slug,page_key,source,last_collected_at)
            SELECT ?,?,json_extract(value,'$.articleSlug'),json_extract(value,'$.pageKey'),'static_audit',json_extract(value,'$.observedAt') FROM json_each(?) WHERE true
            ON CONFLICT(workspace_id,page_key,source) DO UPDATE SET site_slug=excluded.site_slug,article_slug=excluded.article_slug,
              last_collected_at=max(seo_page_observation.last_collected_at,excluded.last_collected_at)`)
            .bind(workspaceId, candidate.siteSlug, payload));
        }
        statements.push(db.$client.prepare(`INSERT INTO seo_source_collection (id,workspace_id,source,last_collected_at,last_failed_at,last_failure_reason)
          VALUES ('ssc_' || lower(hex(randomblob(16))),?,'static_audit',?,NULL,'') ON CONFLICT(workspace_id,source) DO UPDATE SET
          last_collected_at=max(coalesce(seo_source_collection.last_collected_at,0),excluded.last_collected_at),
          last_failed_at=CASE WHEN coalesce(seo_source_collection.last_failed_at,0)<=excluded.last_collected_at THEN NULL ELSE seo_source_collection.last_failed_at END,
          last_failure_reason=CASE WHEN coalesce(seo_source_collection.last_failed_at,0)<=excluded.last_collected_at THEN '' ELSE seo_source_collection.last_failure_reason END`)
          .bind(workspaceId, seconds));
        statements.push(db.$client.prepare(`UPDATE seo_static_audit_scan SET status='published',completed_at=?,last_completed_at=?,updated_at=?
          WHERE workspace_id=? AND site_slug=? AND run_id=? AND revision=?`).bind(at, at, at, workspaceId, candidate.siteSlug, candidate.runId, candidate.revision + 1));
        const results = await db.$client.batch(statements);
        if (Number(results[0]?.meta.changes) !== 1) return conflict();
        return ok({ scan: toScan((await readScan(candidate.siteSlug))!), added, resolved });
      } catch (cause) { return failure("静的監査所見の確定", cause); }
    },

    async coverage(input) {
      const staleBefore = timestamp(input.staleBefore);
      if (staleBefore === null) return invalid();
      try {
        const active = await db.$client.prepare(`SELECT site.slug FROM site_blueprints AS site
          WHERE site.workspace_id=?
            AND (? IS NULL OR site.slug=?)
            AND NOT EXISTS (SELECT 1 FROM site_retirements WHERE slug=site.slug)
          ORDER BY site.slug`).bind(workspaceId, input.siteSlug ?? null, input.siteSlug ?? null).all<{ slug: string }>();
        const scans = await db.select().from(seoStaticAuditScans).where(eq(seoStaticAuditScans.workspaceId, workspaceId));
        const scanBySite = new Map(scans.map((scan) => [scan.siteSlug, scan]));
        const findingCounts = await db.$client.prepare(`SELECT site_slug,count(*) AS n FROM seo_finding
          WHERE workspace_id=? AND source='static_audit' GROUP BY site_slug`).bind(workspaceId).all<{ site_slug: string; n: number }>();
        const findingCountBySite = new Map(findingCounts.results.map((row) => [row.site_slug, Number(row.n)]));
        const targetCounts = await db.$client.prepare(`SELECT target.site_slug,
            count(*) AS target_count,
            sum(CASE WHEN target.failure_code IS NOT NULL THEN 1 ELSE 0 END) AS failed,
            sum(CASE WHEN target.failure_code IS NULL AND target.last_success_at IS NULL THEN 1 ELSE 0 END) AS never,
            sum(CASE WHEN target.failure_code IS NULL AND target.last_success_at IS NOT NULL
              AND (target.last_success_at<? OR coalesce(target.target_updated_at,0)>target.last_success_at) THEN 1 ELSE 0 END) AS stale,
            sum(CASE WHEN target.failure_code IS NULL AND target.last_success_at IS NOT NULL
              AND target.last_success_at>=? AND coalesce(target.target_updated_at,0)<=target.last_success_at THEN 1 ELSE 0 END) AS current
          FROM seo_static_audit_target AS target
          INNER JOIN seo_static_audit_scan AS scan
            ON scan.workspace_id=target.workspace_id AND scan.site_slug=target.site_slug AND scan.run_id=target.run_id
          WHERE target.workspace_id=? GROUP BY target.site_slug`)
          .bind(staleBefore, staleBefore, workspaceId)
          .all<{ site_slug: string; target_count: number; failed: number; never: number; stale: number; current: number }>();
        const targetCountBySite = new Map(targetCounts.results.map((row) => [row.site_slug, row]));
        const coverage = [];
        for (const site of active.results) {
          const scan = scanBySite.get(site.slug);
          const currentFindingCount = findingCountBySite.get(site.slug) ?? 0;
          if (scan === undefined) {
            coverage.push({ siteSlug: site.slug, status: "not_started" as const, total: 0, current: 0, never: 0,
              failed: 0, stale: 0, inventoryComplete: false, startedAt: null, lastCompletedAt: null, currentFindingCount });
            continue;
          }
          const counts = targetCountBySite.get(scan.siteSlug);
          const current = Number(counts?.current ?? 0);
          const failed = Number(counts?.failed ?? 0);
          const stale = Number(counts?.stale ?? 0);
          const never = Number(counts?.never ?? 0) + Math.max(0, scan.total - Number(counts?.target_count ?? 0));
          coverage.push({ siteSlug: scan.siteSlug, status: scan.status, total: scan.total, current, never, failed, stale,
            inventoryComplete: scan.inventoryComplete, startedAt: scan.startedAt.toISOString(), lastCompletedAt: scan.lastCompletedAt?.toISOString() ?? null, currentFindingCount });
        }
        return ok(coverage);
      } catch (cause) { return failure("静的監査の確認範囲の取得", cause); }
    },
  };
}

function timestamp(value: string | null): number | null {
  if (value === null) return null;
  const at = Date.parse(value);
  return Number.isFinite(at) ? at : null;
}
function toTarget(row: SeoStaticAuditTargetRow): StaticAuditTarget {
  return { pageKey: row.pageKey as StaticAuditTarget["pageKey"], url: row.url, articleSlug: row.articleSlug, updatedAt: row.targetUpdatedAt?.toISOString() ?? null };
}
function toScan(row: SeoStaticAuditScanRow): StaticAuditScan {
  return { workspaceId: row.workspaceId, siteSlug: row.siteSlug, runId: row.runId, revision: row.revision,
    inventoryHash: row.inventoryHash, status: row.status, total: row.total, inventoryComplete: row.inventoryComplete,
    startedAt: row.startedAt.toISOString(), completedAt: row.completedAt?.toISOString() ?? null, lastCompletedAt: row.lastCompletedAt?.toISOString() ?? null };
}
function validOrigin(raw: string): boolean {
  try { const url = new URL(raw); return url.origin === raw && /^https?:$/.test(url.protocol) && !url.username && !url.password; } catch { return false; }
}
function validInventory(inv: StaticAuditInventory): boolean {
  if (!inv.siteSlug || !Number.isSafeInteger(inv.total) || inv.total < inv.targets.length || inv.targets.length > STATIC_AUDIT_INVENTORY_LIMIT
    || (inv.complete && inv.total !== inv.targets.length) || new Set(inv.targets.map(target => target.pageKey)).size !== inv.targets.length) return false;
  return inv.targets.every(target => {
    const key = pageKeyOf(target.url);
    try {
      const url = new URL(target.url), basePath = `/s/${inv.siteSlug}`;
      return key.ok && key.key === target.pageKey && (url.pathname === basePath || url.pathname.startsWith(`${basePath}/`))
        && (target.updatedAt === null || timestamp(target.updatedAt) !== null);
    } catch { return false; }
  });
}
async function hash(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}
function observationJson(observation: PageObservation): string | null {
  // Explicit allowlist: callers cannot add HTML bodies, request headers or secrets to this ledger.
  const safe: PageObservation = { pageKey: observation.pageKey, url: observation.url, title: observation.title,
    metaDescription: observation.metaDescription, canonical: observation.canonical, ogImage: observation.ogImage,
    jsonLdTypes: observation.jsonLdTypes, headingLevels: observation.headingLevels, internalLinkCount: observation.internalLinkCount,
    images: observation.images.map(image => ({ src: image.src, hasAlt: image.hasAlt, hasDimensions: image.hasDimensions })),
    ...(observation.openGraph === undefined ? {} : { openGraph: { title: observation.openGraph.title, description: observation.openGraph.description,
      type: observation.openGraph.type, url: observation.openGraph.url, image: observation.openGraph.image } }),
    ...(observation.jsonLdNodes === undefined ? {} : { jsonLdNodes: observation.jsonLdNodes.map(node => ({ types: node.types,
      properties: node.properties, datePublished: node.datePublished, dateModified: node.dateModified })) }),
    ...(observation.visibleDateTimes === undefined ? {} : { visibleDateTimes: observation.visibleDateTimes }),
    ...(observation.internalLinkPageKeys === undefined ? {} : { internalLinkPageKeys: observation.internalLinkPageKeys }),
  };
  const json = JSON.stringify(safe);
  return new TextEncoder().encode(json).byteLength <= OBSERVATION_BYTES ? json : null;
}
