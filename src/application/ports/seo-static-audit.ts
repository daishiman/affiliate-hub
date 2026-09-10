import type { Finding, PageKey, PageObservation } from "@/domain/seo/aeo-measurement";
import type { PortResult } from "./common";
import type { StaticAuditInventory, StaticAuditInventoryTarget } from "@/application/seo/static-audit-inventory";
export type { StaticAuditInventory } from "@/application/seo/static-audit-inventory";

/** 公開判定と有限URL規則を通した、監査の対象集合。 */
export type StaticAuditTarget = StaticAuditInventoryTarget;

export type StaticAuditScan = {
  readonly workspaceId: string;
  readonly siteSlug: string;
  readonly runId: string;
  readonly revision: number;
  readonly inventoryHash: string;
  readonly status: "collecting" | "ready" | "published" | "limited";
  readonly total: number;
  readonly inventoryComplete: boolean;
  readonly startedAt: string;
  readonly completedAt: string | null;
  /** 現在の巡回途中も、前回全体確認を失わない。 */
  readonly lastCompletedAt: string | null;
};

export type StaticAuditClaim = {
  readonly workspaceId: string;
  readonly siteSlug: string;
  readonly runId: string;
  readonly revision: number;
  readonly leaseId: string;
  readonly leaseExpiresAt: string;
  readonly targets: readonly StaticAuditTarget[];
};

/** 失敗の自由文や応答本文を台帳へ保存しない。 */
export type StaticAuditFailureCode = "http_error" | "timeout" | "invalid_response" | "resource_limit" | "unavailable";
export type StaticAuditAttempt =
  | { readonly pageKey: PageKey; readonly ok: true; readonly observation: PageObservation }
  | { readonly pageKey: PageKey; readonly ok: false; readonly errorCode: StaticAuditFailureCode };

export type StaticAuditCandidate = {
  readonly scan: StaticAuditScan;
  readonly pages: readonly { readonly target: StaticAuditTarget; readonly observation: PageObservation }[];
};

export type StaticAuditStageResult = {
  readonly scan: StaticAuditScan;
  /** collectorは読めたが、安全な保存上限を超えて失敗へ分類した件数。 */
  readonly resourceLimitFailures: number;
};

export type StaticAuditCandidateLoad = {
  readonly candidate: StaticAuditCandidate | null;
  /** 候補が無い通常の途中状態と、永続化した上限状態を区別する。 */
  readonly limitedReason: string | null;
};

export type StaticAuditCoverage = {
  readonly siteSlug: string;
  readonly status: StaticAuditScan["status"] | "not_started";
  /** inventoryComplete=falseのときは確定総数ではなく下限。 */
  readonly total: number;
  /** current + never + failed + stale = total。failedを最優先で分類する。 */
  readonly current: number;
  readonly never: number;
  readonly failed: number;
  readonly stale: number;
  readonly inventoryComplete: boolean;
  readonly startedAt: string | null;
  readonly lastCompletedAt: string | null;
  /** 既存所見表の、このworkspace/siteの静的所見件数。表示上限件数ではない。 */
  readonly currentFindingCount: number;
};

/** 所見の確定もこの口で行い、runのCASと同じD1確定単位へ含める。 */
export type SeoStaticAuditPort = {
  inventory(input: { readonly siteSlug: string; readonly origin: string; readonly basePath: string }): PortResult<StaticAuditInventory>;
  beginOrResume(input: {
    readonly inventory: StaticAuditInventory;
    readonly at: string;
    readonly limit: number;
  }): PortResult<{ readonly scan: StaticAuditScan; readonly claim: StaticAuditClaim | null; readonly skippedReason: string | null }>;
  stage(input: {
    readonly claim: StaticAuditClaim;
    /** 取得権を持つ全targetを1回ずつ報告する。途中中断時はlease失効後に再取得する。 */
    readonly attempts: readonly StaticAuditAttempt[];
    readonly at: string;
  }): PortResult<StaticAuditStageResult>;
  loadCompleteCandidate(input: { readonly siteSlug: string; readonly at: string }): PortResult<StaticAuditCandidateLoad>;
  markPublished(input: {
    readonly candidate: StaticAuditCandidate;
    readonly findings: readonly Finding[];
    readonly at: string;
  }): PortResult<{ readonly scan: StaticAuditScan; readonly added: number; readonly resolved: number }>;
  coverage(input: { readonly siteSlug?: string; readonly staleBefore: string }): PortResult<readonly StaticAuditCoverage[]>;
};
