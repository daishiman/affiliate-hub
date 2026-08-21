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
/* 見た目は共通 UI が所有する。ログイン画面専用 CSS は参照が無くなったため削除済み。 */

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
              {/* 見出し階層と見た目は共通部品を正本にする。 */}
              <SectionHeading level={2}>いま誰として動いているか</SectionHeading>
              {/* 列を持つ表ではなく、項目と値の対なので DefinitionList を使う。 */}
              <DefinitionList
                items={[
                  { term: "担当者", description: String(actor.userId) },
                  {
                    term: "役割",
                    description: actor.roles.map((r) => ROLE_LABEL[r as Role]).join("・"),
                  },
                ]}
              />

              {/* 単独の副操作なので、静止時にも押せると分かる枠つきの secondary を使う。 */}
              <form method="post" action="/api/auth/sign-out">
                <Button type="submit" tone="secondary">
                  ログアウトする
                </Button>
              </form>
            </>
          )}

          <Note>{notice}</Note>

          {/* 注記ではなく、別画面への行き先 1 本なので SeeAlso を使う。 */}
          <SeeAlso>
            <Link href="/admin">管理画面へ戻る</Link>
          </SeeAlso>
        </SitePage>
      </FocusedTask>
    </PublicShell>
  );
}
