import type {
  ChannelConnectionRepositoryPort,
  ChannelPublishInput,
  ManualExportPort,
  PublicationRepositoryPort,
} from "@/application/ports/distribution";
import {
  type ChannelConnection,
  type Publication,
  createChannelConnection,
  createPublication,
} from "@/domain/distribution";
import {
  type ChannelConnectionId,
  type ContentVariantId,
  type WorkspaceId,
  ok,
  taggedString,
} from "@/domain/shared";
import { registerStub, stubCall } from "../../stub-registry";
import { SAMPLE_WORKSPACE_ID } from "./sample-identity";

/**
 * ★ これは仮置きの見本データです（スタブ）。★
 *
 * 見本には**わざと「出せない先」と「止まっている配信」を入れている**。
 * すべて成功した状態だけを置くと、
 * 「失敗したときに何が出るか」を誰も確かめないまま公開してしまう。
 *
 * 実際の投稿は行わない。外部サービスの認証情報が必要で、
 * それは利用者ご自身がブラウザで登録するものだから。
 */
const stub = registerStub({
  id: "persistence:distribution-sample",
  port: "配信先の接続と配信記録の保存先",
  label: "配信（見本データ）",
  // テーブル（channel_connections / publications）は追加済み。
  // 保存先がある環境では D1 が使われ、ここは見本の重ね置きだけになる。
  // 残っている条件は**認証だけ**なので、済んだものを条件に残さない。
  // 残すと、いつまでも解除できないスタブに見えて解除条件が読まれなくなる。
  blockedBy: "各サービスの接続設定（利用者本人による認証）",
});

export function sampleDistributionNotice(): string {
  return `${stub.label}で表示しています（${stub.blockedBy}が済むまでの仮です）。`;
}

const WS = SAMPLE_WORKSPACE_ID as WorkspaceId;
const CONNECTED_AT = new Date("2026-06-01T00:00:00Z");

function connection(input: {
  id: string;
  kind: ChannelConnection["kind"];
  accountLabel: string;
  expiresAt: Date | null;
}): ChannelConnection {
  const built = createChannelConnection({
    id: taggedString<"ChannelConnectionId">(input.id),
    workspaceId: WS,
    kind: input.kind,
    accountLabel: input.accountLabel,
    connectedAt: CONNECTED_AT,
    expiresAt: input.expiresAt,
    // 値ではなく保管先の名前だけを持つ。秘密はここに入らない。
    credentialRef: `secret/${input.id}`,
  });
  if (!built.ok) {
    throw new Error(`見本の接続が不正です (${input.id}): ${built.error.message}`);
  }
  return built.value;
}

const CONNECTIONS: readonly ChannelConnection[] = [
  connection({
    id: "conn_own_site",
    kind: "own_site",
    accountLabel: "動画編集の道具（自社サイト）",
    expiresAt: null,
  }),
  connection({
    id: "conn_x",
    kind: "x",
    accountLabel: "@sample_editorial",
    expiresAt: new Date("2027-06-01T00:00:00Z"),
  }),
  // わざと期限切れにしている。「つなぎ直してください」が画面に出ることを確かめるため。
  connection({
    id: "conn_wordpress",
    kind: "wordpress",
    accountLabel: "旧ブログ（WordPress）",
    expiresAt: new Date("2026-05-01T00:00:00Z"),
  }),
];

/**
 * 見本の配信がもとにしている記事。
 *
 * **記事の見本に実在する ID を指す。** 見本どうしで食い違っていると、
 * 書き出し（note へ出す唯一の道）が「記事が見つかりません」で止まり、
 * 実装の不具合と見分けがつかなくなる。
 */
const VARIANT_ID = taggedString<"ContentVariantId">("cv_alpha_review") as ContentVariantId;

