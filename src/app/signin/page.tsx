import Link from "next/link";
import { ROLE_LABEL } from "@/application/usecases/identity/manage-workspace";
import { authAvailability } from "@/infrastructure/identity/better-auth";
import type { Role } from "@/domain/shared";
import { actorNotice, signedInActor } from "@/presentation/composition";
import {
  Button,
  Callout,
  DefinitionList,
  FocusedTask,
  Note,
  PublicShell,
  SectionHeading,
  SeeAlso,
  SitePage,
} from "@/presentation/ui";
import { GoogleSignInButton } from "./google-signin-button";
/*
 * **この画面はもう CSS を 1 つも持っていない。**（2026-08-21 夜）
 *
 * 経緯が 3 段ある。**それぞれの段が正しく、しかも次の段の存在意義を消している。**
 *
 *   1. 朝まで、この画面は管理画面ではないのに `../admin/admin.module.css` を
 *      読んでいた。表（`.rankTable`）と `.criteria` は部品へ上げて解け、
 *      `.sectionTitle` と `.linkNote` が残っていた
 *   2. 昼、その 2 つを `./signin.module.css` へ**自分のものとして持たせた**。
 *      「借り物を減らすことと部品化することは別の問題」という切り分けで、
 *      260 箇所の部品化を待たずに借り物だけを閉じた
 *   3. 夜、`SectionHeading` と `Note` / `SeeAlso` ができ、**4 箇所とも部品を
 *      通るようになった**。写して持っていた 2 クラスは誰も使わなくなり、
 *      `signin.module.css` ごと消えた
 *
 * **②は無駄ではない。**あの時点で部品はまだ無く、②をしなければこの画面は
 * 半日ぶん管理画面の値に引きずられ続けていた。だが**②が引いた線が③の母集団から
 * この画面を外した**（UX-17 の走査は `src/app/admin/**` だった）。
 * 4 箇所とも漏れ、後から拾っている——`docs/product/ui-ux-tasks.md` の
 * 「13 つ目の形：独立させる作業が、次の一括作業の母集団から自分を外す」。
 *
 * **独立させた作業は、独立させたぶんだけ後から拾いに行く必要がある。**
 * ②を悔いる話ではなく、②をしたら③の日に自分で手を挙げる、という話である。
 */

export const dynamic = "force-dynamic";

/**
 * ログイン。
 *
 * 画面が持つ状態は 3 つで、**どれなのかを必ず言葉にする**。
 *
 *   1. まだ設定が済んでいない … 何を登録すればよいかを名前で出す
 *   2. 設定は済んでいて、ログインしていない … ログインの操作を出す
 *   3. ログインしている … 誰として入っているかと、出る操作を出す
 *
 * 1 と 2 を混ぜて「ログインできません」だけにすると、
 * 設定漏れなのか断られたのかが分からず、次の行動が決まらない。
 *
 * 断られた理由（名簿に無い・担当者の登録が無い）は**この画面に出さない**。
 * 出すと、どのアドレスが登録済みかを外から確かめられてしまう。
 */
