import type { Finding } from "./finding";
import { pageKeyOf, type PageKey } from "./page-key";
import type { PageObservation } from "./page-observation";

export type LlmsTxtObservation = "present" | "empty" | "missing";

/** 設計図の配信設定と、公開URLで観測した事実を照合する。 */
export function auditLlmsTxt(
  input: {
    readonly pageKey: PageKey;
    readonly expected: boolean;
    readonly observed: LlmsTxtObservation;
  },
  observedAt: string,
): readonly Finding[] {
  if (input.expected && input.observed !== "present") {
    return [finding(
      input.pageKey,
      "missing_llms_txt",
      input.observed === "empty"
        ? "設計図では配信する設定ですが、llms.txt の内容が空です。"
        : "設計図では配信する設定ですが、llms.txt が 404 です。",
      observedAt,
    )];
  }
  if (!input.expected && input.observed !== "missing") {
    return [finding(
      input.pageKey,
      "unexpected_llms_txt",
      input.observed === "empty"
        ? "設計図では配信しない設定ですが、空の llms.txt が返っています。"
        : "設計図では配信しない設定ですが、llms.txt が公開されています。",
      observedAt,
    )];
  }
  return [];
}

/**
 * 1 site の完全な成功観測だけに適用する横断規則。
 * 未完の集合を渡すと「まだ見ていない」を「無い」と誤判定するため、callerは
 * scan complete のときだけ呼ぶ。
 */
export function auditCompleteSite(
  observations: readonly PageObservation[],
  observedAt: string,
): readonly Finding[] {
  const findings: Finding[] = [];
  const known = new Set(observations.map((page) => page.pageKey));
  const incoming = new Map<PageKey, number>(observations.map((page) => [page.pageKey, 0]));

  for (const page of observations) {
    for (const target of new Set(page.internalLinkPageKeys ?? [])) {
      if (target === page.pageKey || !known.has(target)) continue;
      incoming.set(target, (incoming.get(target) ?? 0) + 1);
    }
  }

  addDuplicates(observations, observedAt, "title", "duplicate_title", findings);
  addDuplicates(observations, observedAt, "metaDescription", "duplicate_meta_description", findings);

  for (const page of observations) {
    if ((incoming.get(page.pageKey) ?? 0) === 0) {
      findings.push(finding(page.pageKey, "orphan_page", "同じブログの別ページから届くリンクがありません。", observedAt));
    }
    const rawCanonical = page.canonical?.trim();
    if (!rawCanonical) continue;
    let absolute: string;
    try { absolute = new URL(rawCanonical, page.url).toString(); } catch { continue; }
    const canonical = pageKeyOf(absolute);
    if (canonical.ok && !known.has(canonical.key)) {
      findings.push(finding(page.pageKey, "canonical_target_unreachable", "canonical の行き先が今回の完全な公開ページ集合にありません。", observedAt));
    }
  }
  return findings;
}

function addDuplicates(
  observations: readonly PageObservation[],
  observedAt: string,
  field: "title" | "metaDescription",
  code: "duplicate_title" | "duplicate_meta_description",
  into: Finding[],
): void {
  const groups = new Map<string, PageObservation[]>();
  for (const page of observations) {
    const value = page[field]?.trim() ?? "";
    if (value === "") continue;
    const group = groups.get(value) ?? [];
    group.push(page);
    groups.set(value, group);
  }
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    for (const page of group) {
      into.push(finding(page.pageKey, code, `同じ内容を使うページが ${group.length} 件あります。`, observedAt));
    }
  }
}

function finding(pageKey: PageKey, code: Finding["code"], detail: string, observedAt: string): Finding {
  return { source: "static_audit", pageKey, code, detail, observedAt };
}
