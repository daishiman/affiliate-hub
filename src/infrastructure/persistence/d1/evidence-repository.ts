import { and, asc, desc, eq, inArray, like, lte } from "drizzle-orm";
import type {
  EditorialClaimRepositoryPort,
  EditorialEvidenceRepositoryPort,
  EditorialTestRunRepositoryPort,
} from "@/application/ports";
import type { PageRequest } from "@/application/ports/common";
import type { Claim, Evidence, TestRun } from "@/domain/evidence";
import {
  type ClaimId,
  type EvidenceId,
  type ProductId,
  type TestRunId,
  type WorkspaceId,
  markEditorial,
  ok,
  taggedString,
} from "@/domain/shared";
import {
  type ClaimRow,
  type EvidenceRecordRow,
  type TestRunRow,
  claims,
  evidenceRecords,
  testRuns,
} from "@/db/schema";
import { CLAIMS_BY_PRODUCT, SAMPLE_EVIDENCE } from "../sample/product-sample-repository";
import type { DrizzleD1 } from "./link-inbox-repository";
import { mergeWithSamples, storageFailure } from "./storage-failure";

/**
 * 主張・根拠・検証記録の保存先（D1）。
 *
 * **これはスタブではない。** 見本版と同じ契約を満たす、実際に保存する実装。
 *
 * --- なぜ 3 つを 1 つのファイルに置くか ---
 *
 * 「言えること」と「なぜ言えるか」は別々には意味を持たない。
 * 根拠だけあれば誰も読まない資料の山、主張だけあれば出所不明の断定になる。
 * 同じ変更でつなぐことが決まっているものを別ファイルに離すと、
 * 片方だけつないだ中途の状態が作れてしまう（`ranking-repository.ts` と同じ理由）。
 *
 * --- なぜ今これを本物にしたか ---
 *
 * 順番の決めごとは企画・順位と同じ。
 * **入れる口が無いものを先に本物にすると、一生埋まらない空の画面ができる。**
 * だからこの変更のなかで `/admin/evidence/new`（根拠を登録する）と
 * `/admin/evidence/claims/new`（言えることを登録する）を同時に用意している。
 *
 * それまで `/admin/evidence` は見本の主張と根拠だけを見ており、
 * **どれだけ調べても画面の中身が 1 文字も増えない**状態だった。
 *
 * --- 商品との紐付けをどこに置くか ---
 *
 * `Claim` は商品を知らない（`domain/evidence/claim.ts`）。
 * 「何が言えるか」の成り立ちに商品は関わらないためで、
 * どの商品について言っているかは**保存先の関心事**として列に持つ。
 * domain の型へ `productId` を足すと、商品に紐付かない主張
 * （たとえば分類そのものについての主張）が型の上で作れなくなる。
 */

function toEvidence(row: EvidenceRecordRow): Evidence {
  const stored = JSON.parse(row.evidenceJson) as Omit<
    Evidence,
    "id" | "workspaceId" | "type" | "title" | "capturedAt"
  >;
  return {
    ...stored,
    id: taggedString<"EvidenceId">(row.id) as EvidenceId,
    workspaceId: taggedString<"WorkspaceId">(row.workspaceId) as WorkspaceId,
    type: row.type as Evidence["type"],
    title: row.title,
    capturedAt: row.capturedAt,
  };
}

function toClaim(row: ClaimRow): Claim {
  const stored = JSON.parse(row.claimJson) as Omit<
    Claim,
    "id" | "workspaceId" | "type" | "verificationStatus" | "validFrom" | "validUntil"
  >;
  return {
    ...stored,
    id: taggedString<"ClaimId">(row.id) as ClaimId,
    workspaceId: taggedString<"WorkspaceId">(row.workspaceId) as WorkspaceId,
    type: row.type as Claim["type"],
    verificationStatus: row.verificationStatus as Claim["verificationStatus"],
    validFrom: row.validFrom,
    validUntil: row.validUntil,
  };
}

function toTestRun(row: TestRunRow): TestRun {
  const stored = JSON.parse(row.runJson) as Omit<
    TestRun,
    "id" | "workspaceId" | "productId" | "methodVersion" | "startedAt" | "completedAt"
  >;
  return {
    ...stored,
    id: taggedString<"TestRunId">(row.id) as TestRunId,
    workspaceId: taggedString<"WorkspaceId">(row.workspaceId) as WorkspaceId,
    productId: taggedString<"ProductId">(row.productId) as ProductId,
    methodVersion: row.methodVersion,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
  };
}

