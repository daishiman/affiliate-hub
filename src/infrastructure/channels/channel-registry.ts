import type {
  ChannelConnectorPort,
  ChannelConnectorProviderPort,
  ChannelPublishInput,
  ChannelPublishResult,
  ManualExportPort,
  SecretResolverPort,
} from "@/application/ports";
import type { ChannelConnection, ChannelKind } from "@/domain/distribution";
import { CHANNEL_CAPABILITIES, supportsDirectPublish } from "@/domain/distribution";
import { domainError, err, ok } from "@/domain/shared";
import type { DomainError, Result } from "@/domain/shared";
import { registerStub, stubCall } from "../stub-registry";
import { createManualExport } from "./manual-export";
import { createBlueskyConnector } from "./bluesky";

/**
 * 配信チャネルの登録所。
 *
 * チャネルを 1 つ増やす作業は「能力表に 1 行 (domain)」+「コネクタ 1 ファイル」+
 * 「この表に 1 行」で終わる (docs/architecture/changeability-scenarios.md ④)。
 *
 * 文字数上限などの判定はここでは行わない。判定はドメインの能力表を使い、
 * 画面・API・WebMCP のどこから来ても同じ結果になるようにする。
 */
export type ChannelConnectorContext = {
  readonly credentialRef: string | null;
  readonly expectedProviderIdentity?: string | null;
  readonly secrets: SecretResolverPort;
  readonly fetch?: typeof globalThis.fetch;
  readonly now?: () => Date;
};

type ConnectorFactory = (ctx: ChannelConnectorContext) => ChannelConnectorPort;

/**
 * **これらはスタブである。**
 *
 * 各チャネルは公式 API の利用申請・アプリ審査が前提になる。
 * 済んだものから本実装に差し替える。
 */
function createStubConnector(
  kind: ChannelKind,
  blockedBy: string,
  _ctx: ChannelConnectorContext,
): ChannelConnectorPort {
  const capability = CHANNEL_CAPABILITIES[kind];
  const entry = registerStub({
    id: `channel:${kind}`,
    port: "ChannelConnectorPort",
    label: `${capability.label} への配信`,
    blockedBy,
  });

  return {
    kind,
    resolveIdentity: () =>
      stubCall<{ readonly providerIdentity: string; readonly accountLabel: string }>(
        entry,
        "resolveIdentity",
      ),
    checkReadiness: () => stubCall<true>(entry, "checkReadiness"),
    prepareDeliveryKey: () => stubCall<string>(entry, "prepareDeliveryKey"),
    publish: () => stubCall<ChannelPublishResult>(entry, "publish"),
    unpublish: () => stubCall<true>(entry, "unpublish"),
    /**
     * 検査だけは今でも意味のある答えを返せる。
     * 上限を超えていれば、送信の実装が無くても利用者に伝えられる。
     */
    async validate(input: ChannelPublishInput) {
      const problems: string[] = [];
      const max = capability.maxBodyLength;
      if (max !== null && input.body.length > max) {
        problems.push(`本文が ${capability.label} の上限 ${max} 文字を ${input.body.length - max} 文字超えています。`);
      }
      if (input.imageKeys.length > capability.maxImages) {
        problems.push(`画像は ${capability.maxImages} 枚までです (${input.imageKeys.length} 枚あります)。`);
      }
      if (!capability.allowsBodyLinks && /https?:\/\//.test(input.body)) {
        problems.push(`${capability.label} は本文中のリンクを想定していません。別の導線に変えてください。`);
      }
      if (capability.disclosurePlacement === "body_top" && !input.body.startsWith(input.disclosureText)) {
        problems.push("広告表記を本文の先頭に置いてください。");
      }
      return ok(problems);
    },
  };
}

