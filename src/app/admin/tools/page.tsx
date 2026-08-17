import Link from "next/link";
import { AdminShell } from "@/presentation/admin/admin-shell";
import { createToolCatalog } from "@/presentation/composition";
import { findTool } from "@/presentation/tools/catalog";
import {
  MCP_RESOURCES,
  SURFACE_LABELS,
  TOOL_CONTRACT,
  type ContractSurface,
  contractCoverage,
} from "@/presentation/tools/spec-contract";
import { Callout, Card, Page, StubLabel } from "@/presentation/ui";
import styles from "../admin.module.css";

export const dynamic = "force-dynamic";

/**
 * AI から使える道具の一覧と、仕様書の道具名との対応。
 *
 * この画面が要るのは、道具が「画面には無いが AI からは使える」ものになりやすいため。
 * 一覧を人が見られる場所に出しておかないと、
 * 何が動いていて何がまだ見本なのかを、コードを読まないと判断できなくなる。
 *
 * 数字は `contractCoverage()` から取る。この画面用に数え直さない。
 */
export default async function ToolsPage() {
  const catalog = createToolCatalog();
  const coverage = contractCoverage();
  const surfaces = Object.keys(SURFACE_LABELS) as ContractSurface[];

  return (
    <AdminShell
      currentPath="/admin/tools"
      breadcrumbs={[{ label: "ホーム", href: "/admin" }, { label: "AI から使える道具" }]}
      actions={<Link href="/admin">ホームへ戻る</Link>}
    >
      <Page
        title="AI から使える道具"
        lead="画面・REST・ページ内AI・外部AI の 4 つの入口は、すべてこの一覧の同じ処理を呼びます。入口ごとに別の処理は持ちません。"
      >
        <Callout
          tone="info"
          title={`仕様書に書かれた ${coverage.total} 個のうち ${coverage.implemented} 個が動きます`}
          reason="残りは見本（スタブ）です。名前を一覧から消さずに残しているのは、何が足りないかを数えられるようにするためです。"
        />

        <Card>
          <h2 className={styles.sectionTitle}>面ごとの内訳</h2>
          <table className={styles.rankTable}>
            <caption>仕様書 §24.1（ページ内AI）・§24.3（外部AI）で決めた道具の数</caption>
            <thead>
              <tr>
                <th scope="col">面</th>
                <th scope="col">動くもの</th>
                <th scope="col">仕様の数</th>
              </tr>
            </thead>
            <tbody>
              {coverage.bySurface.map((s) => (
                <tr key={s.surface}>
                  <th scope="row">{s.label}</th>
                  <td className={styles.numeric}>{s.implemented}</td>
                  <td className={styles.numeric}>{s.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        {surfaces.map((surface) => (
          <Card key={surface}>
            <h2 className={styles.sectionTitle}>{SURFACE_LABELS[surface]}</h2>
            <table className={styles.rankTable}>
              <thead>
                <tr>
                  <th scope="col">仕様書の名前</th>
                  <th scope="col">何をするか</th>
                  <th scope="col">状態</th>
                </tr>
              </thead>
              <tbody>
                {TOOL_CONTRACT.filter((e) => e.surface === surface).map((e) => (
                  <tr key={`${surface}:${e.specName}`}>
                    <th scope="row">
                      <code>{e.specName}</code>
                    </th>
                    <td>{e.purpose}</td>
                    <td>
                      {e.implementedBy === null ? (
                        <>
                          <StubLabel stubId={`tool:${e.specName}`} />
                          <span className={styles.linkNote}>{e.stubReason}</span>
                        </>
                      ) : e.implementedBy === e.specName ? (
                        "動きます"
                      ) : (
                        <>
                          動きます
                          <span className={styles.linkNote}>
                            中身は <code>{e.implementedBy}</code> と同じものです
                          </span>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        ))}

        <Card>
          <h2 className={styles.sectionTitle}>外部AI が読める場所（{MCP_RESOURCES.length}件）</h2>
          <p className={styles.sectionLead}>
            読める場所は新しい処理ではありません。中身は必ず下の道具から取ります。別に読み出しを書くと、道具経由と場所経由で違う内容が返る余地ができます。
          </p>
          <table className={styles.rankTable}>
            <thead>
              <tr>
                <th scope="col">場所</th>
                <th scope="col">中身</th>
                <th scope="col">取ってくる道具</th>
              </tr>
            </thead>
            <tbody>
              {MCP_RESOURCES.map((r) => (
                <tr key={r.uriTemplate}>
                  <th scope="row">
                    <code>{r.uriTemplate}</code>
                  </th>
                  <td>{r.description}</td>
                  <td>
                    <code>{r.backedBy}</code>
                    {findTool(catalog, r.backedBy) === null ? <StubLabel /> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card>
          <h2 className={styles.sectionTitle}>いま登録されている道具（{catalog.length}件）</h2>
          <p className={styles.sectionLead}>
            このうち読み取り専用のものだけが、ページを開いている AI へ渡ります。状態を変えるものは渡しません。
          </p>
          <table className={styles.rankTable}>
            <thead>
              <tr>
                <th scope="col">名前</th>
                <th scope="col">読み取り専用か</th>
                <th scope="col">人の操作が要るか</th>
              </tr>
            </thead>
            <tbody>
              {[...catalog]
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((t) => (
                  <tr key={t.name}>
                    <th scope="row">
                      <code>{t.name}</code>
                    </th>
                    <td>{t.readOnly ? "読み取りだけ" : "状態を変えます"}</td>
                    <td>{t.requiresHumanApproval ? "人が行います" : "AI からも実行できます"}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </Card>
      </Page>
    </AdminShell>
  );
}
