/**
 * @tier 1
 * @req REQ-WC04
 *
 * **`readOnly` が事実と合っているかを、旗ではなく実行で見る。**
 *
 * 「`readOnly: false` の道具が `PAGE_TOOLS` に載っていないこと」は、
 * すでに 3 か所が見ている（`webmcp-policy.test.ts` の 2 本と
 * `tool-catalog-adapters.test.ts` の「WebMCP には読み取り専用だけを」）。
 * **4 本目を足しても守りは増えない。**
 *
 * 増えないどころか、その 3 本は今回の穴を素通りした。
 * `export_manual_draft` は記事の本文を人へ丸ごと渡すのに
 * `readOnly: true` を名乗っており、**旗が嘘だったので、
 * 旗を読む検査は 3 本とも緑のままだった。**
 * ページ内の AI がその道具を握れて、痕跡はどこにも残らなかった。
 *
 * **旗を読む検査は、旗が嘘のときには守りにならない。**
 * ここは旗を信じず、`readOnly` を名乗る道具を**実際に動かして**、
 * 記録の口（`auditLog.append`）へ手が伸びないことを見る。
 * 記録を書くなら状態を変えているので、`readOnly` は事実と違う。
 *
 * **なぜ既存の正常系では足りないか。** あの穴が見つかったのは、
 * 記録を足したら `tool-catalog-adapters` の正常系が落ちたからである。
 * ただしあれが落ちたのは、見本の `auditLog.append` が
 * **いつも失敗を返すスタブだから**であって、記録が書けたことを
 * 見ていたわけではない。**記録が成功するようになった日に、あの守りは消える。**
 * ここは成否を見ないので、その日も残る。
 */
import { describe, expect, it } from "vitest";
import type { ActorContext } from "@/domain/shared";
import { createDeps } from "@/infrastructure/composition";
import { SAMPLE_ACTOR } from "@/infrastructure/identity/sample-actor";
import { buildToolCatalog } from "@/presentation/tools/catalog";
import { invokeTool } from "@/presentation/tools/tool-definition";
import { NO_HAPPY_PATH, validInputFor } from "./tool-inputs";

const OWNER: ActorContext = { ...SAMPLE_ACTOR, roles: ["owner", ...SAMPLE_ACTOR.roles] };

/** どの道具の実行中に記録の口が呼ばれたか。 */
const reached: string[] = [];
/** いま動かしている道具。包んだ `append` から見えるようにする。 */
let running: string | null = null;

const deps = createDeps();
const spied = {
  ...deps,
  auditLog: {
    ...deps.auditLog,
    append: (entry: Parameters<typeof deps.auditLog.append>[0]) => {
      if (running !== null) reached.push(`${running} → ${entry.action}`);
      return deps.auditLog.append(entry);
    },
  },
};

const catalog = buildToolCatalog(spied);
/**
 * 見るのは「読み取り専用を名乗る道具」だけである。
 * `readOnly: false` の道具が記録を書くのは正しい姿なので、ここでは見ない。
 *
 * 入力の見本が無い道具（`NO_HAPPY_PATH`）は動かせないので外す。
 * **外した分は守られていない**ので、下で件数を表明して目に見えるようにする。
 */
const claimed = catalog.filter((t) => t.readOnly && NO_HAPPY_PATH[t.name] === undefined);

describe("readOnly を名乗る道具が、本当に何も変えていないか", () => {
  it("記録の口へ手が伸びない", async () => {
    for (const tool of claimed) {
      running = tool.name;
      // 成否は見ない。**断られても、断られる前に記録を書いていれば赤にする。**
      await invokeTool(tool, OWNER, validInputFor(tool)!);
      running = null;
    }

    expect(
      reached,
      "readOnly: true を名乗っている道具が、記録を書いています（旗が事実と違います）",
    ).toEqual([]);
  });

  it("動かせた道具が十分にある（全部が入力不足で素通りしていない）", () => {
    // これが無いと、`validInputFor` が壊れて全件が入口で弾かれた日に、
    // **上の検査は 0 件を回して緑になる。**
    expect(claimed.length).toBeGreaterThan(20);
  });
});
