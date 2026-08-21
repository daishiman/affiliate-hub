import {
  type AffiliateProgramId,
  type DomainError,
  type LinkIngestionId,
  type ProductId,
  type Result,
  type WorkspaceId,
  domainError,
  err,
  ok,
  validationError,
} from "../shared";

/**
 * 成果リンクの受信箱（プラットフォーム層 §9.2）。
 *
 * **貼り付けられた URL が、どの広告主の、どの商品のものかを突き止めるまでの入れ物。**
 * ここを型で持たないと、「まだ調べていない URL」と「商品に結びついた URL」が
 * 同じ一覧に混ざり、記事に貼れる状態かどうかを人の記憶で判断することになる。
 *
 * 名前について: 仕様には「取込」が 2 つ出てくる。
 *   - ここ（`LinkIngestion`）    = 成果リンク URL の受け取り
 *   - `AffiliateIngestion`      = ASP からの成果データの取り込み実行記録
 * 別物なので別の名前にしている。同じ「取込」と呼ぶと、片方の不具合を
 * もう片方の画面で探すことになる。
 */

/** どこから入ってきたか。経路ごとに責任者が違うので、必ず残す。 */
export type LinkIngestionSource = "paste" | "csv" | "api" | "extension" | "webmcp";

export const LINK_INGESTION_SOURCE_LABEL: Readonly<Record<LinkIngestionSource, string>> = {
  paste: "画面に貼り付け",
  csv: "CSV 取込",
  api: "API",
  extension: "ブラウザ拡張",
  webmcp: "AI から",
};

/**
 * 受信箱の 4 状態（§9.2）。
 *
 *   received → resolved → matched
 *        ＼_________________／
 *                 rejected
 */
export type LinkIngestionState = "received" | "resolved" | "matched" | "rejected";

export const LINK_INGESTION_STATE_LABEL: Readonly<Record<LinkIngestionState, string>> = {
  received: "受け取り済み（未調査）",
  resolved: "広告主が判明",
  matched: "商品に結びつけ済み",
  rejected: "対象外",
};

export type LinkIngestion = {
  readonly id: LinkIngestionId;
  readonly workspaceId: WorkspaceId;
  /** 受け取った URL。**改変せずそのまま持つ**（改変は規約違反になりうる）。 */
  readonly submittedUrl: string;
  /** 重複判定のためだけに使う形。表示にも遷移にも使わない。 */
  readonly normalizedUrl: string;
  readonly source: LinkIngestionSource;
  readonly submittedAt: Date;
  readonly state: LinkIngestionState;
  readonly programId: AffiliateProgramId | null;
  readonly productId: ProductId | null;
  /** 同じ URL が既にあるとき、その相手。null なら重複なし。 */
  readonly duplicateOf: LinkIngestionId | null;
  readonly note: string | null;
  /** 対象外にした理由。**空欄を許さない**（後から誰も理由を思い出せない）。 */
  readonly rejectedReason: string | null;
};

/**
 * 受け取ってよい URL かを判定して、重複判定用の形に直す。
 *
 * ここで弾いているのは 2 種類。
 *   1. http / https 以外（`javascript:` `file:` などを保存しない）
 *   2. 内部ネットワーク宛（受信箱に入れた URL は後で取得しに行くため、
 *      社内・クラウドのメタデータ用アドレスを踏ませない = SSRF 対策の入口側）
 *
 * **リダイレクト先の再検査はここではできない。** 実際に取得しに行く実装
 * （インフラ層）が、1 ホップごとに同じ判定を通す必要がある。
 */
export function normalizeAffiliateUrl(raw: string): Result<string, DomainError> {
  const trimmed = raw.trim();
  if (trimmed === "") return err(validationError("URL が空です。", "url"));

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return err(
      validationError("URL として読み取れませんでした。https:// から始まる形で入れてください。", "url"),
    );
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return err(
      domainError("VALIDATION_FAILED", `この形式の URL は受け取れません（${url.protocol}）。`, {
        field: "url",
        suggestedAction: "http:// または https:// の URL を入れてください。",
      }),
    );
  }

  if (isInternalHost(url.hostname)) {
    return err(
      domainError("VALIDATION_FAILED", "内部ネットワーク宛の URL は受け取れません。", {
        field: "url",
        suggestedAction: "外部から見える URL を入れてください。",
      }),
    );
  }

  // 重複判定用の形。断片（#以下）と、計測用の付加情報だけを落とす。
  // 元の URL は `submittedUrl` に残すので、ここで落としても情報は失われない。
  const params = [...url.searchParams.entries()]
    .filter(([key]) => !TRACKING_PARAMS.has(key.toLowerCase()))
    .sort(([a], [b]) => a.localeCompare(b));
  /*
    組み立て直すときに必ず符号化する。

    `searchParams` は値を復号して返すので、そのまま `k=v` で繋ぐと
    値の中の `&` や `=` が**区切り記号として復活する**。
    その結果 `?x=b%26y=z`（x という 1 つの値）と `?x=b&y=z`（x と y の 2 つ）が
    同じ形になり、**別のリンクが重複と判定される**。
    性質テスト（tests/property/normalization.property.test.ts）で見つけた。
  */
  const query = params
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
  const path = url.pathname.replace(/\/+$/, "");

  return ok(`${url.protocol}//${url.hostname.toLowerCase()}${path}${query ? `?${query}` : ""}`);
}

