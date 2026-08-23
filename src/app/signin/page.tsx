import { ROLE_LABEL } from "@/application/usecases/identity/manage-workspace";
import { authAvailability } from "@/infrastructure/identity/better-auth";
import type { Role } from "@/domain/shared";
import { actorNotice, signedInActor } from "@/presentation/composition";
import {
  ActionButton,
  Callout,
  FactList,
  Note,
  PublicShell,
  Section,
  SitePage,
  TextLink,
} from "@/presentation/ui";
import { GoogleSignInButton } from "./google-signin-button";

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
          <Section title="いま誰として動いているか">
            <FactList
              rows={[
                { key: "user", label: "担当者", value: String(actor.userId) },
                {
                  key: "roles",
                  label: "役割",
                  value: actor.roles.map((r) => ROLE_LABEL[r as Role]).join("・"),
                },
              ]}
            />
            {/* 出る操作は身元の隣に置く。設定の奥に隠すと、別人のまま操作が続く。 */}
            <ActionButton
              action="/api/auth/sign-out"
              label="ログアウトする"
              tone="quiet"
              reason={
                "ログアウトは、いま画面を見ている人の在席そのものを終わらせる操作である。" +
                "AI から呼べると、AI が人を締め出せる。締め出された側には" +
                "「押していないのにログイン画面へ戻された」としか見えず、原因を確かめる手段が無い。"
              }
            />
          </Section>
        )}

        <Note>{notice}</Note>

        <Note>
          <TextLink href="/admin">管理画面へ戻る</TextLink>
        </Note>
      </SitePage>
    </PublicShell>
  );
}
