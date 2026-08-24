import { type AuditClock, auditWriteFailure, buildAuditEntry } from "@/application/audit";
import type { AuditLogPort } from "@/application/ports/compliance";
import type { GuidelineReferencePort } from "@/application/ports/guideline-reference";
import { requireCapability } from "@/domain/identity";
import {
  type GuidelineReference,
  type GuidelineRegion,
  INITIAL_GUIDELINE_REFERENCES,
  referenceReviewStatus,
} from "@/domain/seo/guideline-reference";
import {
  type ActorContext,
  type DomainError,
  type Result,
  err,
  ok,
  validationError,
} from "@/domain/shared";
import type { UseCase } from "../usecase";

/**
 * SEO/AI 検索ガイドラインの出典を、画面から登録・一覧・再確認する。
 *
 * --- 90 日判定をここで書かない ---
 * 判定はドメインの `referenceReviewStatus` ただ 1 つである。この層は
 * 「今日が何日か」を渡すだけにする。判定の写しを持つと、
 * 90 日を変えたときに片方だけ古い判定が残る。
 *
 * --- 初期候補を勝手に保存しない ---
 * `INITIAL_GUIDELINE_REFERENCES` は「登録の候補」であって登録ではない。
 * 一覧を開いただけで保存すると、誰も確認していない出典に登録者の顔が付く。
 * 未登録の候補は `registered: false` の行として返し、登録は人の操作で行う。
 *
 * --- 権限 ---
 * 一覧は `content.read`（記事を書く人が根拠の鮮度を読むため）。
 * 登録と再確認は `site.manage`（サイトの運用方針を決める人の操作）。
 *
 * --- 記録を残す（`deps.auditLog.append` をこのファイルに置く理由） ---
 * 出典は「何を根拠に広告表記や AI 向けの作りを決めたか」の証跡である。
 * 規制対応で問われるのはきまりの中身だけでなく、**誰がいつ何を見て
 * そう決めたか**なので、登録と再確認は操作の記録に残す。
 * 呼び出しを共通の補助関数へ引き上げないのは `src/application/audit.ts`
 * に書いたとおり（同じファイルの中でしか辿られない）。
 */
/** `AuditClock` が `ids` と `now` を持つ（記録の採番と日時に同じものを使う）。 */
export type ManageGuidelineReferencesDeps = AuditClock & {
  readonly references: GuidelineReferencePort;
  readonly auditLog: AuditLogPort;
};

export type ManageGuidelineReferencesInput =
  | { readonly action: "list" }
  | {
      readonly action: "add";
      readonly title: string;
      readonly url: string;
      readonly publisher: string;
      readonly region: string;
      readonly checkedAt: string;
      readonly note?: string;
    }
  | { readonly action: "recheck"; readonly id: string; readonly checkedAt: string };

export type GuidelineReferenceListRow = {
  readonly reference: GuidelineReference;
  /** `review_due` は確認日から 90 日超。画面では「再確認」と表示する。 */
  readonly status: "fresh" | "review_due";
  /** 保存先に在る行か。`false` は初期候補（未登録）。 */
  readonly registered: boolean;
};

export type ManageGuidelineReferencesOutput = {
  readonly rows: readonly GuidelineReferenceListRow[];
};

const YMD = /^\d{4}-\d{2}-\d{2}$/;

