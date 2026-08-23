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
import {
  Callout,
  Code,
  DataTable,
  Note,
  Section,
  StubLabel,
  TextLink,
} from "@/presentation/ui";

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
  const catalog = await createToolCatalog();
  const coverage = contractCoverage();
  const surfaces = Object.keys(SURFACE_LABELS) as ContractSurface[];

  return (
    <AdminShell
      routeId="tools"
      title="AI から使える道具"
      lead="4 つの入口が共通で呼ぶ処理の一覧です。"
      actions={<TextLink href="/admin">ホームへ戻る</TextLink>}
    >
      <Callout
        tone="info"
        title={`仕様書に書かれた ${coverage.total} 個のうち ${coverage.implemented} 個が動きます`}
        reason="残りは見本（スタブ）です。名前を一覧から消さずに残しているのは、何が足りないかを数えられるようにするためです。"
      />

      <Section title="面ごとの内訳">
        <DataTable
          caption="仕様書 §24.1（ページ内AI）・§24.3（外部AI）で決めた道具の数"
          columns={[
            { key: "surface", label: "面" },
            { key: "implemented", label: "動くもの", numeric: true },
            { key: "total", label: "仕様の数", numeric: true },
          ]}
          rows={coverage.bySurface.map((s) => ({
            key: s.surface,
            cells: [s.label, s.implemented, s.total],
          }))}
        />
      </Section>

      {surfaces.map((surface) => (
        <Section key={surface} title={SURFACE_LABELS[surface]}>
          <DataTable
            caption={`${SURFACE_LABELS[surface]}の道具と、いまの状態`}
            columns={[
              { key: "spec", label: "仕様書の名前" },
              { key: "purpose", label: "何をするか" },
              { key: "state", label: "状態" },
            ]}
            rows={TOOL_CONTRACT.filter((e) => e.surface === surface).map((e) => ({
              key: `${surface}:${e.specName}`,
              cells: [
                <Code key="spec">{e.specName}</Code>,
                e.purpose,
                e.implementedBy === null ? (
                  <>
                    <StubLabel stubId={`tool:${e.specName}`} />
                    <Note>{e.stubReason}</Note>
                  </>
                ) : e.implementedBy === e.specName ? (
                  "動きます"
                ) : (
                  <>
                    動きます
                    <Note>
                      中身は <Code>{e.implementedBy}</Code> と同じものです
                    </Note>
                  </>
                ),
              ],
            }))}
          />
        </Section>
      ))}

      <Section
        title={`外部AI が読める場所（${MCP_RESOURCES.length}件）`}
        lead="読める場所は新しい処理ではありません。中身は必ず下の道具から取ります。別に読み出しを書くと、道具経由と場所経由で違う内容が返る余地ができます。"
      >
        <DataTable
          caption="読める場所と、その中身を取ってくる道具"
          columns={[
            { key: "uri", label: "場所" },
            { key: "description", label: "中身" },
            { key: "backedBy", label: "取ってくる道具" },
          ]}
          rows={MCP_RESOURCES.map((r) => ({
            key: r.uriTemplate,
            cells: [
              <Code key="uri">{r.uriTemplate}</Code>,
              r.description,
              <>
                <Code>{r.backedBy}</Code>
                {findTool(catalog, r.backedBy) === null ? <StubLabel /> : null}
              </>,
            ],
          }))}
        />
      </Section>

      <Section
        title={`いま登録されている道具（${catalog.length}件）`}
        lead="このうち読み取り専用のものだけが、ページを開いている AI へ渡ります。状態を変えるものは渡しません。"
      >
        <DataTable
          caption="登録されている道具と、それぞれの扱い"
          columns={[
            { key: "name", label: "名前" },
            { key: "readOnly", label: "読み取り専用か" },
            { key: "approval", label: "人の操作が要るか" },
          ]}
          rows={[...catalog]
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((t) => ({
              key: t.name,
              cells: [
                <Code key="name">{t.name}</Code>,
                t.readOnly ? "読み取りだけ" : "状態を変えます",
                t.requiresHumanApproval ? "人が行います" : "AI からも実行できます",
              ],
            }))}
        />
      </Section>
    </AdminShell>
  );
}
