import { and, desc, eq, isNull, ne, sql } from "drizzle-orm";
import type {
  CustomDomainRepositoryPort,
  CustomHostnameSnapshot,
  EditorialCustomDomainRepositoryPort,
} from "@/application/ports";
import {
  canTransition,
  isCustomDomainDeliveryEligible,
  validateHostname,
  type CustomDomain,
} from "@/domain/domains";
import { domainError, err, isErr, markEditorial, ok, type WorkspaceId } from "@/domain/shared";
import { siteCustomDomains, type SiteCustomDomainRow } from "@/db/schema";
import type { DrizzleD1 } from "./link-inbox-repository";
import { storageFailure } from "./storage-failure";

/**
 * ブログの住所の保存先 (D1)。
 *
 * 既定住所 `/s/<slug>` はこの表に行を持たない。**行が無いことが既定住所**
 * であり、独自ドメインは常に追加である。既定住所を行にすると、その行を
 * 消したときにブログが読めなくなる経路ができる。
 *
 * 外部 (Cloudflare) の写しを反映する `applySnapshot` は、書き込む前に
 * 遷移表を通す。呼び出し順に頼らずここで止めるのは、定期同期と運用者の
 * 操作が同時に走りうるためである。片方だけが遷移表を持つと、写し取りが
 * 取り下げを上書きして、取り下げたはずの住所が復活する。
 */

function toDomain(row: SiteCustomDomainRow): CustomDomain {
  return {
    id: row.id,
    siteSlug: row.siteSlug,
    hostname: row.hostname,
    status: row.status,
    certificateStatus: row.certificateStatus,
    canonical: row.canonical,
    externalHostnameId: row.externalHostnameId,
    syncedAt: row.syncedAt,
    lastError: row.lastError,
  };
}

/**
 * 一意制約に当たったかを、例外の連なり全体から判定する。
 *
 * `String(cause)` だけを見ないのは、Drizzle と D1 が SQLite の例外を
 * それぞれ包み直すためで、外側の 1 枚には制約名も "UNIQUE" の語も
 * 載らないことがある。判定を外側だけに頼ると、業務上の答え
 * (「その住所はもう使われている」) が保存の不調として運用者へ出る。
 */
function isUniqueViolation(cause: unknown): boolean {
  const seen = new Set<unknown>();
  let current: unknown = cause;
  while (current !== null && current !== undefined && !seen.has(current)) {
    seen.add(current);
    const text =
      current instanceof Error ? `${current.name} ${current.message}` : String(current);
    if (text.toUpperCase().includes("UNIQUE")) return true;
    current = (current as { readonly cause?: unknown }).cause;
  }
  return false;
}

/** 生きている行だけを見る条件。取り下げ済みは履歴として残るが対象にしない。 */
function alive() {
  return isNull(siteCustomDomains.deletedAt);
}

/** `isCustomDomainDeliveryEligible` と同じ配信可能条件の SQL 投影。 */
function deliveryEligible() {
  return and(
    eq(siteCustomDomains.status, "active"),
    eq(siteCustomDomains.certificateStatus, "issued"),
  );
}

function notFound() {
  return err(
    domainError("NOT_FOUND", "このドメインは見つかりませんでした。", {
      suggestedAction: "ドメインの一覧を開き直してください。",
    }),
  );
}

