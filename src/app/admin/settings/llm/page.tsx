import Link from "next/link";
import type { ReactNode } from "react";
import { AdminShell } from "@/presentation/admin/admin-shell";
import {
  RegisterLlmKeyForm,
  RevokeLlmKeyForm,
  VerifyLlmKeyForm,
} from "@/presentation/admin/llm-credential-form";
import { LLM_KEY_SHOWN_ONCE_TEXT } from "@/application/usecases/generation/manage-llm-credentials";
import { currentActor, llmCredentialEntry } from "@/presentation/composition";
import { Callout, Card, EmptyView, ErrorView, Page } from "@/presentation/ui";
import styles from "../../admin.module.css";

export const dynamic = "force-dynamic";

/**
 * 生成 AI の API キー。
 *
 * --- 使えないときこそ、この画面を出す ---
 * 保存先が無い・元締めの鍵が無い、といった理由で預かれないときも、
 * **画面ごと消さない**。消すと、利用者には「メニューに無い＝機能が無い」に見え、
 * 何をすれば使えるようになるのかが誰にも分からなくなる。
 * 出すのは理由 1 行と、鍵の発行元への案内までである（登録の口は出さない）。
 *
 * --- 値はここに戻ってこない ---
 * 一覧に出るのは末尾 4 文字だけである。「見せない」ではなく、
 * 画面へ値を渡す型が存在しない（`LlmCredentialSummary` に値の欄が無い）。
 */
export default async function LlmCredentialSettingsPage() {
  const entry = await llmCredentialEntry();

  // --- 預かれない状態 -----------------------------------------------------
  if (!entry.ready) {
    return (
      <Shell>
        <Callout tone="warn" title="いま API キーを預かれません" reason={entry.reason} />
        <Card>
          <h2 className={styles.sectionTitle}>鍵を発行できる場所</h2>
          {entry.providers.length === 0 ? (
            <EmptyView
              title="提供元の設定が入っていません"
              body="使える提供元は LLM_PROVIDER_CATALOG から読みます。設定が入るとここに並びます。"
            />
          ) : (
            <ul className={styles.linkList}>
              {entry.providers.map((p) => (
                <li key={p.providerId}>
                  {p.label}
                  {p.keyIssueUrl === "" ? null : (
                    <>
                      {" — "}
                      <a href={p.keyIssueUrl} rel="noreferrer noopener" target="_blank">
                        鍵を発行する
                      </a>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
          <p className={styles.linkNote}>
            先に鍵を取っておいても構いません。上の理由が解消されたあと、この画面から登録できます。
          </p>
        </Card>
      </Shell>
    );
  }

  // --- 預かれる状態 -------------------------------------------------------
  const actor = await currentActor();
  const listed = await entry.manage.execute(actor, { action: "list" });

  if (!listed.ok) {
    return (
      <Shell>
        <ErrorView
          title="API キーの状態を出せませんでした"
          body={listed.error.message}
          suggestedAction={listed.error.suggestedAction ?? null}
          action={<Link href="/admin/settings">設定へ戻る</Link>}
        />
      </Shell>
    );
  }

  const { rows, emptyReason } = listed.value;

  return (
    <Shell>
      <Callout tone="warn" title="登録した鍵は二度と表示されません" reason={LLM_KEY_SHOWN_ONCE_TEXT} />

      <Card>
        <h2 className={styles.sectionTitle}>提供元ごとの状態</h2>
        {rows.length === 0 ? (
          <EmptyView
            title="使える提供元がありません"
            body={emptyReason ?? "提供元の設定が入るとここに並びます。"}
          />
        ) : (
          <table className={styles.rankTable}>
            <caption>
              出ているのは末尾 4 文字だけです。鍵の値そのものは、この画面のどこにも渡していません。
            </caption>
            <thead>
              <tr>
                <th scope="col">提供元</th>
                <th scope="col">鍵</th>
                <th scope="col">状態</th>
                <th scope="col">最後に確かめた日</th>
                <th scope="col">選べるモデル</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.providerId}>
                  <th scope="row">
                    {r.label}
                    {r.required && <span className={styles.linkNote}>（必須）</span>}
                  </th>
                  <td>{r.credential === null ? "未登録" : `末尾 ${r.credential.last4}`}</td>
                  {/*
                    「使えない理由」を状態の欄に出す。別の欄に分けると、
                    表を横に読まないと理由に行き着かない。
                  */}
                  <td>{r.unavailableReason ?? "使えます"}</td>
                  <td>
                    {r.credential?.lastVerifiedAt == null
                      ? "確かめていません"
                      : `${r.credential.lastVerifiedAt.toLocaleString("ja-JP")}（${
                          r.credential.lastVerification === "ok" ? "つながりました" : "失敗しました"
                        }）`}
                  </td>
                  <td className={styles.numeric}>{r.models.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {rows.map((r) => (
        <Card key={`ops-${r.providerId}`}>
          <h2 className={styles.sectionTitle}>{r.label}</h2>
          {r.unavailableReason !== null && (
            <Callout tone="info" title="いまは使えません" reason={r.unavailableReason} />
          )}

          {/*
            モデルが 0 件のときは登録の口を出さない。
            登録できても呼べる先が無く、「入れたのに何も起きない」で終わるため。
          */}
          {r.models.length === 0 ? (
            <p className={styles.linkNote}>
              選べるモデルが無いため、いまは登録できません。管理者が LLM_PROVIDER_CATALOG
              を設定すると、ここに登録の欄が出ます。
            </p>
          ) : (
            <>
              <RegisterLlmKeyForm
                providerId={r.providerId}
                label={r.label}
                keyIssueUrl={r.keyIssueUrl}
              />
              {r.credential !== null && r.credential.status === "active" && (
                <>
                  <VerifyLlmKeyForm
                    providerId={r.providerId}
                    label={r.label}
                    models={r.models.map((m) => ({ modelId: m.modelId, label: m.label }))}
                  />
                  <RevokeLlmKeyForm providerId={r.providerId} label={r.label} />
                </>
              )}
            </>
          )}
        </Card>
      ))}
    </Shell>
  );
}

function Shell({ children }: { readonly children: ReactNode }) {
  return (
    <AdminShell
      currentPath="/admin/settings/llm"
      breadcrumbs={[
        { label: "ホーム", href: "/admin" },
        { label: "設定", href: "/admin/settings" },
        { label: "生成 AI の API キー" },
      ]}
      actions={<Link href="/admin/settings">設定へ戻る</Link>}
    >
      <Page
        title="生成 AI の API キー"
        lead="記事を書かせるために使う API キーを登録する画面です。登録した値は包んで保管し、この先どこにも表示しません。"
      >
        {children}
      </Page>
    </AdminShell>
  );
}
