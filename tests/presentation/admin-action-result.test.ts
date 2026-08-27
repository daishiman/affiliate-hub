/**
 * @tier 1
 * @req REQ-UX02
 * @types equivalence, code-boundary
 *
 * 管理画面の作成・編集・削除 action に共通する入口と失敗の形。
 * FormData の読み方、成功文言、再検証先、業務分岐は対象ごとに違うため、ここへ寄せない。
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
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

const ALL_STATE_FILES = readdirSync(ADMIN_DIR)
  .filter((file) => file.endsWith("-state.ts"))
  .sort();

/**
 * 現在の worktree には、blog feature より前の同型 state もある。
 * それらを今回の slice で一括変更すると周辺リファクタになるため、対象外の理由を名指しで残す。
 * 新しい state はここへ自動追加されないので、同じ形を書き足すと失敗する。
 */
const STATE_EXEMPTIONS: Readonly<Record<string, string>> = {
  "adjust-conversion-state.ts": "成果調整 feature の独立 slice で移行するため",
  "content-progress-state.ts": "記事進行 feature の独立 slice で移行するため",
  "feedback-state.ts": "複数の返値契約を持つ feedback feature の独立 slice で移行するため",
  "guideline-reference-state.ts": "SEO 出典 feature の独立 slice で移行するため",
  "improvement-state.ts": "改善ループ feature の独立 slice で移行するため",
  "llm-credential-state.ts": "秘密値の専用監査を要する別 feature のため",
  "member-state.ts": "担当者・権限 feature の独立 slice で移行するため",
  "publish-article-state.ts": "公開URLとAI検査結果を持つ別契約のため",
  "reschedule-state.ts": "配信日変更 feature の独立 slice で移行するため",
  "schedule-publication-state.ts": "重複・手動配信の追加状態を持つ別契約のため",
  "site-wizard-state.ts": "作成後URLを持つ wizard feature の独立 slice で移行するため",
};

const BASE_STATE_SHAPE = /readonly status: "idle" \| "done" \| "failed";[\s\S]*?readonly message: string;/;

const STATE_FILES = ALL_STATE_FILES.filter((file) => {
  const source = sourceOf(file);
  return source.includes("AdminActionState") || BASE_STATE_SHAPE.test(source);
});

const ACTION_FILES = readdirSync(ADMIN_DIR)
  .filter((file) => file.endsWith("-action.ts"))
  .filter((file) => {
    const source = sourceOf(file);
    const stateImports = [...source.matchAll(/from "\.\/(.+-state)"/g)];
    return stateImports.some((match) => sourceOf(`${match[1]}.ts`).includes("AdminActionState"));
  })
  .sort();

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
});
