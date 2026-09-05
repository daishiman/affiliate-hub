import type { CustomDomain, CustomDomainStatus } from "@/domain/domains";
import type { Editorial, WorkspaceId } from "@/domain/shared";
import type { PortResult } from "./common";

/**
 * ブログの住所 (住所層) のポート。
 *
 * 保存先 (D1) と外部 (Cloudflare for SaaS) の 2 つのつなぎ目がある。
 * 分けているのは、**どちらが正本か**が違うからである。登録の意思は
 * こちらが持ち、検証と証明書の結果は向こうが持つ。1 つのポートに
 * まとめると、写し取りの失敗と保存の失敗が同じ形で返り、運用者に
 * 「DNS を直せ」と言えばよいのか「時間をおけ」と言えばよいのかを
 * 決められなくなる。
 */

/** 運用者へ見せる、DNS に置いてもらう設定 1 件。 */
export type DomainVerificationInstruction = {
  /** `CNAME` など、置くレコードの種類。 */
  readonly recordType: string;
  readonly name: string;
  readonly value: string;
  /** なぜこれが要るのか。1 文で、専門語を避けて書く。 */
  readonly why: string;
};

/** 外部から写し取った 1 件の状態。 */
export type CustomHostnameSnapshot = {
  readonly externalHostnameId: string;
  readonly status: CustomDomainStatus;
  readonly certificateStatus: CustomDomain["certificateStatus"];
  readonly lastError: string | null;
  readonly instructions: readonly DomainVerificationInstruction[];
};

/**
 * 住所の保存先。
 *
 * `Editorial` 印を付けるのは、住所が読者向けの事実であって報酬に
 * 関わらないためである。ランキングの依存へ混ざっても害がない。
 */
export type CustomDomainRepositoryPort = {
  /** ブログ 1 本ぶんの住所。取り下げ済みも含めて返す (履歴が判断材料になる)。 */
  listForSite(workspaceId: WorkspaceId, siteSlug: string): PortResult<readonly CustomDomain[]>;
  /** workspace 全体の住所一覧。管理画面の「ドメイン一式」の画面が使う。 */
  listForWorkspace(workspaceId: WorkspaceId): PortResult<readonly CustomDomain[]>;
  /**
   * 公開側がホスト名からブログを引く経路。
   *
   * `active` な行だけを返す。検証中の住所で読者を通すと、証明書の
   * 無いホストへ案内することになる。
   */
  findActiveByHostname(hostname: string): PortResult<CustomDomain | null>;
  register(
    workspaceId: WorkspaceId,
    siteSlug: string,
    hostname: string,
  ): PortResult<CustomDomain>;
  /**
   * 外部から写し取った状態を反映する。
   *
   * 遷移表に反しる更新は保存先が拒否する。写し取りが運用者の取り下げを
   * 上書きしないための門で、呼び出し側の順序に頼らない。
   */
  applySnapshot(
    workspaceId: WorkspaceId,
    domainId: string,
    snapshot: CustomHostnameSnapshot,
    at: Date,
  ): PortResult<CustomDomain>;
  /** 正規の住所を切り替える。`active` な行にしか立てられない。 */
  setCanonical(
    workspaceId: WorkspaceId,
    siteSlug: string,
    domainId: string,
  ): PortResult<CustomDomain>;
  /** 取り下げる。行は消さない (取り下げた判断そのものを残す)。 */
  revoke(workspaceId: WorkspaceId, domainId: string, reason: string): PortResult<true>;
};

/**
 * Cloudflare for SaaS の custom hostname とのつなぎ目。
 *
 * ここが返すのは**向こうの言い分**であって、こちらの意思ではない。
 * 保存はしない。保存すると、外部が落ちている間に写しが正本のように
 * 振る舞いはじめる。
 */
export type CustomHostnameProviderPort = {
  /** 登録を申し込み、DNS に置いてもらう設定を受け取る。 */
  request(hostname: string): PortResult<CustomHostnameSnapshot>;
  /** 現在の状態を写し取る。定期同期と、運用者の「今すぐ確認」の両方が使う。 */
  snapshot(externalHostnameId: string): PortResult<CustomHostnameSnapshot>;
  /** 外部側の登録を取り消す。こちらの行は別途 `revoke` する。 */
  release(externalHostnameId: string): PortResult<true>;
};

export type EditorialCustomDomainRepositoryPort = Editorial<CustomDomainRepositoryPort>;
export type EditorialCustomHostnameProviderPort = Editorial<CustomHostnameProviderPort>;
