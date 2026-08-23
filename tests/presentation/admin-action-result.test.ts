/**
 * @tier 1
 * @req REQ-UX02
 * @types equivalence, structural
 *
 * 管理画面の作成・編集・削除 action に共通する入口と失敗の形。
 * FormData の読み方、成功文言、再検証先、業務分岐は対象ごとに違うため、ここへ寄せない。
 */
import { readFileSync } from "node:fs";
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

const ACTION_FILES = [
  "content-form-action.ts",
  "product-form-action.ts",
  "site-form-action.ts",
  "publication-form-action.ts",
  "delete-form-action.ts",
] as const;

const STATE_FILES = [
  "content-form-state.ts",
  "product-form-state.ts",
  "site-form-state.ts",
  "publication-form-state.ts",
  "delete-form-state.ts",
] as const;

describe("管理画面 action の基底状態を個別に書き直さない", () => {
  it.each(STATE_FILES)("%s は AdminActionState を使う", (file) => {
    const source = readFileSync(join(process.cwd(), "src/presentation/admin", file), "utf8");
    expect(source).toContain("AdminActionState");
    expect(source).not.toContain('readonly status: "idle" | "done" | "failed"');
  });
});

describe("管理画面 action の共通失敗を個別に書き直さない", () => {
  it.each(ACTION_FILES)("%s は共通 helper を通す", (file) => {
    const source = readFileSync(join(process.cwd(), "src/presentation/admin", file), "utf8");
    expect(source).toContain("await signedInActor()");
    expect(source).toContain("notSignedInFailure(");
    expect(source).toContain("failureFromDomainError(");
    expect(source).not.toContain("signedInActorForAction(");
    expect(source).not.toMatch(/refusalText\(result\.error\)/);
  });
});