export function createD1EvidenceRepository(db: DrizzleD1): EditorialEvidenceRepositoryPort {
  return markEditorial({
    async findById(workspaceId: WorkspaceId, id: EvidenceId) {
      try {
        const rows = await db
          .select()
          .from(evidenceRecords)
          .where(
            and(
              eq(evidenceRecords.workspaceId, String(workspaceId)),
              eq(evidenceRecords.id, String(id)),
            ),
          )
          .limit(1);
        const found = (rows as EvidenceRecordRow[])[0];
        if (found !== undefined) return ok(toEvidence(found));
        // 見本の根拠を引いている主張が、保存先をつないだ日に
        // 「根拠なし」へ落ちるのを防ぐ。
        return ok(SAMPLE_EVIDENCE.find((e) => String(e.id) === String(id)) ?? null);
      } catch (cause) {
        return storageFailure("根拠の読み出し", cause);
      }
    },

    async listByIds(workspaceId: WorkspaceId, ids: readonly EvidenceId[]) {
      // 頼まれた根拠が 0 件のときに問い合わせない。空の `inArray` は
      // 保存先によっては全件を返す。**根拠の無い主張に根拠が付いて見える。**
      if (ids.length === 0) return ok([]);
      try {
        const rows = await db
          .select()
          .from(evidenceRecords)
          .where(
            and(
              eq(evidenceRecords.workspaceId, String(workspaceId)),
              inArray(evidenceRecords.id, ids.map(String)),
            ),
          );
        const stored = (rows as EvidenceRecordRow[]).map(toEvidence);
        const wanted = new Set(ids.map(String));
        const taken = new Set(stored.map((e) => String(e.id)));
        const samples = SAMPLE_EVIDENCE.filter(
          (e) => wanted.has(String(e.id)) && !taken.has(String(e.id)),
        );
        return ok([...stored, ...samples]);
      } catch (cause) {
        return storageFailure("根拠の読み出し", cause);
      }
    },

    async search(workspaceId: WorkspaceId, query: { text?: string }, page: PageRequest) {
      const text = query.text?.trim() ?? "";
      try {
        const where =
          text === ""
            ? eq(evidenceRecords.workspaceId, String(workspaceId))
            : and(
                eq(evidenceRecords.workspaceId, String(workspaceId)),
                // 題名だけで引く。抜粋は JSON の中にあり、
                // そこを引くには全件を開くことになる。
                like(evidenceRecords.title, `%${text}%`),
              );
        const rows = await db
          .select()
          .from(evidenceRecords)
          .where(where)
          // 新しく取った資料を上に。古い資料が先頭に来ると、
          // 一覧の先頭を選んだ人が知らないうちに古い出所を引く。
          .orderBy(desc(evidenceRecords.capturedAt));
        const stored = (rows as EvidenceRecordRow[]).map(toEvidence);
        const matching = SAMPLE_EVIDENCE.filter(
          (e) => text === "" || `${e.title} ${e.excerptOrSummary}`.includes(text),
        );
        const items = mergeWithSamples(stored, matching);
        return ok({ items: items.slice(0, page.limit), nextCursor: null });
      } catch (cause) {
        return storageFailure("根拠の検索", cause);
      }
    },

    async save(evidence: Evidence) {
      const { id, workspaceId, type, title, capturedAt, ...rest } = evidence;
      const columns = {
        type,
        title,
        capturedAt,
        evidenceJson: JSON.stringify(rest),
      };
      try {
        await db
          .insert(evidenceRecords)
          .values({ id: String(id), workspaceId: String(workspaceId), ...columns })
          .onConflictDoUpdate({ target: evidenceRecords.id, set: columns });
        return ok(evidence);
      } catch (cause) {
        return storageFailure("根拠の保存", cause);
      }
    },
  });
}

/**
 * 主張の保存先。
 *
 * 入れる（`saveForProduct`）と直す（`save`）を分けているのは、
 * どの商品についてかを**入れるときにしか決められない**から。
 * 1 つにまとめると、直すたびに紐付けを渡し直すことになり、
 * 渡し忘れた回だけ主張が商品から外れる。
 */