/** 同じ商品への同じリンクが、計測用の付加情報だけ違う形で何度も届く。 */
const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "fbclid",
  "yclid",
  "_ga",
]);

/** 内部ネットワーク・自分自身宛かどうか。判定は保守的に倒す。 */
export function isInternalHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return true;
  if (host === "::1" || host.startsWith("fc") || host.startsWith("fd")) return true;
  if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host)) return true;
  if (/^169\.254\./.test(host)) return true; // クラウドのメタデータ
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true;
  if (host === "0.0.0.0") return true;
  return false;
}

export function createLinkIngestion(input: {
  id: LinkIngestionId;
  workspaceId: WorkspaceId;
  submittedUrl: string;
  source: LinkIngestionSource;
  submittedAt: Date;
  /** 既に受信箱にあるもの。重複判定に使う。 */
  existing?: readonly LinkIngestion[];
  note?: string | null;
}): Result<LinkIngestion, DomainError> {
  const normalized = normalizeAffiliateUrl(input.submittedUrl);
  if (!normalized.ok) return normalized;

  const duplicate = findDuplicate(input.existing ?? [], normalized.value);

  return ok({
    id: input.id,
    workspaceId: input.workspaceId,
    submittedUrl: input.submittedUrl.trim(),
    normalizedUrl: normalized.value,
    source: input.source,
    submittedAt: input.submittedAt,
    state: "received",
    programId: null,
    productId: null,
    // 重複でも捨てない。捨てると「送ったのに無い」が起きる。印を付けて残す。
    duplicateOf: duplicate?.id ?? null,
    note: input.note ?? null,
    rejectedReason: null,
  });
}

export function findDuplicate(
  existing: readonly LinkIngestion[],
  normalizedUrl: string,
): LinkIngestion | null {
  return existing.find((i) => i.normalizedUrl === normalizedUrl && i.state !== "rejected") ?? null;
}

/** 広告主が判明した。ここから先は「どの商品か」を決める作業になる。 */
export function resolveProgram(
  item: LinkIngestion,
  programId: AffiliateProgramId,
): Result<LinkIngestion, DomainError> {
  if (item.state === "rejected") return err(rejectedAlready(item));
  return ok({ ...item, state: "resolved", programId });
}

/**
 * 商品に結びつける。
 *
 * **広告主が分からないまま商品へ結びつけない。**
 * 結びつけてしまうと、提携が終了したときに外すべきリンクを特定できない。
 */
export function matchProduct(
  item: LinkIngestion,
  productId: ProductId,
): Result<LinkIngestion, DomainError> {
  if (item.state === "rejected") return err(rejectedAlready(item));
  if (item.programId === null) {
    return err(
      domainError("INVARIANT_VIOLATED", "広告主が分からないまま商品へ結びつけられません。", {
        suggestedAction: "先にリンク先をたどって広告主を確定してください。",
      }),
    );
  }
  return ok({ ...item, state: "matched", productId });
}

/** 対象外にする。理由は必須。 */
export function rejectIngestion(
  item: LinkIngestion,
  reason: string,
): Result<LinkIngestion, DomainError> {
  if (reason.trim() === "") {
    return err(validationError("対象外にする理由を書いてください。", "reason"));
  }
  return ok({ ...item, state: "rejected", rejectedReason: reason.trim() });
}

function rejectedAlready(item: LinkIngestion): DomainError {
  return domainError("INVARIANT_VIOLATED", "対象外にしたものは、そのままでは進められません。", {
    suggestedAction: "もう一度扱うなら、受信箱へ入れ直してください。",
    details: { id: String(item.id), reason: item.rejectedReason ?? "" },
  });
}

/** その状態で次にできること。画面とツールで同じ判断をするために、ここに置く。 */
export function nextActionsFor(item: LinkIngestion): readonly LinkIngestionState[] {
  switch (item.state) {
    case "received":
      return ["resolved", "rejected"];
    case "resolved":
      return ["matched", "rejected"];
    case "matched":
      return ["rejected"];
    case "rejected":
      return [];
  }
}
