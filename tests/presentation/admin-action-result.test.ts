/**
 * @tier 1
 * @req REQ-UX02
 * @types equivalence, code-boundary
 *
 * 管理画面の作成・編集・削除 action に共通する入口と失敗の形。
 * FormData の読み方、成功文言、再検証先、業務分岐は対象ごとに違うため、ここへ寄せない。
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { domainError } from "@/domain/shared";
import {
  failureFromDomainError,
  notSignedInFailure,
} from "@/presentation/admin/use-case-result";

describe("管理画面 action の共通状態", () => {
  it("ログインしていなければ、失敗状態を組み立てる", () => {
    const failure = notSignedInFailure("商品の登録");
    expect(failure).toMatchObject({ status: "failed" });
  });

  it("未認証の断りに操作名を含める", () => {
    const failure = notSignedInFailure("商品の登録");
    expect(failure.message).toContain("商品の登録");
  });

  it("業務側の断りは、理由と欄を落とさず標準失敗へ変える", () => {
    const failure = failureFromDomainError(
      domainError("VALIDATION_FAILED", "受け取れません。", { field: "name" }),
    );
    expect(failure).toMatchObject({
      status: "failed",
      field: "name",
    });
    expect(failure.message.trim()).not.toBe("");
  });

  it("業務側が欄を特定しない断りでは、field を付けない", () => {
    const failure = failureFromDomainError(domainError("CONFLICT", "今は直せません。"));
    expect(failure.field).toBeUndefined();
  });
});

const ADMIN_DIR = join(process.cwd(), "src/presentation/admin");

function sourceOf(file: string): string {
  return readFileSync(join(ADMIN_DIR, file), "utf8");
}

/**
 * `admin/` は 2026-08-30 に業務分類 (`ADMIN_NAV_GROUP_LABELS`) 別の
 * サブディレクトリへ割れた。1 階層しか見ないと母集団がほぼ空になり、
 * 「違反 0 件」が何も見ないまま成り立つので、再帰で集める。
 * 返す名前は `ADMIN_DIR` からの相対パス（例 `earn/inbox-action.ts`）。
 */
function adminFiles(dir: string = ADMIN_DIR): readonly string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...adminFiles(full));
    else out.push(relative(ADMIN_DIR, full));
  }
  return out;
}

const ALL_STATE_FILES = adminFiles()
  .filter((file) => file.endsWith("-state.ts"))
  .sort();

/**
 * 現在の worktree には、blog feature より前の同型 state もある。
 * それらを今回の slice で一括変更すると周辺リファクタになるため、対象外の理由を名指しで残す。
 * 新しい state はここへ自動追加されないので、同じ形を書き足すと失敗する。
 */
const STATE_EXEMPTIONS: Readonly<Record<string, string>> = {
  "earn/adjust-conversion-state.ts": "成果調整 feature の独立 slice で移行するため",
  "write/content-progress-state.ts": "記事進行 feature の独立 slice で移行するため",
  "feedback-state.ts": "複数の返値契約を持つ feedback feature の独立 slice で移行するため",
  "maintain/guideline-reference-state.ts": "SEO 出典 feature の独立 slice で移行するため",
  "observe/improvement-state.ts": "改善ループ feature の独立 slice で移行するため",
  "maintain/llm-credential-state.ts": "秘密値の専用監査を要する別 feature のため",
  "maintain/member-state.ts": "担当者・権限 feature の独立 slice で移行するため",
  "publish/publish-article-state.ts": "公開URLとAI検査結果を持つ別契約のため",
  "publish/reschedule-state.ts": "配信日変更 feature の独立 slice で移行するため",
  "schedule-publication-state.ts": "重複・手動配信の追加状態を持つ別契約のため",
  "publish/site-wizard-state.ts": "作成後URLを持つ wizard feature の独立 slice で移行するため",
};

const BASE_STATE_SHAPE = /readonly status: "idle" \| "done" \| "failed";[\s\S]*?readonly message: string;/;

