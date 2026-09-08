import type {
  CitationMonthlyBudgetStatus,
  SeoCitationBudgetPort,
} from "@/application/ports/seo-measurement";
import { MAX_CITATION_MONTHLY_SEARCH_LIMIT } from "@/application/ports/seo-measurement";
import { domainError, err, ok, validationError } from "@/domain/shared";
import type { DrizzleD1 } from "./link-inbox-repository";
import { jsonArrayChunks } from "./json-array-chunks";
import { storageFailure } from "./storage-failure";

const LEASE_SECONDS = 60 * 60;

type Deps = { readonly db: DrizzleD1; readonly workspaceId: string };

type TotalRow = {
  readonly used: number | null;
  readonly unconfirmed: number | null;
  readonly reserved: number | null;
};

export function createD1SeoCitationBudgetRepository({ db, workspaceId }: Deps): SeoCitationBudgetPort {
  async function current(input: Parameters<SeoCitationBudgetPort["current"]>[0]) {
    const time = budgetTime(input.at);
    if (time === null || !validLimit(input.monthlyLimit)) {
      return err(validationError("AI検索の月次予算を確認できません。"));
    }
    try {
      return ok(await readStatus(time.monthKey, input.monthlyLimit, time.seconds));
    } catch (cause) {
      return storageFailure("AI検索の月次予算の取得", cause);
    }
  }

  async function readStatus(monthKey: string, monthlyLimit: number | null, atSeconds: number): Promise<CitationMonthlyBudgetStatus> {
    const expiredAt = atSeconds - LEASE_SECONDS;
    const row = await db.$client.prepare(`SELECT
      coalesce(sum(used_searches),0) AS used,
      coalesce(sum(unconfirmed_searches + CASE
        WHEN lease_id IS NOT NULL AND lease_at<=? THEN reserved_searches ELSE 0 END),0) AS unconfirmed,
      coalesce(sum(CASE
        WHEN lease_id IS NOT NULL AND lease_at>? THEN reserved_searches ELSE 0 END),0) AS reserved
      FROM seo_ai_citation_monthly_usage
      WHERE workspace_id=? AND month_key=?`).bind(expiredAt, expiredAt, workspaceId, monthKey).first<TotalRow>();
    const usedSearches = Number(row?.used ?? 0);
    const unconfirmedSearches = Number(row?.unconfirmed ?? 0);
    const reservedSearches = Number(row?.reserved ?? 0);
    const allocated = usedSearches + unconfirmedSearches + reservedSearches;
    const remainingSearches = monthlyLimit === null ? null : Math.max(0, monthlyLimit - allocated);
    return {
      monthKey,
      limitSearches: monthlyLimit,
      usedSearches,
      unconfirmedSearches,
      reservedSearches,
      remainingSearches,
      reached: remainingSearches === 0 && monthlyLimit !== null,
    };
  }

  return {
    current,

    async reserve(input) {
      const time = budgetTime(input.at);
      if (time === null || input.siteSlug.trim() === "" || !validLimit(input.monthlyLimit)
          || input.monthlyLimit === null || !validCount(input.siteMonthlyLimit)
          || !validPositiveCount(input.requestedSearches)) {
        return err(validationError("AI検索の予約範囲を確認できません。"));
      }
      const leaseId = `citation_${crypto.randomUUID()}`;
      const expiredAt = time.seconds - LEASE_SECONDS;
      try {
        // usageはsite/月1行、attemptは記事ごと最新1行に上書きし、実行回数に比例して増やさない。
        await db.$client.prepare(`INSERT INTO seo_ai_citation_monthly_usage
            (workspace_id,month_key,site_slug,used_searches,unconfirmed_searches,reserved_searches,lease_id,lease_at,revision,updated_at)
            VALUES (?,?,?,0,0,0,NULL,NULL,1,?)
            ON CONFLICT(workspace_id,month_key,site_slug) DO NOTHING`)
          .bind(workspaceId, time.monthKey, input.siteSlug, time.seconds).run();

        /*
         * D1の1 statement内でworkspace総枠とsite割当を再計算する。
         * 別siteの並行UPDATEも書込順に直列化され、後着は先着のreservedをSUMへ含める。
         * 期限切れleaseは、送信済みか判別できないのでunconfirmedへ移してから新規予約する。
         */
        const rows = await db.$client.prepare(`UPDATE seo_ai_citation_monthly_usage AS target SET
          unconfirmed_searches=unconfirmed_searches + CASE
            WHEN lease_id IS NOT NULL AND lease_at<=? THEN reserved_searches ELSE 0 END,
          reserved_searches=min(?,
            max(0, ? - (
              SELECT coalesce(sum(used_searches+unconfirmed_searches+reserved_searches),0)
              FROM seo_ai_citation_monthly_usage
              WHERE workspace_id=? AND month_key=?
            )),
            max(0, ? - (used_searches+unconfirmed_searches+reserved_searches))
          ),
          lease_id=?, lease_at=?, revision=revision+1, updated_at=max(updated_at,?)
          WHERE workspace_id=? AND month_key=? AND site_slug=?
            AND (lease_id IS NULL OR lease_at<=?)
            AND EXISTS (SELECT 1 FROM seo_measurement_setting
              WHERE workspace_id=? AND citation_monthly_search_limit=?)
            AND min(?,
              max(0, ? - (
                SELECT coalesce(sum(used_searches+unconfirmed_searches+reserved_searches),0)
                FROM seo_ai_citation_monthly_usage
                WHERE workspace_id=? AND month_key=?
              )),
              max(0, ? - (used_searches+unconfirmed_searches+reserved_searches))
            ) > 0
          RETURNING reserved_searches AS reserved`)
          .bind(
            expiredAt,
            input.requestedSearches, input.monthlyLimit, workspaceId, time.monthKey, input.siteMonthlyLimit,
            leaseId, time.seconds, time.seconds,
            workspaceId, time.monthKey, input.siteSlug, expiredAt,
            workspaceId, input.monthlyLimit,
            input.requestedSearches, input.monthlyLimit, workspaceId, time.monthKey, input.siteMonthlyLimit,
          ).all<{ reserved: number }>();

        const status = await readStatus(time.monthKey, input.monthlyLimit, time.seconds);
        const granted = Number(rows.results[0]?.reserved ?? 0);
        if (granted > 0) {
          return ok({
            reservation: { id: leaseId, monthKey: time.monthKey, siteSlug: input.siteSlug,
              reservedSearches: granted, limitSearches: input.monthlyLimit },
            status,
            unavailableReason: null,
          });
        }

        const site = await db.$client.prepare(`SELECT used_searches AS used,
          unconfirmed_searches AS unconfirmed,reserved_searches AS reserved,lease_id AS leaseId,lease_at AS leaseAt,
          (SELECT citation_monthly_search_limit FROM seo_measurement_setting WHERE workspace_id=?) AS currentLimit
          FROM seo_ai_citation_monthly_usage
          WHERE workspace_id=? AND month_key=? AND site_slug=?`)
          .bind(workspaceId, workspaceId, time.monthKey, input.siteSlug)
          .first<{ used: number; unconfirmed: number; reserved: number; leaseId: string | null; leaseAt: number | null; currentLimit: number | null }>();
        const siteAllocated = Number(site?.used ?? 0) + Number(site?.unconfirmed ?? 0) + Number(site?.reserved ?? 0);
        const concurrent = site?.leaseId !== null && Number(site?.leaseAt ?? 0) > expiredAt;
        return ok({
          reservation: null,
          status,
          unavailableReason: site?.currentLimit !== input.monthlyLimit ? "setting_changed"
            : concurrent ? "concurrent"
            : siteAllocated >= input.siteMonthlyLimit ? "site_exhausted" : "monthly_exhausted",
        });
      } catch (cause) {
        return storageFailure("AI検索の月次予算の予約", cause);
      }
    },

    async settle(input) {
      const time = budgetTime(input.at);
      const charged = input.usedSearches + input.unconfirmedSearches;
      if (time === null || !validCount(input.usedSearches) || !validCount(input.unconfirmedSearches)
          || charged > input.reservation.reservedSearches || input.reservation.id.trim() === ""
          || !/^\d{4}-\d{2}$/.test(input.reservation.monthKey)
          || input.reservation.siteSlug.trim() === "" || !validPositiveCount(input.reservation.reservedSearches)
          || !validLimit(input.reservation.limitSearches) || input.reservation.limitSearches === null
          || input.attempted.some((row) => row.siteSlug !== input.reservation.siteSlug || row.articleSlug.trim() === ""
            || budgetTime(row.attemptedAt) === null)) {
        return err(validationError("AI検索の使用数を確認できません。"));
      }

      try {
        const statements: D1PreparedStatement[] = [];
        for (const payload of jsonArrayChunks(input.attempted.map((row) => ({
          siteSlug: row.siteSlug,
          articleSlug: row.articleSlug,
          pageKey: row.pageKey,
          attemptedAt: Math.floor(Date.parse(row.attemptedAt) / 1_000),
        })))) {
          statements.push(db.$client.prepare(`INSERT INTO seo_ai_citation_attempt
            (workspace_id,site_slug,article_slug,page_key,last_attempted_at)
            SELECT ?,json_extract(j.value,'$.siteSlug'),json_extract(j.value,'$.articleSlug'),
              json_extract(j.value,'$.pageKey'),json_extract(j.value,'$.attemptedAt')
            FROM json_each(?) AS j
            WHERE EXISTS (
              SELECT 1 FROM seo_ai_citation_monthly_usage
              WHERE workspace_id=? AND month_key=? AND site_slug=? AND lease_id=? AND reserved_searches=?
            )
            ON CONFLICT(workspace_id,site_slug,article_slug) DO UPDATE SET
              page_key=excluded.page_key,last_attempted_at=excluded.last_attempted_at
            WHERE seo_ai_citation_attempt.last_attempted_at<=excluded.last_attempted_at`)
            .bind(workspaceId, payload, workspaceId, input.reservation.monthKey, input.reservation.siteSlug, input.reservation.id,
              input.reservation.reservedSearches));
        }
        statements.push(db.$client.prepare(`UPDATE seo_ai_citation_monthly_usage SET
          used_searches=used_searches+?,unconfirmed_searches=unconfirmed_searches+?,
          reserved_searches=0,lease_id=NULL,lease_at=NULL,revision=revision+1,updated_at=max(updated_at,?)
          WHERE workspace_id=? AND month_key=? AND site_slug=? AND lease_id=? AND reserved_searches=?`)
          .bind(input.usedSearches, input.unconfirmedSearches, time.seconds, workspaceId,
            input.reservation.monthKey, input.reservation.siteSlug, input.reservation.id,
            input.reservation.reservedSearches));

        const result = await db.$client.batch(statements);
        if ((result.at(-1)?.meta.changes ?? 0) !== 1) {
          return err(domainError("CONFLICT", "AI検索の予約は別の実行で確定済みです。"));
        }
        return ok(await readStatus(input.reservation.monthKey, input.reservation.limitSearches, time.seconds));
      } catch (cause) {
        return storageFailure("AI検索の月次予算の確定", cause);
      }
    },
  };
}

function validLimit(value: number | null): boolean {
  return value === null || (Number.isSafeInteger(value) && value >= 0 && value <= MAX_CITATION_MONTHLY_SEARCH_LIMIT);
}

function validCount(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= MAX_CITATION_MONTHLY_SEARCH_LIMIT;
}

function validPositiveCount(value: number): boolean {
  return validCount(value) && value > 0;
}

function budgetTime(raw: string): {
  readonly seconds: number;
  readonly monthKey: string;
} | null {
  const milliseconds = Date.parse(raw);
  if (!Number.isFinite(milliseconds)) return null;
  const date = new Date(milliseconds);
  const monthKey = date.toISOString().slice(0, 7);
  return {
    seconds: Math.floor(milliseconds / 1_000),
    monthKey,
  };
}
