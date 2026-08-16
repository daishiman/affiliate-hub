import type { AspAdapterPort, SecretResolverPort } from "@/application/ports";
import type { AspKind } from "@/domain/monetization";
import { ASP_LABEL } from "@/domain/monetization";
import { domainError, err } from "@/domain/shared";
import type { DomainError, Result } from "@/domain/shared";
import { createStubAspAdapter } from "./stub-asp-adapter";

/**
 * ASP アダプタの登録所。
 *
 * ASP を 1 つ増やす作業は「アダプタを 1 ファイル書き、この表に 1 行足す」だけ。
 * ユースケースに `if (asp === "...")` を書かないための場所である
 * (docs/architecture/changeability-scenarios.md ①)。
 *
 * 各アダプタは 1 つの ASP アカウントに紐づく。認証情報は
 * `credentialRef` から `SecretResolverPort` で取り出し、
 * アダプタの外へは出さない。
 */
export type AspAdapterContext = {
  readonly credentialRef: string | null;
  readonly publicTrackingId: string | null;
  readonly secrets: SecretResolverPort;
};

export type AspAdapterFactory = (ctx: AspAdapterContext) => AspAdapterPort;

/**
 * 実装の対応表。
 *
 * 現状はすべて未実装のスタブ。ASP ごとの API 仕様確認と申請が前提条件で、
 * それが済んだものから 1 つずつ本実装に差し替える。
 * スタブは呼ばれると NOT_IMPLEMENTED で失敗する (空の成功を返さない)。
 */
const FACTORIES: Readonly<Record<AspKind, AspAdapterFactory>> = {
  amazon_associates: (ctx) =>
    createStubAspAdapter("amazon_associates", ctx, "PA-API 5.0 の利用資格 (売上実績) と申請が必要"),
  rakuten_affiliate: (ctx) =>
    createStubAspAdapter("rakuten_affiliate", ctx, "楽天ウェブサービスのアプリID発行が必要"),
  yahoo_shopping: (ctx) =>
    createStubAspAdapter("yahoo_shopping", ctx, "Yahoo!デベロッパーネットワークのアプリケーションID発行が必要"),
  value_commerce: (ctx) =>
    createStubAspAdapter("value_commerce", ctx, "バリューコマースのAPI利用申請と提携承認が必要"),
  a8net: (ctx) =>
    createStubAspAdapter("a8net", ctx, "A8.net は公開APIが限定的。成果データはCSV取込で代替する方針を決める"),
  moshimo: (ctx) => createStubAspAdapter("moshimo", ctx, "もしもアフィリエイトのAPI提供条件の確認が必要"),
  accesstrade: (ctx) => createStubAspAdapter("accesstrade", ctx, "アクセストレードのAPI利用申請が必要"),
  direct: (ctx) =>
    createStubAspAdapter("direct", ctx, "直接契約は広告主ごとに連携方法が異なる。手動登録で運用する"),
};

export function createAspAdapter(
  asp: AspKind,
  ctx: AspAdapterContext,
): Result<AspAdapterPort, DomainError> {
  const factory = FACTORIES[asp];
  if (factory === undefined) {
    return err(
      domainError("NOT_SUPPORTED", `${asp} には対応していません。`, {
        suggestedAction: "対応している提携先の一覧から選び直してください。",
      }),
    );
  }
  return { ok: true, value: factory(ctx) };
}

/** 画面の選択肢に使う一覧。表示名はドメインの正本 (`ASP_LABEL`) から取る。 */
export function supportedAsps(): readonly { kind: AspKind; label: string }[] {
  return (Object.keys(FACTORIES) as AspKind[]).map((kind) => ({ kind, label: ASP_LABEL[kind] }));
}
