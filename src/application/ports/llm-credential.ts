import type {
  LlmCredentialSummary,
  LlmCredentialVerification,
} from "@/domain/generation/llm-credential";
import type { UserId, WorkspaceId } from "@/domain/shared";
import type { PortResult } from "./common";

/**
 * 生成 AI の鍵の預かり所。
 *
 * --- ここの形がふつうと違う理由 ---
 * 普通に書くなら `get(workspaceId, providerId): PortResult<string>` である。
 * **その口を作らない。** 一度でも「値を返す口」があると、
 * 呼んだ先で記録に入れる・エラーに載せる・モデルへ渡すのが全部可能になり、
 * あとは書く人の注意力だけが守りになる。
 *
 * 代わりに、値に触れる口（`useKey`）は**この層に置かない**。
 * 置き場は `src/infrastructure/llm/key-access.ts` の `LlmKeyAccess` で、
 * 呼ぶのは提供元アダプタだけである。
 *
 * --- なぜ層をまたいで分けたか（2026-08-18 に動かした） ---
 * 最初は `useKey` もこの型に並べていた。書けば済むと思っていたが、
 * つなぎ目の検査が「`useKey` はユースケースから一度も呼ばれていない」と出した。
 * 事実その通りで、**応用層は鍵を使わない**。並べてあると
 * 「使ってよいもの」に見えるだけで、守りは書く人の注意力に戻る。
 * 型として届かない場所へ移せば、応用層から鍵へ至る道が**そもそも無い**。
 * ランキングで「報酬額が型として届かない」状態を作ったのと同じ手である。
 *
 * これで見るべき場所は提供元アダプタ 1 か所へ縮む。そこは検査で固定する
 * （`tests/architecture/llm-credential-leak.test.ts`）。
 */
export type LlmCredentialVaultPort = {
  /**
   * 鍵を預ける。すでに同じ提供元の鍵があれば差し替える。
   *
   * 戻り値は要約だけ。**保存した値を返さない**
   * （「保存できたか確認するため」に返し始めると、そこから漏れる）。
   */
  store(input: {
    readonly workspaceId: WorkspaceId;
    readonly providerId: string;
    readonly apiKey: string;
    readonly registeredBy: UserId;
  }): PortResult<LlmCredentialSummary>;

  /** 作業場所に預かっている鍵の一覧。値は含まない。 */
  list(workspaceId: WorkspaceId): PortResult<readonly LlmCredentialSummary[]>;

  /** 失効させる。行は消さず、失効の記録として残す。 */
  revoke(input: {
    readonly workspaceId: WorkspaceId;
    readonly providerId: string;
    readonly revokedBy: UserId;
  }): PortResult<LlmCredentialSummary>;

  /** 疎通確認の結果を書き留める。いつ確かめたかを画面に出すため。 */
  recordVerification(input: {
    readonly workspaceId: WorkspaceId;
    readonly providerId: string;
    readonly outcome: LlmCredentialVerification;
  }): PortResult<LlmCredentialSummary>;
};

/**
 * 使える提供元とモデルの目録。
 *
 * **モデル名をコードに直書きしない。** 提供元は月単位でモデルを入れ替える。
 * 直書きすると、新しいモデルが出るたびに配布が要る。
 * 目録は設定（環境変数）から読み、無ければ空を返す
 * ＝「選べるモデルがありません」と画面に出る。黙って古い名前を使わない。
 */
export type LlmProviderCatalogPort = {
  /** 画面に出す提供元の一覧。 */
  listProviders(): PortResult<readonly LlmProviderDescriptor[]>;
  /** その提供元で選べるモデル。空なら設定が入っていない。 */
  listModels(providerId: string): PortResult<readonly LlmModelDescriptor[]>;
};

/**
 * 登録した鍵が実際に使えるかを 1 回だけ確かめる口。
 *
 * --- なぜ「軽い呼び出し」なのか ---
 * 形（接頭辞や長さ）を見るだけでは、**使えない鍵が登録できてしまう**。
 * 気づくのは記事を作ろうとした時で、そのときには
 * 「鍵が違うのか、モデルが違うのか、提供元が落ちているのか」が分からない。
 * 登録の直後に 1 回だけ短い依頼を送れば、切り分けがその場で終わる。
 *
 * 提供元の名前はここに出さない。どの提供元をどう呼ぶかは infrastructure が持つ。
 */
export type LlmConnectivityPort = {
  check(input: {
    readonly workspaceId: WorkspaceId;
    readonly providerId: string;
    readonly modelId: string;
  }): PortResult<void>;
};

export type LlmProviderDescriptor = {
  readonly providerId: string;
  readonly label: string;
  /** 鍵を発行する画面の場所。利用者が自分で取りに行くための案内。 */
  readonly keyIssueUrl: string;
  /**
   * 対応が必須かどうか。`false` は「枠として残してあるが、いま使わなくてよい」。
   * 画面では並べ方を変えるだけで、隠さない（隠すと存在が忘れられる）。
   */
  readonly required: boolean;
};

export type LlmModelDescriptor = {
  readonly modelId: string;
  readonly label: string;
  /** 100 万トークンあたりの単価（最小通貨単位）。費用見積りの入力。 */
  readonly inputPricePerMillionMinor: number;
  readonly outputPricePerMillionMinor: number;
  /**
   * 提供元が請求に使う通貨（いまはどこも `USD`）。
   *
   * **円に換算して持たない。** 換算するには為替をこちらが決める必要があり、
   * その値は必ず古くなる。しかも請求の正本は提供元の USD なので、
   * 円で持った瞬間に**照合できない概算**になる。
   * 円で見せたいときは表示の段で掛ける（掛けた日付も一緒に出す）。
   */
  readonly currency: string;
  /**
   * この単価を読み取った価格ページ。
   *
   * **1 行ごとに持つ。** 提供元ごとにまとめると、モデルを 1 つ足したときに
   * 「同じページで確かめた」ことになってしまう。実際には
   * 足した人が見たページは別かもしれず、後から確かめようがない。
   */
  readonly sourceUrl: string;
  /** そのページを見た日（`YYYY-MM-DD`）。古さの判定はこの日付だけを見る。 */
  readonly pricedOn: string;
};
