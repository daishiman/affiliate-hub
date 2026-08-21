import { and, eq } from "drizzle-orm";
import type { LlmCredentialVaultPort } from "@/application/ports/llm-credential";
import type { LlmKeyAccess } from "@/infrastructure/llm/key-access";
import type { PortResult } from "@/application/ports/common";
import {
  type LlmCredentialSummary,
  type LlmCredentialVerification,
  checkApiKeyShape,
  containsSecret,
  last4Of,
  redactSecretsInText,
} from "@/domain/generation/llm-credential";
import { type UserId, type WorkspaceId, domainError, err, ok, taggedString } from "@/domain/shared";
import { type LlmCredentialRow, llmCredentials } from "@/db/schema";
import { SecretBoxOpenError, openSecret, sealSecret } from "@/infrastructure/platform/secret-box";
import type { DrizzleD1 } from "./link-inbox-repository";
import { storageFailure } from "./storage-failure";

/**
 * 生成 AI の鍵の預かり所（D1）。
 *
 * **この 1 ファイルだけが、包んだ鍵を開ける。**
 * だからここだけを厚く読めば「鍵が外へ出ないか」の判断が付く。
 * 逆に言うと、ここに `console.log` が 1 行入ると全部台無しになる。
 * それを人の注意力ではなく検査で押さえる
 * （`tests/architecture/llm-credential-leak.test.ts`）。
 *
 * --- 作業場所の分離をどう保証しているか ---
 * 主キーが (workspace_id, provider_id) の組で、
 * このファイルの問い合わせは**すべて両方を where に置いている**。
 * 片方だけで引く問い合わせを書かない、を検査で固定してある。
 */

/** 行 → 要約。**`sealedKey` をここで読まない**（要約に値の欄が無い）。 */
function toSummary(row: LlmCredentialRow): LlmCredentialSummary {
  return {
    workspaceId: taggedString<"WorkspaceId">(row.workspaceId) as WorkspaceId,
    providerId: row.providerId,
    last4: row.last4,
    status: row.status === "revoked" ? "revoked" : "active",
    registeredBy:
      row.registeredBy === null ? null : (taggedString<"UserId">(row.registeredBy) as UserId),
    registeredAt: row.registeredAt,
    lastVerifiedAt: row.lastVerifiedAt,
    lastVerification:
      row.lastVerification === "ok" || row.lastVerification === "failed"
        ? row.lastVerification
        : null,
  };
}

export type LlmCredentialVaultDeps = {
  readonly db: DrizzleD1;
  /**
   * 元締めの鍵。無いときは `null` を渡す。
   * **`null` のときはこの預かり所を組み立てない**（呼び出し側で機能ごと止める）。
   */
  readonly masterSecret: string;
  readonly now: () => Date;
};

/**
 * 応用層に見せる口と、提供元アダプタだけに見せる口の**両方**を満たす 1 つの物。
 * 物は 1 つだが、受け取る側は自分に必要な面しか型として持てない。
 */