export function createD1ClaimRepository(db: DrizzleD1): EditorialClaimRepositoryPort {
  return markEditorial({
    async findById(workspaceId: WorkspaceId, id: ClaimId) {
      try {
        const rows = await db
          .select()
          .from(claims)
          .where(and(eq(claims.workspaceId, String(workspaceId)), eq(claims.id, String(id))))
          .limit(1);
        const found = (rows as ClaimRow[])[0];
        if (found !== undefined) return ok(toClaim(found));
        const sample = Object.values(CLAIMS_BY_PRODUCT)
          .flat()
          .find((c) => String(c.id) === String(id));
        return ok(sample ?? null);
      } catch (cause) {
        return storageFailure("言えることの読み出し", cause);
      }
    },

    async listByProduct(workspaceId: WorkspaceId, productId: ProductId) {
      try {
        const rows = await db
          .select()
          .from(claims)
          .where(
            and(
              eq(claims.workspaceId, String(workspaceId)),
              eq(claims.productId, String(productId)),
            ),
          )
          .orderBy(desc(claims.validFrom));
        const stored = (rows as ClaimRow[]).map(toClaim);
        const samples = CLAIMS_BY_PRODUCT[String(productId)] ?? [];
        return ok(mergeWithSamples(stored, samples));
      } catch (cause) {
        return storageFailure("言えることの読み出し", cause);
      }
    },

    async listExpiringBefore(workspaceId: WorkspaceId, at: Date, limit: number) {
      try {
        const rows = await db
          .select()
          .from(claims)
          .where(and(eq(claims.workspaceId, String(workspaceId)), lte(claims.validUntil, at)))
          // 期限の近い順。遠い順に見ると、いちばん危ないものが最後に来る。
          .orderBy(asc(claims.validUntil));
        return ok((rows as ClaimRow[]).map(toClaim).slice(0, limit));
      } catch (cause) {
        return storageFailure("期限の近い主張の読み出し", cause);
      }
    },

    async save(claim: Claim) {
      /*
       * 契約の `save` は商品を受け取らない。
       * 既にある主張を直す経路（確認済みにする・期限を延ばす）はこれで足りる——
       * 上書きの対象から `product_id` を外してあるので、紐付けは元のまま残る。
       *
       * まだ無い主張をここから入れると、どの商品についてかが空のまま入る。
       * **勝手にどこかの商品へ付けない。** 付けると、関係のない商品のページに
       * 見覚えのない主張が現れ、消し方も分からなくなる。
       */
      return saveClaimRow(db, claim, "");
    },

    async saveForProduct(workspaceId: WorkspaceId, productId: ProductId, claim: Claim) {
      // 主張が持つ作業場所と、頼まれた作業場所が食い違うときは入れない。
      // 入れると、別の作業場所の商品ページへ他人の主張が現れる。
      if (String(claim.workspaceId) !== String(workspaceId)) {
        return storageFailure("言えることの保存", new Error("workspace mismatch"));
      }
      return saveClaimRow(db, claim, String(productId));
    },
  });
}

async function saveClaimRow(db: DrizzleD1, claim: Claim, productId: string) {
  const { id, workspaceId, type, verificationStatus, validFrom, validUntil, ...rest } = claim;
  // 上書きするのは主張の中身だけ。`product_id` を入れていないのは、
  // 直すたびに紐付けが空へ戻る事故を型より手前で止めるため。
  const updatable = {
    type,
    verificationStatus,
    validFrom,
    validUntil,
    claimJson: JSON.stringify(rest),
  };
  try {
    await db
      .insert(claims)
      .values({
        id: String(id),
        workspaceId: String(workspaceId),
        productId,
        ...updatable,
      })
      .onConflictDoUpdate({ target: claims.id, set: updatable });
    return ok(claim);
  } catch (cause) {
    return storageFailure("言えることの保存", cause);
  }
}

export function createD1TestRunRepository(db: DrizzleD1): EditorialTestRunRepositoryPort {
  return markEditorial({
    async findById(workspaceId: WorkspaceId, id: TestRunId) {
      try {
        const rows = await db
          .select()
          .from(testRuns)
          .where(and(eq(testRuns.workspaceId, String(workspaceId)), eq(testRuns.id, String(id))))
          .limit(1);
        const found = (rows as TestRunRow[])[0];
        return ok(found === undefined ? null : toTestRun(found));
      } catch (cause) {
        return storageFailure("検証記録の読み出し", cause);
      }
    },

    async listByProduct(workspaceId: WorkspaceId, productId: ProductId) {
      try {
        const rows = await db
          .select()
          .from(testRuns)
          .where(
            and(
              eq(testRuns.workspaceId, String(workspaceId)),
              eq(testRuns.productId, String(productId)),
            ),
          )
          .orderBy(desc(testRuns.startedAt));
        return ok((rows as TestRunRow[]).map(toTestRun));
      } catch (cause) {
        return storageFailure("検証記録の読み出し", cause);
      }
    },

    async save(run: TestRun) {
      const { id, workspaceId, productId, methodVersion, startedAt, completedAt, ...rest } = run;
      const columns = {
        productId: String(productId),
        methodVersion,
        startedAt,
        completedAt,
        runJson: JSON.stringify(rest),
      };
      try {
        await db
          .insert(testRuns)
          .values({ id: String(id), workspaceId: String(workspaceId), ...columns })
          .onConflictDoUpdate({ target: testRuns.id, set: columns });
        return ok(run);
      } catch (cause) {
        return storageFailure("検証記録の保存", cause);
      }
    },
  });
}
