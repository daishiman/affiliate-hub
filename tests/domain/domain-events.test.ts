/**
 * @tier 1
 * @req REQ-EV01, REQ-EV02, REQ-EV03, REQ-EV04, REQ-EV05, REQ-EV06, REQ-EV07, REQ-EV08
 * @req REQ-EV09, REQ-EV10, REQ-EV11, REQ-EV12, REQ-EV13, REQ-EV14, REQ-EV15, REQ-EV16
 * @types equivalence, boundary
 *
 * 16 件の出来事（REQ-EV01〜REQ-EV16）の分かれ目は、ここにある。
 *
 * 出来事は「受け手が必ず使う項目」を約束する連絡である。約束が守られる分かれ目は
 * **そろった形と、そのすぐ隣（必須のうち 1 つだけ欠けた形）**の 2 つで、
 * 下の「16 件のどれも、必須項目を 1 つ落とすだけで断られる」が 16 件すべてに当てている。
 *
 * まだどこからも出していない 9 件（`product.enriched` など）も同じ検査を通る。
 * 出す側が未実装であることと、約束の形が決まっていることは別だからである。
 * 出していないこと自体は台帳（`docs/product/event-ledger.md`）が数で持つ。
 *
 * 出す場所の側（どの状態変化で出るか）は、出す側の要件が持つ。
 * 例: `affiliate_url.submitted` の出どころは REQ-P01 の受信箱で、
 * その状態遷移は `tests/domain/link-ingestion.test.ts`「受信箱の 4 状態」にある。
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DOMAIN_EVENTS,
  DOMAIN_EVENT_NAMES,
  buildEvent,
  describeEvent,
  type DomainEventName,
} from "@/domain/shared";
import { expectLedgerFile } from "../support/ledger-file";

/**
 * 文脈をまたぐ連絡（イベント）の検査と台帳づくり。
 *
 * 「一覧には書いたが、どこからも出していない」を隠さない。
 * 出していないものは台帳に「まだ出していない」と書き、
 * 何が済めば出せるようになるかを併記する。
 *
 * 更新するとき: `UPDATE_EVENT_LEDGER=1 pnpm test`
 */
const ROOT = resolve(import.meta.dirname, "../..");
const LEDGER_PATH = join(ROOT, "docs/product/event-ledger.md");

/** 仕様（プラットフォーム層 §23.2）が挙げている 16 件。ここを正解とする。 */
const SPEC_EVENTS = [
  "affiliate_url.submitted",
  "affiliate_url.resolved",
  "product.matched",
  "product.enriched",
  "comparison.ready",
  "content_package.created",
  "content_variant.generated",
  "content_variant.approved",
  "publication.scheduled",
  "publication.published",
  "publication.failed",
  "affiliate_link.broken",
  "affiliate_program.terminated",
  "claim.expired",
  "content.refresh_due",
  "conversion.received",
] as const;

/** まだ出していないものが、何を待っているか。空欄を許さない。 */
const BLOCKED_BY: Readonly<Record<string, string>> = {
  "affiliate_url.submitted": "成果リンクの受信箱（貼付・CSV 取込）の実装",
  "affiliate_url.resolved": "リンク先をたどって広告主を特定する処理（ASP 接続が要る）",
  "product.matched": "受信したリンクと商品を突き合わせる処理",
  "product.enriched": "外部情報から商品属性を補う取込処理",
  "comparison.ready": "比較候補の 4 分類（同一/派生/競合/代替）の判定処理",
  "content_package.created": "記事のまとまりを作る画面と生成の起動",
  "publication.scheduled": "配信予約の実装（出し先の接続が要る）",
  "publication.published": "配信の実行（各サービスの認証が要る）",
  "publication.failed": "配信の実行と失敗の取り扱い",
  "affiliate_link.broken": "リンク切れ検出の定期実行",
  "affiliate_program.terminated": "ASP からの提携状態の取得",
  "claim.expired": "根拠の有効期限を見て回る定期実行",
  "conversion.received": "ASP からの成果データ取込",
};

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : path.endsWith(".ts") ? [path] : [];
  });
}

