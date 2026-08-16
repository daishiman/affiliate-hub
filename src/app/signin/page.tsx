import Link from "next/link";
import { ROLE_LABEL } from "@/application/usecases/identity/manage-workspace";
import { capabilitiesOf } from "@/domain/identity";
import type { Role } from "@/domain/shared";
import { actorNotice, currentActor } from "@/presentation/composition";
import { Callout, PublicShell, SitePage, StubNotice } from "@/presentation/ui";
import styles from "../admin/admin.module.css";

export const dynamic = "force-dynamic";

/**
 * ログイン。
 *
 * **この画面はまだ本物ではない（スタブ）。**
 * Google でログインするには、Google 側で発行する識別子と秘密の値が要る。
 * それは利用者本人がブラウザで登録するものなので、
 * ここで代わりに用意することはできない。
 *
 * 何もない白紙にせず、いま誰として動いているのか・
 * その人に何ができないのかを出しておく。
 * 「ログイン画面が無い」のと「まだつないでいない」は別のことなので、
 * 後者であることが分かる状態にする。
 */
export default async function SignInPage() {
  const actor = await currentActor();
  const capabilities = [...capabilitiesOf(actor.roles)].map(String);
  const canPublish = capabilities.includes("content.publish");
  const canManageMembers = capabilities.includes("member.manage");

  return (
    <PublicShell title="affiliate-hub">
      <SitePage
        title="ログイン"
        lead="いまは、あらかじめ決めた見本の担当者として画面が動いています。Google でのログインはまだつないでいません。"
      >
        <StubNotice
          what="Google でのログイン・ログアウト・招待の受け取り"
          blockedBy="Google 側でこのアプリを登録し、発行された識別子と秘密の値を利用者本人がブラウザから登録すること"
          stubId="identity:sample-actor"
        >
          <span>{actorNotice()}</span>
        </StubNotice>

        <Callout
          tone="info"
          title="秘密の値をこの画面から預からない理由"
          reason="ログインの秘密の値は、ファイルやコマンドの履歴に残ると、後から誰でも読めてしまいます。登録は Cloudflare の管理画面か、お手元の別のターミナルから行ってください。この画面では受け取りません。"
        />

        <h2 className={styles.sectionTitle}>いま誰として動いているか</h2>
        <table className={styles.rankTable}>
          <tbody>
            <tr>
              <th scope="row">担当者</th>
              <td>見本の担当者（{String(actor.userId)}）</td>
            </tr>
            <tr>
              <th scope="row">役割</th>
              <td>{actor.roles.map((r) => ROLE_LABEL[r as Role]).join("・")}</td>
            </tr>
            <tr>
              <th scope="row">記事を公開できるか</th>
              <td>
                {canPublish
                  ? "できます"
                  : "できません。ログインが入るまで、公開の権限は誰にも渡していません。"}
              </td>
            </tr>
            <tr>
              <th scope="row">人を招待できるか</th>
              <td>
                {canManageMembers
                  ? "できます"
                  : "できません。招待の受け取りはログインの仕組みと一体のため、同時に使えるようになります。"}
              </td>
            </tr>
          </tbody>
        </table>

        <h2 className={styles.sectionTitle}>つながると何ができるようになるか</h2>
        <ul className={styles.linkList}>
          <li>
            Google のアカウントでログインする
            <span className={styles.linkNote}>
              許可した宛先の人だけが管理画面に入れる状態になります。
            </span>
          </li>
          <li>
            ログアウトする
            <span className={styles.linkNote}>共有の端末でも、作業の後を残さずに離れられます。</span>
          </li>
          <li>
            招待を受け取る
            <span className={styles.linkNote}>
              招待された人が自分でログインし、渡された役割で入れるようになります。
            </span>
          </li>
          <li>
            公開の権限を人に渡す
            <span className={styles.linkNote}>
              いまは誰も公開できません。ログインが入って初めて「この人は公開してよい」が決まります。
            </span>
          </li>
        </ul>

        <p className={styles.linkNote}>
          <Link href="/admin">管理画面へ戻る</Link>
        </p>
      </SitePage>
    </PublicShell>
  );
}