/** YYYY-MM-DD として読めるか。形だけでなく実在する日付かまで見る。 */
function isValidYmd(value: string): boolean {
  if (!YMD.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function checkAddInput(
  input: Extract<ManageGuidelineReferencesInput, { action: "add" }>,
): Result<Omit<GuidelineReference, "id">, DomainError> {
  const title = input.title.trim();
  if (title === "") return err(validationError("タイトルを入れてください。", "title"));

  // https 限定。http の出典を許すと、確認しに行く先が改竄されうる経路になる。
  if (!input.url.startsWith("https://")) {
    return err(validationError("URL は https:// で始まる必要があります。", "url"));
  }

  const publisher = input.publisher.trim();
  if (publisher === "") return err(validationError("発行元を入れてください。", "publisher"));

  if (input.region !== "global" && input.region !== "jp") {
    return err(validationError("対象は「海外 (global)」か「日本 (jp)」から選んでください。", "region"));
  }

  if (!isValidYmd(input.checkedAt)) {
    return err(validationError("確認日は YYYY-MM-DD の形で入れてください。", "checkedAt"));
  }

  const note = input.note?.trim() ?? "";
  return ok({
    title,
    url: input.url,
    publisher,
    region: input.region as GuidelineRegion,
    checkedAt: input.checkedAt,
    ...(note === "" ? {} : { note }),
  });
}

export function createManageGuidelineReferencesUseCase(
  deps: ManageGuidelineReferencesDeps,
): UseCase<ManageGuidelineReferencesInput, ManageGuidelineReferencesOutput> {
  return {
    async execute(
      actor: ActorContext,
      input: ManageGuidelineReferencesInput,
    ): Promise<Result<ManageGuidelineReferencesOutput, DomainError>> {
      const allowed = requireCapability(
        actor,
        input.action === "list" ? "content.read" : "site.manage",
        "SEO/AI 指針の出典の管理",
      );
      if (!allowed.ok) return allowed;

      if (input.action === "add") {
        const checked = checkAddInput(input);
        if (!checked.ok) return checked;
        const id = `gr_${deps.ids.newId()}`;
        const added = await deps.references.add({
          workspaceId: actor.workspaceId,
          reference: { id, ...checked.value },
        });
        if (!added.ok) return added;

        const entry = buildAuditEntry(deps, actor, {
          action: "guideline_reference.registered",
          targetType: "guideline_reference",
          targetId: id,
          before: null,
          after: {
            title: checked.value.title,
            url: checked.value.url,
            publisher: checked.value.publisher,
            region: checked.value.region,
            checkedAt: checked.value.checkedAt,
          },
        });
        if (!entry.ok) return entry;
        const appended = await deps.auditLog.append(entry.value);
        if (!appended.ok) {
          return err(auditWriteFailure(`${checked.value.title} は登録されています`, { id }));
        }
      }

      if (input.action === "recheck") {
        if (input.id.trim() === "") {
          return err(validationError("どの出典かが分かりませんでした。", "id"));
        }
        if (!isValidYmd(input.checkedAt)) {
          return err(validationError("確認日は YYYY-MM-DD の形で入れてください。", "checkedAt"));
        }
        const updated = await deps.references.updateCheckedAt({
          workspaceId: actor.workspaceId,
          id: input.id,
          checkedAt: input.checkedAt,
        });
        if (!updated.ok) return updated;

        const entry = buildAuditEntry(deps, actor, {
          action: "guideline_reference.rechecked",
          targetType: "guideline_reference",
          targetId: input.id,
          before: null,
          after: { checkedAt: input.checkedAt },
        });
        if (!entry.ok) return entry;
        const appended = await deps.auditLog.append(entry.value);
        if (!appended.ok) {
          return err(
            auditWriteFailure("確認日は更新されています", {
              id: input.id,
              checkedAt: input.checkedAt,
            }),
          );
        }
      }

      const stored = await deps.references.list(actor.workspaceId);
      if (!stored.ok) return stored;

      // Workers の実行時計は UTC。判定の基準日もそれに合わせて 1 つにする。
      const today = deps.now().toISOString().slice(0, 10);
      const toRow = (reference: GuidelineReference, registered: boolean): GuidelineReferenceListRow => ({
        reference,
        status: referenceReviewStatus(reference, today),
        registered,
      });

      // 初期候補は URL で突き合わせる。登録時に id を採番し直すので id では照合できない。
      const registeredUrls = new Set(stored.value.map((r) => r.url));
      const candidates = INITIAL_GUIDELINE_REFERENCES.filter((r) => !registeredUrls.has(r.url));

      return ok({
        rows: [
          ...stored.value.map((r) => toRow(r, true)),
          ...candidates.map((r) => toRow(r, false)),
        ],
      });
    },
  };
}
