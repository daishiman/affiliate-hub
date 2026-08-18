import type { TrackingCoveragePort } from "@/application/ports/analytics";
import { requireCapability } from "@/domain/identity";
import type { ActorContext, DomainError, Result } from "@/domain/shared";
import { ok } from "@/domain/shared";
import type { UseCase } from "../usecase";

/**
 * 順位表の成果リンクのうち、まだクリックを突合できないものが何件あるか。
 *
 * --- なぜこの数字を画面に出すのか ---
 * 合言葉が発行されていないリンクは、**黙って ASP の URL が出る**。
 * 読者は普通に買えるし、画面のどこにも異常は出ない。それでいて
 * そのリンクのクリックは 1 件も記録されない。
 * 数字の画面には「クリック数」が並ぶので、**出ている数字が
 * 全体の一部でしかないことに誰も気づけない**のがこの状態の危なさである。
 *
 * 全部が一度に切り替わることはない（合言葉は記事を出し直したときに入る）。
 * だから「未発行が 0 件かどうか」ではなく、**何件残っているか**を出す。
 *
 * --- 0 件のときも黙らない ---
 * 未発行が 0 件でも「全部そろっています」と出す。何も出さないと、
 * 数え上げが動いていないのか、本当に 0 なのかを画面から見分けられない。
 */
export type ReadTrackingCoverageDeps = {
  readonly trackingCoverage: TrackingCoveragePort;
};

export type TrackingCoverageView = {
  readonly total: number;
  readonly tracked: number;
  readonly untracked: number;
  /** 未発行のリンクを抱えている記事（先頭のみ）。どこを出し直せばよいかが分かる。 */
  readonly untrackedArticles: readonly string[];
  /** 画面にそのまま出す 1 文。画面側で数字から文を組み立てさせない。 */
  readonly headline: string;
  /** いま何が起きているか。0 件のときも書く。 */
  readonly detail: string;
};

export function createReadTrackingCoverageUseCase(
  deps: ReadTrackingCoverageDeps,
): UseCase<Record<string, never>, TrackingCoverageView> {
  return {
    async execute(
      actor: ActorContext,
      _input: Record<string, never>,
    ): Promise<Result<TrackingCoverageView, DomainError>> {
      const allowed = requireCapability(actor, "analytics.read", "数字の参照");
      if (!allowed.ok) return allowed;

      const summary = await deps.trackingCoverage.summarize(actor.workspaceId);
      if (!summary.ok) return summary;
      const { total, tracked, untracked, untrackedArticles } = summary.value;

      if (total === 0) {
        return ok({
          total,
          tracked,
          untracked,
          untrackedArticles,
          headline: "成果リンクがまだ 1 件もありません",
          detail:
            "記事に成果リンクが入ると、ここに「クリックを突合できる件数」が出ます。0 件は、まだ出していないという意味です。",
        });
      }

      if (untracked === 0) {
        return ok({
          total,
          tracked,
          untracked,
          untrackedArticles,
          headline: `成果リンク ${total} 件は、すべてクリックを突合できます`,
          detail:
            "読者はこちらの入口（/go/）を通って ASP へ行くので、どの記事のどのリンクが押されたかが記録に残ります。",
        });
      }

      return ok({
        total,
        tracked,
        untracked,
        untrackedArticles,
        headline: `成果リンク ${total} 件のうち ${untracked} 件は、クリックを突合できません`,
        detail:
          `この ${untracked} 件は ASP の URL を読者へ直に出しています。読者は普通に買えますが、押されたことは記録に残りません。` +
          "記事をもう一度出すと、そのとき合言葉が発行されて記録できるようになります。" +
          (untrackedArticles.length === 0
            ? ""
            : `残っている記事: ${untrackedArticles.join("、")}`),
      });
    },
  };
}