export function createD1CustomDomainRepository(deps: {
  readonly db: DrizzleD1;
  readonly newId: () => string;
}): EditorialCustomDomainRepositoryPort {
  const { db, newId } = deps;

  /** 所有境界つきで 1 行引く。ID だけで別 workspace の行を触らせない。 */
  async function findOwned(
    workspaceId: WorkspaceId,
    domainId: string,
  ): Promise<SiteCustomDomainRow | null> {
    const rows = await db
      .select()
      .from(siteCustomDomains)
      .where(
        and(
          eq(siteCustomDomains.workspaceId, String(workspaceId)),
          eq(siteCustomDomains.id, domainId),
          alive(),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  }

  const port: CustomDomainRepositoryPort = {
    async listForSite(workspaceId, siteSlug) {
      try {
        const rows = await db
          .select()
          .from(siteCustomDomains)
          .where(
            and(
              eq(siteCustomDomains.workspaceId, String(workspaceId)),
              eq(siteCustomDomains.siteSlug, siteSlug),
              alive(),
            ),
          )
          // 配信中を先に、その中では新しい順。運用者が最初に見るのは
          // 「いま読者が来ている住所」で、検証中の行はその次でよい。
          .orderBy(desc(siteCustomDomains.canonical), desc(siteCustomDomains.createdAt));
        return ok(rows.map(toDomain));
      } catch (cause) {
        return storageFailure("ドメインの読み出し", cause);
      }
    },

    async listForWorkspace(workspaceId) {
      try {
        const rows = await db
          .select()
          .from(siteCustomDomains)
          .where(and(eq(siteCustomDomains.workspaceId, String(workspaceId)), alive()))
          .orderBy(siteCustomDomains.siteSlug, desc(siteCustomDomains.createdAt));
        return ok(rows.map(toDomain));
      } catch (cause) {
        return storageFailure("ドメイン一覧の読み出し", cause);
      }
    },

    async findActiveByHostname(hostname) {
      try {
        const normalized = validateHostname(hostname);
        // 引くだけなので、形が変な入力は「見つからない」で返す。
        // ここで失敗を返すと、公開側が 500 を出すことになる。
        if (isErr(normalized)) return ok(null);
        const rows = await db
          .select()
          .from(siteCustomDomains)
          .where(
            and(
              eq(siteCustomDomains.hostname, normalized.value),
              deliveryEligible(),
              alive(),
            ),
          )
          .limit(1);
        const domain = rows.length === 0 ? null : toDomain(rows[0]);
        return ok(domain !== null && isCustomDomainDeliveryEligible(domain) ? domain : null);
      } catch (cause) {
        return storageFailure("ドメインの照会", cause);
      }
    },

    async register(workspaceId, siteSlug, hostname) {
      const normalized = validateHostname(hostname);
      if (isErr(normalized)) return normalized;
      try {
        const now = new Date();
        const inserted = await db
          .insert(siteCustomDomains)
          .values({
            id: newId(),
            workspaceId: String(workspaceId),
            siteSlug,
            hostname: normalized.value,
            status: "pending",
            certificateStatus: "none",
            canonical: false,
            createdAt: now,
            updatedAt: now,
          })
          .returning();
        return ok(toDomain(inserted[0]!));
      } catch (cause) {
        /*
         * 部分ユニーク索引の衝突。**「保存に失敗した」で返さない。**
         *
         * 同じドメインを 2 つのブログには置けない、という業務上の答えが
         * ここで出ている。時間をおけば直る種類の不調と同じ文面にすると、
         * 運用者は何度も同じ操作を繰り返すことになる。
         */
        if (isUniqueViolation(cause)) {
          return err(
            domainError("CONFLICT", "このドメインはすでに登録されています。", {
              suggestedAction:
                "別のドメインを入れるか、先に登録済みのほうを取り下げてください。",
            }),
          );
        }
        return storageFailure("ドメインの登録", cause);
      }
    },

    async applySnapshot(workspaceId, domainId, snapshot: CustomHostnameSnapshot, at) {
      try {
        const current = await findOwned(workspaceId, domainId);
        if (current === null) return notFound();
        if (!canTransition(current.status, snapshot.status)) {
          return err(
            domainError(
              "CONFLICT",
              `このドメインは「${current.status}」から「${snapshot.status}」へは進めません。`,
              {
                suggestedAction:
                  "取り下げたドメインを使い直す場合は、新しく登録し直してください。",
              },
            ),
          );
        }
        const updated = await db
          .update(siteCustomDomains)
          .set({
            status: snapshot.status,
            certificateStatus: snapshot.certificateStatus,
            externalHostnameId: snapshot.externalHostnameId,
            verificationToken:
              snapshot.instructions.length === 0
                ? null
                : JSON.stringify(snapshot.instructions),
            lastError: snapshot.lastError,
            syncedAt: at,
            updatedAt: at,
            /*
             * 配信可能でなくなった行の canonical を同時に降ろす。
             *
             * 降ろさないと、読み取り側 (`resolveCanonicalHost`) が
             * 「canonical だが配信可能でない」行を無視して既定住所へ倒す
             * 一方で、保存先には canonical が立ったままになる。画面と
             * 実際の配信先が食い違う状態を作らない。
             */
            canonical: isCustomDomainDeliveryEligible(snapshot) ? current.canonical : false,
          })
          .where(
            and(
              eq(siteCustomDomains.workspaceId, String(workspaceId)),
              eq(siteCustomDomains.id, domainId),
              // 読んでから書くまでに他が動いていたら書かない。
              eq(siteCustomDomains.status, current.status),
              alive(),
            ),
          )
          .returning();
        if (updated.length === 0) {
          return err(
            domainError("CONFLICT", "このドメインは別の操作で更新されました。", {
              retryable: true,
              suggestedAction: "画面を開き直して、最新の状態を確認してください。",
            }),
          );
        }
        return ok(toDomain(updated[0]!));
      } catch (cause) {
        return storageFailure("ドメイン状態の反映", cause);
      }
    },

    async setCanonical(workspaceId, siteSlug, domainId) {
      try {
        const current = await findOwned(workspaceId, domainId);
        if (current === null || current.siteSlug !== siteSlug) return notFound();
        if (!isCustomDomainDeliveryEligible(current)) {
          return err(
            domainError("VALIDATION_FAILED", "配信中でないドメインは正規の住所にできません。", {
              suggestedAction:
                "所有権の確認と証明書の発行が終わってから、もう一度お試しください。",
            }),
          );
        }
        /*
         * 降ろしてから立てる。逆順だと部分ユニーク索引に一瞬 2 行が
         * 並び、制約違反で両方が巻き戻る。batch にするのは、降ろした
         * だけで終わる状態 (正規の住所が無い) を残さないため。
         */
        const now = new Date();
        await db.batch([
          db
            .update(siteCustomDomains)
            .set({ canonical: false, updatedAt: now })
            .where(
              and(
                eq(siteCustomDomains.workspaceId, String(workspaceId)),
                eq(siteCustomDomains.siteSlug, siteSlug),
                ne(siteCustomDomains.id, domainId),
                eq(siteCustomDomains.canonical, true),
                alive(),
              ),
            ),
          db
            .update(siteCustomDomains)
            .set({ canonical: true, updatedAt: now })
            .where(
              and(
                eq(siteCustomDomains.workspaceId, String(workspaceId)),
                eq(siteCustomDomains.id, domainId),
                deliveryEligible(),
                alive(),
              ),
            ),
        ]);
        const after = await findOwned(workspaceId, domainId);
        if (after === null) return notFound();
        return ok(toDomain(after));
      } catch (cause) {
        return storageFailure("正規の住所の切り替え", cause);
      }
    },

    async revoke(workspaceId, domainId, reason) {
      try {
        const current = await findOwned(workspaceId, domainId);
        if (current === null) return notFound();
        if (current.status === "revoked") {
          // すでに取り下げ済み。同じ結果なので成功として返す。
          // 失敗にすると、二重送信のたびに運用者へ赤い画面が出る。
          return ok(true as const);
        }
        await db
          .update(siteCustomDomains)
          .set({
            status: "revoked",
            canonical: false,
            lastError: reason,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(siteCustomDomains.workspaceId, String(workspaceId)),
              eq(siteCustomDomains.id, domainId),
              alive(),
            ),
          );
        return ok(true as const);
      } catch (cause) {
        return storageFailure("ドメインの取り下げ", cause);
      }
    },
  };

  return markEditorial(port);
}

/**
 * 公開側が Host ヘッダからブログを決めるための、最小の照会。
 *
 * ポートを経由しないのは、この経路が要求ごとに必ず 1 回走るためで、
 * 組み立ての層を挟まずに引けるようにしてある。返すのは URL 名だけで、
 * 状態と証明書が配信可能かだけを判断する。
 */
export async function resolveSiteSlugByHost(
  db: DrizzleD1,
  hostname: string,
): Promise<string | null> {
  const normalized = validateHostname(hostname);
  if (isErr(normalized)) return null;
  const rows = await db
    .select({
      siteSlug: siteCustomDomains.siteSlug,
      status: siteCustomDomains.status,
      certificateStatus: siteCustomDomains.certificateStatus,
    })
    .from(siteCustomDomains)
    .where(
      and(
        eq(siteCustomDomains.hostname, normalized.value),
        deliveryEligible(),
        sql`${siteCustomDomains.deletedAt} is null`,
      ),
    )
    .limit(1);
  const row = rows[0];
  return row !== undefined && isCustomDomainDeliveryEligible(row) ? row.siteSlug : null;
}

/**
 * 逆向きの照会。ブログの URL 名から、**読者へ見せる正本の住所**を引く。
 *
 * `resolveSiteSlugByHost` と対になる。あちらは「この住所はどのブログか」、
 * こちらは「このブログの住所はどれか」で、後者は `<link rel="canonical">`
 * を組むのに要る。両方を持たないと、既定の住所で来た読者へ
 * 「正本はこちら」と伝える先が無い。
 *
 * 部分ユニーク索引 `site_custom_domain_canonical_idx` があるので、
 * 生きた canonical は同じ workspace のブログにつき高々 1 件である。
 * ここが workspace を絞らないのは、公開側が持っているのが URL 名だけで、
 * URL 名がブログを一意に決める結合キーだからである
 * (`arch-blog-operations-console.md` AD-5)。
 */
export async function resolveCanonicalHostBySiteSlug(
  db: DrizzleD1,
  siteSlug: string,
): Promise<string | null> {
  const rows = await db
    .select({
      hostname: siteCustomDomains.hostname,
      status: siteCustomDomains.status,
      certificateStatus: siteCustomDomains.certificateStatus,
    })
    .from(siteCustomDomains)
    .where(
      and(
        eq(siteCustomDomains.siteSlug, siteSlug),
        deliveryEligible(),
        eq(siteCustomDomains.canonical, true),
        sql`${siteCustomDomains.deletedAt} is null`,
      ),
    )
    .limit(1);
  const row = rows[0];
  return row !== undefined && isCustomDomainDeliveryEligible(row) ? row.hostname : null;
}