/**
 * コメントを落とす。名前が**コメントに書いてあるだけ**を発行と数えないため。
 * `//` は URL の `https://` を巻き込まないように、直前が `:` でない場合だけ見る。
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/**
 * その本文が `name` を**発行している**か。
 *
 * **文字列の出現では数えない。**
 * 2026-08-21 に実測: 以前はファイル本文に `"affiliate_url.submitted"` という
 * 文字列が在れば「発行あり」に数えていた。発行の呼び出しを丸ごと消して
 * 同じ名前をコメントに 1 行残しただけで、このファイルは 7 件とも緑のままで、
 * 台帳も「発行あり」と書き続けた。数えるのは**発行の呼び出し**にする。
 *
 * 見るのは `emit(deps, actor, "名前", …)` と `buildEvent("名前", …)` の 2 つ。
 * 監査記録の `action: "…"` や権限名は同じ書式の文字列だが、呼び出しの中に
 * 無いので数えない（`affiliate_link.created` などが実在する）。
 */
function emitsEvent(source: string, name: string): boolean {
  const escaped = name.replace(/\./g, "\\.");
  // `[^;]` で式 1 つぶんに区切る。次の文まで跨いで拾わないため。
  return new RegExp(String.raw`\b(?:emit|buildEvent)\s*\([^;]{0,400}?"${escaped}"`).test(
    stripComments(source),
  );
}

/** その名前を実際に発行している場所。 */
function emissionSites(name: DomainEventName): string[] {
  return walk(join(ROOT, "src/application"))
    .filter((path) => emitsEvent(readFileSync(path, "utf8"), name))
    .map((path) => path.slice(ROOT.length + 1));
}

