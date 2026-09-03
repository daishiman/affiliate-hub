import type { ActorContext } from "@/domain/shared";
import { taggedString } from "@/domain/shared";
import { SAMPLE_WORKSPACE_ID } from "../persistence/sample/ranking-sample-repository";
import { registerStub } from "../stub-registry";

/**
 * ★ これは仮置きのログイン情報です（スタブ）。★
 *
 * 認証（Better Auth + Google）を入れるまでのあいだ、
 * 画面と AI 入口の経路を通すために「見本の担当者」を返す。
 *
 * **2026-08-18 に、書き込みの役をすべて外した。** 残したのは `analyst` だけで、
 * これは読む権限しか持たない（`content.read` / `analytics.read` /
 * `affiliate.read_revenue`）。
 *
 * 理由は `docs/product/open-doors.md` にある。認証がまだ無いため、
 * 管理画面の入口 49 か所は誰でも開ける。そこへ書き込みの役を配っていたので、
 * **アドレスを知っている人なら誰でも記事を承認し、鍵を発行できた。**
 *
 * 塞ぎ方は 2 つあった。
 *
 *   (a) 取り返しのつかない操作 6 件だけを個別に止める
 *   (b) 見本の身元から書き込みの役を外す（＝これ）
 *
 * (b) を採ったのは、(a) が「6 件」という数え上げの正しさに寄りかかるため。
 * 数え落としが 1 つあれば穴が残る。(b) は数え上げに依存しない。
 *
 * **開発中だけの抜け道は作らない。** 「`pnpm dev` のときは書ける」を足すと、
 * その分岐は認証が入ったあとも残る。書き込みを要する作業は
 * すべて認証より後ろに並べてあるので、いま止まるものは無い。
 * もし何かが止まったら、抜け道を作らずに報告して順番を直す。
 *
 * 本実装への差し替えはこのファイル 1 つ。画面側は 1 行も変わらない。
 */
const stub = registerStub({
  id: "identity:sample-actor",
  port: "現在のログイン利用者の取得",
  label: "ログイン情報（見本）",
  blockedBy: "Better Auth と Google ログインの設定",
});

export const SAMPLE_ACTOR: ActorContext = {
  workspaceId: SAMPLE_WORKSPACE_ID,
  userId: taggedString<"UserId">("u_sample"),
  /**
   * **読む役 1 つだけ。書き込みの役をここへ足さない。**
   *
   * `analyst` が持つのは `content.read` / `analytics.read` /
   * `affiliate.read_revenue` の 3 つで、いずれも読むだけである。
   *
   * 外したものと、外したことで止まるもの:
   *
   *   - `writer` / `researcher` / `reviewer` — 記事と商品の書き込み、査読
   *   - `feedback_admin` — 改善要望の扱いの決定と、**鍵の発行・失効**
   *
   * とくに `feedback_admin` は `integration_key.manage` を持っていた。
   * 認証が無いまま外部連携の鍵を発行できる状態だったということである。
   *
   * ここに役を 1 つ足すと、**その瞬間に「誰でもできること」が増える。**
   * 足す前に、認証が入っているかを先に確かめること。
   */
  roles: ["analyst"],
  // 見本は読み取り専用。範囲は workspace 全体だが、brand.manage は持たない。
  scopedBrandIds: [],
  isAiServiceAccount: false,
  /**
   * **確かめていない。** `u_sample` は誰も指していない名前である。
   *
   * ここを `true` にすると、ログインを解決できなかったときの画面の操作が
   * 「u_sample という人がやった」として操作の記録に残る。
   * 記録は後から「人が承認した」を説明するために読むので、そこに嘘があると
   * 記録そのものが使えなくなる。
   */
  identified: false,
};

export function sampleActorNotice(): string {
  return `${stub.label}で表示しています（${stub.blockedBy}が済むまでの仮です）。`;
}

/** 現在のログイン利用者。認証が入るまでは見本を返す。 */
export async function getCurrentActor(): Promise<ActorContext> {
  return SAMPLE_ACTOR;
}