export function createD1LlmCredentialVault(
  deps: LlmCredentialVaultDeps,
): LlmCredentialVaultPort & LlmKeyAccess {
  const { db, masterSecret, now } = deps;

  const whereOne = (workspaceId: WorkspaceId, providerId: string) =>
    and(eq(llmCredentials.workspaceId, workspaceId), eq(llmCredentials.providerId, providerId));

  async function readRow(
    workspaceId: WorkspaceId,
    providerId: string,
  ): Promise<LlmCredentialRow | null> {
    const rows = await db
      .select()
      .from(llmCredentials)
      .where(whereOne(workspaceId, providerId))
      .limit(1);
    return rows[0] ?? null;
  }

  return {
    async store(input): PortResult<LlmCredentialSummary> {
      const shape = checkApiKeyShape(input.apiKey);
      if (!shape.ok) return err(shape.error);
      const tail = last4Of(input.apiKey);
      if (!tail.ok) return err(tail.error);

      try {
        const sealed = await sealSecret(input.apiKey, masterSecret);
        const row: LlmCredentialRow = {
          workspaceId: input.workspaceId,
          providerId: input.providerId,
          sealedKey: sealed,
          last4: tail.value,
          status: "active",
          registeredBy: input.registeredBy,
          registeredAt: now(),
          // 入れ直したら未確認へ戻す。前の鍵の確認結果を新しい鍵の実績にしない。
          lastVerifiedAt: null,
          lastVerification: null,
        };
        await db
          .insert(llmCredentials)
          .values(row)
          .onConflictDoUpdate({
            target: [llmCredentials.workspaceId, llmCredentials.providerId],
            set: {
              sealedKey: row.sealedKey,
              last4: row.last4,
              status: "active",
              registeredBy: row.registeredBy,
              registeredAt: row.registeredAt,
              lastVerifiedAt: null,
              lastVerification: null,
            },
          });
        return ok(toSummary(row));
      } catch (cause) {
        // **例外を素通しさせない。** 包む途中で落ちると、実装によっては
        // 入力した値が例外の本文に載る。`storageFailure` は種類の名前しか残さない。
        return storageFailure("API キーの保管", cause);
      }
    },

    async list(workspaceId): PortResult<readonly LlmCredentialSummary[]> {
      try {
        const rows = await db
          .select()
          .from(llmCredentials)
          .where(eq(llmCredentials.workspaceId, workspaceId));
        return ok(rows.map(toSummary));
      } catch (cause) {
        return storageFailure("API キーの一覧の取得", cause);
      }
    },

    async revoke(input): PortResult<LlmCredentialSummary> {
      try {
        const row = await readRow(input.workspaceId, input.providerId);
        if (row === null) {
          return err(
            domainError("NOT_FOUND", "その提供元の API キーは登録されていません。", {
              details: { providerId: input.providerId },
            }),
          );
        }
        // **包んだ値も一緒に消す。** 状態だけ変えて値を残すと、
        // 「失効させたのに保管庫には残っている」状態になる。
        await db
          .update(llmCredentials)
          .set({ status: "revoked", sealedKey: "" })
          .where(whereOne(input.workspaceId, input.providerId));
        return ok({ ...toSummary(row), status: "revoked" });
      } catch (cause) {
        return storageFailure("API キーの失効", cause);
      }
    },

    async useKey<T>(input: {
      readonly workspaceId: WorkspaceId;
      readonly providerId: string;
      readonly fn: (apiKey: string) => Promise<T>;
    }): PortResult<T> {
      let row: LlmCredentialRow | null;
      try {
        row = await readRow(input.workspaceId, input.providerId);
      } catch (cause) {
        return storageFailure("API キーの取得", cause);
      }
      if (row === null || row.status === "revoked" || row.sealedKey === "") {
        return err(
          domainError("NOT_FOUND", "その提供元の API キーが登録されていません。", {
            suggestedAction: "設定画面から API キーを登録してください。",
            details: { providerId: input.providerId },
          }),
        );
      }

      let apiKey: string;
      try {
        apiKey = await openSecret(row.sealedKey, masterSecret);
      } catch (cause) {
        if (cause instanceof SecretBoxOpenError) {
          return err(
            // 保管してある値と元締めの鍵が噛み合っていない状態。
            // 「無い」ではないので `NOT_FOUND` にしない（入れ直しが要ることは同じでも、
            // 起きていることが違う。混ぜると元締めの鍵の取り違えに気づけない）。
            domainError("INVARIANT_VIOLATED", "保管している API キーを読み出せませんでした。", {
              suggestedAction: "設定画面から API キーを登録し直してください。",
              details: { providerId: input.providerId },
            }),
          );
        }
        return storageFailure("API キーの読み出し", cause);
      }

      try {
        return ok(await input.fn(apiKey));
      } catch (cause) {
        /**
         * --- ここが一番漏れやすい経路 ---
         * 提供元は「api_key sk-… は無効です」と、**こちらが渡した鍵を
         * そのまま載せて**返してくることがある。それが例外の本文になり、
         * 何もしなければ上位のログへそのまま流れる。
         *
         * この場では本物の値を持っているので、形ではなく**値そのもの**で
         * 突き合わせられる。混ざっていたら文面ごと捨てる（塗り潰しは
         * 知っている形にしか効かないので、こちらを先に見る）。
         */
        const raw = cause instanceof Error ? cause.message : String(cause);
        const safe = containsSecret(raw, apiKey) ? "" : redactSecretsInText(raw);
        return err(
          domainError("UPSTREAM_UNAVAILABLE", "生成 AI の呼び出しに失敗しました。", {
            retryable: true,
            suggestedAction:
              "API キーが有効か、提供元の状態に問題がないかを設定画面から確認してください。",
            details: {
              providerId: input.providerId,
              reason: cause instanceof Error ? cause.name : "unknown",
              // 空にしたのは「鍵が混ざっていたので捨てた」ことを示す。
              // 欄ごと消すと、落とした事実まで見えなくなる。
              upstreamMessage: safe,
            },
          }),
        );
      }
    },

    async recordVerification(input: {
      readonly workspaceId: WorkspaceId;
      readonly providerId: string;
      readonly outcome: LlmCredentialVerification;
    }): PortResult<LlmCredentialSummary> {
      try {
        const verifiedAt = now();
        await db
          .update(llmCredentials)
          .set({ lastVerifiedAt: verifiedAt, lastVerification: input.outcome })
          .where(whereOne(input.workspaceId, input.providerId));
        const row = await readRow(input.workspaceId, input.providerId);
        if (row === null) {
          return err(
            domainError("NOT_FOUND", "その提供元の API キーは登録されていません。", {
              details: { providerId: input.providerId },
            }),
          );
        }
        return ok(toSummary(row));
      } catch (cause) {
        return storageFailure("疎通確認の記録", cause);
      }
    },
  };
}