const FACTORIES: Readonly<Record<ChannelKind, ConnectorFactory>> = {
  /*
   * 出す道は**もう通っている**。配信の画面の「いまサイトに出す」から
   * `publish_article_to_own_site` を呼ぶと、D1 の published_articles に保存され、
   * 読者ページ (src/app/s/[site]/) に出る。
   *
   * 記事本文の即時公開と取り下げは Content のユースケースで実装済み。
   * ここが残っているのは、予約時刻に実行して Publication 状態へ結果を同期する
   * connector worker のためであり、接続登録だけでは動かない。
   */
  own_site: (ctx) =>
    createStubConnector(
      "own_site",
      "予約時刻の実行とPublication状態の同期が必要。記事本文の即時公開・取り下げはContent側で実装済み",
      ctx,
    ),
  x: (ctx) => createStubConnector("x", "X API の有料プラン契約とアプリ登録が必要", ctx),
  instagram: (ctx) =>
    createStubConnector("instagram", "Instagram Graph API はプロアカウントと Facebook ページ連携が必要", ctx),
  youtube: (ctx) => createStubConnector("youtube", "YouTube Data API のクォータ申請が必要", ctx),
  tiktok: (ctx) => createStubConnector("tiktok", "TikTok Content Posting API の審査が必要", ctx),
  threads: (ctx) => createStubConnector("threads", "Threads API のアプリ登録が必要", ctx),
  facebook: (ctx) =>
    createStubConnector("facebook", "Facebook ページの連携と Graph API のアプリ審査が必要", ctx),
  note: (ctx) => createStubConnector("note", "note に公開された投稿用 API は存在しない。書き出しのみを提供する", ctx),
  newsletter: (ctx) => createStubConnector("newsletter", "配信基盤 (メール送信) の選定が必要", ctx),
  wordpress: (ctx) => createStubConnector("wordpress", "接続先サイトの REST API とアプリケーションパスワードが必要", ctx),
  bluesky: (ctx) => createBlueskyConnector(ctx),
};

/**
 * コネクタを作る。
 *
 * 直接公開に対応していないチャネル (note) では、あえて失敗を返す。
 * 「送信できるつもり」のコードを書けないようにするため。
 * 書き出しが必要な場合は `createChannelExporter` を使う。
 */
export function createChannelConnector(
  kind: ChannelKind,
  ctx: ChannelConnectorContext,
): Result<ChannelConnectorPort, DomainError> {
  if (!supportsDirectPublish(kind)) {
    return err(
      domainError("NOT_SUPPORTED", `${CHANNEL_CAPABILITIES[kind].label} へは直接投稿できません。`, {
        suggestedAction: "下書きを書き出して、ご自身で投稿してください。",
        details: { basis: CHANNEL_CAPABILITIES[kind].basisNote },
      }),
    );
  }
  return ok(FACTORIES[kind](ctx));
}

/** 接続行を唯一の入力にして、kindとcredentialRefを取り違えないcomposition。 */
export function createChannelConnectorProvider(
  context: Omit<ChannelConnectorContext, "credentialRef">,
): ChannelConnectorProviderPort {
  const cache = new Map<string, ChannelConnectorPort>();
  function forConnection(connection: ChannelConnection) {
    const cacheKey = `${connection.id}:${connection.kind}:${connection.providerIdentity ?? "unbound"}:${connection.credentialRef ?? "none"}`;
    const cached = cache.get(cacheKey);
    if (cached !== undefined) return ok(cached);
    const created = createChannelConnector(connection.kind, {
      ...context,
      credentialRef: connection.credentialRef,
      expectedProviderIdentity: connection.providerIdentity,
    });
    if (created.ok) cache.set(cacheKey, created.value);
    return created;
  }
  return {
    forConnection,
  };
}

/**
 * 公式 API が無いチャネル向けの書き出し。
 *
 * 出し先の種類は書き出すときに渡す。1 つの窓口で全部の種類を扱えるので、
 * 組み立て役（composition）は配信 1 件ごとに作り直さなくてよい。
 */
export function createChannelExporter(): ManualExportPort {
  return createManualExport();
}

/** 画面の選択肢。表示名も出し方もドメインの能力表から取る。 */
export function availableChannels(): readonly {
  kind: ChannelKind;
  label: string;
  directPublish: boolean;
}[] {
  return (Object.keys(FACTORIES) as ChannelKind[]).map((kind) => ({
    kind,
    label: CHANNEL_CAPABILITIES[kind].label,
    directPublish: supportsDirectPublish(kind),
  }));
}