const STATE_FILES = ALL_STATE_FILES.filter((file) => {
  const source = sourceOf(file);
  return source.includes("AdminActionState") || BASE_STATE_SHAPE.test(source);
});

const ACTION_FILES = adminFiles()
  .filter((file) => file.endsWith("-action.ts"))
  .filter((file) => {
    const source = sourceOf(file);
    const stateImports = [...source.matchAll(/from "(\.\.?\/[^"]+-state)"/g)];
    return stateImports.some((match) => {
      const target = relative(ADMIN_DIR, resolve(dirname(join(ADMIN_DIR, file)), match[1]));
      return sourceOf(`${target}.ts`).includes("AdminActionState");
    });
  })
  .sort();

const EXTENDED_STATE_ACTION_FILES = [
  ["maintain/compliance-action.ts", 2, 2, 2],
  ["earn/inbox-action.ts", 3, 3, 6],
  ["publish/publish-article-action.ts", 1, 1, 1],
] as const;

describe("管理画面 action の基底状態を個別に書き直さない", () => {
  it.each(STATE_FILES)("%s は AdminActionState を使う", (file) => {
    const source = sourceOf(file);
    const exemption = STATE_EXEMPTIONS[file];
    if (exemption !== undefined) {
      expect(exemption.trim(), `${file} の除外理由が空です`).not.toBe("");
      return;
    }
    expect(source).toContain("AdminActionState");
    expect(source).not.toContain('readonly status: "idle" | "done" | "failed"');
  });

  it("除外は実在する同型 state だけを指す", () => {
    expect(Object.keys(STATE_EXEMPTIONS).filter((file) => !STATE_FILES.includes(file))).toEqual([]);
  });
});

describe("管理画面 action の共通失敗を個別に書き直さない", () => {
  it.each(ACTION_FILES)("%s は共通 helper を通す", (file) => {
    const source = sourceOf(file);
    expect(source).toContain("await signedInActor()");
    expect(source).toContain("notSignedInFailure(");
    expect(source).toContain("failureFromDomainError(");
    expect(source).not.toContain("signedInActorForAction(");
    expect(source).not.toMatch(/refusalText\(result\.error\)/);
  });

  it.each(EXTENDED_STATE_ACTION_FILES)(
    "%s は認証境界を残し、失敗 state だけを共通 helper へ寄せる",
    (file, actorChecks, notSignedFailures, domainFailures) => {
      const source = readFileSync(join(ADMIN_DIR, file), "utf8");
      expect(source.match(/await signedInActor\(\)/g)).toHaveLength(actorChecks);
      expect(source.match(/notSignedInFailure\(/g)).toHaveLength(notSignedFailures);
      expect(source.match(/failureFromDomainError\(result\.error\)/g)).toHaveLength(
        domainFailures,
      );
      expect(source).not.toContain("signedInActorForAction(");
      expect(source).not.toMatch(/notSignedInText\(/);
      expect(source).not.toMatch(/refusalText\(result\.error\)/);
    },
  );

  it("site-wizard-action.ts は state 失敗だけを寄せ、redirect の組み立てを隠さない", () => {
    const source = readFileSync(
      join(process.cwd(), "src/presentation/admin/publish/site-wizard-action.ts"),
      "utf8",
    );
    expect(source.match(/await signedInActor\(\)/g)).toHaveLength(3);
    expect(source).toContain('return notSignedInFailure("下書きの保存")');
    expect(source).toContain('return notSignedInFailure("ブログの作成")');
    expect(source.match(/return failureFromDomainError\(result\.error\)/g)).toHaveLength(2);
    expect(source).not.toContain("signedInActorForAction(");

    // startSiteDraftAction は状態を返さず redirect を投げるため、この変換の対象外。
    expect(source).toContain('notSignedInText("下書きの作成")');
    expect(source).toContain("refusalText(result.error)");
  });
});
