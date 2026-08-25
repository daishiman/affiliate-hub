import type { FeedbackOrigin, TechnicalContext, TechnicalContextInput } from "./report";

/** ブラウザ診断は補助情報なので、本文を押しのけない件数に固定する。 */
export const STORED_DIAGNOSTICS_LIMIT = 8;

const MAX_REDACTED_COUNT = 10_000;
const MAX_DIAGNOSTIC_INPUT_LENGTH = 2_000;
const MAX_SAFE_PATH_LENGTH = 500;
const ERROR_NAMES = [
  "TypeError",
  "ReferenceError",
  "SyntaxError",
  "RangeError",
  "SecurityError",
  "NetworkError",
  "AbortError",
] as const;

const sensitiveText = (value: string): boolean =>
  /[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:token|secret|password|authorization|bearer|api[-_]?key)/iu.test(
    value,
  );

const stringValue = (value: unknown): string => (typeof value === "string" ? value : "");

function stringArray(value: unknown): { readonly values: readonly string[]; readonly rejected: number } {
  if (!Array.isArray(value)) return { values: [], rejected: 1 };
  const values = value.filter((item): item is string => typeof item === "string");
  return { values, rejected: value.length - values.length };
}

function safePath(raw: string): string {
  try {
    const parsed = new URL(raw, "https://feedback.invalid");
    return parsed.pathname.startsWith("/") && parsed.pathname.length <= MAX_SAFE_PATH_LENGTH
      ? parsed.pathname
      : "/";
  } catch {
    return "/";
  }
}

function safeAbsoluteUrl(raw: string, fallbackPath: string): string {
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return fallbackPath;
    return `${parsed.origin}${safePath(parsed.pathname)}`;
  } catch {
    return fallbackPath;
  }
}

function finiteViewport(value: unknown): number {
  if (typeof value !== "number") return 0;
  if (!Number.isFinite(value)) return 0;
  return Math.min(100_000, Math.max(0, Math.round(value)));
}

function errorCategory(raw: string): string {
  return ERROR_NAMES.find((name) => raw.includes(name)) ?? "Error";
}

function failedRequestCategory(raw: string): string {
  const boundedRaw = raw.slice(0, MAX_DIAGNOSTIC_INPUT_LENGTH);
  const status = boundedRaw.match(/\b([45]\d{2})\b/u)?.[1];
  const url = boundedRaw.match(/https?:\/\/[^\s]+/u)?.[0];
  const relative = boundedRaw.match(/\/[A-Za-z0-9_./~-]+(?:\?[^\s#]*)?(?:#[^\s]*)?/u)?.[0];
  const target = url
    ? safeAbsoluteUrl(url, "（読めない宛先）")
    : relative
      ? safePath(relative)
      : "（読めない宛先）";
  return status ? `${status} ${target}` : `届きませんでした ${target}`;
}

function actionCategory(raw: string): string {
  if (raw === "ボタンを操作した" || raw === "リンクを操作した" || raw === "詳細を操作した") {
    return raw;
  }
  if (raw.endsWith("を開いた")) return "画面を開いた";
  return "操作を実行した";
}

function browserCategory(raw: string): string {
  if (/Firefox\//u.test(raw)) return "Firefox";
  if (/Edg\//u.test(raw)) return "Edge";
  if (/Chrome\//u.test(raw)) return "Chrome";
  if (/Safari\//u.test(raw)) return "Safari";
  return raw.trim() === "" ? "不明" : "ブラウザ";
}

function bounded<T>(values: readonly T[]): readonly T[] {
  return values.slice(-STORED_DIAGNOSTICS_LIMIT);
}

function changedValue(before: unknown, after: unknown): number {
  return Object.is(before, after) ? 0 : 1;
}

function changedLines(before: readonly string[], after: readonly string[]): number {
  const kept = before.slice(-STORED_DIAGNOSTICS_LIMIT);
  return (
    Math.max(0, before.length - kept.length) +
    kept.reduce((count, line, index) => count + changedValue(line, after[index]), 0)
  );
}

/**
 * クライアントを信用せず、永続化できる診断の語彙へ縮約する。
 * 生の例外・ラベル・User-Agent は、秘密を検出できるかどうかに関係なく保存しない。
 */
export function sanitizeFeedbackContext(
  origin: FeedbackOrigin,
  technical: TechnicalContextInput,
): { readonly origin: FeedbackOrigin; readonly technical: TechnicalContext } {
  const rawOrigin = (origin ?? {}) as Partial<FeedbackOrigin>;
  const rawTechnical = (technical ?? {}) as Partial<TechnicalContextInput>;
  const screenName = stringValue(rawOrigin.screenName);
  const originUrl = stringValue(rawOrigin.url);
  const originRoute = stringValue(rawOrigin.route);
  const route = safePath(originRoute);
  const safeOrigin: FeedbackOrigin = {
    screenName:
      screenName.trim() === "" || sensitiveText(screenName)
        ? "画面"
        : screenName.trim().slice(0, 100),
    url: safeAbsoluteUrl(originUrl, route),
    route,
    viewportWidth: finiteViewport(rawOrigin.viewportWidth),
    viewportHeight: finiteViewport(rawOrigin.viewportHeight),
  };

  const rawJsErrors = stringArray(rawTechnical.jsErrors);
  const rawFailedRequests = stringArray(rawTechnical.failedRequests);
  const rawRecentActions = stringArray(rawTechnical.recentActions);
  const rawUserAgent = stringValue(rawTechnical.userAgent);
  const jsErrors = bounded(rawJsErrors.values).map(errorCategory);
  const failedRequests = bounded(rawFailedRequests.values).map(failedRequestCategory);
  const recentActions = bounded(rawRecentActions.values).map(actionCategory);
  const userAgent = browserCategory(rawUserAgent);
  const rawRedactedCount = rawTechnical.redactedCount;
  const declaredRedactedCount =
    typeof rawRedactedCount === "number" && Number.isFinite(rawRedactedCount)
      ? Math.min(MAX_REDACTED_COUNT, Math.max(0, Math.round(rawRedactedCount)))
      : 0;
  const changed =
    changedValue(rawOrigin.screenName, safeOrigin.screenName) +
    changedValue(rawOrigin.url, safeOrigin.url) +
    changedValue(rawOrigin.route, safeOrigin.route) +
    changedValue(rawOrigin.viewportWidth, safeOrigin.viewportWidth) +
    changedValue(rawOrigin.viewportHeight, safeOrigin.viewportHeight) +
    changedValue(rawTechnical.userAgent, userAgent) +
    rawJsErrors.rejected +
    rawFailedRequests.rejected +
    rawRecentActions.rejected +
    changedLines(rawJsErrors.values, jsErrors) +
    changedLines(rawFailedRequests.values, failedRequests) +
    changedLines(rawRecentActions.values, recentActions) +
    changedValue(rawRedactedCount, declaredRedactedCount);

  return {
    origin: safeOrigin,
    technical: {
      jsErrors,
      failedRequests,
      userAgent,
      recentActions,
      redactedCount: Math.min(
        MAX_REDACTED_COUNT,
        declaredRedactedCount + changed,
      ),
      // 届いたばかりのものは、まだ消していない。**入口の申告は見ない。**
      purgedAt: null,
    },
  };
}
