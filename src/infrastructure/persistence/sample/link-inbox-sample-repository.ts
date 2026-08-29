import type { CommercialLinkIngestionRepositoryPort } from "@/application/ports/monetization";
import {
  type LinkIngestion,
  type LinkIngestionState,
  createLinkIngestion,
} from "@/domain/monetization";
import {
  type AffiliateProgramId,
  type LinkIngestionId,
  type ProductId,
  type WorkspaceId,
  markCommercial,
  ok,
  taggedString,
} from "@/domain/shared";
import { registerStub, stubReason } from "../../stub-registry";
import { SAMPLE_WORKSPACE_ID } from "./sample-identity";

/**
 * ★ これは仮置きの見本データです（スタブ）。★
 *
 * 受信箱の中身は、この場（動いているサーバー 1 つ分）にだけ持っている。
 * **入れたリンクは、しばらく置くと消える。** 保存先が D1 になるまでは、
 * 「入れて、広告主を決めて、商品に結びつける」という流れの確認用と考えてほしい。
 *
 * 消えることを黙っておくと「保存したのに無くなった」が不具合として報告される。
 * だからスタブとして名乗り、画面にもそのまま出す。
 */
const stub = registerStub({
  id: "persistence:link-inbox-sample",
  port: "成果リンク受信箱の保存先",
  label: "受信箱（見本データ・この場限り）",
  blockedBy: "済み。保存先が無い環境（pnpm dev・自動テスト）での控えとして残す",
  fallbackFor: "src/infrastructure/persistence/d1/link-inbox-repository.ts",
});

export function sampleLinkInboxNotice(): string {
  return `${stub.label}で動いています。入れたリンクはしばらくすると消えます（${stubReason(stub)}）。`;
}

const WS = SAMPLE_WORKSPACE_ID as WorkspaceId;

function seed(input: {
  id: string;
  url: string;
  source: LinkIngestion["source"];
  submittedAt: string;
  state: LinkIngestionState;
  programId?: string;
  productId?: string;
  note?: string;
  rejectedReason?: string;
}): LinkIngestion {
  const built = createLinkIngestion({
    id: taggedString<"LinkIngestionId">(input.id) as LinkIngestionId,
    workspaceId: WS,
    submittedUrl: input.url,
    source: input.source,
    submittedAt: new Date(input.submittedAt),
    note: input.note ?? null,
  });
  if (!built.ok) throw new Error(`見本の受信リンクが不正です (${input.id}): ${built.error.message}`);
  return {
    ...built.value,
    state: input.state,
    programId:
      input.programId === undefined
        ? null
        : (taggedString<"AffiliateProgramId">(input.programId) as AffiliateProgramId),
    productId:
      input.productId === undefined
        ? null
        : (taggedString<"ProductId">(input.productId) as ProductId),
    rejectedReason: input.rejectedReason ?? null,
  };
}

/**
 * 4 つの状態がすべて 1 件以上ある見本。
 * 状態がそろっていないと、画面の空表示・理由表示を目で確かめられない。
 */
const SEED: readonly LinkIngestion[] = [
  seed({
    id: "li_received_1",
    url: "https://example.invalid/asp/amazon/p_alpha_15?utm_source=slack",
    source: "paste",
    submittedAt: "2026-08-15T09:12:00Z",
    state: "received",
    note: "編集部の共有メモから貼り付け",
  }),
  seed({
    id: "li_received_2",
    url: "https://example.invalid/asp/unknown/xyz-2201",
    source: "csv",
    submittedAt: "2026-08-15T09:20:00Z",
    state: "received",
  }),
  seed({
    id: "li_resolved_1",
    url: "https://example.invalid/asp/rakuten/p_beta_14",
    source: "extension",
    submittedAt: "2026-08-14T02:00:00Z",
    state: "resolved",
    programId: "prg_rakuten_pc",
  }),
  seed({
    id: "li_matched_1",
    url: "https://example.invalid/asp/direct/p_alpha_15",
    source: "webmcp",
    submittedAt: "2026-08-13T23:40:00Z",
    state: "matched",
    programId: "prg_direct_soft",
    productId: "p_alpha_15",
  }),
  seed({
    id: "li_rejected_1",
    url: "https://example.invalid/campaign/expired-summer",
    source: "paste",
    submittedAt: "2026-08-10T05:00:00Z",
    state: "rejected",
    rejectedReason: "キャンペーンが終了しており、提携条件が確認できないため。",
  }),
];

