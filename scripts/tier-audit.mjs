/**
 * 段の指定漏れを見つけて落とす。
 *
 * **これがこの仕組みで一番大事な検査である。**
 * 段で絞って走らせる以上、どの段にも属さないテストは
 * **どこでも走らないまま緑になる**。テストが 1 つ増えるたびに
 * 静かに穴が開くので、機械が気づく場所をここに 1 つ置く。
 *
 * ディレクトリ既定（`tests/domain/` は自動で 1 段、など）を作っていないのも同じ理由で、
 * 既定があると新しいファイルが黙って段を持ち、この検査は永久に発火しない。
 *
 * 規範: docs/spec/11-CI-CD・品質ゲート仕様.md §8
 */

import { TIERS, TIER_IDS } from "../quality-gates.config.mjs";
import { scanTiers } from "./tier-scan.mjs";

const LABEL = {
  missing: "段の印が無い",
  unknown: "知らない段の番号",
  duplicate: "段の印が 2 つ以上ある",
};

const files = scanTiers();
const bad = files.filter((f) => f.problem !== null);

if (bad.length > 0) {
  console.error(`段の指定に問題のあるテストが ${bad.length} 件あります。\n`);
  for (const f of bad) {
    const found = f.found.length > 0 ? `（見つかった印: ${f.found.join(", ")}）` : "";
    console.error(`  NG ${f.path}\n     ${LABEL[f.problem]}${found}`);
  }
  console.error("\nファイルの先頭に、次のどれか 1 行を書いてください:");
  for (const t of TIERS) {
    console.error(`   * @tier ${t.id}   ${t.label}: ${t.contains}`);
  }
  console.error("\n印が無いテストは、どの段でも走りません。");
  console.error("**印を書かずにこの検査を外して緑にすることを禁じます。**");
  process.exit(1);
}

const counts = TIER_IDS.map((id) => `${id} 段 ${files.filter((f) => f.tier === id).length} 件`);
console.log(`OK 段の指定漏れなし（${files.length} 件: ${counts.join(" / ")}）`);
