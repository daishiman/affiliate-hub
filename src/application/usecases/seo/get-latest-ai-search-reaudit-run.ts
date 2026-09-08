import type {
  AiSearchReauditRun,
  AiSearchReauditRunPort,
} from "@/application/ports/seo";
import { requireCapability } from "@/domain/identity";
import type { UseCase } from "../usecase";

/**
 * 管理画面へ、最後に完了した定期再点検の実行結果を返す。
 *
 * workspace は入力に持たない。画面や URL から別 workspace を指定できる形を
 * 作らず、実行主体の `workspaceId` だけを保存先へ渡す。
 * `null`（未実行）と保存先の失敗は意味が違うため、どちらも加工せず返す。
 */
export function createGetLatestAiSearchReauditRunUseCase(deps: {
  readonly runs: AiSearchReauditRunPort;
}): UseCase<Record<string, never>, AiSearchReauditRun | null> {
  return {
    async execute(actor) {
      const allowed = requireCapability(actor, "content.read", "定期再点検の実行結果の参照");
      if (!allowed.ok) return allowed;

      return deps.runs.getLatest(actor.workspaceId);
    },
  };
}
