/** @tier 1 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * 保存先の入口（Repository ポート）が、必ず作業場所（ワークスペース）を伴うことを固定する。
 *
 * この仕組みには「よそのワークスペースのデータを混ぜない」という前提がある。
 * その前提を守っているのは、いまのところ **1 本ずつ手で書かれた引数**だけである。
 * 引数を 1 つ書き忘れた新しいメソッドが 1 本混ざると、
 * そこだけ全ワークスペース横断の読み書きになる。**画面からは何も変わって見えない。**
 *
 * 目で確認し続けることはできないので、ここで宣言そのものを読む。
 * 許す形は 2 つだけで、どちらにも当てはまらないものは
 * **理由を書いて `EXEMPT` に載せない限り落とす**。
 *
 *   形 1: 引数に `workspaceId: WorkspaceId` がある（呼び出し側が作業場所を渡す）
 *   形 2: 引数のどれかが `workspaceId` を持つ実体である
 *         （渡すものが自分で作業場所を知っている）
 *
 * 形 2 は「実体が本当に `workspaceId` を持っているか」を domain 側まで読んで確かめる。
 * 持っていない実体を渡す `save` は、**保存の時点で作業場所が誰にも分からない**。
 * 型の名前が実体らしく見えるかどうかでは判定しない。
 *
 * ここが見ているのは**宣言だけ**である。実際の SQL に workspace_id が付いているか、
 * ユースケースが `assertSameTenant()` を呼んでいるかは別の検査が見る。
 * この検査が緑でも「テナント分離が済んだ」ことにはならない。
 *
 * 規範: docs/product/traceability.md REQ-SEC01 / `src/domain/shared/tenancy.ts`
 * @req REQ-SEC01, REQ-P01
 * @types tenant-isolation, contract
 */

const PORTS_DIR = join(process.cwd(), "src/application/ports");
const DOMAIN_DIR = join(process.cwd(), "src/domain");

/**
 * 作業場所を引数に取らなくてよいもの。**理由を書けないものは載せられない。**
 *
 * ここに足すのは「作業場所という考え方が当てはまらない」ときだけで、
 * 「まだ直していない」を理由にしない。減る方向にしか動かさない。
 */
const EXEMPT: Readonly<Record<string, string>> = {
  // 作業場所そのものを扱うポート。引数の `id` が作業場所の ID である。
  "WorkspaceRepositoryPort.findById": "引数の id が作業場所そのもの",
  "WorkspaceRepositoryPort.findByOwner": "作業場所を持ち主から引く。作業場所を渡せる段階ではない",
  "WorkspaceRepositoryPort.save": "作業場所そのものを保存する",
  "WorkspaceRepositoryPort.countBrands": "引数の id が作業場所そのもの",
  "WorkspaceRepositoryPort.countSites": "引数の id が作業場所そのもの",
  "WorkspaceRepositoryPort.countMembers": "引数の id が作業場所そのもの",
  "WorkspaceRepositoryPort.countGenerationsThisMonth": "引数の id が作業場所そのもの",

  // 読者に見せる公開サイト。ログインの無い読み取りで、URL の名前だけが手がかり。
  "SiteRepositoryPort.findBySlug": "公開サイトを URL の名前から引く。読者に作業場所は無い",
  "SiteRepositoryPort.list": "公開されているサイトの一覧。読者に作業場所は無い",

  // 時刻で起動する処理。全作業場所をまたいで「今出すもの」を集める。
  "PublicationRepositoryPort.listDue":
    "予定時刻の到来した配信を全作業場所から集める。呼ぶのは人ではなく時計",
};

type PortMethod = {
  readonly portName: string;
  readonly methodName: string;
  readonly key: string;
  readonly file: string;
  readonly params: readonly { name: string; typeText: string }[];
};

/** `export type X = {...}` の本文に `workspaceId` があるか、domain 全体を読んで表にする。 */
function domainTypesWithWorkspaceId(): ReadonlySet<string> {
  const found = new Set<string>();
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(join(dir, e.name)) : e.name.endsWith(".ts") ? [join(dir, e.name)] : [],
    );

  for (const file of walk(DOMAIN_DIR)) {
    const src = ts.createSourceFile(
      file,
      readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    ts.forEachChild(src, (node) => {
      if (!ts.isTypeAliasDeclaration(node)) return;
      if (!ts.isTypeLiteralNode(node.type)) return;
      const hasTenant = node.type.members.some(
        (m) => ts.isPropertySignature(m) && m.name?.getText() === "workspaceId",
      );
      if (hasTenant) found.add(node.name.text);
    });
  }
  return found;
}