/**
 * この場限りの受信箱。
 *
 * 見本の 5 件を種にして、動いている間の追加分を後ろに足していく。
 * 種そのものは書き換えない（作り直すたびに同じ状態から始められるようにする）。
 */
/**
 * 追加・更新された分。
 *
 * **関数の中ではなくここに置く。** 組み立て（`createDeps()`）は呼ばれるたびに
 * 新しい保存先を作るので、関数の中に置くと、貼り付けた次の画面表示で消える。
 */
const added: LinkIngestion[] = [];

/**
 * 「その URL を最初に受け取ったのは誰か」の取り合い（D1 側の
 * `link_ingestion_url_claims` に当たるもの）。鍵は作業場所 + 正規化 URL。
 *
 * 種のうち対象外（`rejected`）のものは最初から降りている。
 * 捨てたリンクを相手に指した「重複」を出さないため。
 */
const claimKey = (workspaceId: WorkspaceId, normalizedUrl: string) =>
  `${String(workspaceId)}\u0000${normalizedUrl}`;

const claims = new Map<string, LinkIngestionId>(
  SEED.filter((i) => i.state !== "rejected").map((i) => [
    claimKey(i.workspaceId, i.normalizedUrl),
    i.id,
  ]),
);

export function createSampleLinkIngestionRepository(): CommercialLinkIngestionRepositoryPort {
  /**
   * 種と追加分を合わせた全件。
   * **同じ ID があるときは追加分が勝つ。** 種を先に返すと、
   * 広告主を決めた直後の一覧に、決める前の状態が出てしまう。
   */
  const all = (): readonly LinkIngestion[] => {
    const overridden = new Set(added.map((i) => String(i.id)));
    return [...SEED.filter((i) => !overridden.has(String(i.id))), ...added];
  };

  return markCommercial({
    async findById(workspaceId: WorkspaceId, id: LinkIngestionId) {
      return ok(all().find((i) => i.workspaceId === workspaceId && i.id === id) ?? null);
    },

    async list(
      workspaceId: WorkspaceId,
      filter: { state: LinkIngestionState | null },
      page: { limit: number },
    ) {
      const items = all()
        .filter((i) => i.workspaceId === workspaceId)
        .filter((i) => filter.state === null || i.state === filter.state)
        // 新しいものが上。古い受け取りを探しに行く場面より、
        // いま届いたものを片付ける場面のほうが多い。
        .sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime())
        .slice(0, page.limit);
      return ok({ items, nextCursor: null });
    },

    async claimNormalizedUrl(
      workspaceId: WorkspaceId,
      normalizedUrl: string,
      candidateId: LinkIngestionId,
    ) {
      /*
       * D1 側の主キーに当たるものを、この場では Map の鍵で表す。
       *
       * **`has` で見てから入れる形でよいのはここだけ。** JavaScript の
       * 1 つの実行の途中では、`await` を挟まないこの 2 行の間に
       * 他の受け取りが割り込めないため。保存先が別の場所にある D1 では
       * 同じ書き方は成り立たないので、あちらは一手で決着させてある。
       */
      const key = claimKey(workspaceId, normalizedUrl);
      const holder = claims.get(key);
      if (holder !== undefined) return ok(holder);
      claims.set(key, candidateId);
      return ok(candidateId);
    },

    async releaseNormalizedUrl(
      workspaceId: WorkspaceId,
      normalizedUrl: string,
      id: LinkIngestionId,
    ) {
      const key = claimKey(workspaceId, normalizedUrl);
      // 最初の 1 本でなければ何もしない（他人の取り分を消さない）。
      if (claims.get(key) === id) claims.delete(key);
      return ok(undefined);
    },

    async save(item: LinkIngestion) {
      // 種そのものは書き換えず、上書き分として追加側へ置く（all() が後勝ちで解決する）。
      const index = added.findIndex((i) => i.id === item.id);
      if (index >= 0) added[index] = item;
      else added.push(item);
      return ok(item);
    },
  });
}
