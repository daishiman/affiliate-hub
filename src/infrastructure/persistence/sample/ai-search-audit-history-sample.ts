import type { AiSearchAuditHistoryPort } from "@/application/ports/seo";
import { ok } from "@/domain/shared";
import { stubCall } from "../../stub-registry";
import { CONTENT_SAMPLE_STUB } from "./content-sample-data";

/**
 * 保存先（D1）が無い実行での、AI 検索点検の履歴。
 *
 * --- 記録は成功を返さない ---
 * `record` は `stubCall` で失敗にする。空の成功を返すと、点検結果が
 * 1 件も残らないまま「残しました」と言うことになり、あとから
 * 「なぜ履歴が空なのか」を追う手がかりが消える。
 * 記録の失敗は公開を巻き戻さないので、ここが失敗しても記事は出る。
 *
 * --- 読み取りの空と取得不能を混同しない ---
 * 再点検候補と失敗行そのものは空でよいが、公開記事の総数をこの代役は知らない。
 * coverage だけは失敗を返し、管理画面が「全合格」ではなく「取得不能」と示せるようにする。
 */
export function createSampleAiSearchAuditHistoryRepository(): AiSearchAuditHistoryPort {
  return {
    async record() {
      return stubCall<void>(CONTENT_SAMPLE_STUB, "AI 検索点検の履歴の保存");
    },
    async listStale() {
      return ok([]);
    },
    async listLatestFailing() {
      return ok([]);
    },
    async getCoverage() {
      return stubCall(CONTENT_SAMPLE_STUB, "AI 検索点検の範囲の取得");
    },
  };
}