function publication(input: {
  id: string;
  kind: Publication["channelKind"];
  connectionId: string | null;
  state: Publication["state"];
  scheduledAt: Date | null;
  attempts?: number;
  lastError?: string | null;
  externalUrl?: string | null;
}): Publication {
  const built = createPublication({
    id: taggedString<"PublicationId">(input.id),
    workspaceId: WS,
    variantId: VARIANT_ID,
    channelKind: input.kind,
    connectionId:
      input.connectionId === null
        ? null
        : (taggedString<"ChannelConnectionId">(input.connectionId) as ChannelConnectionId),
    scheduledAt: input.scheduledAt,
    idempotencyKey: `${input.id}:key`,
  });
  if (!built.ok) {
    throw new Error(`見本の配信が不正です (${input.id}): ${built.error.message}`);
  }
  // 状態は見本として直接置く。domain の遷移を通していないので、
  // ここは「そう保存されていた」ものとして扱う（保存先の代わり）。
  return {
    ...built.value,
    state: input.state,
    attempts: input.attempts ?? 0,
    lastError: input.lastError ?? null,
    externalUrl: input.externalUrl ?? null,
  };
}

/**
 * 見本の配信。
 *
 * `let` にしてあるのは、取りやめや予定日の変更を**その場で反映させる**ため。
 * ただし残るのはこの処理が動いているあいだだけで、
 * 立ち上げ直すと最初の 6 件に戻る。画面の上部にその旨を出している。
 *
 * 置き場所が関数の中ではなくここ（module の一番外）なのは、
 * 組み立て（createDeps）が要求ごとに動くため。
 * 中に置くと、変更した直後の読み出しで元の値が返る。
 */
let PUBLICATIONS: readonly Publication[] = [
  publication({
    id: "pub_own_site",
    kind: "own_site",
    connectionId: "conn_own_site",
    state: "PUBLISHED",
    scheduledAt: null,
    externalUrl: "https://example.invalid/sample-article",
  }),
  /*
   * まだ出していない自分のブログ宛て。
   *
   * これが無いと、見本データだけで動かしたときに
   * 「いまサイトに出す」の入口へ**一度もたどり着けない**。
   * 出し終わった `pub_own_site` は行き止まり（公開済み）で、
   * 入口の条件（自分のブログ宛て かつ 未公開）を満たさないため。
   */
  publication({
    id: "pub_own_site_ready",
    kind: "own_site",
    connectionId: "conn_own_site",
    state: "QUEUED",
    scheduledAt: null,
  }),
  publication({
    id: "pub_x_failed",
    kind: "x",
    connectionId: "conn_x",
    state: "FAILED_SEND",
    scheduledAt: new Date("2026-08-10T09:00:00Z"),
    attempts: 2,
    lastError: "送信先が一時的に受け付けませんでした。時間をおいて再送できます。",
  }),
  // note は公式の投稿の仕組みが無いため、必ずここで止まる。
  publication({
    id: "pub_note_manual",
    kind: "note",
    connectionId: null,
    state: "MANUAL_EXPORT_READY",
    scheduledAt: null,
  }),
  /*
   * 同じ日・同じ先に 3 件。
   * 投稿カレンダーが「連投に見えます」と知らせることを、
   * 見本のデータでも確かめられるようにするために置いている。
   */
  publication({
    id: "pub_x_queued_1",
    kind: "x",
    connectionId: "conn_x",
    state: "QUEUED",
    scheduledAt: new Date("2026-08-20T09:00:00Z"),
  }),
  publication({
    id: "pub_x_queued_2",
    kind: "x",
    connectionId: "conn_x",
    state: "QUEUED",
    scheduledAt: new Date("2026-08-20T13:00:00Z"),
  }),
  publication({
    id: "pub_x_queued_3",
    kind: "x",
    connectionId: "conn_x",
    state: "QUEUED",
    scheduledAt: new Date("2026-08-20T18:00:00Z"),
  }),
];

/**
 * 見本の出し先。**保存先（D1）版もこれを重ねて返す。**
 *
 * 各サービスへの接続は利用者ご自身の認証が要るため、ここを消すと
 * 認証が入る日まで配信を 1 件も作れず、作った先の画面を誰も確かめられない。
 */