export default async function SignInPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [availability, actor, notice, params] = await Promise.all([
    authAvailability(),
    signedInActor(),
    actorNotice(),
    searchParams,
  ]);
  const failed = params.error !== undefined;

  return (
    <PublicShell title="affiliate-hub">
      {/* ここですることは 1 つ（入る・出る）なので、幅いっぱいに広げず箱に収める。
          箱の型は `templates/site-shell.tsx` にある。この画面では作らない。 */}
      <FocusedTask>
        <SitePage
          title="ログイン"
          lead={
            actor !== null
              ? "ログインしています。"
              : "この画面から Google でログインします。合言葉や秘密の値をこの画面に入力する場面はありません。"
          }
        >
          {failed && actor === null && (
            <Callout
              tone="warn"
              title="ログインできませんでした"
              reason={
                "このアプリを使える人として登録されていないか、担当者の登録がまだありません。" +
                "心当たりがある場合は、管理している方にアドレスの登録を依頼してください。"
              }
            />
          )}

          {!availability.ready && (
            <Callout
              tone="warn"
              title="ログインの設定がまだ済んでいません"
              reason={
                "次の設定が登録されるまで、Google でのログインは動きません: " +
                availability.missing.join(" / ") +
                "。値そのものはこの画面から預かりません（履歴に残ると後から誰でも読めるため）。" +
                "お手元のターミナルで `node .better-auth-google/setup-secrets.mjs` を実行して登録してください。"
              }
            />
          )}

          {availability.ready && actor === null && (
            <>
              <GoogleSignInButton callbackUrl="/admin" />
              <Note>
                入れるのは、あらかじめ登録されたアドレスの人だけです。
                登録が無いアドレスでは、Google の確認が通っても中には入れません。
              </Note>
            </>
          )}

          {actor !== null && (
            <>
              {/*
                **これも 13 つ目の形で漏れていた。**UX-17 で `.sectionTitle` 179 箇所を
                `SectionHeading` へ通したとき、走査したのは `src/app/admin/**` だった。
                この画面は同じ日の朝に借り物を解いて `signin.module.css` へ
                `.sectionTitle` を**自分のものとして持った**ので、母集団から外れている。
                役B 3 件とまったく同じ経路で漏れた 4 件目。
              */}
              <SectionHeading level={2}>いま誰として動いているか</SectionHeading>
              {/*
                **これは表ではない。**以前ここは `<table className={styles.rankTable}>` で、
                表の数え上げ（34 箇所）が `src/app/admin/**` を走査していたため
                この表は数に入っていなかった（残課題 141・UX-15）。

                一度 `DataTable` へ通したが、そのとき「項目 / 値」という
                **中身の無い見出しを発明していた**。列に名前が付く表ではないから
                そうなった。次に `<dl className={styles.criteria}>` へ寄せたが、
                それは管理画面からの借り物だった。2026-08-21 に `DefinitionList`
                として部品へ上げ、借り物を 3 つから 2 つへ減らした（残課題 142・UX-17）。
              */}
              <DefinitionList
                items={[
                  { term: "担当者", description: String(actor.userId) },
                  {
                    term: "役割",
                    description: actor.roles.map((r) => ROLE_LABEL[r as Role]).join("・"),
                  },
                ]}
              />

              {/*
                **注記用のクラスをボタンに当てない。**
                以前ここは `<button className={styles.linkNote}>` で、枠も背景も無い
                小さい灰色の文字だった。押せると分からないうえ、部品を通っていないので
                `--tap-target-min` も当たらず、指で押せる大きさを割っていた。

                `tone` は `secondary`（枠を持つ）。**`quiet` を選ばなかった理由を書く。**
                `quiet` は枠も背景も持たず、押せることを伝えているのは hover の背景だけ
                である。既存の使用箇所 4 件（`improvement-forms` / `inbox-forms` /
                `publish-article-form` / `ui-catalog`）はすべて主ボタンと横に並んでいて、
                隣との対比で「こちらは副」と読める。**ここは単独で、並ぶ相手がいない。**
                触る画面には hover も無い。静止時に押せると分かる必要があるので枠を持たせる。

                **見せ方は増やさない。**`primary` では退出が画面の主役になってしまうが、
                そのために新しい `tone` を作ると、使い道が 1 箇所の見せ方が部品に残る。
                既にある 4 つで足りるなら足さない。
              */}
              <form method="post" action="/api/auth/sign-out">
                <Button type="submit" tone="secondary">
                  ログアウトする
                </Button>
              </form>
            </>
          )}

          <Note>{notice}</Note>

          {/*
            **ここは注記ではない。**中身がリンク 1 本きりで、前後に連れの文が無い。
            `see-also.tsx` の言い方だと「いま見えているものの読み方」ではなく
            「ここには無い、あちらへ行け」である。**13 つ目の形の後始末として
            役B 3 件をまとめて `Note` へ通しかけたが、通す前に 1 件ずつ役を見た**——
            `note.tsx` が「部品化は役を正さない。役を疑う仕事は部品にした後のほうが重い」
            と書いているのは、まさにこの手を止めるためである。
          */}
          <SeeAlso>
            <Link href="/admin">管理画面へ戻る</Link>
          </SeeAlso>
        </SitePage>
      </FocusedTask>
    </PublicShell>
  );
}