function collectPorts(): {
  readonly methods: readonly PortMethod[];
  readonly wrappers: readonly { name: string; file: string; targetText: string }[];
} {
  const methods: PortMethod[] = [];
  const wrappers: { name: string; file: string; targetText: string }[] = [];

  for (const fileName of readdirSync(PORTS_DIR).filter((f) => f.endsWith(".ts"))) {
    const path = join(PORTS_DIR, fileName);
    const src = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true);

    ts.forEachChild(src, (node) => {
      if (!ts.isTypeAliasDeclaration(node)) return;
      const portName = node.name.text;
      if (!portName.endsWith("RepositoryPort")) return;

      if (!ts.isTypeLiteralNode(node.type)) {
        wrappers.push({ name: portName, file: fileName, targetText: node.type.getText() });
        return;
      }

      for (const member of node.type.members) {
        if (!ts.isMethodSignature(member)) {
          // プロパティとして関数を持たせると、この検査をすり抜けられてしまう。
          methods.push({
            portName,
            methodName: member.name?.getText() ?? "(名前なし)",
            key: `${portName}.${member.name?.getText() ?? "?"}`,
            file: fileName,
            params: [],
          });
          continue;
        }
        const methodName = member.name.getText();
        methods.push({
          portName,
          methodName,
          key: `${portName}.${methodName}`,
          file: fileName,
          params: member.parameters.map((p) => ({
            name: p.name.getText(),
            typeText: (p.type?.getText() ?? "").replace(/\s+/g, " "),
          })),
        });
      }
    });
  }
  return { methods, wrappers };
}

const TENANT_TYPES = domainTypesWithWorkspaceId();
const { methods: PORT_METHODS, wrappers: PORT_WRAPPERS } = collectPorts();

/** 引数に作業場所そのものを取っている。 */
function takesWorkspaceId(m: PortMethod): boolean {
  return m.params.some((p) => p.name === "workspaceId" && p.typeText === "WorkspaceId");
}

/** 引数のどれかが、作業場所を内側に持つ実体である。 */
function carriesWorkspaceId(m: PortMethod): boolean {
  return m.params.some((p) => TENANT_TYPES.has(p.typeText));
}

function isScoped(m: PortMethod): boolean {
  return takesWorkspaceId(m) || carriesWorkspaceId(m);
}

describe("保存先の入口は、必ず作業場所を伴う", () => {
  it("そもそも読み取れている（0 件なら、この検査は何も見ていない）", () => {
    // 走査に失敗しても「違反 0 件」で緑になる。落ちない検査を置かないための番人。
    expect(PORT_METHODS.length).toBeGreaterThan(80);
    expect(TENANT_TYPES.size).toBeGreaterThan(20);
  });

  it("作業場所を伴わないメソッドは、理由つきで免除されたものだけ", () => {
    const unscoped = PORT_METHODS.filter((m) => !isScoped(m) && EXEMPT[m.key] === undefined).map(
      (m) => `${m.file}: ${m.key}(${m.params.map((p) => `${p.name}: ${p.typeText}`).join(", ")})`,
    );
    expect(
      unscoped,
      "作業場所を渡さない入口が増えています。引数に workspaceId を足すか、EXEMPT へ理由を書いてください。",
    ).toEqual([]);
  });

  it("免除の一覧に、もう要らないものが残っていない", () => {
    // 直したのに免除が残ると、次に同じ穴が開いても検査が通ってしまう。
    const stale = Object.keys(EXEMPT).filter((key) => {
      const m = PORT_METHODS.find((x) => x.key === key);
      return m === undefined || isScoped(m);
    });
    expect(stale, "免除が実態と合っていません。直したものは EXEMPT から消してください。").toEqual(
      [],
    );
  });

  it("免除には必ず理由が書いてある", () => {
    const empty = Object.entries(EXEMPT)
      .filter(([, reason]) => reason.trim() === "")
      .map(([key]) => key);
    expect(empty).toEqual([]);
  });

  it("実体を渡すだけで済ませている入口は、その型が本当に作業場所を持っている", () => {
    // 「実体を渡しているから大丈夫」で通すと、workspaceId を持たない型が黙って抜ける。
    // 実際にここで 1 件見つかった（ScoreCardRepositoryPort.save / EditorialScoreCard）。
    const byEntity = PORT_METHODS.filter(
      (m) => !takesWorkspaceId(m) && EXEMPT[m.key] === undefined,
    );
    const missing = byEntity
      .filter((m) => !carriesWorkspaceId(m))
      .map((m) => `${m.key}(${m.params.map((p) => p.typeText).join(", ")})`);
    expect(
      missing,
      "渡している型に workspaceId がありません。保存の時点で作業場所が分かりません。",
    ).toEqual([]);
    expect(byEntity.length).toBeGreaterThan(10);
  });

  it("印つきの別名（Editorial / Commercial）は、素のポートを包んだものだけ", () => {
    // 型リテラルを書かずに別名で宣言すれば、上の検査を全部すり抜けられる。
    const portNames = new Set(PORT_METHODS.map((m) => m.portName));
    const bad = PORT_WRAPPERS.filter((w) => {
      const match = /^(?:Editorial|Commercial)<\s*([A-Za-z0-9_]+)\s*>$/.exec(w.targetText);
      return match === null || !portNames.has(match[1]!);
    }).map((w) => `${w.file}: ${w.name} = ${w.targetText}`);
    expect(bad, "検査済みのポートを包んだ形になっていません。").toEqual([]);
    expect(PORT_WRAPPERS.length).toBeGreaterThan(5);
  });
});