export function sampleChannelConnections(): readonly ChannelConnection[] {
  return CONNECTIONS;
}

/**
 * 見本の配信。**保存先（D1）版もこれを重ねて返す。**
 *
 * 消すと、まだ 1 件も出していない状態で一覧もカレンダーも空になり、
 * 「まだ出していない」のか「壊れている」のかを見分けられなくなる。
 */
export function samplePublications(): readonly Publication[] {
  return PUBLICATIONS;
}

export function createSampleChannelConnectionRepository(): ChannelConnectionRepositoryPort {
  return {
    async findById(workspaceId, id) {
      const found = CONNECTIONS.find((c) => c.workspaceId === workspaceId && c.id === id);
      return ok(found ?? null);
    },
    async listByWorkspace(workspaceId) {
      return ok({
        items: CONNECTIONS.filter((c) => c.workspaceId === workspaceId),
        nextCursor: null,
      });
    },
    save: () => stubCall(stub, "接続の保存"),
  };
}

export function createSamplePublicationRepository(): PublicationRepositoryPort {
  return {
    async findById(workspaceId, id) {
      const found = PUBLICATIONS.find((p) => p.workspaceId === workspaceId && p.id === id);
      return ok(found ?? null);
    },
    async findByIdempotencyKey(workspaceId, key) {
      const found = PUBLICATIONS.find(
        (p) => p.workspaceId === workspaceId && p.idempotencyKey === key,
      );
      return ok(found ?? null);
    },
    async listByVariant(workspaceId, variantId) {
      return ok(
        PUBLICATIONS.filter((p) => p.workspaceId === workspaceId && p.variantId === variantId),
      );
    },
    async listDue(at, limit) {
      return ok(
        PUBLICATIONS.filter(
          (p) => p.state === "QUEUED" && p.scheduledAt !== null && p.scheduledAt <= at,
        ).slice(0, limit),
      );
    },
    async listRecent(workspaceId, limit) {
      return ok(PUBLICATIONS.filter((p) => p.workspaceId === workspaceId).slice(0, limit));
    },
    /**
     * その場では保存する。**保つのはこの処理が動いているあいだだけ。**
     *
     * 保存を断る作りにしていた頃は、取りやめも予定日の変更も
     * 必ず失敗し、画面の操作を 1 つも確かめられなかった。
     * かといって「保存した」とだけ返して何も変えないのは
     * もっと悪く、取りやめたはずのものが残る。
     * そこで **実際に置き換えたうえで、仮の保存先だと画面に出す**。
     */
    async save(publication) {
      const index = PUBLICATIONS.findIndex(
        (p) => p.workspaceId === publication.workspaceId && p.id === publication.id,
      );
      if (index < 0) {
        PUBLICATIONS = [...PUBLICATIONS, publication];
      } else {
        PUBLICATIONS = PUBLICATIONS.map((p, i) => (i === index ? publication : p));
      }
      return ok(publication);
    },
  };
}

/**
 * 公式の投稿の仕組みが無い先（note）への書き出し。
 *
 * ここは実際に動く。外部サービスへ接続しないため、
 * 認証情報が無くても書き出しまでは行えるのが本来の姿だから。
 */
export function createSampleManualExport(): ManualExportPort {
  return {
    async buildDraft(input: ChannelPublishInput) {
      const lines = [
        input.title === null ? null : `# ${input.title}`,
        input.disclosureText === "" ? null : input.disclosureText,
        input.body,
      ].filter((l): l is string => l !== null && l !== "");
      return ok({
        markdown: lines.join("\n\n"),
        instructions:
          "この下書きをコピーして、note の投稿画面に貼り付けてください。" +
          "note には外部から投稿する公式の仕組みが無いため、最後の操作はご自身で行っていただきます。" +
          "広告表記は本文の冒頭に置いたままにしてください。",
      });
    },
  };
}
