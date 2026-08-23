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
import { Callout, Card, DataTable, Page, SectionHeading, StubLabel } from "@/presentation/ui";
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
  const catalog = (await createToolCatalog());
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
          <SectionHeading level={2}>面ごとの内訳</SectionHeading>
          <DataTable
            caption="仕様書 §24.1（ページ内AI）・§24.3（外部AI）で決めた道具の数"
            columns={[
              { key: "surface", header: "面", rowHeader: true, cell: (s) => s.label },
              {
                key: "implemented",
                header: "動くもの",
                align: "numeric",
                cell: (s) => s.implemented,
              },
              { key: "total", header: "仕様の数", align: "numeric", cell: (s) => s.total },
            ]}
            rows={coverage.bySurface}
            rowKey={(s) => s.surface}
          />
        </Card>

        {surfaces.map((surface) => (
          <Card key={surface}>
            <SectionHeading level={2}>{SURFACE_LABELS[surface]}</SectionHeading>
            <DataTable
              caption={`${SURFACE_LABELS[surface]}から呼べる道具`}
              columns={[
                {
                  key: "specName",
                  header: "仕様書の名前",
                  rowHeader: true,
                  cell: (e) => <code>{e.specName}</code>,
                },
                { key: "purpose", header: "何をするか", cell: (e) => e.purpose },
                {
                  key: "state",
                  header: "状態",
                  cell: (e) =>
                    e.implementedBy === null ? (
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
                    ),
                },
              ]}
              rows={TOOL_CONTRACT.filter((e) => e.surface === surface)}
              rowKey={(e) => `${surface}:${e.specName}`}
            />
          </Card>
        ))}

        <Card>
          <SectionHeading level={2}>外部AI が読める場所（{MCP_RESOURCES.length}件）</SectionHeading>
          <p className={styles.sectionLead}>
            読める場所は新しい処理ではありません。中身は必ず下の道具から取ります。別に読み出しを書くと、道具経由と場所経由で違う内容が返る余地ができます。
          </p>
          <DataTable
            caption="外部AI が読める場所と、その中身を取ってくる道具の対応"
            columns={[
              {
                key: "uriTemplate",
                header: "場所",
                rowHeader: true,
                cell: (r) => <code>{r.uriTemplate}</code>,
              },
              { key: "description", header: "中身", cell: (r) => r.description },
              {
                key: "backedBy",
                header: "取ってくる道具",
                cell: (r) => (
                  <>
                    <code>{r.backedBy}</code>
                    {findTool(catalog, r.backedBy) === null ? <StubLabel /> : null}
                  </>
                ),
              },
            ]}
            rows={MCP_RESOURCES}
            rowKey={(r) => r.uriTemplate}
          />
        </Card>

        <Card>
          <SectionHeading level={2}>いま登録されている道具（{catalog.length}件）</SectionHeading>
          <p className={styles.sectionLead}>
            このうち読み取り専用のものだけが、ページを開いている AI へ渡ります。状態を変えるものは渡しません。
          </p>
          <DataTable
            caption="いま登録されている道具と、その扱い方"
            columns={[
              {
                key: "name",
                header: "名前",
                rowHeader: true,
                cell: (t) => <code>{t.name}</code>,
              },
              {
                key: "readOnly",
                header: "読み取り専用か",
                cell: (t) => (t.readOnly ? "読み取りだけ" : "状態を変えます"),
              },
              {
                key: "approval",
                header: "人の操作が要るか",
                cell: (t) => (t.requiresHumanApproval ? "人が行います" : "AI からも実行できます"),
              },
            ]}
            rows={[...catalog].sort((a, b) => a.name.localeCompare(b.name))}
            rowKey={(t) => t.name}
          />
        </Card>
      </Page>
    </AdminShell>
  );
}