function renderLedger(): string {
  const rows = DOMAIN_EVENT_NAMES.map((name) => {
    const spec = describeEvent(name);
    const sites = emissionSites(name);
    return {
      name,
      spec,
      sites,
      status: sites.length > 0 ? "発行あり" : "まだ発行していない",
      blocked: sites.length > 0 ? "—" : (BLOCKED_BY[name] ?? ""),
    };
  });
  const emitted = rows.filter((r) => r.sites.length > 0).length;

  return [
    "# 文脈をまたぐ連絡（イベント台帳）",
    "",
    "このファイルは `tests/domain/domain-events.test.ts` が作る。手で書き換えない。",
    "更新は `UPDATE_EVENT_LEDGER=1 pnpm test` を実行して、出た差分をそのまま保存する。",
    "末尾の指紋がその見張りで、手で 1 文字でも書くと、内容が合っていてもテストが赤くなる。",
    "",
    "イベントは、ある文脈で起きたことを別の文脈へ伝えるための唯一の経路。",
    "別の文脈の保存処理を直接呼ばないので、受け手が増えても送り手は変わらない。",
    "",
    `件数: ${rows.length}（うち実際に発行しているもの: ${emitted}）`,
    "",
    "| 名前 | 出す文脈 | 何が起きたか | 必ず入る項目 | 状態 | 発行場所 / 何が済めば出せるか |",
    "|---|---|---|---|---|---|",
    ...rows.map(
      (r) =>
        `| \`${r.name}\` | ${r.spec.context} | ${r.spec.description} | ${r.spec.requiredKeys
          .map((k) => `\`${k}\``)
          .join(" ")} | ${r.status} | ${r.sites.length > 0 ? r.sites.map((s) => `\`${s}\``).join(" ") : r.blocked} |`,
    ),
    "",
  ].join("\n");
}

describe("文脈をまたぐ連絡（イベント）", () => {
  it("仕様の 16 件が過不足なく定義されている", () => {
    expect([...DOMAIN_EVENT_NAMES].sort()).toEqual([...SPEC_EVENTS].sort());
  });

  it("すべてのイベントに、出す文脈・説明・必ず入る項目がある", () => {
    for (const name of DOMAIN_EVENT_NAMES) {
      const spec = DOMAIN_EVENTS[name];
      expect(spec.description.trim(), `${name} に説明がありません`).not.toBe("");
      expect(spec.requiredKeys.length, `${name} に必須項目がありません`).toBeGreaterThan(0);
    }
  });

  it("必要な項目が欠けていたら、送る前に断る", () => {
    const result = buildEvent("content_variant.approved", "ws_1", new Date(), {
      variantId: "cv_1",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_FAILED");
      expect(result.error.suggestedAction).toContain("approvedBy");
    }
  });

  it("16 件のどれも、必須項目を 1 つ落とすだけで断られる", () => {
    // 1 件だけ試して済ませない。上の検査は content_variant.approved しか通らず、
    // 残り 15 件は「必須項目を書いたが見ていない」まま緑になれてしまう。
    // ここで見るのは**そろった状態のすぐ隣**（必須のうち 1 つだけ欠けた形）で、
    // 通ってしまうならその 1 項目は名前だけの必須である。
    const at = new Date("2026-08-17T00:00:00Z");
    for (const name of DOMAIN_EVENT_NAMES) {
      const keys = DOMAIN_EVENTS[name].requiredKeys;
      const full = Object.fromEntries(keys.map((k) => [k, "値"]));
      expect(buildEvent(name, "ws_1", at, full).ok, `${name} はそろえても組み立てられません`).toBe(
        true,
      );
      for (const dropped of keys) {
        const short = Object.fromEntries(keys.filter((k) => k !== dropped).map((k) => [k, "値"]));
        const result = buildEvent(name, "ws_1", at, short);
        expect(result.ok, `${name} から ${dropped} を落としても通ってしまいます`).toBe(false);
        if (result.ok) continue;
        expect(
          result.error.suggestedAction,
          `${name}: 落とした ${dropped} の名前が返りません`,
        ).toContain(dropped);
      }
    }
  });

  it("そろっていれば組み立てられる", () => {
    const at = new Date("2026-08-17T00:00:00Z");
    const result = buildEvent("content_variant.approved", "ws_1", at, {
      variantId: "cv_1",
      approvedBy: "u_1",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.name).toBe("content_variant.approved");
      expect(result.value.occurredAt).toBe(at);
    }
  });

  it("「発行あり」は呼び出しで数えていて、名前が書いてあるだけでは数えない", () => {
    // **この検査が台帳の「うち N 件を実際に発行している」の担保。**
    // 数え方が文字列一致に戻ると、発行をやめても台帳は「発行あり」と書き続ける。
    const name = "affiliate_url.submitted";
    expect(emitsEvent(`await emit(deps, actor, "${name}", { url });`, name)).toBe(true);
    expect(emitsEvent(`const e = buildEvent("${name}", ws, now, payload);`, name)).toBe(true);
    // 発行をやめて名前だけ残した形。ここが true になるなら数え方が壊れている。
    expect(emitsEvent(`// もう出していない "${name}"`, name), "コメントを発行に数えています").toBe(
      false,
    );
    expect(
      emitsEvent(`/* 出す予定 "${name}" */`, name),
      "ブロックコメントを発行に数えています",
    ).toBe(false);
    // 監査記録の action 名は書式が同じだが発行ではない。
    expect(
      emitsEvent(`await deps.audit.write({ action: "${name}" });`, name),
      "監査記録を発行に数えています",
    ).toBe(false);
    // 別の名前の発行に巻き込まれない。
    expect(emitsEvent(`await emit(deps, actor, "product.matched", {});`, name)).toBe(false);
  });

  it("実際に発行しているイベントが 1 件以上ある", () => {
    // **母集団の床。**走査先を間違えると全件が「まだ発行していない」になり、
    // 上の待ち条件の検査は BLOCKED_BY を全件見るだけで緑のまま通る。
    const files = walk(join(ROOT, "src/application"));
    expect(files.length, "src/application を歩けていません").toBeGreaterThan(5);
    const emitted = DOMAIN_EVENT_NAMES.filter((name) => emissionSites(name).length > 0);
    expect(emitted.length, "発行している場所を 1 件も見つけられていません").toBeGreaterThan(0);
  });

  it("まだ出していないイベントには、何を待っているかが書いてある", () => {
    // 「時間が無い」は待ち条件ではない。何が済めば出せるかを書く。
    for (const name of DOMAIN_EVENT_NAMES) {
      if (emissionSites(name).length > 0) continue;
      expect((BLOCKED_BY[name] ?? "").trim(), `${name} の待ち条件が空です`).not.toBe("");
    }
  });

  it("台帳ファイルが実際の状態と一致していて、手で書かれていない", () => {
    expectLedgerFile(
      LEDGER_PATH,
      renderLedger(),
      process.env.UPDATE_EVENT_LEDGER === "1",
      "イベント台帳が古くなっています。`UPDATE_EVENT_LEDGER=1 pnpm test` で作り直してください。",
    );
  });
});
