import { LLM_KEY_SHOWN_ONCE_TEXT } from "@/application/usecases/generation/manage-llm-credentials";
import { AdminShell } from "@/presentation/admin/admin-shell";
import {
  RegisterLlmKeyForm,
  RevokeLlmKeyForm,
  VerifyLlmKeyForm,
} from "@/presentation/admin/maintain/llm-credential-form";
import { currentActor, llmCredentialEntry } from "@/presentation/composition";
import {
  ActionNote,
  Callout,
  DataTable,
  EmptyView,
  ErrorView,
  ExternalLink,
  ListView,
  Note,
  Section,
  TextLink,
} from "@/presentation/ui";

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

  return (
    <AdminShell
      routeId="settings/llm"
      title="生成 AI の API キー"
      lead="記事を書かせる鍵を登録します。"
      actions={<TextLink href="/admin/settings">設定へ戻る</TextLink>}
    >
      {!entry.ready ? (
        <>
          <Callout tone="warn" title="いま API キーを預かれません" reason={entry.reason} />
          <Section title="鍵を発行できる場所">
            {entry.providers.length === 0 ? (
              <EmptyView
                title="提供元の設定が入っていません"
                body="使える提供元は LLM_PROVIDER_CATALOG から読みます。設定が入るとここに並びます。"
              />
            ) : (
              <ListView
                rows={entry.providers.map((p) => ({
                  key: p.providerId,
                  label:
                    p.keyIssueUrl === "" ? (
                      p.label
                    ) : (
                      <>
                        {p.label}
                        {" — "}
                        <ExternalLink href={p.keyIssueUrl}>鍵を発行する</ExternalLink>
                      </>
                    ),
                }))}
              />
            )}
            <Note>
              先に鍵を取っておいても構いません。上の理由が解消されたあと、この画面から登録できます。
            </Note>
          </Section>
        </>
      ) : (
        <LlmCredentialManager entry={entry} />
      )}
    </AdminShell>
  );
}

/** 鍵を預かれる状態の入口。`ready: true` の枝だけを取り出す。 */
type ReadyEntry = Extract<Awaited<ReturnType<typeof llmCredentialEntry>>, { readonly ready: true }>;

/**
 * 提供元ごとの状態と、登録・確認・失効の口。
 *
 * 表と操作を分けている。表は「いまどうなっているか」を横断で見る物で、
 * 操作は提供元 1 つに閉じる。混ぜると、直したい提供元の欄を探して
 * 横に長い表を目で追うことになる。
 */
async function LlmCredentialManager({ entry }: { readonly entry: ReadyEntry }) {
  const actor = await currentActor();
  const listed = await entry.manage.execute(actor, { action: "list" });

  if (!listed.ok) {
    return (
      <ErrorView
        title="API キーの状態を出せませんでした"
        body={listed.error.message}
        suggestedAction={listed.error.suggestedAction ?? null}
        action={<TextLink href="/admin/settings">設定へ戻る</TextLink>}
      />
    );
  }

  const { rows, emptyReason } = listed.value;

  return (
    <>
      <Callout
        tone="warn"
        title="登録した鍵は二度と表示されません"
        reason={LLM_KEY_SHOWN_ONCE_TEXT}
      />

      <Section title="提供元ごとの状態">
        {rows.length === 0 ? (
          <EmptyView
            title="使える提供元がありません"
            body={emptyReason ?? "提供元の設定が入るとここに並びます。"}
          />
        ) : (
          <DataTable
            caption="出ているのは末尾 4 文字だけです。鍵の値そのものは、この画面のどこにも渡していません。"
            columns={[
              { key: "provider", label: "提供元" },
              { key: "key", label: "鍵" },
              { key: "state", label: "状態" },
              { key: "verified", label: "最後に確かめた日" },
              { key: "models", label: "選べるモデル", numeric: true },
            ]}
            rows={rows.map((r) => ({
              key: r.providerId,
              cells: [
                r.required ? `${r.label}（必須）` : r.label,
                r.credential === null ? "未登録" : `末尾 ${r.credential.last4}`,
                // 「使えない理由」を状態の欄に出す。別の欄に分けると、
                // 表を横に読まないと理由に行き着かない。
                r.unavailableReason ?? "使えます",
                r.credential?.lastVerifiedAt == null
                  ? "確かめていません"
                  : `${r.credential.lastVerifiedAt.toLocaleString("ja-JP")}（${
                      r.credential.lastVerification === "ok" ? "つながりました" : "失敗しました"
                    }）`,
                r.models.length,
              ],
            }))}
          />
        )}
      </Section>

      {rows.map((r) => (
        <Section key={`ops-${r.providerId}`} title={r.label}>
          {r.unavailableReason !== null && (
            <ActionNote>いまは使えません。{r.unavailableReason}</ActionNote>
          )}

          {/*
            モデルが 0 件のときは登録の口を出さない。
            登録できても呼べる先が無く、「入れたのに何も起きない」で終わるため。
          */}
          {r.models.length === 0 ? (
            <Note>
              選べるモデルが無いため、いまは登録できません。管理者が LLM_PROVIDER_CATALOG
              を設定すると、ここに登録の欄が出ます。
            </Note>
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
        </Section>
      ))}
    </>
  );
}
